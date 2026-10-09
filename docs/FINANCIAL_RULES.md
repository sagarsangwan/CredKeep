# CredKeep V1 — Financial Rules & Calculation Engine

**Status:** Approved & Simplified Product Specification  
**Context:** Offline-First, Single-Financier Mobile Lending Ledger (Android)

---

## 1. Monetary Units & Arithmetic Principles

1. **Integer Paise Storage**:
   - All monetary figures (Principal, Markup, Penalties, Collections, Balances) are stored and computed strictly as integer **Paise** (`1 INR = 100 Paise`).
   - Floating-point arithmetic is prohibited in domain logic and database schema.
   - Example: ₹2,600.00 is stored as `260000` paise; ₹100.00 daily late fee is stored as `10000` paise.
2. **Contractual Face Value Conservation**:
   $$\text{ContractualFaceValuePaise} = \text{PrincipalDisbursedPaise} + \text{ContractualMarkupPaise}$$
3. **Strict Separation of Balances**:
   Contractual principal and markup are tracked independently from late penalties. Penalties never compound and are never added to principal.

---

## 2. Simplified Late Penalty Behavior

### 2.1 The Core Mental Model
In the user interface, the financier sees a simple, transparent breakdown for any overdue installment:

$$\text{Total Payable} = \text{Scheduled Instalment} + \text{Late Penalty}$$

- **Rate**: ₹100 per calendar day (`10000` paise).
- **Grace**: No penalty on the due date itself. The first chargeable day is the day immediately following the due date.
- **Example (Single Kist)**:
  - Scheduled Kist: ₹2,600
  - Paid 5 days late: Late Penalty = $5 \times ₹100 = \mathbf{₹500}$
  - Total Collected: ₹2,600 + ₹500 = **₹3,100**
  - **Outcome**: The kist is marked **Paid**, and the ₹500 penalty is **Cleared**.
  - **Next Month**: Starts fresh at its original scheduled amount of **₹2,600**. Paid penalties are **never carried into future months**. If the next month is also paid 5 days late, its payable is independently ₹3,100.

### 2.2 Multiple Overdue Instalments (Per-Loan Cap)
If a borrower misses multiple instalments simultaneously:
- **The penalty does NOT multiply per instalment.**
- The loan incurs a maximum of **₹100 per calendar day total**.
- Overdue days are calculated from the **earliest unpaid effective due date**:
  $$\text{OverdueDays} = \max\left(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{earliestUnpaidDueDate})\right)$$
  $$\text{ActiveLatePenalty} = \text{OverdueDays} \times ₹100$$

#### Concrete Example:
- Kist 1 (₹2,600) was due on `10 Oct`.
- Kist 2 (₹2,600) was due on `10 Nov`.
- On `22 Nov` (36 days after Kist 1, 12 days after Kist 2):
  - Total overdue days on the loan = **43 days** (from 11 Oct to 22 Nov).
  - Total Late Penalty = $43 \times ₹100 = \mathbf{₹4,300}$ (NOT $43 \times 100 + 12 \times 100$).
  - Total to bring loan current: Kist 1 (₹2,600) + Kist 2 (₹2,600) + Penalty (₹4,300) = **₹9,500**.

### 2.3 Clearing Overdue Status
- When all instalments whose due dates have passed are paid:
  - The loan is **current**.
  - No further late penalties accrue.
  - Future instalments sit at their original scheduled amounts.
- **Manual Waiver**:
  The financier can waive the late fee at any time (e.g., collect ₹2,600 instead of ₹3,100). The app marks the kist Paid and writes a `PENALTY_WAIVER` noncash audit record for ₹500.

---

## 3. Extra Payments Automatically Reduce Future Kists

CredKeep V1 eliminates advance wallets, credit balances, and virtual holding accounts.

### 3.1 Direct Sequential Reduction
- Any cash collected in excess of current due amounts is automatically applied to reduce the **earliest unpaid future scheduled kist(s)** in chronological order.
- Future kists show their reduced remaining balance directly.
- Original contractual due dates of future kists **do not change**.

### 3.2 Concrete Examples
- **Example A (Small Surplus)**:
  - Kist 1 due today: ₹2,600.
  - Borrower pays: ₹2,700.
  - Kist 1: Marked **Paid** (₹2,600 allocated).
  - Kist 2 (due next month): Receives ₹100 credit. **Remaining payable on Kist 2 is now ₹2,500**.
- **Example B (Lump Sum Covering Future Kists)**:
  - Monthly kists: ₹2,600 each. Kist 1 due today.
  - Borrower pays: ₹6,000.
  - Kist 1: **Paid** (₹2,600 allocated).
  - Kist 2: **Paid** (₹2,600 allocated).
  - Kist 3: **Partially Paid** (₹800 allocated, ₹1,800 remaining payable on its scheduled date).
  - Kists 4–10: Remain at ₹2,600 each.

---

## 4. One-Time Single-Instalment Due Date Changes

The financier can reschedule a single kist without shifting other months.

- **Example**:
  - Original Schedule: Kist 1 (10 Oct), Kist 2 (10 Nov), Kist 3 (10 Dec).
  - Borrower requests extra time for Kist 2: Financier moves Kist 2 to **15 Nov**.
  - **Outcome**: Kist 2 is due 15 Nov. **Kist 3 remains due on 10 Dec**.
- **Penalty Handling on Date Change**:
  - Overdue calculations use `effective_due_date` (15 Nov).
  - If the kist had already accrued penalties before the extension, the UI presents a clear choice:
    - **Retain Penalty**: Already accrued penalties remain payable.
    - **Waive Penalty**: Already accrued penalties are waived to ₹0.
  - In both cases, no *new* penalties accrue between 10 Nov and 15 Nov.

