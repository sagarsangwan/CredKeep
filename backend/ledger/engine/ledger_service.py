import uuid
from decimal import Decimal
from typing import Dict, Any, Optional
from django.db import transaction, models
from django.core.exceptions import ValidationError
from ledger.models import LoanAccount, Kist, Transaction as LedgerTx, SyncOutbox
from .allocation import (
    KistAllocationState,
    AllocationInput,
    allocate_payment,
    AllocationResult,
)
from .penalty import (
    PenaltyRule,
    OverdueKist,
    LoanPenaltyState,
    calculate_new_penalties,
)
from .schedule import calculate_next_due_date

def extend_bullet_schedule_if_needed(loan: LoanAccount, current_date_str: str) -> None:
    """
    Extends schedule month-by-month for bullet loans whose last installment has passed.
    """
    if loan.product_type != 'bullet' or loan.status != 'ACTIVE':
        return

    kists = list(loan.schedules.all().order_by('installment_number'))
    if not kists:
        return

    last_kist = kists[-1]
    last_due_date_str = last_kist.effective_due_date.strftime("%Y-%m-%d")

    if last_due_date_str < current_date_str:
        total_markup = int(round(Decimal(loan.principal_paise) * loan.markup_factor))
        markup_due_per_month = total_markup // loan.term_months

        next_installment_number = last_kist.installment_number + 1
        months_to_add = next_installment_number
        start_date_str = loan.start_date.strftime("%Y-%m-%d")
        next_due_date = calculate_next_due_date(start_date_str, months_to_add, loan.due_day)

        while next_due_date <= current_date_str or next_installment_number == last_kist.installment_number + 1:
            Kist.objects.create(
                tenant=loan.tenant,
                loan=loan,
                installment_number=next_installment_number,
                original_due_date=next_due_date,
                effective_due_date=next_due_date,
                principal_component_paise=0,
                markup_component_paise=markup_due_per_month,
                total_due_paise=markup_due_per_month,
                status='PENDING'
            )

            if next_due_date > current_date_str:
                break

            next_installment_number += 1
            months_to_add += 1
            next_due_date = calculate_next_due_date(start_date_str, months_to_add, loan.due_day)


def assess_penalties(loan: LoanAccount, current_date_str: str) -> int:
    """
    Assesses late penalties up to current_date_str and writes PENALTY_ASSESSMENT transactions.
    Returns total newly assessed penalty in Paise.
    """
    if loan.status != 'ACTIVE':
        return 0

    extend_bullet_schedule_if_needed(loan, current_date_str)

    kists = loan.schedules.all().order_by('installment_number')
    existing_assessments = (
        LedgerTx.objects
        .filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
        .values_list('effective_date', flat=True)
    )
    assessed_dates = {d.strftime("%Y-%m-%d") for d in existing_assessments}

    overdue_kists = [
        OverdueKist(
            kist_number=k.installment_number,
            due_date=k.effective_due_date.strftime("%Y-%m-%d"),
            amount_due=k.total_due_paise,
            amount_paid=k.principal_paid_paise + k.markup_paid_paise,
            is_fully_paid=(k.status == 'PAID')
        )
        for k in kists
    ]

    state = LoanPenaltyState(
        loan_id=str(loan.id),
        rule=PenaltyRule(daily_rate_paise=10000),  # ₹100/day
        kists=overdue_kists,
        assessed_dates=assessed_dates
    )

    new_penalty_amount, new_assessed_dates = calculate_new_penalties(state, current_date_str)

    # Record penalty assessment transactions for each new date
    for d in new_assessed_dates:
        LedgerTx.objects.create(
            tenant=loan.tenant,
            operation_id=uuid.uuid4(),
            loan=loan,
            transaction_type='PENALTY_ASSESSMENT',
            amount_paise=10000,
            effective_date=d
        )

    return new_penalty_amount


