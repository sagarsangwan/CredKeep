# 06-sqlite-schema-and-idempotency

Status: `ready-for-agent`

## Overview
Implement SQLite database schema migrations, append-only triggers, unique idempotency constraints, and exclusive transaction wrappers.

## Implementation Blocker (Must Correct Before Migration)
- **Defect in ADR-0003 `transactions` table DDL**: The schema specification mistakenly declares two primary keys: `id TEXT PRIMARY KEY NOT NULL` and `sequence_number INTEGER PRIMARY KEY AUTOINCREMENT`. SQLite rejects multiple primary key declarations with `table "transactions" has more than one primary key`, and restricts `AUTOINCREMENT` strictly to `INTEGER PRIMARY KEY`.
- **Correction Before Migration**: Normalize the table definition to use either:
  1. `sequence_number INTEGER PRIMARY KEY AUTOINCREMENT` with `id TEXT NOT NULL UNIQUE` (recommended for SQLite auto-incrementing audit log), or
  2. `id TEXT PRIMARY KEY NOT NULL` with an application/trigger-sequenced monotonic counter.

## Acceptance Criteria
- Correct the DDL primary key conflict before generating SQL migration statements.
- Creates normalized schema: `borrowers`, `loans`, `repayment_schedules`, `transactions`, `loan_overdue_periods`, `schedule_modifications`.
- Triggers prevent runtime `UPDATE` and `DELETE` on `transactions`.
- Check constraints enforce non-negative balances and zero money leakage.
- `UNIQUE INDEX idx_transactions_operation_id` prevents duplicate mutations across app crashes and retries.
- Wraps multi-statement operations in `db.withExclusiveTransactionAsync`.
