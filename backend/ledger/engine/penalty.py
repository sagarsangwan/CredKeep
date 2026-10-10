from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Set, Tuple

@dataclass
class PenaltyRule:
    daily_rate_paise: int = 10000  # ₹100 = 10,000 paise

@dataclass
class OverdueKist:
    kist_number: int
    due_date: str  # YYYY-MM-DD
    amount_due: int
    amount_paid: int
    is_fully_paid: bool

@dataclass
class LoanPenaltyState:
    loan_id: str
    rule: PenaltyRule
    kists: List[OverdueKist]
    assessed_dates: Set[str] = field(default_factory=set)

def get_dates_between(start_date_str: str, end_date_str: str) -> List[str]:
    """
    Returns list of dates formatted as YYYY-MM-DD from start_date (exclusive) to end_date (inclusive).
    The due date itself is not a late day; late days begin the day after the due date.
    """
    dates: List[str] = []
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").date()

    curr = start_dt + timedelta(days=1)
    while curr <= end_dt:
        dates.append(curr.strftime("%Y-%m-%d"))
        curr += timedelta(days=1)

    return dates

def calculate_new_penalties(
    state: LoanPenaltyState,
    current_date_str: str
) -> Tuple[int, List[str]]:
    """
    Calculates unassessed late penalties up to current_date.
    Rule: ₹100 per overdue calendar day for the loan, starting day after earliest unpaid due date.
    Returns (new_penalty_amount, new_assessed_dates).
    """
    earliest_unpaid_due_date: Optional[str] = None

    for kist in state.kists:
        if not kist.is_fully_paid:
            if earliest_unpaid_due_date is None or kist.due_date < earliest_unpaid_due_date:
                earliest_unpaid_due_date = kist.due_date

    if not earliest_unpaid_due_date:
        return 0, []

    if earliest_unpaid_due_date >= current_date_str:
        return 0, []

    potential_dates = get_dates_between(earliest_unpaid_due_date, current_date_str)
    new_assessed_dates: List[str] = []
    new_penalty_amount = 0

    for d in potential_dates:
        if d not in state.assessed_dates:
            new_assessed_dates.append(d)
            new_penalty_amount += state.rule.daily_rate_paise

    return new_penalty_amount, new_assessed_dates
