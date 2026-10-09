# 05-due-date-modification

Status: `ready-for-agent`

## Overview
Implement single-installment due date modification, preserving the original contractual schedule and handling accrued penalties.

## Acceptance Criteria
- Modifies `effective_due_date` of one specific kist without altering other kists.
- Records modification event in `schedule_modifications`.
- Supports penalty treatment choice (`RETAIN` vs `WAIVE`).
- If `WAIVE`, records noncash `PENALTY_WAIVER` and decrements `outstanding_penalty_paise`.
- Recomputes overdue status and closes active overdue period if the revised date is now in the future.
