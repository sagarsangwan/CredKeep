# 0003. Relational Transaction Ledger with Materialized Balances, Persistent Idempotency, and Direct Kist Penalties

**Status**: Accepted (Supersedes ADR-0002)

## Context
CredKeep V1 is an offline-first, single-financier lending ledger operating on Android. The application requires:
1. Fast indexed dashboard and borrower queries without computing entire account histories from raw transaction logs on every render.
2. An auditable, append-only financial ledger where no historic transaction can be deleted or silently modified at runtime.
3. Persistent protection against duplicate payment entries across application crashes, background process kills, or rapid user retries.
4. An intuitive, transparent penalty model: ₹100/day assessed per overdue loan (not multiplied per overdue kist), cleared alongside the instalment, with next month starting clean at its scheduled amount.
5. Direct sequential allocation of extra payments to future scheduled kists without exposing a complex advance-wallet interface.
6. Support for one-time instalment due-date revisions while preserving original contractual due dates and historical penalties.
7. Crash resilience ensuring an unexpected device shutdown or power loss mid-operation leaves zero inconsistent states between materialized balances and transaction logs.

Full event-sourcing with dynamic CQRS projections and blockchain-style hash chains were rejected (ADR-0002) as overengineered for a single-financier offline deployment.

## Decision

We implement a normalized relational financial schema using SQLite. The design combines **immutable transaction records** with **materialized balance columns**, governed by database-level constraints, atomic transaction blocks, and deterministic in-memory financial domain logic.

---

### 1. Database Configuration & Transaction Wrapper (`expo-sqlite ~57.0.4`)

