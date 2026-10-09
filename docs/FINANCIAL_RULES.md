# CredKeep V1 — Financial Rules & Engine Specification

**Document Version:** 1.0.0  
**Context:** Offline-First, Single-Financier Mobile Lending Ledger (Android)  
**Status:** Approved Product Rules (with explicit Legal/Business flags noted)

---

## 1. Monetary Units & Arithmetic Principles

1. **Integer Paise Storage**:
   - All monetary figures (Principal, Markup, Penalties, Collections, Balances) are stored and computed strictly as integer **Paise** (`1 INR = 100 Paise`).
   - Floats and decimals are prohibited in domain models and database tables.
   - Example: ₹2,600.00 is stored as `260000` paise; ₹100.00 daily penalty is stored as `10000` paise.
2. **Contractual Face Value Conservation**:
   $$\text{ContractualFaceValuePaise} = \text{PrincipalDisbursedPaise} + \text{ContractualMarkupPaise}$$
3. **Zero Money Leakage**:
   Every payment receipt allocates 100% of collected funds across obligations. Funds cannot disappear or be created without balanced ledger entries.

---

## 2. Overdue Penalty Engine & Overdue Period Lifecycle

### 2.1 Core Penalty Rules
- **Flat Per-Loan Daily Charge**: Default penalty is **₹100 per calendar day** (`10000` paise).
- **Per Loan, NOT Per Instalment**: The penalty applies **once per overdue loan** per chargeable calendar day, regardless of whether 1, 2, or 5 instalments are overdue.
- **Grace on Due Date**: No penalty is charged on the due date itself.
- **First Chargeable Day**: The calendar day immediately following the earliest unpaid `effective_due_date`.
- **No Compounding**: Penalties do not compound, do not earn interest, and are never capitalized into loan principal.
- **Isolated Balance**: Accrued penalties are stored in a dedicated `outstanding_penalty_paise` column, completely separate from contractual kists.
- **Legal Review Flag**: The proposed ₹100/day fee must undergo legal review against state-level Money Lenders Acts (e.g., statutory interest/fee caps and usury ceilings) before production commercial use.

### 2.2 Overdue Period Lifecycle
To ensure deterministic, auditable, and idempotent evaluation across app restarts and backup restores, penalties are modeled as discrete **Overdue Periods**:

```
[Kist Due Date: 10 Oct]
          │
          ▼ (11 Oct: Unpaid)
┌────────────────────────────────────────────────────────┐
│  OVERDUE PERIOD 1 STARTS (Charge: ₹100/calendar day)   │
└────────────────────────────────────────────────────────┘
          │
          ├─► 20 Oct: ₹1,000 accrued (10 days @ ₹100/day)
          │
          ├─► 25 Oct: Borrower pays past kists in full.
          ▼
┌────────────────────────────────────────────────────────┐
│  OVERDUE PERIOD 1 ENDS (Accrued: ₹1,400)               │
│  • Scheduled obligations now current.                  │
│  • Clock stops: ₹0/day further accrual.                │
│  • Note: Unpaid ₹1,400 penalty remains outstanding.    │
└────────────────────────────────────────────────────────┘
          │
          ▼ (No penalty accrues while loan remains current)
          │
[Next Kist Due: 10 Nov]
          │
          ▼ (11 Nov: Unpaid)
┌────────────────────────────────────────────────────────┐
│  OVERDUE PERIOD 2 STARTS (Charge: ₹100/calendar day)   │
│  • Does NOT alter or erase Period 1 records.           │
│  • Cumulative penalty = ₹1,400 + Period 2 charges.     │
└────────────────────────────────────────────────────────┘
```

#### Lifecycle State Rules:
1. **Period Initiation**:
   An overdue period opens on date $D$ if:
   - There exists at least one kist with $\text{effective\_due\_date} < D$ where $\text{kist\_balance} > 0$.
   - No active overdue period is currently open for this loan.
2. **Daily Assessment (Idempotent)**:
   For each calendar day $D$ where an overdue period is active:
   - A unique daily transaction is recorded with `operation_id = penalty_<loan_id>_<YYYY-MM-DD>`.
   - Running the evaluation multiple times on the same day assesses the fee exactly once.
3. **Period Termination**:
   An active overdue period closes on date $D$ when:
   - All instalments with $\text{effective\_due\_date} \le D$ have their contractual principal and markup fully covered.
   - **Critical Rule**: Previously accrued but unpaid penalties remain in `outstanding_penalty_paise` but **do not keep the overdue clock running**.
