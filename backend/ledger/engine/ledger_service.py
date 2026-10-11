import time
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional
from django.db import transaction, models
from django.utils import timezone
from django.db.utils import OperationalError
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
    last_due_date_str = last_kist.effective_due_date.strftime("%Y-%m-%d") if hasattr(last_kist.effective_due_date, 'strftime') else str(last_kist.effective_due_date)

    if last_due_date_str < current_date_str:
        if isinstance(loan.markup_factor, float):
            markup_dec = Decimal(str(loan.markup_factor))
        else:
            markup_dec = Decimal(loan.markup_factor)
        total_markup = int((Decimal(loan.principal_paise) * markup_dec).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        markup_due_per_month = total_markup // loan.term_months

        next_installment_number = last_kist.installment_number + 1
        months_to_add = next_installment_number
        start_date_str = loan.start_date.strftime("%Y-%m-%d") if hasattr(loan.start_date, 'strftime') else str(loan.start_date)
        next_due_date = calculate_next_due_date(start_date_str, months_to_add, loan.due_day)

        while next_due_date <= current_date_str or next_installment_number == last_kist.installment_number + 1:
            new_kist = Kist.objects.create(
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
            SyncOutbox.objects.create(
                tenant=loan.tenant,
                record_type='KIST',
                record_id=new_kist.id,
                operation_type='INSERT',
                payload={
                    'id': str(new_kist.id),
                    'loan_id': str(loan.id),
                    'installment_number': new_kist.installment_number,
                    'original_due_date': str(new_kist.original_due_date),
                    'effective_due_date': str(new_kist.effective_due_date),
                    'principal_component_paise': new_kist.principal_component_paise,
                    'markup_component_paise': new_kist.markup_component_paise,
                    'total_due_paise': new_kist.total_due_paise,
                    'status': new_kist.status,
                }
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
    assessed_dates = {(d.strftime("%Y-%m-%d") if hasattr(d, 'strftime') else str(d)) for d in existing_assessments}

    overdue_kists = [
        OverdueKist(
            kist_number=k.installment_number,
            due_date=(k.effective_due_date.strftime("%Y-%m-%d") if hasattr(k.effective_due_date, 'strftime') else str(k.effective_due_date)),
            amount_due=k.total_due_paise,
            amount_paid=k.principal_paid_paise + k.markup_paid_paise,
            is_fully_paid=(k.status == 'PAID' or (k.total_due_paise <= k.principal_paid_paise + k.markup_paid_paise))
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
        pen_op_id = uuid.uuid5(uuid.NAMESPACE_OID, f"penalty:{loan.id}:{d}")
        if LedgerTx.objects.filter(loan=loan, transaction_type='PENALTY_ASSESSMENT', effective_date=d).exists():
            continue

        pen_tx = LedgerTx.objects.create(
            tenant=loan.tenant,
            operation_id=pen_op_id,
            loan=loan,
            transaction_type='PENALTY_ASSESSMENT',
            amount_paise=10000,
            effective_date=d
        )
        SyncOutbox.objects.create(
            tenant=loan.tenant,
            record_type='TRANSACTION',
            record_id=pen_tx.id,
            operation_type='INSERT',
            payload={
                'id': str(pen_tx.id),
                'operation_id': str(pen_tx.operation_id),
                'loan_id': str(loan.id),
                'transaction_type': pen_tx.transaction_type,
                'is_cash': pen_tx.is_cash,
                'payment_method': pen_tx.payment_method,
                'amount_paise': pen_tx.amount_paise,
                'allocated_principal_paise': pen_tx.allocated_principal_paise,
                'allocated_markup_paise': pen_tx.allocated_markup_paise,
                'allocated_penalty_paise': pen_tx.allocated_penalty_paise,
                'unallocated_surplus_paise': pen_tx.unallocated_surplus_paise,
                'forgiven_penalty_paise': pen_tx.forgiven_penalty_paise,
                'effective_date': str(pen_tx.effective_date),
            }
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

    for attempt in range(6):
        # Idempotency check
        existing = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
        if existing:
            if (
                str(existing.loan.id) != str(loan.id) or
                existing.amount_paise != payment_amount or
                str(existing.effective_date) != str(effective_date_str) or
                existing.transaction_type != 'COLLECTION'
            ):
                raise ValueError(
                    f"Idempotency conflict: operation_id {operation_id} already exists with different payment attributes."
                )
            return {'status': 'ALREADY_EXISTS', 'transaction': existing}

        try:
            with transaction.atomic():
                # Lock loan row for update
                locked_loan = LoanAccount.objects.select_for_update().get(id=loan.id)

                # Recheck idempotency under lock to prevent concurrent duplicates from double-processing
                existing_locked = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
                if existing_locked:
                    if (
                        str(existing_locked.loan.id) != str(loan.id) or
                        existing_locked.amount_paise != payment_amount or
                        str(existing_locked.effective_date) != str(effective_date_str) or
                        existing_locked.transaction_type != 'COLLECTION'
                    ):
                        raise ValueError(
                            f"Idempotency conflict: operation_id {operation_id} already exists with different payment attributes."
                        )
                    return {'status': 'ALREADY_EXISTS', 'transaction': existing_locked}

                # Extend schedule for bullet loans bounded by server clock
                server_date_str = str(timezone.now().date())
                sched_date_str = min(effective_date_str, server_date_str)
                extend_bullet_schedule_if_needed(locked_loan, sched_date_str)

                # Assess late penalties bounded by server clock
                assess_penalties(locked_loan, sched_date_str)

                # Calculate outstanding penalties (accounting for collections and waivers)
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
                total_penalty_waived = (
                    LedgerTx.objects
                    .filter(loan=locked_loan, transaction_type='REVERSAL')
                    .aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0
                )
                outstanding_penalty = max(0, total_assessed - total_penalty_paid - total_penalty_waived)

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
                    total_principal_paid = sum(k.principal_paid for k in alloc_result.updated_kists)
                    if (total_principal_paid >= locked_loan.principal_paise and
                        all_kists_paid and
                        alloc_result.remaining_penalty <= 0):
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

                # Always publish authoritative loan status to SyncOutbox for client delta sync
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='LOAN',
                    record_id=locked_loan.id,
                    operation_type='UPDATE',
                    payload={
                        'id': str(locked_loan.id),
                        'status': locked_loan.status
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
                        'is_cash': tx_obj.is_cash,
                        'payment_method': tx_obj.payment_method,
                        'amount_paise': tx_obj.amount_paise,
                        'allocated_principal_paise': tx_obj.allocated_principal_paise,
                        'allocated_markup_paise': tx_obj.allocated_markup_paise,
                        'allocated_penalty_paise': tx_obj.allocated_penalty_paise,
                        'unallocated_surplus_paise': tx_obj.unallocated_surplus_paise,
                        'forgiven_penalty_paise': tx_obj.forgiven_penalty_paise,
                        'effective_date': str(tx_obj.effective_date)
                    }
                )

                return {
                    'status': 'SUCCESS',
                    'transaction': tx_obj,
                    'allocation_result': alloc_result
                }
        except OperationalError as exc:
            if ('locked' in str(exc).lower() or 'busy' in str(exc).lower()) and attempt < 5:
                time.sleep(0.05 * (attempt + 1))
                continue
            raise