---

## 5. Monthly Anchor Day & Calendar Semantics

1. **Anchor Day Selection (1 to 31)**:
   - Quick presets: 1, 5, 10, 15, 20, 25, 28.
   - Custom: Any integer from 1 to 31.
2. **Short Month Clamping**:
   - For months with fewer days than the anchor day, the due date clamps to the final day of that month.
   - Subsequent months restore the original anchor day.
   - Example (Anchor Day 31):
     - Jan: 31 Jan
     - Feb: 28 Feb (or 29 Feb in leap years) *(clamped)*
     - Mar: 31 Mar *(restored)*
     - Apr: 30 Apr *(clamped)*

---

## 6. Cash-First Payment Recording

- **Cash** is the default payment method.
- **UPI** and **Bank Transfer** are available as manual reference options.
- The UI displays:
  - `Scheduled Kist`: ₹2,600
  - `Late Penalty`: ₹500 (if late)
  - `Total Amount Received` input (prefilled with total payable)
- Recording payment executes atomically: updates kist status, reduces balances, logs the transaction journal entry.
- Minimal on-screen confirmation shown; external receipt printing and WhatsApp sharing are deferred beyond V1.

---

## 7. Financial Engine Test Specifications

The pure TypeScript domain test suite must validate:

1. **On-Time Payment**: Pay ₹2,600 on due date &rarr; Kist marked `PAID`, ₹0 penalty, next month starts clean at ₹2,600.
2. **Single Kist 5 Days Late**: Pay ₹2,600 five days late &rarr; penalty calculated as $5 \times ₹100 = \mathbf{₹500}$; total collected ₹3,100; kist `PAID`, penalty cleared; next month starts clean at ₹2,600.
3. **Independent Consecutive Late Payments**: Month 1 paid 5 days late (₹3,100 collected); Month 2 paid 5 days late &rarr; independently payable as ₹3,100 (₹500 penalty), no penalty carried over from Month 1.
4. **Two Overdue Kists (Single Daily Rate)**: Both Kist 1 and Kist 2 overdue for 12 days &rarr; total penalty on loan is exactly $12 \times ₹100 = \mathbf{₹1,200}$ (NOT ₹2,400).
5. **Three Overdue Kists**: Three kists overdue for 5 days &rarr; total penalty on loan is exactly $5 \times ₹100 = \mathbf{₹500}$ (NOT ₹1,500).
6. **Surplus Payment to Next Kist**: ₹2,700 paid on ₹2,600 kist &rarr; Kist 1 `PAID` (₹2,600), Kist 2 remaining payable is ₹2,500 due on its original date.
7. **Lump Sum Across Multiple Kists**: ₹6,000 paid against ₹2,600 kists &rarr; Kist 1 `PAID` (₹2,600), Kist 2 `PAID` (₹2,600), Kist 3 `PARTIALLY_PAID` (₹800 paid, ₹1,800 remaining).
8. **Partial Payment**: ₹1,000 paid against ₹2,600 kist &rarr; Kist 1 `PARTIALLY_PAID`, ₹1,600 remaining due.
9. **Single Kist Rescheduled**: Kist 2 changed from 10 Nov to 15 Nov &rarr; Kist 3 remains due on 10 Dec. Paid on 15 Nov incurs ₹0 penalty.
10. **Reschedule with Waiver**: Kist extended after ₹300 penalties accrued, with waiver selected &rarr; penalty balance resets to ₹0; kist due date extended.
11. **Penalty Stops When Current**: All overdue kists cleared &rarr; penalty accrual stops immediately; future kists sit at scheduled ₹2,600.
12. **Penalty Resumes on Later Miss**: Loan current in Oct; Nov kist missed &rarr; daily ₹100 accrual resumes starting day after Nov due date.
13. **Idempotent Daily Assessment**: Running penalty evaluation 10 times on the same date produces exactly one ₹100 daily fee.
14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and ₹100 of K2 &rarr; K1 and K2 restore exact prior unpaid balances; DPD recalculates cleanly.
15. **Anchor Day 31 Clamping**: Anchor Day 31 over Jan-Feb-Mar 2028 (leap year) &rarr; Jan 31, Feb 29, Mar 31.

---

## 8. Remaining Product & Legal Decisions (Marked Unapproved)

The following parameters are documented with architect recommendations, but remain **unapproved pending formal confirmation**:

1. **Statutory Penalty Cap**:
   - *Status*: **Needs Legal Review**.
   - *Recommendation*: Cap total accrued penalties at 25% or 50% of the loan principal to comply with Indian state Money Lenders Acts and Usurious Loans Act 1918.
2. **Partial Payment Impact on Daily Overdue Accrual**:
   - *Status*: **Needs Product Decision**.
   - *Recommendation*: The ₹100 daily fee continues as long as *any* non-zero balance remains on a past-due kist.
3. **Cash Allocation Priority (Penalties vs Kists)**:
   - *Status*: **Needs Product Decision**.
   - *Recommendation*: Default to clearing `Penalties` first, with a loan-origination toggle for `Kists First` to accommodate informal borrower expectations.
4. **Early Loan Settlement / Foreclosure Rebate**:
   - *Status*: **Needs Product Decision**.
   - *Recommendation*: Support configurable settlement options: `FLAT_NO_REBATE` (full contractual face value owed) vs `PRO_RATA_REBATE` (unearned markup credited).
