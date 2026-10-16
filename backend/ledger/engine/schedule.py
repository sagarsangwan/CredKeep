import calendar
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Union, Optional

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

def calculate_contract_interest(
    principal_paise: int,
    annual_rate: Union[Decimal, float],
    term_months: int
) -> int:
    """
    Computes interest for annual simple-flat-interest contracts:
    Interest = Principal × AnnualRate × DurationMonths / 1200
    Result rounded to integer paise using ROUND_HALF_UP.
    """
    if annual_rate < 0 or term_months <= 0:
        raise ValueError("annual_rate and term_months must be positive")
    rate_dec = Decimal(str(annual_rate))
    interest_dec = (Decimal(principal_paise) * rate_dec * Decimal(term_months)) / Decimal(1200)
    return int(interest_dec.quantize(Decimal('1'), rounding=ROUND_HALF_UP))

def generate_schedule(
    principal_paise: int,
    markup_factor: Optional[Union[Decimal, float]] = None,
    term_months: int = 1,
    start_date_str: str = '',
    due_day: int = 1,
    product_type: str = 'instalment',
    annual_rate: Optional[Union[Decimal, float]] = None,
    rate_basis: Optional[str] = None
) -> List[ScheduledKistData]:
    """
    Generates initial repayment schedule.
    - Monthly Kist (instalment): both principal and interest divided across term_months.
    - One-Time Repayment (bullet): NO monthly kists are generated.
    """
    if term_months <= 0:
        raise ValueError("term_months must be a positive integer")

    if rate_basis is None:
        rate_basis = 'ANNUAL_SIMPLE_FLAT' if annual_rate is not None else 'LEGACY_FIXED_TERM'

    # ONE-TIME REPAYMENT: There are NO monthly kists.
    if product_type == 'bullet' and rate_basis == 'ANNUAL_SIMPLE_FLAT':
        return []

    if rate_basis == 'ANNUAL_SIMPLE_FLAT' and annual_rate is not None:
        total_markup = calculate_contract_interest(principal_paise, annual_rate, term_months)
    else:
        if markup_factor is None or markup_factor < 0:
            raise ValueError("markup_factor must be non-negative")
        if isinstance(markup_factor, Decimal) and (markup_factor.is_nan() or markup_factor.is_infinite()):
            raise ValueError("markup_factor must be a finite number")
        if isinstance(markup_factor, float):
            markup_dec = Decimal(str(markup_factor))
        else:
            markup_dec = Decimal(markup_factor)
        total_markup = int((Decimal(principal_paise) * markup_dec).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

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
        # Legacy fixed-term markup bullet
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
