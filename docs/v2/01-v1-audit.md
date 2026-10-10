# CredKeep V1 Audit

## 1. Technology Stack
- **React Native:** `0.86.3`
- **Expo:** `~57.0.27`
- **Expo Router:** Used for all navigation, housed under `src/app/`. Includes tab layouts (`(tabs)`) and detail views (`borrower/[id]`, `loan/[id]`).

## 2. Database & Encryption (SQLCipher)
- Uses `expo-sqlite` and `expo-secure-store`.
- Database initialized with `PRAGMA key` for SQLCipher encryption.
- A 32-byte cryptographically secure master key is generated natively using `expo-crypto` and stored in the OS-level `SecureStore`.
- Journal mode `WAL` and `NORMAL` synchronous mode for performance.

## 3. Schema & Models
- `borrowers`: Tracks id, name, phone (UNIQUE), created_at.
- `loans`: Tracks terms, principal, markup, product type (`instalment` or `bullet`), due day.
- `repayment_schedules`: Tracks monthly kists, due dates, principal/markup components.
- `transactions`: A strictly append-only table (enforced by SQLite triggers `prevent_transactions_update` and `prevent_transactions_delete`). Records all collections and penalty assessments.
- `schedule_modifications`: Tracks changes to due dates and penalty waivers.

## 4. Financial Logic
- **Payment Allocation:** Payments are cascaded through kists (past due, present, then surplus) via `transactionRepository.recordCashPayment`.
- **Loan Products:** Supports fixed `markup` instalment loans and `bullet` (interest-only) loans.
- **Penalties:** Late penalties (₹100 per day) are assessed dynamically and materialized into the `transactions` table as `PENALTY_ASSESSMENT` records.
- **Settlement:** Loans are automatically marked `SETTLED` when all kists are paid, principal is recovered (for bullet), and penalties are cleared.
- **Values:** All money logic operates on integer paise. Floating point numbers are strictly avoided.

## 5. Security & Authentication
- **PIN Lock:** `PinLock.tsx` enforces a 4-digit PIN. Supports biometric fallback using `expo-local-authentication`.
- **Auto-lock:** The app listens to `AppState` and immediately re-locks when transitioning from inactive/background to active.

## 6. Export / Backup
- **Capabilities:** `backup.tsx` contains logic for encrypting and sharing the database file `.ckb` as an offline backup.
- **Status:** *Currently disabled in the UI* pending a cryptographic security audit of the AES key derivation.

## 7. Reporting
- The `transactionRepository` provides `getEarningsSummary` and `getBorrowerSummary`.
- Distinctly separates received cash (from `COLLECTION` transactions) from assessed/outstanding amounts.

## 8. Notifications
- **Current State:** No local or push notifications are currently implemented. (`expo-notifications` is not installed).

## 9. Workflow & QA State
- **Git State:** Currently on branch `feat/bugfix/second-phone-install`.
- **Workflow State:** `HANDOFF.md` confirms 35 unit tests are passing.
- **Outstanding Tasks:** The previous active task ("Second-phone installation failure") was marked completed. Waiting for V1 final sign-off.

## 10. V2 Compatibility & Migration Risks
| Feature | Risk | Description |
|---------|------|-------------|
| Append-only Ledger | Low | Already aligns perfectly with V2 ledger requirements. |
| SQLCipher Key | High | Migration must extract the local SQLite DB without exposing the master key, or upload records piecemeal via the new API. |
| UUID Keys | Low | Already uses UUIDs for `id`, making cloud synchronization without ID collisions much easier. |
| Multi-tenancy | Medium | V1 has no concept of a lender ID (single-user design). All existing records must be retroactively linked to the registered V2 account. |
| SQLite Triggers | Medium | The mobile DB relies on SQLite triggers. The server DB will need equivalent row-level constraints or application-layer enforcement in DRF. |
| Penalties | Medium | Penalty logic relies heavily on "Current Date". V2 Sync must tolerate clock skew and resolve discrepancies between server-time and client-time. |
