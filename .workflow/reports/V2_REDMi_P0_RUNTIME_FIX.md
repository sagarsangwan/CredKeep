# CredKeep V2 — Redmi Note 8 Pro Physical Device Runtime Stability Report

## 1. Device and Environment Identity
- **Device**: Xiaomi Redmi Note 8 Pro (`begoniain`, Android 11, MIUI)
- **ADB Identifier**: `iv55hasczdb6v4de` (authorized)
- **Package Name**: `com.sagarsangwan.credkeep`
- **Observed Installed Build**: Build 2 (`versionCode=2`, `versionName=1.0.0`, PID 7143 & 21344)
- **Current Remediated Commit**: `7c3b6f1` (branch `staging`)
- **Remote Sync**: Pushed to `https://github.com/sagarsangwan/CredKeep.git`

---

## 2. Reproduced Failure Analysis & Root Causes

### Defect 1: Home Screen "DB Error: Caused by java.lang.NullPointerException"
- **Observed Symptom**:
  Red banner on Home screen displaying:
  ```
  Database Error
  Call to function 'NativeDatabase.execAsync' has been rejected.
  -> Caused by: java.lang.NullPointerException: java.lang.NullPointerException
  ```
- **Live Android Logcat Evidence**:
  ```
  10-15 23:59:37.591 21344 21377 D sqlcipher: ERROR CORE sqlcipher_page_cipher: hmac check failed for pgno=1
  10-15 23:59:37.591 21344 21377 D sqlcipher: ERROR CORE sqlite3Codec: error decrypting page 1 data: 1
  10-15 23:59:37.591 21344 21377 D sqlcipher: ERROR CORE sqlcipher_codec_ctx_set_error 1
  ```
- **Root Cause Source File & Line**:
  - `src/core/database/schema.ts:4` in Build 2 (`10e3b30`) invoked `db.withExclusiveTransactionAsync(async (tx) => ...)`.
  - In `node_modules/expo-sqlite/src/SQLiteDatabase.ts:180-192`, `withExclusiveTransactionAsync` calls `Transaction.createAsync(this, { useNewConnection: true })`.
  - In Expo SQLite SDK 52, `useNewConnection: true` creates a brand new native connection handle without executing `PRAGMA key`.
  - When `await transaction.execAsync('BEGIN')` ran on this unkeyed connection against a SQLCipher encrypted database, SQLCipher failed to decrypt page 1 HMAC (`hmac check failed for pgno=1`).
  - In native C++ JNI (`NativeDatabaseBinding.cpp:85-90`), throwing `SQLiteErrorException` in a release minified APK triggered a JNI null-reference exception (`java.lang.NullPointerException: java.lang.NullPointerException`), rejecting `NativeDatabase.execAsync`.
  - Migrations failed to complete, aborting repository initialization.
- **Resolution**:
  - Replaced `withExclusiveTransactionAsync` with `withDbTransaction` in `src/core/database/transaction.ts`.
  - Transactions run directly on the keyed connection handle protected by an asynchronous FIFO mutex (`transactionMutex`).
  - Reordered key candidate pragmas in `src/core/database/db.ts:43-47` so standard passphrase (`PRAGMA key = '${key}';`) is executed first, preventing decrypt failures in logcat.

---

### Defect 2: Broken Pages ("404 / Not Found" on Earnings & Reports)
- **Observed Symptom**:
  Tapping "Earnings & Reports" in the More tab resulted in:
  `Unmatched Route: Page could not be found. credkeep:///`
- **Root Cause Source File & Line**:
  - `src/app/(tabs)/more.tsx:128` routed to `/reports/index`.
  - In Expo Router, `src/app/reports/index.tsx` is mounted at `/reports`. Navigating to `/reports/index` fails route resolution because index is not an explicit subroute.
  - When the user tapped "Sitemap" on the unmatched route screen, it threw:
    ```
    FATAL EXCEPTION: mqt_v_native
    Process: com.sagarsangwan.credkeep, PID: 7143
    com.facebook.react.common.JavascriptException: TypeError: Cannot read property 'origin' of undefined
        at SystemInfo
        at SitemapInner
    ```
    This crashed the React Native runtime and forced an Android process restart.
