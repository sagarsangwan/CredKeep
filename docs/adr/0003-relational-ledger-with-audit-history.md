# 0003. Relational Transaction Ledger with Materialized Balances and Audit History

**Status**: Accepted (Supersedes ADR-0002)

## Context
CredKeep V1 is a single-financier lending ledger operating offline. The application needs fast dashboard queries, immediate balance lookups across dozens of active borrowers, strictly traceable transaction histories, and zero financial data loss or balance discrepancies.

## Decision
We implement a normalized relational financial schema with:
1. **Immutable Transaction Journal (`transactions` table)**: Every financial event (Disbursement, Collection, Penalty Assessment, Penalty Waiver, Foreclosure, Settlement Write-Off) is written as an immutable row with monotonic sequence IDs, timestamp, transaction type, and structured allocation columns (`principal_amount`, `markup_amount`, `penalty_amount`).
2. **Materialized State in Entities**: `loan_accounts` and `repayment_schedules` maintain current materialized balance columns (`outstanding_principal_paise`, `outstanding_markup_paise`, `outstanding_penalty_paise`, `status`). These balances are updated within the same atomic SQLite transaction as the journal entry.
3. **Audit Correction Log (`audit_corrections` table)**: Manual adjustments or corrections to past records are recorded as compensating transactions referencing the original transaction ID with a mandatory audit reason, preserving complete historical fidelity without in-place historical deletion.
4. **Deterministic Pure Waterfall Engine**: Payment allocations are calculated by pure TypeScript functions in memory before being committed into the relational database in an atomic transaction.