Transaction execution strictly adheres to the official API provided by the installed `expo-sqlite` package:
- **Pragma Initialization**:
  On every database connection open:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  ```
- **Transaction Wrapper**:
  All multi-statement financial mutations must execute inside:
  ```typescript
  await db.withExclusiveTransactionAsync(async (tx) => {
    // Financial statements executed here
  });
  ```
- **Prohibition on Raw Transaction SQL**:
  Never execute manual SQL strings such as `BEGIN TRANSACTION`, `BEGIN IMMEDIATE`, or `COMMIT` directly inside `withExclusiveTransactionAsync`. In `expo-sqlite`, transaction lifecycle and locking are managed by the native bridge wrapper; manual transaction SQL causes internal state collisions and crashes.
- **Concurrency & Locking**:
  `withExclusiveTransactionAsync` acquires an exclusive lock (`BEGIN EXCLUSIVE` natively). Other concurrent asynchronous read/write queries are blocked until the block completes and commits, or automatically rolls back on an unhandled exception.

---

### 2. Append-Only Transaction Invariants & Immutability Safeguards

The `transactions` table represents the canonical journal of financial events (Disbursements, Collections, Penalties, Waivers, Adjustments, Reversals, Write-Offs):
- **Insert-Only Enforcement**:
  SQLite triggers actively prevent `UPDATE` and `DELETE` operations at runtime:
  ```sql
  CREATE TRIGGER prevent_transactions_update
  BEFORE UPDATE ON transactions
  BEGIN
    SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
  END;

  CREATE TRIGGER prevent_transactions_delete
  BEFORE DELETE ON transactions
  BEGIN
    SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
  END;
  ```
- **Monotonic Sequence Ordering**:
  Transactions record an auto-incrementing integer `sequence_number` along with an ISO-8601 UTC timestamp to provide unambiguous ordering during reconciliation and audit replays.

---

### 3. Persistent Database-Enforced Payment Idempotency

UI debouncing and in-memory async mutexes are user-experience affordances to reduce duplicate network or bridge traffic, but **they are not correctness guarantees**. Correctness is enforced persistently by the database engine:
- Every mutation request requires a client-generated UUIDv4 `operation_id` generated when the submission action is initiated.
- The `transactions` table enforces a persistent unique index:
  ```sql
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    operation_id TEXT NOT NULL,
    loan_id TEXT NOT NULL,
    sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_type TEXT NOT NULL, -- 'DISBURSEMENT', 'COLLECTION', 'PENALTY_ASSESSMENT', 'PENALTY_WAIVER', 'WRITE_OFF', 'REFUND', 'COLLECTION_REVERSAL'
    is_cash INTEGER NOT NULL DEFAULT 1, -- 1 for physical/bank cash flows, 0 for noncash ledger adjustments
    payment_method TEXT NOT NULL DEFAULT 'CASH', -- 'CASH', 'UPI', 'BANK_TRANSFER'
    amount_paise INTEGER NOT NULL DEFAULT 0, -- Gross cash flow (0 for noncash adjustments)
    allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
    allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
    allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
    unallocated_surplus_paise INTEGER NOT NULL DEFAULT 0,
    forgiven_principal_paise INTEGER NOT NULL DEFAULT 0,
    forgiven_markup_paise INTEGER NOT NULL DEFAULT 0,
    forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
    effective_date TEXT NOT NULL, -- ISO date YYYY-MM-DD
    created_at TEXT NOT NULL, -- ISO-8601 UTC timestamp
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
  );

  CREATE UNIQUE INDEX idx_transactions_operation_id ON transactions(operation_id);
  ```
- **Idempotent Handling**:
  If a duplicate submission occurs (e.g., following an app restart after an interrupted response or double-tap), SQLite raises a `SQLITE_CONSTRAINT_UNIQUE` violation. The repository intercepts this error, queries the existing transaction by `operation_id`, and safely returns the existing record without mutating balances.

---

### 4. Simplified Late Penalty Behavior & Per-Loan Cap

The penalty model matches the product owner's direct mental model without complex UI period abstractions:
1. **Per-Loan Daily Fee**: The penalty rate is ₹100 per calendar day (`10000` paise).
2. **Per Loan, Not Per Instalment**: If multiple kists are overdue simultaneously, the fee does NOT multiply. Overdue days are calculated from the earliest unpaid effective due date:
   $$\text{OverdueDays} = \max\left(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{earliestUnpaidDueDate})\right)$$
   $$\text{LatePenalty} = \text{OverdueDays} \times ₹100$$
3. **Clean Monthly Cycles**:
   - For an overdue installment, the UI displays:
     $$\text{Total Payable} = \text{Scheduled Kist (₹2,600)} + \text{Late Penalty (₹500)} = \mathbf{₹3,100}$$
   - When ₹3,100 is collected, that month's installment is marked **Paid** and the penalty is **Cleared**.
   - **Next Month Starts Clean**: The next month sits at its original scheduled amount of ₹2,600. Paid penalties are never carried into future months.
4. **Idempotent Daily Assessment**: Running penalty calculations multiple times on the same calendar day assesses the fee exactly once using key `penalty_<loan_id>_<YYYY-MM-DD>`.

---

### 5. Extra Payments & Sequential Future Kist Reduction

CredKeep V1 eliminates advance-wallet interfaces:
- Extra cash beyond current obligations applies immediately to reduce the **earliest unpaid future scheduled kist(s)** in chronological order.
- In `repayment_schedules`:
  ```sql
  CREATE TABLE repayment_schedules (
    id TEXT PRIMARY KEY NOT NULL,
    loan_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL,
    original_due_date TEXT NOT NULL, -- Contractual anchor date
    effective_due_date TEXT NOT NULL, -- Active calculation date (modified via schedule_modifications)
    principal_component_paise INTEGER NOT NULL,
    markup_component_paise INTEGER NOT NULL,
    total_due_paise INTEGER NOT NULL,
    principal_paid_paise INTEGER NOT NULL DEFAULT 0,
    markup_paid_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIALLY_PAID', 'PAID'
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
  );
  ```
- Extra payments directly increase `principal_paid_paise` and `markup_paid_paise` on future kists. The future kist displays its remaining net payable balance without changing its scheduled due date.
- Any payment exceeding the total face value of the entire loan is routed to `unallocated_surplus_paise` for refunding.

---

### 6. One-Time Single-Instalment Due-Date Changes

Financiers can reschedule a single kist without disrupting other dates:
- Recorded in `schedule_modifications`:
  ```sql
  CREATE TABLE schedule_modifications (
    id TEXT PRIMARY KEY NOT NULL,
    loan_id TEXT NOT NULL,
    kist_id TEXT NOT NULL,
    original_due_date TEXT NOT NULL,
    prior_effective_due_date TEXT NOT NULL,
    revised_effective_due_date TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    reason TEXT,
    accrued_penalty_action TEXT NOT NULL, -- 'RETAIN' or 'WAIVE'
    waived_penalty_paise INTEGER NOT NULL DEFAULT 0,
    operation_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (kist_id) REFERENCES repayment_schedules(id) ON DELETE RESTRICT
  );
  ```
- Only the target kist's `effective_due_date` updates in `repayment_schedules`. Subsequent kist due dates remain intact.
- If `accrued_penalty_action = 'WAIVE'`, a noncash `PENALTY_WAIVER` transaction row is inserted in the same atomic transaction, reducing `outstanding_penalty_paise`.

---

### 7. Comprehensive Reconciliation Equations

When full reconciliation executes, the system asserts mathematical identity across the entire ledger:

1. **Cash Ledger Reconciliation**:
   $$\text{TotalCashCollected} = \sum_{\substack{T \in \text{transactions} \\ T.\text{transaction\_type} = \text{'COLLECTION'}}} T.\text{amount\_paise} - \sum_{\substack{R \in \text{transactions} \\ R.\text{transaction\_type} = \text{'REFUND'}}} R.\text{amount\_paise}$$
   *Noncash waivers, bad-debt write-offs, and daily penalty assessments have $\text{amount\_paise} = 0$ and never inflate cash totals.*

2. **Principal Balance Reconciliation**:
   $$\text{MaterializedPrincipal} = \text{PrincipalDisbursed} - \sum \text{AllocatedPrincipal} - \sum \text{ForgivenPrincipal} + \sum \text{ReversedPrincipal}$$

3. **Markup Balance Reconciliation**:
   $$\text{MaterializedMarkup} = \text{ContractualMarkup} - \sum \text{AllocatedMarkup} - \sum \text{ForgivenMarkup} + \sum \text{ReversedMarkup}$$

4. **Penalty Balance Reconciliation**:
   $$\text{MaterializedPenalty} = \sum \text{AccruedPenalties} - \sum \text{AllocatedPenalty} - \sum \text{ForgivenPenalty} + \sum \text{ReversedPenalty}$$

5. **Schedule Balance Reconciliation**:
   For every kist $k$:
   $$\text{RemainingKistPayable}_k = \text{total\_due\_paise}_k - (\text{principal\_paid\_paise}_k + \text{markup\_paid\_paise}_k)$$

6. **Total Outstanding Receivable**:
   $$\text{TotalReceivable} = \text{MaterializedPrincipal} + \text{MaterializedMarkup} + \text{MaterializedPenalty} - \text{MaterializedSurplus}$$

---

### 8. Historical Payment Reversal Policy (LIFO)

1. **Latest-Payment Reversal Only (LIFO)**:
   In V1, **only the single latest active payment on a specific loan account may be reversed**.
2. **Rejection of Historical Reversals**:
   If a financier attempts to reverse an older payment when subsequent payments exist on that loan account, the engine **strictly rejects the request** with error code `CANNOT_REVERSE_HISTORICAL_PAYMENT`. The application will not perform silent cascading reallocations or multi-transaction rewrites.
3. **Compensating Reversal Transaction**:
   The reversal inserts a compensating transaction of type `COLLECTION_REVERSAL`:
   - Offsetting cash outflow logged.
   - Allocation legs inverted.
   - Scheduled kist paid amounts restored in reverse order.
   - Dynamic recomputation of Days Past Due (DPD) as of current calculation date.

---

## Required Automated Test Scenarios

The financial test suite must explicitly validate:
1. **On-Time Payment**: Full payment of ₹2,600 on due date &rarr; status `PAID`, ₹0 penalty, next month starts clean at ₹2,600.
2. **Single Kist 5 Days Late**: ₹2,600 paid 5 days late &rarr; $5 \times ₹100 = \mathbf{₹500}$ penalty; total collected ₹3,100; kist `PAID`, penalty cleared; next month starts clean at scheduled ₹2,600.
3. **Independent Consecutive Late Payments**: Month 1 paid 5 days late (₹3,100 collected); Month 2 paid 5 days late &rarr; independently payable as ₹3,100; zero penalty carried from Month 1.
4. **Multiple Overdue Kists (Two Kists)**: Two kists overdue for 12 days &rarr; total penalty on loan is exactly $12 \times ₹100 = \mathbf{₹1,200}$ (not ₹2,400).
5. **Multiple Overdue Kists (Three Kists)**: Three kists overdue for 5 days &rarr; total penalty on loan is exactly $5 \times ₹100 = \mathbf{₹500}$ (not ₹1,500).
6. **Surplus Payment to Next Kist**: ₹2,700 paid on ₹2,600 kist &rarr; Kist 1 `PAID` (₹2,600), Kist 2 remaining payable is ₹2,500 due on its original scheduled date.
7. **Lump Sum Across Multiple Kists**: ₹6,000 paid against ₹2,600 kists &rarr; Kist 1 `PAID` (₹2,600), Kist 2 `PAID` (₹2,600), Kist 3 `PARTIALLY_PAID` (₹800 paid, ₹1,800 remaining).
8. **Partial Payment**: ₹1,000 paid against ₹2,600 kist &rarr; Kist 1 `PARTIALLY_PAID`, ₹1,600 remaining due.
9. **Single Kist Rescheduling**: Kist 2 moved from 10 Nov to 15 Nov &rarr; Kist 3 due date remains 10 Dec; paid on 15 Nov incurs ₹0 penalty.
10. **Reschedule with Penalty Waiver**: Kist extended after ₹300 penalties accrued with `WAIVE` option &rarr; records `PENALTY_WAIVER`, restores penalty balance to ₹0.
11. **Penalty Stops When Current**: All overdue kists cleared &rarr; penalty accrual stops immediately; future kists sit at scheduled ₹2,600.
12. **Penalty Resumes on Later Miss**: Loan current in Oct; Nov kist missed &rarr; daily ₹100 accrual resumes starting day after Nov due date.
13. **Idempotent Daily Assessment**: Running penalty evaluation 10 times on the same date produces exactly one ₹100 daily fee.
14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and ₹100 of K2 &rarr; both kists and DPD restore to exact prior states.
15. **Month-End Leap Year Clamping**: Loan created with Anchor Day 31 across Jan-Feb-Mar 2028 (leap year) &rarr; Jan 31, Feb 29, Mar 31.
16. **Exception Rollback vs. Process-Termination Recovery**:
    - *Exception Rollback*: Verify transaction rollback on runtime exception.
    - *Process-Termination Recovery*: Verify SQLite WAL recovery on native crash leaving zero corruption.

---

## Consequences
- **Positive**:
  - Direct mental model aligns with real-world field collections.
  - Zero carrying of paid penalties into future months.
  - High query speed via materialized balances on loans and schedules.
  - Zero duplicate penalties or double-collections via database-enforced idempotency keys.
  - Excess funds reduce future kists without advance-wallet confusion.
  - Flexible field rescheduling without breaking subsequent schedules.
- **Negative / Trade-offs**:
  - Reversals in V1 are constrained to the latest payment (LIFO), preventing arbitrary out-of-order historical edits.
  - Materialized balances require strict discipline to update only within exclusive transactions alongside journal rows.