4. **Reopening**:
   If a later instalment misses its due date, a **new** distinct overdue period begins. Historical assessments remain immutable.

---

## 3. Extra Payments & Sequential Future Kist Reduction

CredKeep V1 eliminates complex "advance wallet" interfaces. Excess payments immediately reduce future scheduled obligations.

### 3.1 Allocation Flow
When cash $P$ is received against a loan:
1. **Unpaid Penalties Allocation** (subject to product waterfall policy): Any designated penalty portion clears `outstanding_penalty_paise`.
2. **Current & Overdue Obligations**: Funds satisfy the earliest unpaid past-due kists in chronological order of `effective_due_date`.
3. **Sequential Future Kist Reduction**:
   - If excess cash remains after clearing past-due kists, funds automatically apply to the **earliest unpaid future scheduled kist**.
   - The contractual due dates of future kists remain unchanged.
   - Future kists maintain an exact ledger of:
     - `principal_paid_paise`
     - `markup_paid_paise`
     - `status` (`PARTIALLY_PAID` or `PAID`)
4. **Surplus Beyond Total Loan Face Value**:
   - If total payments exceed the remaining face value of the entire loan, the excess is recorded as `unallocated_surplus_paise` for refunding.

### 3.2 Concrete Example
- Loan with ₹2,600 monthly kists.
- Customer pays ₹2,700 on Kist 1 due date.
- **Kist 1**: Fully paid (₹2,600). Status: `PAID`.
- **Kist 2**: Credited with ₹100. Outstanding payable on Kist 2 is now ₹2,500 due on its original scheduled date.
- No interest/profit is inflated; total loan face value remains invariant.

---

## 4. One-Time Instalment Due-Date Changes

Financiers can reschedule **one specific kist** to accommodate cashflow delays without altering other installments.

### 4.1 Data Model
In `repayment_schedules`:
- `original_due_date TEXT NOT NULL` (Immutable contractual date).
- `effective_due_date TEXT NOT NULL` (Active calculation date).

Recorded in `schedule_modifications`:
- `id`: UUIDv4
- `loan_id`: Foreign key
- `kist_id`: Target installment ID
- `original_due_date`: Unchanged contractual anchor
- `prior_effective_due_date`: Previous due date
- `revised_effective_due_date`: New due date
- `changed_at`: Timestamp
- `reason`: Free-form text (e.g., *"Mandi festival delay"*)
- `penalty_treatment`: `RETAIN` or `WAIVE`
- `waived_penalty_paise`: Amount waived if applicable

### 4.2 Behavior & Rules
- Modifying Kist 2's due date from 10 Nov to 15 Nov **leaves Kist 3 (10 Dec) completely untouched**.
- **Accrued Penalty Treatment**:
  - If penalties already accrued prior to the date extension, the financier explicitly chooses to **Retain** or **Waive**.
  - If **Waive** is selected, a noncash `PENALTY_WAIVER` transaction row is recorded, decrementing `outstanding_penalty_paise`.
  - The overdue period evaluator evaluates overdue status against `revised_effective_due_date`. If the revised date is in the future, active overdue status terminates immediately.

---

## 5. Monthly Anchor Day & Calendar Semantics

1. **Anchor Day Selection (1 to 31)**:
   - Presets provided: 1, 5, 10, 15, 20, 25, 28.
   - Custom: Any valid integer from 1 to 31.
2. **Short Month Clamping**:
   - When an anchor day exceeds the days in a given calendar month, the due date clamps to the final day of that month.
   - **Anchor Preservation**: The clamping applies *only* to the short month. Subsequent months restore the original anchor day.
   - Example (Anchor Day 31):
     - Month 1 (Jan): 31 Jan
     - Month 2 (Feb): 28 Feb (or 29 Feb in leap years) *(clamped)*
     - Month 3 (Mar): 31 Mar *(restored)*
     - Month 4 (Apr): 30 Apr *(clamped)*
     - Month 5 (May): 31 May *(restored)*

---

## 6. Cash-First Payment Recording (V1 Scope)

