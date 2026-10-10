# Financial Invariants

The backend must enforce the following financial constraints independently of the mobile app to ensure integrity.

## 1. Immutability
- **Transactions:** The `transactions` table is append-only. No UPDATE or DELETE operations are permitted on existing collections or assessments.
- **Reversals:** Mistakes must be corrected by issuing a new compensating transaction (e.g., `transaction_type = 'REVERSAL'`) rather than deleting the original record.

## 2. Integer Math (Paise)
- All financial fields (`principal_paise`, `amount_paise`) are stored and computed as exact integers.
- Floating-point calculations are strictly prohibited in the Python backend ledger logic.

## 3. Allocation Constraints
For any given collection transaction:
- `allocated_principal_paise + allocated_markup_paise + allocated_penalty_paise + unallocated_surplus_paise` MUST EXACTLY EQUAL `amount_paise`.
- The total `principal_paid_paise` across all kists for a loan must never exceed the loan's `principal_paise`.

## 4. Penalty Rules (Preserved from V1)
- Late penalty is ₹100 per calendar day per overdue loan, starting the day after the due date.
- Penalties do not compound.
- A penalty assessment is represented as a distinct `PENALTY_ASSESSMENT` transaction record, increasing the total outstanding balance.

## 5. Settlement
- A loan transitions to `SETTLED` state only when:
  - All scheduled kists are `PAID`.
  - The outstanding principal is zero (for bullet loans).
  - All assessed penalties have been cleared (allocated to collections or explicitly waived).
