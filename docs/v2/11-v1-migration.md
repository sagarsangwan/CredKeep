# V1 Data Migration Strategy

Existing V1 users have a local SQLite database encrypted with SQLCipher. The migration to V2 must safely transition this data to the cloud backend.

## Constraints
- The user's local encryption key MUST NEVER leave the device.
- The local ledger is the only copy. Do not delete it until verification succeeds.
- Migration must be resumable if interrupted.

## Migration Flow
1. **Account Creation:** The user upgrades to the V2 app and is prompted to register a cloud account (creating their `tenant_id`).
2. **Local Scan:** The app detects an existing V1 SQLite database.
3. **Migration Screen:** User is prompted to migrate local data to the cloud.
4. **Data Extraction:** The app decrypts the V1 database locally and reads the tables (Borrowers, Loans, Transactions).
5. **Batch Upload:**
   - The app constructs API requests to a dedicated `/api/v2/migration/import` endpoint.
   - It sends records in batches, preserving the original `id`s (UUIDs) and `operation_id`s.
   - The server accepts these, linking them to the user's `tenant_id`.
6. **Reconciliation:** Once uploaded, the client queries the server for portfolio totals (Total Active Loans, Total Outstanding Balance). It compares these to its local V1 totals.
7. **Finalization:** If totals match, the V1 database is archived/tombstoned, and the app transitions entirely to the V2 SQLite replica architecture.

## Fallback
If the migration fails or totals mismatch, the user can cancel. The V1 database remains untouched, and they can try again later.
