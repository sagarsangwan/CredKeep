# 06-sqlite-schema-and-idempotency

Status: `ready-for-agent`

## Overview
Implement SQLite database schema migrations, append-only triggers, unique idempotency constraints, and exclusive transaction wrappers.

## Acceptance Criteria
- Creates normalized schema: `borrowers`, `loans`, `repayment_schedules`, `transactions`, `loan_overdue_periods`, `schedule_modifications`.
- Triggers prevent runtime `UPDATE` and `DELETE` on `transactions`.
- Check constraints enforce non-negative balances and zero money leakage.
- `UNIQUE INDEX idx_transactions_operation_id` prevents duplicate mutations across app crashes and retries.
- Wraps multi-statement operations in `db.withExclusiveTransactionAsync`.
