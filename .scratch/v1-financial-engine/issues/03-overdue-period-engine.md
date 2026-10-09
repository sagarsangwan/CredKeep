# 03-late-penalty-engine

Status: `ready-for-agent`

## Overview
Implement the simplified late penalty engine calculating ₹100/day per overdue loan, tracking overdue status without complex UI period abstractions.

## Acceptance Criteria
- Overdue days calculated as $\max(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{earliestUnpaidDueDate}))$.
- Assesses flat ₹100/day (`10000` paise) once per overdue loan, regardless of whether 1, 2, or 3 kists are overdue.
- Displays on collection UI as: `Scheduled Kist (₹2,600) + Late Penalty (₹500) = Total Payable (₹3,100)`.
- When ₹3,100 is collected, marks kist `PAID` and clears the penalty. Next month starts clean at its original scheduled ₹2,600.
- Paid penalties are never carried into future months.
- Idempotent daily assessment using operation key `penalty_<loanId>_<YYYY-MM-DD>`.
- Supports manual penalty waiver via noncash `PENALTY_WAIVER` transaction.
