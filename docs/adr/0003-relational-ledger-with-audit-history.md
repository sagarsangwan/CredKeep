# 0003. Relational Transaction Ledger with Materialized Balances, Persistent Idempotency, and Compensating Audits

**Status**: Accepted (Supersedes ADR-0002)

## Context
CredKeep V1 is an offline-first, single-financier lending ledger operating on Android. The application requires:
1. Fast indexed dashboard and borrower queries without computing entire account histories from raw transaction logs on every render.
2. An auditable, append-only financial ledger where no historic transaction can be deleted or silently modified at runtime.
3. Persistent protection against duplicate payment entries across application crashes, background process kills, or rapid user retries.
4. Deterministic correction and reversal workflows that preserve complete historical fidelity when resolving data-entry errors.
5. Crash resilience ensuring an unexpected device shutdown or power loss mid-operation leaves zero inconsistent states between materialized balances and transaction logs.

Full event-sourcing with dynamic CQRS projections and blockchain-style hash chains were rejected (ADR-0002) as overengineered for a single-financier offline deployment.

## Decision

We implement a normalized relational financial schema using SQLite. The design combines **immutable transaction records** with **materialized balance columns**, governed by database-level constraints, atomic transaction blocks, and deterministic in-memory financial domain logic.

---

### 1. Database Configuration & Transaction Wrapper (`expo-sqlite ~57.0.4`)

Transaction execution must strictly adhere to the official API provided by the installed `expo-sqlite` package:
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

The `transactions` table represents the canonical journal of financial events (Disbursements, Collections, Advance Absorptions, Noncash Waivers, Write-Offs, Settlement Adjustments, Reversals):
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