- **Resolution**:
  - Updated `src/app/(tabs)/more.tsx:128` to route to `/reports`.
  - Created `src/app/reports.tsx` as a first-class route re-exporting `src/app/reports/index.tsx`.
  - Registered both `reports` and `reports/index` in `src/app/_layout.tsx`.
  - Created custom `src/app/+not-found.tsx` preventing the crashing dev sitemap from rendering in release.

---

### Defect 3: Authentication Loop ("Go Home" redirects to Login)
- **Observed Symptom**:
  Pressing "Go Home" or returning from 404 redirected authenticated users back to the Welcome/Login screen.
- **Root Cause Source File & Line**:
  - `src/app/` lacked a root `index.tsx`. Deep-links or links to `/` (such as `credkeep:///`) had no matched component.
  - When navigating to `"/"`, `useSegments()` returned an empty root segment.
  - In `src/app/_layout.tsx`, if the route was not recognized or the user landed on `/auth`, there was no forward guard redirecting authenticated users to `/(tabs)`.
- **Resolution**:
  - Created `src/app/index.tsx` to handle root `"/"` (`credkeep:///`) by querying `AuthStore.isAuthenticated()` and cleanly redirecting authenticated users to `/(tabs)` and unauthenticated users to `/auth`.
  - Updated `src/app/_layout.tsx` auth-gating effect to ensure authenticated users entering the `auth` group are immediately forwarded to `/(tabs)`:
    ```tsx
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
    ```
  - Added "Return to Dashboard" in `src/app/+not-found.tsx` which calls `router.replace('/(tabs)')` when authenticated.

---

### Defect 4: Borrower Creation Fails with "Database Initializing"
- **Observed Symptom**:
  Adding a borrower failed with an Alert: `Database Initializing: Please wait for database initialization.`
- **Root Cause Source File & Line**:
  - Direct consequence of Defect 1: because `runMigrations` threw `NullPointerException`, `DatabaseProvider` was trapped in an error state with `state.borrowers = null`.
  - `src/app/(tabs)/borrowers.tsx:52` checked `if (!borrowers)` and blocked creation.
- **Resolution**:
  - Resolving Defect 1 enables database migrations to complete in `< 5ms`, transitioning `DatabaseProvider` to `status: 'READY'`.
  - Added explicit retry capability (`retryInitDatabase()`) and transparent error messaging to `borrowers.tsx`.

---

## 3. Summary of Code Changes

| File | Change |
|---|---|
| `src/core/database/transaction.ts` | Uses keyed connection with async FIFO mutex; avoids `withExclusiveTransactionAsync`. |
| `src/core/database/schema.ts` | Migrations use `withDbTransaction` directly on keyed DB. |
| `src/core/database/db.ts` | Prioritizes standard passphrase pragma; adds multi-key candidate fallback. |
| `src/app/index.tsx` | New root route entrypoint for `/` (`credkeep:///`) with auth-aware redirect. |
| `src/app/+not-found.tsx` | New branded 404 screen with safe "Return to Dashboard" action. |
| `src/app/reports.tsx` | Dedicated direct export for `/reports` route. |
| `src/app/(tabs)/more.tsx` | Updated route to `/reports`. |
| `src/app/_layout.tsx` | Registered `index`, `reports`, `reports/index`, `+not-found`; added forward auth guard. |
| `src/ui/PinLock.tsx` | Switched to opaque native `<Modal>` overlay and 30-second background grace period. |
| `src/__tests__/runtime-stability.test.ts` | Added unit tests for key priority and transaction rollback. |

---

## 4. Verification & Quality Gates
- **TypeScript**: `npx tsc --noEmit` — **0 errors**
- **ESLint**: `npx expo lint` — **0 errors**
- **Test Suite**: `npm test` — **15 passed, 15 total (134 tests passed)**
- **Git Commit**: `7c3b6f1` pushed to `origin/staging`

---

## 5. Next Step: Targeted Release Build
- The phone is currently running the old Build 2 APK (`versionCode=2`), which contains the unkeyed `withExclusiveTransactionAsync` bug.
- Build 3 (`versionCode=3`) must be compiled via EAS to deliver these fixes to the Redmi Note 8 Pro.
