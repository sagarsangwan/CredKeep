# V2 Executable Backlog

This backlog drives the autonomous execution of CredKeep V2.

## Phase 1: Backend Foundation
- [x] **CK-V2-BE-001**: Scaffold Django Project & Config
  - *Scope:* Init Django, DRF, PostgreSQL connection (psycopg3).
  - *Acceptance:* `python manage.py check` passes.
- [x] **CK-V2-SEC-001**: Implement Identity & Tenancy Models
  - *Scope:* Create Tenant, User linking, Device models.
  - *Acceptance:* Models created, initial migrations applied.
- [x] **CK-V2-SEC-002**: Implement PostgreSQL RLS
  - *Scope:* Add RunSQL migrations to enforce `tenant_id` scoping.
  - *Acceptance:* Tests prove cross-tenant queries return empty.

## Phase 2: Domain Data Models
- [x] **CK-V2-LEDGER-001**: Implement Borrower & Loan Models
  - *Scope:* Create Borrower, LoanAccount, Kist models.
- [x] **CK-V2-LEDGER-002**: Implement Transaction Models
  - *Scope:* Create append-only Transaction model and SyncOutbox.
  - *Acceptance:* Models created, migrations generated.

## Phase 3: Financial Engine Core
- [x] **CK-V2-LEDGER-003**: Implement Payment Allocation Logic
  - *Scope:* Port the V1 waterfall allocation to Python.
  - *Acceptance:* Unit tests pass against V1 fixtures.
- [x] **CK-V2-LEDGER-004**: Implement Penalty Assessment Logic
  - *Scope:* Port V1 penalty logic (₹100/day).
  - *Acceptance:* Unit tests pass against V1 fixtures.

## Phase 4: Sync API
- [x] **CK-V2-API-001**: Implement Authentication API
  - *Scope:* Registration and Login endpoints.
- [x] **CK-V2-SYNC-001**: Implement PUSH Endpoint
  - *Scope:* Accept batch operations, idempotency check, trigger allocations.
- [x] **CK-V2-SYNC-002**: Implement PULL Endpoint
  - *Scope:* Return state changes since `cursor`.

## Phase 5: Mobile Integration
- [ ] **CK-V2-MOB-001**: Mobile Auth UI & SecureStore
  - *Scope:* Add Login/Register screens, store JWT in SecureStore.
- [ ] **CK-V2-MOB-002**: Sync Client & Outbox
  - *Scope:* Modify local SQLite to mark pending txns, send to PUSH endpoint.
- [ ] **CK-V2-MOB-003**: Apply Server State
  - *Scope:* Fetch from PULL endpoint, update local SQLite.

## Phase 6: Migration & Ops
- [ ] **CK-V2-MIG-001**: V1 Local Data Extractor
  - *Scope:* Read V1 SQLite, structure into PUSH payloads.
- [ ] **CK-V2-OPS-001**: Dockerize and Deploy
  - *Scope:* Create Dockerfile, prepare `render.yaml`.
- [ ] **CK-V2-QA-001**: Final Verification
  - *Scope:* E2E test on Android device.
