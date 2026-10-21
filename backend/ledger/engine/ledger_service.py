import time
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional
from django.db import transaction, models
from django.utils import timezone
from django.db.utils import OperationalError
from django.core.exceptions import ValidationError
from ledger.models import (
    LoanAccount,
    Kist,
    Transaction as LedgerTx,
    SyncOutbox,
    LoanTerm,
    PaymentCorrection,
    LoanAttachment,
)
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
from .schedule import calculate_next_due_date, calculate_contract_interest

def extend_bullet_schedule_if_needed(loan: LoanAccount, current_date_str: str) -> None:
    """
    Extends schedule month-by-month for legacy bullet loans whose last installment has passed.
    For new One-Time Repayment loans (rate_basis == 'ANNUAL_SIMPLE_FLAT'), NO monthly kists are generated.
    """
    if loan.product_type != 'bullet' or loan.status != 'ACTIVE' or getattr(loan, 'rate_basis', '') == 'ANNUAL_SIMPLE_FLAT':
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

    existing_assessments = (
        LedgerTx.objects
        .filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
        .values_list('effective_date', flat=True)
    )
    assessed_dates = {(d.strftime("%Y-%m-%d") if hasattr(d, 'strftime') else str(d)) for d in existing_assessments}

    if loan.product_type == 'bullet' and getattr(loan, 'rate_basis', '') == 'ANNUAL_SIMPLE_FLAT':
        maturity_str = loan.maturity_date.strftime("%Y-%m-%d") if hasattr(loan.maturity_date, 'strftime') else str(loan.maturity_date or '')
        if not maturity_str:
            return 0
        total_contract_amt = loan.total_paise or (loan.principal_paise + (loan.interest_paise or 0))
        total_collected = (
            LedgerTx.objects
            .filter(loan=loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
            .exclude(id__in=PaymentCorrection.objects.filter(loan=loan).values_list('original_transaction_id', flat=True))
            .aggregate(total=models.Sum('amount_paise'))['total'] or 0
        )
        overdue_kists = [
            OverdueKist(
                kist_number=1,
                due_date=maturity_str,
                amount_due=total_contract_amt,
                amount_paid=total_collected,
                is_fully_paid=(total_collected >= total_contract_amt)
            )
        ]
    else:
        kists = loan.schedules.all().order_by('installment_number')
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
    2. Bullet schedule extension (for legacy loans).
    3. Penalty assessment.
    4. Waterfall allocation (INSTALMENT_FIRST rule).
    5. Bullet principal/interest assignment.
    6. Appending Transaction and updating Kists/Terms.
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
                existing.transaction_type != 'COLLECTION' or
                existing.payment_method != payment_method or
                bool(existing.is_cash) != bool(is_cash)
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
                        existing_locked.transaction_type != 'COLLECTION' or
                        existing_locked.payment_method != payment_method or
                        bool(existing_locked.is_cash) != bool(is_cash)
                    ):
                        raise ValueError(
                            f"Idempotency conflict: operation_id {operation_id} already exists with different payment attributes."
                        )
                    return {'status': 'ALREADY_EXISTS', 'transaction': existing_locked}

                # Extend schedule for legacy bullet loans bounded by server clock
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
                    .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                    .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
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

                past_principal_paid = 0
                past_interest_paid = 0
                total_contract_interest = 0

                if locked_loan.product_type == 'bullet':
                    if getattr(locked_loan, 'rate_basis', '') == 'ANNUAL_SIMPLE_FLAT':
                        total_contract_interest = sum(t.interest_paise for t in locked_loan.terms.all()) if locked_loan.terms.exists() else (locked_loan.interest_paise or 0)
                        past_interest_paid = (
                            LedgerTx.objects
                            .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                            .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
                            .aggregate(total=models.Sum('allocated_markup_paise'))['total'] or 0
                        )
                        unpaid_interest = max(0, total_contract_interest - past_interest_paid)
                        if unpaid_interest > 0 and alloc_result.unallocated_funds > 0:
                            pay_interest = min(alloc_result.unallocated_funds, unpaid_interest)
                            allocated_markup += pay_interest
                            alloc_result.unallocated_funds -= pay_interest

                            rem_interest = pay_interest
                            for term in locked_loan.terms.filter(settled=False).order_by('term_number'):
                                term_unpaid = term.interest_paise - term.interest_paid_paise
                                if term_unpaid > 0:
                                    t_alloc = min(rem_interest, term_unpaid)
                                    term.interest_paid_paise += t_alloc
                                    if term.interest_paid_paise >= term.interest_paise:
                                        term.settled = True
                                    term.save(update_fields=['interest_paid_paise', 'settled'])
                                    rem_interest -= t_alloc
                                    if rem_interest <= 0:
                                        break

                    past_paid = (
                        LedgerTx.objects
                        .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                        .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
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
                    total_interest_paid = past_interest_paid + allocated_markup
                    if (total_principal_paid >= locked_loan.principal_paise and
                        (getattr(locked_loan, 'rate_basis', '') != 'ANNUAL_SIMPLE_FLAT' or total_interest_paid >= total_contract_interest) and
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


def extend_loan(
    loan: LoanAccount,
    additional_months: int,
    interest_collected_paise: int,
    operation_id: uuid.UUID,
    effective_date_str: str,
    payment_operation_id: Optional[uuid.UUID] = None
) -> Dict[str, Any]:
    """
    Extends a One-Time Repayment loan atomically:
    1. Validates loan is active and product_type is bullet.
    2. Collects required term interest if passed.
    3. Appends new immutable LoanTerm.
    4. Updates LoanAccount cumulative term_months, interest_paise, total_paise, maturity_date.
    5. Publishes SyncOutbox records for Loan and LoanTerm.
    """
    with transaction.atomic():
        locked_loan = LoanAccount.objects.select_for_update().get(id=loan.id)
        if locked_loan.product_type != 'bullet':
            raise ValidationError("Only One-Time Repayment (bullet) loans can be extended.")
        if locked_loan.status != 'ACTIVE':
            raise ValidationError(f"Cannot extend loan in status '{locked_loan.status}'.")

        # Idempotency check
        existing_term = LoanTerm.objects.filter(loan=locked_loan, operation_id=operation_id).first()
        if existing_term:
            return {'status': 'ALREADY_EXISTS', 'term': existing_term}

        # Current terms
        terms = list(locked_loan.terms.all().order_by('term_number'))
        last_term = terms[-1] if terms else None
        last_maturity_date = last_term.maturity_date if last_term else (locked_loan.maturity_date or locked_loan.start_date)

        # In the first implementation, require completed term's contractual interest to be settled
        if last_term and not last_term.settled:
            prior_unpaid = last_term.interest_paise - last_term.interest_paid_paise
            if interest_collected_paise < prior_unpaid:
                raise ValidationError(
                    f"Prior term's contractual interest must be fully settled before extending the loan. "
                    f"Required: {prior_unpaid} paise, collected: {interest_collected_paise} paise."
                )

        if interest_collected_paise > 0:
            pay_op_id = payment_operation_id or uuid.uuid5(operation_id, f"extension_payment:{operation_id}")
            record_collection(
                loan=locked_loan,
                payment_amount=interest_collected_paise,
                operation_id=pay_op_id,
                effective_date_str=effective_date_str,
                payment_method='CASH',
                is_cash=True
            )
            if last_term:
                last_term.interest_paid_paise = (last_term.interest_paid_paise or 0) + interest_collected_paise
                if last_term.interest_paid_paise >= last_term.interest_paise:
                    last_term.settled = True
                last_term.save(update_fields=['interest_paid_paise', 'settled'])

        new_term_number = (last_term.term_number + 1) if last_term else 1
        new_start_date = last_maturity_date
        start_date_str = new_start_date.strftime("%Y-%m-%d") if hasattr(new_start_date, 'strftime') else str(new_start_date)
        new_maturity_date = calculate_next_due_date(start_date_str, additional_months, locked_loan.due_day)
        rate_val = locked_loan.annual_rate or (Decimal(str(locked_loan.markup_factor)) * Decimal(100))
        new_interest = calculate_contract_interest(locked_loan.principal_paise, rate_val, additional_months)

        term_obj = LoanTerm.objects.create(
            tenant=locked_loan.tenant,
            loan=locked_loan,
            term_number=new_term_number,
            duration_months=additional_months,
            annual_rate=rate_val,
            interest_paise=new_interest,
            start_date=start_date_str,
            maturity_date=new_maturity_date,
            interest_paid_paise=0,
            settled=False,
            operation_id=operation_id
        )

        locked_loan.term_months += additional_months
        locked_loan.interest_paise = (locked_loan.interest_paise or 0) + new_interest
        locked_loan.total_paise = locked_loan.principal_paise + locked_loan.interest_paise
        locked_loan.maturity_date = new_maturity_date
        locked_loan.save(update_fields=['term_months', 'interest_paise', 'total_paise', 'maturity_date'])

        # Publish to SyncOutbox
        SyncOutbox.objects.create(
            tenant=locked_loan.tenant,
            record_type='LOAN_TERM',
            record_id=term_obj.id,
            operation_type='INSERT',
            payload={
                'id': str(term_obj.id),
                'loan_id': str(locked_loan.id),
                'term_number': term_obj.term_number,
                'duration_months': term_obj.duration_months,
                'annual_rate': str(term_obj.annual_rate),
                'interest_paise': term_obj.interest_paise,
                'start_date': str(term_obj.start_date),
                'maturity_date': str(term_obj.maturity_date),
                'settled': term_obj.settled,
                'interest_settled': term_obj.settled,
                'operation_id': str(operation_id)
            }
        )
        SyncOutbox.objects.create(
            tenant=locked_loan.tenant,
            record_type='LOAN',
            record_id=locked_loan.id,
            operation_type='UPDATE',
            payload={
                'id': str(locked_loan.id),
                'term_months': locked_loan.term_months,
                'interest_paise': locked_loan.interest_paise,
                'total_paise': locked_loan.total_paise,
                'maturity_date': str(locked_loan.maturity_date),
                'status': locked_loan.status
            }
        )
        return {'status': 'SUCCESS', 'term': term_obj}


def correct_payment(
    loan: LoanAccount,
    original_operation_id: uuid.UUID,
    corrected_amount_paise: int,
    reason: str,
    operation_id: uuid.UUID,
    effective_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Auditable payment correction workflow:
    1. Idempotency check on operation_id.
    2. Select original COLLECTION transaction under lock.
    3. Record immutable REVERSAL transaction linking reversal_of_id.
    4. If corrected_amount_paise > 0, record replacement COLLECTION transaction.
    5. Record PaymentCorrection linking original, reversal, and replacement.
    6. Recompute product-specific balances and kist states sequentially.
    7. Publish SyncOutbox events.
    """
    tenant = loan.tenant
    with transaction.atomic():
        locked_loan = LoanAccount.objects.select_for_update().get(id=loan.id)

        # Idempotency check
        existing_corr = PaymentCorrection.objects.filter(tenant=tenant, operation_id=operation_id).first()
        if existing_corr:
            return {'status': 'ALREADY_EXISTS', 'correction': existing_corr}

        orig_tx = LedgerTx.objects.filter(
            models.Q(operation_id=original_operation_id) | models.Q(id=original_operation_id),
            tenant=tenant,
            loan=locked_loan
        ).first()
        if not orig_tx:
            raise ValidationError(f"Original transaction with ID/operation_id {original_operation_id} not found.")
        if orig_tx.transaction_type != 'COLLECTION':
            raise ValidationError(f"Only collection transactions can be corrected. Found: {orig_tx.transaction_type}")
        if PaymentCorrection.objects.filter(tenant=tenant, original_transaction=orig_tx).exists():
            raise ValidationError("This payment has already been corrected.")

        eff_date = effective_date_str or str(orig_tx.effective_date)
        rev_op_id = uuid.uuid5(operation_id, f"reversal:{orig_tx.id}")

        reversal_tx = LedgerTx.objects.create(
            tenant=tenant,
            operation_id=rev_op_id,
            loan=locked_loan,
            transaction_type='REVERSAL',
            amount_paise=0,
            allocated_principal_paise=0,
            allocated_markup_paise=0,
            allocated_penalty_paise=0,
            unallocated_surplus_paise=0,
            effective_date=eff_date,
            reversal_of_id=orig_tx.id,
            correction_reason=reason
        )

        # Unwind orig_tx allocations before applying replacement
        if locked_loan.product_type == 'instalment':
            for k in locked_loan.schedules.all():
                k.principal_paid_paise = 0
                k.markup_paid_paise = 0
                k.status = 'PENDING'
                k.save(update_fields=['principal_paid_paise', 'markup_paid_paise', 'status'])

            prior_collections = (
                LedgerTx.objects
                .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                .exclude(id=orig_tx.id)
                .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
                .order_by('effective_date', 'sequence_number')
            )
            for col in prior_collections:
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
                        is_due=True,
                        status=k.status
                    )
                    for k in db_kists
                ]
                alloc_res = allocate_payment(AllocationInput(
                    payment_amount=col.amount_paise,
                    kists=kist_states,
                    outstanding_penalty=0
                ))
                for updated_k in alloc_res.updated_kists:
                    db_k = next(k for k in db_kists if k.installment_number == updated_k.kist_number)
                    if (db_k.principal_paid_paise != updated_k.principal_paid or
                        db_k.markup_paid_paise != updated_k.markup_paid or
                        db_k.status != updated_k.status):
                        db_k.principal_paid_paise = updated_k.principal_paid
                        db_k.markup_paid_paise = updated_k.markup_paid
                        db_k.status = updated_k.status
                        db_k.save(update_fields=['principal_paid_paise', 'markup_paid_paise', 'status'])

        replacement_tx = None
        if corrected_amount_paise > 0:
            rep_op_id = uuid.uuid5(operation_id, f"replacement:{orig_tx.id}")
            res = record_collection(
                loan=locked_loan,
                payment_amount=corrected_amount_paise,
                operation_id=rep_op_id,
                effective_date_str=eff_date,
                payment_method=orig_tx.payment_method,
                is_cash=orig_tx.is_cash
            )
            replacement_tx = res.get('transaction')

        correction_obj = PaymentCorrection.objects.create(
            tenant=tenant,
            loan=locked_loan,
            original_transaction=orig_tx,
            reversal_transaction=reversal_tx,
            replacement_transaction=replacement_tx,
            original_amount_paise=orig_tx.amount_paise,
            corrected_amount_paise=corrected_amount_paise,
            reason=reason,
            operation_id=operation_id
        )

        # Recompute loan settlement status
        if locked_loan.status == 'SETTLED':
            if locked_loan.product_type == 'instalment':
                has_pending = locked_loan.schedules.exclude(status='PAID').exists()
                if has_pending:
                    locked_loan.status = 'ACTIVE'
                    locked_loan.save(update_fields=['status'])
            elif locked_loan.product_type == 'bullet':
                total_prin_paid = (
                    LedgerTx.objects
                    .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                    .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
                    .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
                )
                if total_prin_paid < locked_loan.principal_paise:
                    locked_loan.status = 'ACTIVE'
                    locked_loan.save(update_fields=['status'])

        SyncOutbox.objects.create(
            tenant=tenant,
            record_type='PAYMENT_CORRECTION',
            record_id=correction_obj.id,
            operation_type='INSERT',
            payload={
                'id': str(correction_obj.id),
                'loan_id': str(locked_loan.id),
                'original_transaction_id': str(orig_tx.id),
                'original_operation_id': str(orig_tx.operation_id),
                'reversal_transaction_id': str(reversal_tx.id),
                'replacement_transaction_id': str(replacement_tx.id) if replacement_tx else None,
                'original_amount_paise': correction_obj.original_amount_paise,
                'corrected_amount_paise': correction_obj.corrected_amount_paise,
                'reason': correction_obj.reason,
                'operation_id': str(operation_id)
            }
        )
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

        return {'status': 'SUCCESS', 'correction': correction_obj}


def close_loan(
    loan: LoanAccount,
    settlement_amount_paise: int,
    operation_id: uuid.UUID,
    effective_date_str: str,
    payment_method: str = 'CASH'
) -> Dict[str, Any]:
    """
    Closes a loan upon actual settlement of all outstanding obligations.
    """
    tenant = loan.tenant
    with transaction.atomic():
        locked_loan = LoanAccount.objects.select_for_update().get(id=loan.id)
        if locked_loan.status == 'SETTLED':
            return {'status': 'ALREADY_SETTLED', 'loan': locked_loan}
        if locked_loan.status == 'WRITTEN_OFF':
            raise ValidationError(f"Cannot close loan in status '{locked_loan.status}'.")

        if settlement_amount_paise > 0:
            pay_op_id = uuid.uuid5(operation_id, f"close_settlement:{locked_loan.id}")
            record_collection(
                loan=locked_loan,
                payment_amount=settlement_amount_paise,
                operation_id=pay_op_id,
                effective_date_str=effective_date_str,
                payment_method=payment_method,
                is_cash=(payment_method == 'CASH')
            )

        locked_loan.refresh_from_db()
        # Verify settlement: only close if obligations are settled
        if locked_loan.product_type == 'bullet':
            past_prin = (
                LedgerTx.objects
                .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
                .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
            )
            if past_prin >= locked_loan.principal_paise:
                locked_loan.status = 'SETTLED'
                locked_loan.save(update_fields=['status'])
            else:
                raise ValidationError(f"Cannot close loan: remaining principal {locked_loan.principal_paise - past_prin} paise is not fully settled.")
        elif locked_loan.product_type == 'instalment':
            if not locked_loan.schedules.exclude(status='PAID').exists():
                locked_loan.status = 'SETTLED'
                locked_loan.save(update_fields=['status'])
            else:
                raise ValidationError("Cannot close loan: pending installments remain.")

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
        return {'status': 'SUCCESS', 'loan': locked_loan}

