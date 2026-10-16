# CredKeep V2 Neon + Render Staging Completion Report

Final status: `BLOCKED_NEON_CONFIGURATION`

## Scope and stopping condition

The bounded deployment task stopped during Neon runtime-role validation, before any source edit, commit, push, database mutation, synthetic-data operation, or new deployment attempt.

Render startup logs for `credkeep-v2-staging` show the fail-closed database guard rejecting the configured runtime connection:

```text
CommandError: The application database role must not have SUPERUSER or BYPASSRLS privileges.
```

This is a mandatory security failure. The available Render connector does not expose environment-variable values, and no authenticated browser surface was available, so the configured username could not be safely confirmed as `neondb_owner` versus another privileged role. The full `DATABASE_URL`, password, and owner credentials were not retrieved or printed.

## Files changed

- `.workflow/reports/V2_NEON_RENDER_STAGING_COMPLETE.md` only (this uncommitted blocker report)

No application, migration, financial, Docker, or Render configuration file was changed.

## Repository state

- Working branch: `staging`
- Local/remote commit before this report: `5fbf0558cb53dd727e887b8d0fc1b7bc412ad9e3`
- Staging worktree was clean before this report was created.
- GitHub push performed in this task: **NO**
- Commit created in this task: **NO**
- `main` was not modified, checked out, merged, or pushed.

## Current implementation inspection

- `backend/scripts/render-start.sh` verifies the database role, runs `migrate`, verifies RLS, then starts Gunicorn.
- `backend/Dockerfile` uses that script as its container `CMD` and binds health checks to `/api/v2/ready/`.
- Render has no Docker command override, so the script is the effective startup path.
- Django requires `DATABASE_URL` outside tests and rejects non-PostgreSQL production connections.
- `verify_database_role` rejects PostgreSQL roles with `SUPERUSER` or `BYPASSRLS`.
- `verify_rls` checks eight tenant-owned tables for enabled and forced RLS plus at least one policy.
- `TenantMiddleware` sets transaction-local `credkeep.current_tenant` for authenticated requests.
- Registration creates a Django user, one owned tenant/workspace, and a DRF token atomically.
- Borrower and synchronization operations use tenant-scoped application queries; PostgreSQL RLS supplies defense in depth.
- Migrations enable and force RLS on tenant-owned device and ledger tables.

## Render state

- Workspace: `Sagar Sangwan's Workspace`
- Service: `credkeep-v2-staging`
- Service ID: `srv-db71in0m7kps73bnl7u0`
- URL: `https://credkeep-v2-staging.onrender.com`
- Branch: `staging`
- Runtime: Docker
- Dockerfile: `./backend/Dockerfile`
- Docker context: `./backend`
- Region: Singapore
- Plan: Free
- Auto-deployment: Disabled
- Existing service `one_backend`: not modified

Existing failed deployment snapshots observed:

- `dep-db71inom7kps73bnl9o0` — `update_failed`
- `dep-db71kbon74is739ds0gg` — `update_failed`
- `dep-db71m46k1f9s73buakqg` — `update_failed`

No deployment was triggered during this task. The maximum-one-attempt allowance remains unused.

## Database role validation

- PostgreSQL connection reached the role-verification command: **YES**
- Restricted runtime-role validation: **FAILED**
- `SUPERUSER`/`BYPASSRLS` prohibition: **FAILED for the currently configured connection**
- Runtime username equals `credkeep_app`: **NOT VERIFIED**
- Runtime username equals `neondb_owner`: **NOT VERIFIED through available tooling**
- TLS and direct non-pooler Neon host: **NOT VERIFIED**
- Tenant-table ownership: **NOT VERIFIED**
- Runtime CRUD permissions: **NOT VERIFIED**
- Ability to alter protected RLS policies: **NOT TESTED**
- Cross-tenant database isolation: **NOT TESTED**

No database SQL, migration, cleanup, reset, policy change, or synthetic-data operation was executed after the security failure.

## RLS, registration, and endpoint validation

- Live `verify_rls`: **NOT RUN** because role verification failed first.
- Live registration: **NOT RUN**.
- Live login: **NOT RUN**.
- Live borrower creation: **NOT RUN**.
- Live cross-tenant authorization: **NOT RUN**.
- `/api/v2/health/`: **NOT VERIFIED in this task**.
- `/api/v2/ready/`: **NOT VERIFIED in this task**.
- HTTPS application availability: **NOT VERIFIED**.

## Tests

No local test suite was run because the mandatory remote database-role check failed before implementation began. No skipped PostgreSQL test is described as passing.

## Required Product Owner action

1. In Render, replace `DATABASE_URL` if it uses `neondb_owner` or any other privileged role.
2. Set it to the Neon direct TLS connection URL for `credkeep_app` (prefer a hostname without `-pooler`).
3. Do not provide or copy the Neon owner password into Render runtime configuration.
4. Confirm the URL uses PostgreSQL and TLS, while keeping the password private.
5. Explicitly ask the deployment engineer to resume. On resume, the engineer must re-run role validation before changing startup or triggering the single allowed deployment.

The startup migration decoupling remains required but was intentionally not implemented after the security stop condition fired.
