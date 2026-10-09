# QA Report: CK-P0-002 (Monthly Kist Settlement)

## Objective
Trace the payment allocation engine to ensure instalment loans correctly mark Kists as 'PAID' or 'PARTIALLY_PAID', handle overpayments, and properly determine settlement. 

## Diagnostics & Root Cause
- **Bug 1 (Unresolved PENDING status)**: Kists that were perfectly paid (`amountPaid >= amountDue`) but had `status: 'PENDING'` were skipped by `allocatePayment` if the current payment amount was 0, leaving them as `PENDING`. This prevented the loan from being marked as settled.
- **Bug 2 (Amount Paid reduction on overpayment)**: If a kist was overpaid and still marked `PENDING`, `Math.min(remainingFunds, remainingDue)` produced a negative allocation, stealing funds from the kist's paid amount to artificially balance it.

## Verification
- Added failing tests to `src/core/domain/allocation.test.ts` to reproduce the bugs.
- Fixed `updatedKists` initialization in `allocation.ts` to explicitly resolve `PENDING` statuses to `PAID`, `PARTIALLY_PAID`, or `UNPAID` based on actual math, ignoring the stale database default.
- Added a fallback to ensure `PAID` is applied if `amountPaid >= amountDue`.
- Ran `npm test -- -t "allocation"`:
  - 7 tests passed (including the two new regression tests).
- Ran full test suite (`npm test`): 32 tests passed.
- Ran `npx tsc --noEmit` and `npx expo lint`: 0 errors.

## Result
**SOURCE_QA_APPROVED**: The fix guarantees correct status resolution regardless of initial database state and properly cascades payments/overpayments.
