# 07-bullet-loan-settlement

Status: `ready-for-agent`

## Overview
Bullet loans (Interest-Only recurring charges) currently do not support principal repayment. The `recordCashPayment` engine allocates excess funds to `unallocated_surplus_paise` instead of settling the principal. We need to implement principal settlement for bullet loans.

## Requirements
1. Modify `recordCashPayment` in `transactionRepository.ts`.
2. If `loan.product_type === 'bullet'`, after satisfying all due and future markup kists and penalties, apply any `remainingFunds` towards the loan's principal.
3. If the cumulative principal paid across all transactions equals the `loan.principal_paise`, mark the loan as `SETTLED`.
4. The principal payment should be recorded in the `transactions` table (e.g., in `allocated_principal_paise` or a new transaction type if needed, but since it's a COLLECTION, adding to `allocated_principal_paise` of the collection transaction is correct). Wait, for a bullet loan, there is no principal in the schedule. So the allocation result doesn't return `allocatedToPrincipal` for the bullet principal part, only for kists.
5. So, `transactionRepository.ts` must manually allocate to principal, deduct from `unallocatedFunds`, and record it in `allocated_principal_paise`.
6. Alternatively, update `allocatePayment` to know about the bullet loan principal? No, `allocatePayment` only takes `kists`. The `loan.principal_paise` is not in the schedule.
7. So `transactionRepository` should handle it.

## Acceptance Criteria
- Overpayments on bullet loans go towards principal repayment after clearing markup and penalties.
- When principal is fully paid, the bullet loan closes (`status = 'SETTLED'`).
- The `allocated_principal_paise` column correctly records the principal paid.
- Regression tests exist for bullet loan partial principal payment and full settlement.