def record_collection(
    loan: LoanAccount,
    payment_amount: int,
    operation_id: uuid.UUID,
    effective_date_str: str,
    payment_method: str = 'CASH',
    is_cash: bool = True
) -> Dict[str, Any]:
    """
    Executes a cash/digital collection atomically:
    1. Idempotency check on operation_id.
    2. Bullet schedule extension.
    3. Penalty assessment.
    4. Waterfall allocation (INSTALMENT_FIRST rule).
    5. Bullet principal assignment.
    6. Appending Transaction and updating Kists.
    7. Settlement verification.
    """
    tenant = loan.tenant

    # Idempotency check
    existing = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
    if existing:
        return {'status': 'ALREADY_EXISTS', 'transaction': existing}

    with transaction.atomic():
        # Lock loan row for update
        locked_loan = LoanAccount.objects.select_for_update().get(id=loan.id)

        # Extend schedule for bullet loans if applicable
        extend_bullet_schedule_if_needed(locked_loan, effective_date_str)

        # Assess late penalties up to collection date
        assess_penalties(locked_loan, effective_date_str)

        # Calculate outstanding penalties
        total_assessed = (
            LedgerTx.objects
            .filter(loan=locked_loan, transaction_type='PENALTY_ASSESSMENT')
            .aggregate(total=models.Sum('amount_paise'))['total'] or 0
        )
        total_penalty_paid = (
            LedgerTx.objects
            .filter(loan=locked_loan, transaction_type='COLLECTION')
            .aggregate(total=models.Sum('allocated_penalty_paise'))['total'] or 0
        )
        outstanding_penalty = max(0, total_assessed - total_penalty_paid)

        # Prepare kist states
        db_kists = list(locked_loan.schedules.all().order_by('installment_number'))
        kist_states = [
            KistAllocationState(
                kist_number=k.installment_number,
                amount_due=k.total_due_paise,
                principal_due=k.principal_component_paise,
                markup_due=k.markup_component_paise,
                amount_paid=k.principal_paid_paise + k.markup_paid_paise,
                principal_paid=k.principal_paid_paise,
                markup_paid=k.markup_paid_paise,
                is_due=(k.effective_due_date.strftime("%Y-%m-%d") <= effective_date_str),
                status=k.status
            )
            for k in db_kists
        ]

        # Run allocation engine
        alloc_result: AllocationResult = allocate_payment(AllocationInput(
            payment_amount=payment_amount,
            kists=kist_states,
            outstanding_penalty=outstanding_penalty
        ))

        allocated_principal = sum(a.allocated_to_principal for a in alloc_result.allocations)
        allocated_markup = sum(a.allocated_to_markup for a in alloc_result.allocations)
        allocated_penalty = sum(a.allocated_to_penalty for a in alloc_result.allocations)

        # For bullet loans: unallocated funds pay towards principal
        past_principal_paid = 0
        if locked_loan.product_type == 'bullet':
            past_paid = (
                LedgerTx.objects
                .filter(loan=locked_loan, transaction_type='COLLECTION')
                .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
            )
            past_principal_paid = past_paid
            remaining_principal = max(0, locked_loan.principal_paise - past_principal_paid)

            if remaining_principal > 0 and alloc_result.unallocated_funds > 0:
                pay_principal = min(alloc_result.unallocated_funds, remaining_principal)
                allocated_principal += pay_principal
                alloc_result.unallocated_funds -= pay_principal

        # Create append-only collection transaction
        tx_obj = LedgerTx.objects.create(
            tenant=tenant,
            operation_id=operation_id,
            loan=locked_loan,
            transaction_type='COLLECTION',
            is_cash=is_cash,
            payment_method=payment_method,
            amount_paise=payment_amount,
            allocated_principal_paise=allocated_principal,
            allocated_markup_paise=allocated_markup,
            allocated_penalty_paise=allocated_penalty,
            unallocated_surplus_paise=alloc_result.unallocated_funds,
            effective_date=effective_date_str
        )

        # Update Kists in database
        for updated_k in alloc_result.updated_kists:
            orig = next(k for k in db_kists if k.installment_number == updated_k.kist_number)
            if (orig.principal_paid_paise != updated_k.principal_paid or
                orig.markup_paid_paise != updated_k.markup_paid or
                orig.status != updated_k.status):
                orig.principal_paid_paise = updated_k.principal_paid
                orig.markup_paid_paise = updated_k.markup_paid
                orig.status = updated_k.status
                orig.save(update_fields=['principal_paid_paise', 'markup_paid_paise', 'status'])

                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='KIST',
                    record_id=orig.id,
                    operation_type='UPDATE',
                    payload={
                        'id': str(orig.id),
                        'loan_id': str(locked_loan.id),
                        'installment_number': orig.installment_number,
                        'principal_paid_paise': orig.principal_paid_paise,
                        'markup_paid_paise': orig.markup_paid_paise,
                        'status': orig.status
                    }
                )

        # Check for loan settlement
        all_kists_paid = all(k.status == 'PAID' for k in alloc_result.updated_kists)
        settled_now = False
        if locked_loan.product_type == 'instalment':
            if all_kists_paid and alloc_result.remaining_penalty <= 0:
                locked_loan.status = 'SETTLED'
                locked_loan.save(update_fields=['status'])
                settled_now = True
        elif locked_loan.product_type == 'bullet':
            total_principal_paid = past_principal_paid + allocated_principal
            if (total_principal_paid >= locked_loan.principal_paise and
                all_kists_paid and
                alloc_result.remaining_penalty <= 0):
                locked_loan.status = 'SETTLED'
                locked_loan.save(update_fields=['status'])
                settled_now = True

        if settled_now:
            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='LOAN',
                record_id=locked_loan.id,
                operation_type='UPDATE',
                payload={
                    'id': str(locked_loan.id),
                    'status': 'SETTLED'
                }
            )

        # Create SyncOutbox entry for delta-sync
        SyncOutbox.objects.create(
            tenant=tenant,
            record_type='TRANSACTION',
            record_id=tx_obj.id,
            operation_type='INSERT',
            payload={
                'id': str(tx_obj.id),
                'operation_id': str(tx_obj.operation_id),
                'loan_id': str(locked_loan.id),
                'transaction_type': tx_obj.transaction_type,
                'amount_paise': tx_obj.amount_paise,
                'allocated_principal_paise': tx_obj.allocated_principal_paise,
                'allocated_markup_paise': tx_obj.allocated_markup_paise,
                'allocated_penalty_paise': tx_obj.allocated_penalty_paise,
                'unallocated_surplus_paise': tx_obj.unallocated_surplus_paise,
                'effective_date': str(tx_obj.effective_date)
            }
        )

        return {
            'status': 'SUCCESS',
            'transaction': tx_obj,
            'allocation_result': alloc_result
        }
