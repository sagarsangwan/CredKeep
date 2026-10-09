# 03-overdue-period-engine

Status: `ready-for-agent`

## Overview
Implement the overdue period lifecycle and deterministic daily penalty assessment engine.

## Acceptance Criteria
- Evaluates loan overdue state as of a given `asOfDate`.
- Charges ₹100/day (`10000` paise) once per overdue loan, not multiplied per overdue kist.
- Opens an overdue period on the day after the earliest past-due kist's effective due date.
- Closes the active overdue period as soon as all past-due kists are fully paid, stopping daily accrual even if accrued penalty balance remains unpaid.
- Generates idempotent operation key `penalty_<loanId>_<YYYY-MM-DD>`.
- Re-opens a new distinct overdue period if a later kist misses its due date.