1. **Default Mode**: Physical cash is selected by default in collection workflows.
2. **Manual Alternatives**: UPI and Bank Transfer are supported as manual reference entries.
3. **Atomic Execution**: Balance updates, schedule allocations, and transaction logging execute within an atomic `withExclusiveTransactionAsync` block.
4. **Deferred Features**:
   - PDF generation, thermal printing, WhatsApp receipt sharing, payment gateway webhooks, and cloud sync are deferred beyond V1.

---

## 7. Required Automated Test Specifications

The financial engine test suite must enforce:

1. **On-Time Payment**: ₹2,600 paid on or before due date &rarr; ₹0 penalty, kist `PAID`.
2. **Two-Day Overdue Single Kist**: ₹2,600 paid 2 days late &rarr; 2 days $\times$ ₹100 = ₹200 accrued penalty.
3. **Multiple Overdue Kists (Two Kists)**: Both Kist 1 and Kist 2 overdue for 12 days &rarr; exactly 12 days $\times$ ₹100 = ₹1,200 penalty (NOT ₹2,400).
4. **Multiple Overdue Kists (Three Kists)**: Three kists overdue for 5 days &rarr; exactly 5 days $\times$ ₹100 = ₹500 penalty.
5. **Surplus Payment to Next Kist**: ₹2,700 paid on ₹2,600 kist &rarr; Kist 1 `PAID` (₹2,600), Kist 2 remaining due is ₹2,500.
6. **Partial Payment**: ₹1,000 paid against ₹2,600 kist &rarr; Kist 1 `PARTIALLY_PAID`, ₹1,600 remains due.
7. **Overdue Period Closure**: All past-due kists fully paid &rarr; overdue period ends; daily accrual stops even if accrued penalty balance remains unpaid.
8. **Overdue Period Reopening**: All past kists cleared in October; November kist passes due date unpaid &rarr; opens Period 2, adds ₹100/day without duplicating October assessments.
9. **Single Kist Rescheduling**: Kist 2 moved from 10 Nov to 15 Nov &rarr; Kist 3 due date remains 10 Dec.
10. **Reschedule with Penalty Waiver**: Kist rescheduled after ₹300 penalties accrued with `WAIVE` option &rarr; records `PENALTY_WAIVER`, restores penalty balance to ₹0.
11. **Idempotent Daily Assessment**: Running penalty evaluation 10 times on the same date produces exactly one ₹100 transaction.
12. **Backup Restore Determinism**: Export and restore database &rarr; recompute DPD as of fixed snapshot date &rarr; exact parity with pre-backup state.
13. **Latest Payment Reversal**: Reverse payment that reduced Kist 1 and partially credited Kist 2 &rarr; both kists and DPD restore to exact prior states.
14. **Month-End Leap Year Clamping**: Loan created with Anchor Day 31 across Jan-Feb-Mar 2028 (leap year) &rarr; Jan 31, Feb 29, Mar 31.

---

## 8. Decisions Still Requiring Product & Legal Confirmation

The following 6 parameters are documented with architect recommendations, but remain **unapproved pending product/legal sign-off**:

| # | Topic | Proposed Recommendation | Legal / Product Impact |
| :- | :--- | :--- | :--- |
| **1** | **Statutory Penalty Cap** | Cap total accrued penalties at 25% or 50% of the loan principal. | Indian Usurious Loans Act and Money Lenders Acts restrict punitive charges that exceed reasonable damages. |
| **2** | **Partial Payment Overdue Impact** | Daily ₹100 penalty continues as long as *any* non-zero balance remains on a past-due kist. | Alternatively, could scale penalty proportionally to unpaid balance. Needs product decision. |
| **3** | **Cash Allocation Priority** | Default: `Late Penalties` &rarr; `Due Kist Obligations`. Loan option: `Kist Obligations First`. | Informal market borrowers frequently dispute paying fees before principal. |
| **4** | **Accrued Fees on Due Date Extension** | Default: Accrued penalties are retained unless financier explicitly toggles "Waive Accrued Penalties". | Avoids unintentional revenue loss for the financier. |
| **5** | **Paying Penalties Alone** | Paying penalties does NOT end the overdue period if contractual kist principal/markup remains overdue. | Only clearing scheduled kists satisfies overdue status. |
| **6** | **Early Settlement / Foreclosure Rebate** | Configurable: `FLAT_NO_REBATE` (full contractual face value owed) vs `PRO_RATA_REBATE` (unearned markup credited). | Pure flat markup without rebate is common informally, but subject to legal challenge if disputed. |