UI debouncing and in-memory async mutexes are user-experience affordances to reduce duplicate network or bridge traffic, but **they are not correctness guarantees**. Correctness must be enforced persistently by the database engine:
- Every mutation request requires a client-generated UUIDv4 `operation_id` generated when the submission action is initiated.
- The `transactions` table enforces a persistent unique index:
  ```sql
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    operation_id TEXT NOT NULL,
    loan_id TEXT NOT NULL,
    sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_type TEXT NOT NULL, -- 'DISBURSEMENT', 'COLLECTION', 'ADVANCE_ABSORPTION', 'PENALTY_WAIVER', 'WRITE_OFF', 'REFUND', 'COLLECTION_REVERSAL'
    is_cash INTEGER NOT NULL DEFAULT 1, -- 1 for physical/bank cash flows, 0 for noncash ledger adjustments
    amount_paise INTEGER NOT NULL DEFAULT 0, -- Gross cash flow (0 for noncash adjustments)
    allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
    allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
    allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
    unallocated_advance_paise INTEGER NOT NULL DEFAULT 0,
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
  If a duplicate submission occurs (e.g., following an app restart after an interrupted response or double-tap), SQLite raises a `SQLITE_CONSTRAINT_UNIQUE` violation. The repository intercepts this specific error, queries the existing transaction by `operation_id`, and safely returns the existing record without mutating balances.

---

### 4. Database Constraints & Cash Allocation Separation

To prevent corrupt or invalid states, schema constraints enforce financial validity directly in SQLite:
- **Non-Negative Balances**:
  ```sql
  CHECK (outstanding_principal_paise >= 0)
  CHECK (outstanding_markup_paise >= 0)
  CHECK (outstanding_penalty_paise >= 0)
  CHECK (unallocated_advance_paise >= 0)
  ```
- **Separation of Cash Flows vs. Noncash Allocations**:
  - Cash collections require positive cash amounts:
    ```sql
    CHECK (transaction_type != 'COLLECTION' OR (is_cash = 1 AND amount_paise > 0))
    ```
  - Noncash accounting operations (Waivers, Absorptions, Write-Offs) must never register cash inflows:
    ```sql
    CHECK (transaction_type NOT IN ('PENALTY_WAIVER', 'ADVANCE_ABSORPTION', 'WRITE_OFF') OR (is_cash = 0 AND amount_paise = 0))
    ```
- **Zero Money Leakage on Cash Collections**:
  Every cash collection row must satisfy exact allocation conservation:
  ```sql
  CHECK (transaction_type != 'COLLECTION' OR 
         (allocated_principal_paise + allocated_markup_paise + 
          allocated_penalty_paise + unallocated_advance_paise = amount_paise))
  ```
- **Foreign Key Protection**:
  All relational dependencies enforce `ON DELETE RESTRICT`, preventing accidental orphan creation or parent record deletion.

---

### 5. Materialized Balances & Lightweight Startup Validation

To ensure fast UI rendering without running full-table aggregation queries on every screen view, `loans` and `repayment_schedules` maintain materialized balance columns:
- `outstanding_principal_paise`
- `outstanding_markup_paise`
- `outstanding_penalty_paise`
- `unallocated_advance_paise`
- `status` (`ACTIVE`, `SETTLED`, `OVERDUE`, `WRITTEN_OFF`)

#### Dual-Write Atomicity
Every state change writes to `transactions` and updates the materialized columns on `loans` and `repayment_schedules` within the same `withExclusiveTransactionAsync` block. If a process terminates mid-write, SQLite WAL rollback ensures neither write persists.

#### Lightweight Startup Validation
To prevent startup latency from scaling with transaction volume, app startup executes only a lightweight $O(1)$ health check:
1. `PRAGMA quick_check(1);` verifying SQLite B-tree file integrity.
2. Read `schema_version` from `system_metadata`.
3. Read `ledger_dirty_flag` from `system_metadata`. If `0` (clean previous shutdown), app startup proceeds immediately.

#### Full Reconciliation Triggers
A full, exhaustive ledger recalculation is deferred to specific events:
1. **Post-Restore**: Immediately following a backup archive restoration.
2. **Post-Migration**: Following an applied database schema migration.
3. **Crash Recovery**: If startup detects an unclean shutdown (`ledger_dirty_flag = 1`) or if `quick_check` reports an error.
4. **On-Demand Diagnostics**: Triggered manually by the financier from the Settings & Diagnostic screen.

---

### 6. Comprehensive Reconciliation Equations

When full reconciliation executes, the system asserts mathematical identity across the entire ledger, strictly separating cash receipts from noncash accounting adjustments:

1. **Cash Ledger Reconciliation**:
   $$\text{TotalCashCollected} = \sum_{\substack{T \in \text{transactions} \\ T.\text{transaction\_type} = \text{'COLLECTION'}}} T.\text{amount\_paise} - \sum_{\substack{R \in \text{transactions} \\ R.\text{transaction\_type} = \text{'REFUND'}}} R.\text{amount\_paise}$$
   *Noncash waivers, absorptions, and write-offs have $\text{amount\_paise} = 0$ and never inflate this total.*

2. **Principal Balance Reconciliation**:
   $$\text{MaterializedPrincipal} = \text{PrincipalDisbursed} - \sum \text{AllocatedPrincipal} - \sum \text{ForgivenPrincipal} + \sum \text{ReversedPrincipal}$$

3. **Markup Balance Reconciliation**:
   $$\text{MaterializedMarkup} = \text{ContractualMarkup} - \sum \text{AllocatedMarkup} - \sum \text{ForgivenMarkup} + \sum \text{ReversedMarkup}$$

4. **Penalty Balance Reconciliation**:
   $$\text{MaterializedPenalty} = \sum \text{AccruedPenalties} - \sum \text{AllocatedPenalty} - \sum \text{ForgivenPenalty} + \sum \text{ReversedPenalty}$$

5. **Advance Credit Buffer Reconciliation**:
   $$\text{MaterializedAdvance} = \sum \text{AdvanceReceiptsFromCollections} - \sum \text{AdvanceAbsorbedIntoKists} - \sum \text{AdvanceRefundedCash}$$

6. **Total Outstanding Receivable**:
   $$\text{TotalReceivable} = \text{MaterializedPrincipal} + \text{MaterializedMarkup} + \text{MaterializedPenalty} - \text{MaterializedAdvance}$$

If any delta $> 0$ paise occurs during full reconciliation, the diagnostic engine flags an integrity violation and can recalculate materialized columns directly from the immutable transaction journal.

---

### 7. Historical Reversal Policy & V1 Scope Limitation

Reversing historical payments when subsequent payments or allocations exist creates complex timeline re-allocations and shifts retroactive interest and penalties:

1. **V1 Policy: Latest-Payment Reversal Only (LIFO)**:
   In V1, **only the single latest active payment on a specific loan account may be reversed**.
2. **Rejection of Historical Reversals**:
   If a financier attempts to reverse an older payment when subsequent payments exist on that loan account, the engine **strictly rejects the request** with `CANNOT_REVERSE_HISTORICAL_PAYMENT`. The application will never silently rewrite or cascade changes through downstream transactions.
3. **Compensating Reversal Transaction**:
   The reversal inserts a compensating transaction of type `COLLECTION_REVERSAL`:
   - `is_cash = 1` (records an offsetting cash outflow).
   - Inverted allocation legs matching the original transaction.
   - Restores the affected kist status (`PAID` &rarr; `PENDING` or `PARTIALLY_PAID`).
   - Re-evaluates unallocated advance balances.
4. **Dynamic State & DPD Recomputation**:
   - Days Past Due (DPD) is recomputed dynamically as of the current calculation date (`asOfDate`) against the now-unpaid due dates:
     $$\text{DPD} = \max\left(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{dueDate}) - \text{gracePeriodDays}\right)$$
   - Overdue penalty evaluations are updated based on the restored unpaid balances.
5. **Deferred Scope**:
   Arbitrary out-of-order historical corrections are deferred beyond V1 until a formal, audited timeline re-allocation engine is specified.

---

### 8. Treatment of Advances, Noncash Waivers, Write-Offs, and Loan Closures

- **Advance-Credit Buffer & Absorption**:
  - *Receipt Phase*: When a borrower pays more than currently due obligations, the excess is logged in the `COLLECTION` transaction under `unallocated_advance_paise`. Cash is recognized **only at this receipt time**.
  - *Absorption Phase*: When a future kist arrives at its scheduled due date, an internal noncash transaction of type `ADVANCE_ABSORPTION` is recorded:
    - `is_cash = 0`, `amount_paise = 0`.
    - Generates its own deterministic `operation_id` (e.g., `loan_<ID>_kist_<NUM>_absorb`).
    - Explicit `effective_date` set to the kist due date.
    - Allocates funds into `allocated_principal_paise` and `allocated_markup_paise`.
    - Decrements `loans.unallocated_advance_paise` by the absorbed sum in the same atomic transaction.
    - *Invariant*: This internal transfer never touches the cash ledger, preventing advance funds from being counted twice.
- **Noncash Penalty Waivers**:
  - Recorded as a `PENALTY_WAIVER` transaction: `is_cash = 0`, `amount_paise = 0`, `forgiven_penalty_paise = waived_amount`.
  - In the same transaction block, `outstanding_penalty_paise` is decremented.
  - *Invariant*: Waivers never increase cash collection figures.
- **Separation of SETTLED Loan Closure vs. Accounting Write-Offs**:
  - `SETTLED`: Represents legal discharge of debt obligation (via complete repayment, approved foreclosure, or mutually executed One-Time Settlement compromise). No further collection is legally or operationally permitted. Recorded via `LOAN_SETTLEMENT` with explicit settlement payment and any forgiven concessions.
  - `WRITTEN_OFF`: Represents an **accounting impairment of bad debt**. It flags the loan as an accounting loss, but **does not extinguish the legal or operational right to recover funds**. Outstanding receivables remain tracked in ledger records, and subsequent recovery collections remain permissible.
  - The domain model independently records:
    - `settlement_type`: `FULL_REPAYMENT`, `FORECLOSURE_REBATE`, `ONE_TIME_SETTLEMENT`, `BAD_DEBT_WRITE_OFF`.
    - `forgiven_principal_paise`, `forgiven_markup_paise`, `forgiven_penalty_paise`.
    - `closure_reason`: Free-form audit text.

---

## Required Test Scenarios

The financial test suite must explicitly validate:

1. **Latest-Payment Reversal & Historical Rejection**:
   - Verify that reversing the single latest payment restores exact kist balances and DPD.
   - Verify that attempting to reverse an earlier payment when subsequent payments exist is blocked with a validation error.
2. **Persistent Idempotency After App Restart**:
   - Submit a collection with `operation_id`, terminate the application process, restart, and re-submit the identical `operation_id`.
   - Verify zero duplicate ledger rows and that the repository returns the existing transaction.
3. **Exception Rollback vs. Process-Termination Recovery**:
   - *Exception Rollback*: Throw a JavaScript runtime error inside `withExclusiveTransactionAsync`; verify the transaction catches the error and cleanly rolls back in-memory state and SQLite tables.
   - *Process-Termination Recovery*: Simulate sudden process termination (SIGKILL) while write statements are in-flight in SQLite WAL; verify that upon subsequent database restart, SQLite WAL recovery cleanly rolls back partial writes, leaving zero orphan rows or corrupt balances.
4. **Month-End Due Dates & Calendar Semantics**:
   - Verify schedule generation anchored on Jan 31 clamps correctly to Feb 28 (or Feb 29 in leap years), Mar 31, and Apr 30.
5. **Penalty Idempotency**:
   - Execute the overdue assessment routine multiple times on the same calendar day for an overdue kist; verify that late penalties accrue exactly once.
6. **Negative Balances & Overpayment Advance Routing**:
   - Attempt to record transactions that push balances below 0; verify SQLite check constraints reject the write.
   - Verify that legitimate overpayments route surplus into `unallocated_advance_paise`.
7. **Advance Absorption Lifecycle**:
   - Record an overpayment into advance, execute `ADVANCE_ABSORPTION` on the next kist, verify that cash collection totals do not change, and verify unallocated advance decreases.
8. **Backup Restoration DPD & Reconciliation Verification**:
   - Restore a `.ckenc` backup file into a clean database.
   - Evaluate reconstructed DPD against a **fixed, frozen `asOfDate`** (the backup snapshot timestamp) to confirm exact parity with pre-backup state.
   - Independently evaluate DPD against the **current date** to confirm forward aging functions correctly.

---

## Consequences

- **Positive**:
  - Fast single-row indexed queries replace multi-table aggregation joins on dashboard views.
  - Audit history is protected against runtime modification via SQLite trigger constraints.
  - Database-level idempotency prevents duplicate submissions for identical operation IDs.
  - Complete mathematical separation prevents noncash waivers and internal advance absorptions from distorting cash accounting.
  - Clear separation between accounting write-offs and legal debt settlement.
- **Negative / Trade-offs**:
  - Reversals in V1 are constrained to the latest payment (LIFO), preventing arbitrary out-of-order historical edits until a full timeline re-allocation engine is built.
  - Dual-write pattern requires developer discipline to keep materialized columns and journal rows in sync within exclusive transactions.
