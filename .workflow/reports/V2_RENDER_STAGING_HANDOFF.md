# CredKeep V2 Render Staging Handoff

Final status: `STAGING_CREATED_AWAITING_NEON`

## 1. Git branch and remote commit

- Repository: `https://github.com/sagarsangwan/CredKeep.git`
- Branch published: `staging`
- Local SHA: `5fbf0558cb53dd727e887b8d0fc1b7bc412ad9e3`
- Remote `origin/staging` SHA: `5fbf0558cb53dd727e887b8d0fc1b7bc412ad9e3`
- Latest verified V2 integration history is included in the published commit.
- `main` was not pushed, checked out, or merged.
- The staging worktree was clean before publication.
- The tracked-file scan found only documented/local placeholder database URLs; no live credential or private-key material was identified.

## 2. Push status

- `git push -u origin staging`: **SUCCESS**
- GitHub authentication and write access: **VERIFIED**
- No force-push was used.

## 3. Render service

- Workspace: `Sagar Sangwan's Workspace`
- Service name: `credkeep-v2-staging`
- Service ID: `srv-db71in0m7kps73bnl7u0`
- Dashboard: `https://dashboard.render.com/web/srv-db71in0m7kps73bnl7u0`
- Assigned HTTPS URL: `https://credkeep-v2-staging.onrender.com`
- The URL is assigned only; application health and readiness are **NOT VERIFIED**.
- Existing service `one_backend` was inspected only and was not modified.

## 4. Runtime configuration

- Type: Web Service
- Runtime: Docker
- Repository: `https://github.com/sagarsangwan/CredKeep`
- Branch: `staging`
- Dockerfile: `./backend/Dockerfile`
- Docker build context: `./backend`
- Region: Singapore
- Plan: Free
- Automatic deployment: Disabled (`autoDeploy: no`, trigger `off`)

## 5. GitHub repository access

- Render repository access: **VERIFIED**
- Evidence: Render resolved and began building commit `5fbf0558cb53dd727e887b8d0fc1b7bc412ad9e3` from the private repository.

## 6. Environment configuration

Configured directly in Render:

- `DEBUG=False`
- `SECRET_KEY` (unique generated value; stored directly in Render and not logged or committed)
- `ALLOWED_HOSTS=localhost,127.0.0.1` (Django appends Render's exact `RENDER_EXTERNAL_HOSTNAME` at runtime)
- `SECURE_SSL_REDIRECT=True`

Still required from the Product Owner:

- `DATABASE_URL`

Render supplies `PORT` and `RENDER_EXTERNAL_HOSTNAME`. Optional supported settings include `CSRF_TRUSTED_ORIGINS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, and `SECURE_HSTS_SECONDS`; they are not required for the waiting state because secure production defaults are present in Django settings.

## 7. Database and migration prerequisites

- Do not use SQLite, a Render PostgreSQL database, an existing production database, or real customer data.
- `DATABASE_URL` must use Neon's TLS-enabled direct connection endpoint initially, not a transaction-pooled endpoint.
- The runtime application role must not have `SUPERUSER`, `BYPASSRLS`, schema ownership, or table ownership privileges.
- Apply migrations separately with a controlled migration role that has only the privileges needed for migrations.
- Preserve and verify forced PostgreSQL RLS and policies on every tenant-owned table.
- The committed container startup script currently invokes `python manage.py migrate` through the runtime `DATABASE_URL`. Before live verification, treat migrations as a separate prerequisite and ensure there are no pending migrations for the restricted runtime role; do not grant ownership or broad DDL privileges merely to make startup pass.
- When explicitly resumed, verify role attributes and ownership, migration state, RLS enforcement, readiness, authentication, synthetic PUSH/PULL, and cross-tenant isolation.

## 8. Initial Render build

- Render started one initial deployment automatically when the service was created.
- Deploy ID: `dep-db71inom7kps73bnl9o0`
- Trigger: `manual` (service creation)
- Commit: `5fbf0558cb53dd727e887b8d0fc1b7bc412ad9e3`
- Status at handoff snapshot: `build_in_progress`
- No retry, redeploy, or repair loop was started.
- A successful live application is not claimed because `DATABASE_URL` is intentionally absent.

## 9. Exact remaining Product Owner steps

1. Prepare the Neon staging database with a privileged, controlled migration role and a separate restricted runtime application role.
2. Apply all Django migrations using the migration role, then revoke any temporary migration privileges.
3. Confirm the runtime role has no `SUPERUSER`, `BYPASSRLS`, schema ownership, or table ownership privileges and that Neon requires TLS.
4. In the Render service Environment dashboard, add `DATABASE_URL` using the restricted runtime role and Neon's direct TLS endpoint.
5. Do not manually redeploy yet. Explicitly ask the deployment engineer to resume verification.
6. On resume, verify connectivity, migration state, forced RLS, health/readiness, registration/login, synthetic authenticated PUSH/PULL, and cross-tenant denial before treating the assigned HTTPS URL as live.

No production deployment, paid resource, Render database, Neon project, branch merge, Android build, or modification to `one_backend` was performed.
