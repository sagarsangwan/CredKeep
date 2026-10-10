from dataclasses import dataclass
from typing import List, Optional, Tuple

@dataclass
class KistAllocationState:
    kist_number: int
    amount_due: int  # in paise
    principal_due: int  # in paise
    markup_due: int  # in paise
    amount_paid: int = 0
    principal_paid: int = 0
    markup_paid: int = 0
    is_due: Optional[bool] = None
    status: str = 'PENDING'

@dataclass
class PaymentAllocation:
    amount: int
    allocated_to_kist: int  # 0 indicates loan-level penalty
    allocated_to_principal: int
    allocated_to_markup: int
    allocated_to_penalty: int

@dataclass
class AllocationInput:
    payment_amount: int
    kists: List[KistAllocationState]
    outstanding_penalty: int = 0

@dataclass
class AllocationResult:
    updated_kists: List[KistAllocationState]
    allocations: List[PaymentAllocation]
    remaining_penalty: int
    unallocated_funds: int

def allocate_within_kist(amount: int, kist: KistAllocationState) -> Tuple[int, int]:
    """
    Allocates amount between principal and markup for a single kist.
    Priority: Markup first, then principal.
    Returns (allocated_principal, allocated_markup).
    """
    unpaid_principal = max(0, kist.principal_due - kist.principal_paid)
    unpaid_markup = max(0, kist.markup_due - kist.markup_paid)

    if amount >= (unpaid_principal + unpaid_markup):
        return unpaid_principal, unpaid_markup

    m = min(amount, unpaid_markup)
    p = amount - m
    return p, m

def allocate_payment(input_data: AllocationInput) -> AllocationResult:
    """
    Waterfall payment allocation engine (INSTALMENT_FIRST rule):
    1. Due instalments (oldest first). Within instalment: markup first, then principal.
    2. Outstanding loan penalties.
    3. Future non-due instalments (pre-payments).
    4. Any excess remains unallocated (for bullet loans, principal payoff; else surplus).
    All arithmetic is strictly integer Paise.
    """
    remaining_funds = input_data.payment_amount
    remaining_penalty = input_data.outstanding_penalty

    # Resolve initial statuses for kists
    updated_kists: List[KistAllocationState] = []
    for k in input_data.kists:
        resolved_status = k.status
        if not resolved_status or resolved_status in ('PENDING', 'UNPAID', 'PARTIALLY_PAID'):
            if k.amount_paid >= k.amount_due:
                resolved_status = 'PAID'
            elif k.amount_paid > 0:
                resolved_status = 'PARTIALLY_PAID'
            else:
                resolved_status = 'UNPAID'
        elif k.amount_paid >= k.amount_due and resolved_status != 'PAID':
            resolved_status = 'PAID'

        updated_kists.append(KistAllocationState(
            kist_number=k.kist_number,
            amount_due=k.amount_due,
            principal_due=k.principal_due,
            markup_due=k.markup_due,
            amount_paid=k.amount_paid,
            principal_paid=k.principal_paid,
            markup_paid=k.markup_paid,
            is_due=k.is_due,
            status=resolved_status
        ))

    allocations: List[PaymentAllocation] = []

    # Phase 1: Due instalments (oldest first)
    for kist in updated_kists:
        if kist.is_due is not False and kist.status != 'PAID' and remaining_funds > 0:
            remaining_due = max(0, kist.amount_due - kist.amount_paid)
            allocated_to_kist = min(remaining_funds, remaining_due)

            kist.amount_paid += allocated_to_kist
            remaining_funds -= allocated_to_kist

            if kist.amount_paid >= kist.amount_due:
                kist.status = 'PAID'
            else:
                kist.status = 'PARTIALLY_PAID'

            if allocated_to_kist > 0:
                p, m = allocate_within_kist(allocated_to_kist, kist)
                kist.principal_paid += p
                kist.markup_paid += m

                allocations.append(PaymentAllocation(
                    amount=allocated_to_kist,
                    allocated_to_kist=kist.kist_number,
                    allocated_to_principal=p,
                    allocated_to_markup=m,
                    allocated_to_penalty=0
                ))

    # Phase 2: Outstanding penalties
    if remaining_funds > 0 and remaining_penalty > 0:
        allocated_to_penalty = min(remaining_funds, remaining_penalty)
        remaining_penalty -= allocated_to_penalty
        remaining_funds -= allocated_to_penalty

        allocations.append(PaymentAllocation(
            amount=allocated_to_penalty,
            allocated_to_kist=0,  # 0 indicates loan-level penalty
            allocated_to_principal=0,
            allocated_to_markup=0,
            allocated_to_penalty=allocated_to_penalty
        ))

    # Phase 3: Future non-due instalments (pre-payments)
    for kist in updated_kists:
        if kist.is_due is False and kist.status != 'PAID' and remaining_funds > 0:
            remaining_due = max(0, kist.amount_due - kist.amount_paid)
            allocated_to_kist = min(remaining_funds, remaining_due)

            kist.amount_paid += allocated_to_kist
            remaining_funds -= allocated_to_kist

            if kist.amount_paid >= kist.amount_due:
                kist.status = 'PAID'
            else:
                kist.status = 'PARTIALLY_PAID'

            if allocated_to_kist > 0:
                p, m = allocate_within_kist(allocated_to_kist, kist)
                kist.principal_paid += p
                kist.markup_paid += m

                allocations.append(PaymentAllocation(
                    amount=allocated_to_kist,
                    allocated_to_kist=kist.kist_number,
                    allocated_to_principal=p,
                    allocated_to_markup=m,
                    allocated_to_penalty=0
                ))

    return AllocationResult(
        updated_kists=updated_kists,
        allocations=allocations,
        remaining_penalty=remaining_penalty,
        unallocated_funds=remaining_funds
    )
