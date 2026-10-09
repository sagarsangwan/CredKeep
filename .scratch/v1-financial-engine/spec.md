# Feature Spec: V1 Financial Domain Engine

**Feature Slug:** `v1-financial-engine`  
**Status:** `ready-for-agent`  
**Context:** Core financial engine for offline-first, single-financier lending ledger (Android/React Native)

---

## 1. Objectives

Implement pure TypeScript domain modules enforcing the verified financial rules:
1. Integer paise currency representations with brand typing (`Paise`).
2. Monthly schedule generator supporting anchor days 1–31 with month-end clamping.
3. Overdue period lifecycle engine assessing ₹100/day per loan (not multiplied per kist).
4. Sequential future kist reduction for excess payments (no advance wallet interface).
5. One-time single-installment due date modification with explicit penalty treatment.
6. SQLite relational schema with insert-only transaction journal, database-enforced idempotency (`operation_id`), and materialized balance updates.

---

## 2. Invariants & Rules

- **Arithmetic**: Pure integer arithmetic in paise (`10000` paise = ₹100.00). Zero floating point operations.
- **Contractual Face Value**: $\text{FaceValue} = \text{Principal} + \text{Markup}$.
- **Overdue Penalty**: Max 1 penalty per loan per calendar day where $\text{asOfDate} > \text{earliest\_effective\_due\_date}$ and balance is unpaid.
- **Period Closure**: Overdue period ends when all past-due kists are fully paid. Accrued penalties do not keep period active.
- **Excess Allocation**: Funds in excess of past-due kists apply sequentially to earliest unpaid future kists.
- **LIFO Reversal**: Only the single latest payment on a loan account can be reversed in V1.

---

## 3. Tickets

- `01-money-and-models.md`: Pure TypeScript money types and domain contract interfaces.
- `02-schedule-and-anchor-days.md`: Schedule generation with 1–31 anchor days and month clamping.
- `03-overdue-period-engine.md`: Overdue period lifecycle and idempotent daily ₹100 penalty assessment.
- `04-allocation-and-future-kist-reduction.md`: Payment allocation engine reducing current and future kists sequentially.
- `05-due-date-modification.md`: Single kist rescheduling with penalty retain/waive handling.
- `06-sqlite-schema-and-idempotency.md`: Database migrations, triggers, constraints, and exclusive transaction wrappers.
