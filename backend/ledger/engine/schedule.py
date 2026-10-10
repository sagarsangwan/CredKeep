import calendar
from dataclasses import dataclass
from decimal import Decimal
from typing import List, Union

@dataclass
class ScheduledKistData:
    kist_number: int
    due_date: str
    amount_due: int
    principal_due: int
    markup_due: int

def divide_paise(total: int, parts: int) -> List[int]:
    """
    Evenly divides total paise into `parts`, distributing any remainder
    1 paise at a time across the earliest installments to ensure exact sum.
    """
    if parts <= 0:
        raise ValueError("Parts must be a positive integer")
    base = total // parts
    remainder = total % parts
    result = [base] * parts
    for i in range(remainder):
        result[i] += 1
    return result

def calculate_next_due_date(start_date_str: str, months_to_add: int, target_due_day: int) -> str:
    """
    Computes due date for installment N months from start date,
    adjusting for shorter months (e.g. Feb 28/29, April 30).
    """
    year_str, month_str, _ = start_date_str.split('-')
    year = int(year_str)
    month = int(month_str)

    month += months_to_add
    while month > 12:
        month -= 12
        year += 1

    _, days_in_month = calendar.monthrange(year, month)
    final_day = min(target_due_day, days_in_month)

    return f"{year:04d}-{month:02d}-{final_day:02d}"

def generate_schedule(
    principal_paise: int,
    markup_factor: Union[Decimal, float],
    term_months: int,
    start_date_str: str,
    due_day: int,
    product_type: str = 'instalment'
) -> List[ScheduledKistData]:
    """
    Generates initial repayment schedule.
    - Instalment loans: both principal and markup divided across term_months.
    - Bullet loans: only markup due in monthly kists (principal due at settlement).
    """
    if isinstance(markup_factor, float):
        total_markup = round(principal_paise * markup_factor)
    else:
        total_markup = int(round(Decimal(principal_paise) * markup_factor))

    schedule: List[ScheduledKistData] = []

    if product_type == 'instalment':
        principal_instalments = divide_paise(principal_paise, term_months)
        markup_instalments = divide_paise(total_markup, term_months)

        for i in range(term_months):
            schedule.append(ScheduledKistData(
                kist_number=i + 1,
                due_date=calculate_next_due_date(start_date_str, i + 1, due_day),
                amount_due=principal_instalments[i] + markup_instalments[i],
                principal_due=principal_instalments[i],
                markup_due=markup_instalments[i]
            ))
    elif product_type == 'bullet':
        markup_instalments = divide_paise(total_markup, term_months)

        for i in range(term_months):
            schedule.append(ScheduledKistData(
                kist_number=i + 1,
                due_date=calculate_next_due_date(start_date_str, i + 1, due_day),
                amount_due=markup_instalments[i],
                principal_due=0,
                markup_due=markup_instalments[i]
            ))
    else:
        raise ValueError(f"Unsupported product_type '{product_type}'. Must be 'instalment' or 'bullet'.")

    return schedule
