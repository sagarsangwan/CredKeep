# CredKeep V2 Render Staging Deployment

## 1. Git branch and commit

- Prepared branch: `staging`
- Verified V2 integration/base commit: `0281bea9c770e08585332115fac62b9b3d450adf` (`feat(infra): improve local Docker Compose environment and mobile API resolution`)
- Source branch: `feat/v2/migration-and-ops`
- The branch was created in an isolated Git worktree because the source checkout initially contained unrelated uncommitted changes. Those changes were committed and pushed concurrently as the verified base commit above; the unpushed staging commit was then rebased onto it.
- The deployment-preparation commit is intentionally not pushed. Its SHA is reported in the handoff after this report is committed (a commit cannot contain its own final SHA).
- `main` was not modified or checked out.

## 2. Deployment configuration

- Service name: `credkeep-v2-staging`
- Type: Render Web Service
- Runtime: Docker
- Repository: `https://github.com/sagarsangwan/CredKeep`
- Branch: `staging`
- Region: Singapore
- Instance plan: Free
- Auto-deploy: Off
- Repository root: repository root
- Dockerfile: `backend/Dockerfile`
- Docker build context: `backend`
- Render health check: `/api/v2/ready/`
- Container command: `backend/scripts/render-start.sh`
- Gunicorn bind: `0.0.0.0:${PORT:-10000}`

Render's current Blueprint specification supports `runtime: docker`, `dockerfilePath`, `dockerContext`, `region: singapore`, and `autoDeployTrigger: off`. Render documents pre-deploy commands as unavailable on Free web services. Consequently, this Free staging service has one fail-closed startup sequence: verify the PostgreSQL role, apply pending migrations, verify RLS, then replace the shell with Gunicorn. Migrations are not executed while building the image.

References:

- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploys
- https://render.com/docs/docker
- https://render.com/docs/environment-variables

## 3. Files modified

- `.gitattributes`
- `backend/Dockerfile`
- `backend/credkeep_backend/settings.py`
- `backend/scripts/render-start.sh`
- `backend/tenants/management/__init__.py`
- `backend/tenants/management/commands/__init__.py`
- `backend/tenants/management/commands/verify_database_role.py`
- `backend/tenants/management/commands/verify_rls.py`
- `backend/tenants/test_deployment_checks.py`
- `render.yaml`
- `src/core/api/client.ts` and `src/core/api/client.test.ts` were inspected and inherited from the verified base commit; they provide the deployment URL behavior but are not authored by the staging deployment commit.
- `.workflow/reports/V2_RENDER_STAGING_DEPLOYMENT.md`

## 4. Actual Render service

- Service ID: Not created.
- HTTPS URL: Not assigned.
- Authenticated Render workspace access was confirmed read-only.
- The workspace contains only the unrelated `one_backend` service; it was not modified.
- No paid resource, EAS build, or production deployment was created.

## 5. GitHub repository access

- The local Git remote and `origin/feat/v2/migration-and-ops` were available during inspection.
- Render workspace authentication is available through the connected Render integration.
- Render-specific authorization to fetch the private `sagarsangwan/CredKeep` repository remains unverified: the integration does not expose Git-provider grants separately, and attempting service creation before the `staging` branch is pushed would be invalid and unauthorized.
- The local `staging` branch is not on GitHub because pushing requires explicit Product Owner approval.

## 6. Docker build and Gunicorn startup

- Local Docker build: PASS.
- Base image: `python:3.13-slim`.
- Requirements installation inside the image: PASS.
- Docker build context and Dockerfile path: PASS.
- Startup script copied with executable permissions and LF line endings: PASS.
- Gunicorn `--check-config` importing `credkeep_backend.wsgi:application`: PASS.
- Hosted Gunicorn startup: NOT RUN because the service was not created and no staging `DATABASE_URL` was supplied.
- The startup path exits nonzero if the database is not PostgreSQL, the role is privileged, migrations fail, RLS verification fails, or Gunicorn fails.

## 7. PostgreSQL and RLS verification

- Settings require `DATABASE_URL` outside the test suite, and `DEBUG=False` additionally rejects any non-PostgreSQL URL. Tests retain their explicit in-memory SQLite default.
- `verify_database_role` requires PostgreSQL and rejects roles with `SUPERUSER` or `BYPASSRLS`.
- `verify_rls` requires all eight tenant-owned tables to have RLS enabled, RLS forced, and at least one policy.
- The existing migrations force RLS on `tenants_device` and all seven tenant-owned ledger tables.
- The same `DATABASE_URL` connection is used for startup migrations and live API requests. Under the repository's current migration design, that restricted role needs schema DDL privileges but must not have `SUPERUSER` or `BYPASSRLS`. Forced RLS prevents the table owner from bypassing these policies.
- Unit coverage for privileged-role rejection and forced-policy verification: PASS.
- Actual staging role attributes, database vendor, applied migrations, policies, and cross-tenant enforcement: NOT VERIFIED because `DATABASE_URL` was not available.
- No replacement database was created and no database or Docker volume was reset.

## 8. Environment variable names

Required or provided by the Render service:

- `DATABASE_URL` (secret, supplied privately; must be PostgreSQL)
- `SECRET_KEY` (generated by Render)
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `SECURE_SSL_REDIRECT=True`
- `RENDER_EXTERNAL_HOSTNAME` (automatically supplied by Render and appended exactly to Django's allowed hosts)
- `PORT` (automatically supplied by Render)

Optional settings supported by Django configuration:

- `CSRF_TRUSTED_ORIGINS`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SECURE`
- `SECURE_HSTS_SECONDS`

No values, credentials, database URLs, authentication tokens, or synthetic account passwords are recorded here.

## 9. Health check

- Local URL routes exist for `/api/v2/health/` and database-aware `/api/v2/ready/`.
- Docker and Render use `/api/v2/ready/` for readiness gating.
- Public HTTPS health response: NOT VERIFIED because no Render service/hostname exists.

## 10. Live API tests

Local automated results:

- Backend: 82 passed, 3 skipped. The skipped tests require a real PostgreSQL RLS database.
- Mobile/Jest: 14 suites and 129 tests passed.

Hosted checks not performed:

- Registration with a disposable synthetic account
- Login
- Authenticated request
- Unauthenticated protected request rejection
- Cross-tenant access rejection
- Borrower/loan/payment PUSH/PULL idempotency
- Service-log secret inspection

No synthetic account was transmitted because there is no hosted service.

## 11. Django security check

`python manage.py check --deploy` completed with no errors. It reported:

- Two HSTS warnings (`SECURE_HSTS_INCLUDE_SUBDOMAINS` and `SECURE_HSTS_PRELOAD`). These remain intentionally disabled because the staging service uses Render's shared `onrender.com` parent domain and must not assert policy for unrelated subdomains or request preload treatment.
- Nine existing `drf-spectacular` serializer-inference warnings for APIView schema generation. These do not expose debug tracebacks or weaken runtime authentication and are outside this bounded deployment change.

Production-like settings now include proxy-aware HTTPS detection, secure session/CSRF cookies, HTTPS redirect enabled by Render configuration, a one-hour staging HSTS duration, exact Render hostname admission, and no wildcard hosts.

## 12. Expo API URL configuration

- Expo SDK: 57.
- Client variable: `EXPO_PUBLIC_API_URL`.
- Required value after Render assigns and verifies the real hostname: `https://<ACTUAL_RENDER_HOSTNAME>/api/v2`.
- The actual hostname is intentionally not invented or hardcoded.
- Local Android/iOS development fallbacks remain unchanged when the variable is absent.
- Expo documents that `EXPO_PUBLIC_*` variables are embedded in the client bundle, so this variable must contain only the public API base URL and never credentials.

Reference: https://docs.expo.dev/guides/environment-variables/

## 13. Validation summary

- Docker image build: PASS
- Gunicorn configuration import: PASS
- Backend tests: PASS (82 passed, 3 PostgreSQL-only skipped)
- TypeScript: PASS
- Expo lint: PASS with 20 pre-existing warnings and 0 errors
- Mobile tests: PASS (129 passed)
- Django deployment check: PASS with documented warnings
- Render workspace/service inventory: PASS (authenticated; only `one_backend` exists and was left unchanged)
- Render CLI Blueprint validation: NOT RUN; the Render CLI is not installed. The Blueprint fields were checked against the current Render Blueprint/Docker/Web Service specifications.
- `graphify update .`: NOT RUN; the `graphify` executable is unavailable in this environment
- Independent autonomous Codex review: intentionally not invoked per milestone stopping rules

## 14. Remaining blockers

1. Explicit Product Owner approval is required to push local branch `staging` to GitHub.
2. After the branch is pushed, Render's GitHub integration must be verified against the private `sagarsangwan/CredKeep` repository before service creation. Workspace authentication alone does not prove repository access.
3. `DATABASE_URL` must be configured privately in Render and must point to the authorized synthetic-data staging PostgreSQL database.
4. The database role must have migration DDL permissions while remaining non-superuser and without `BYPASSRLS`; the startup guard will fail closed otherwise.
5. The Render service has not been created, so no actual service ID or hostname exists.
6. All required live health, authentication, synchronization, tenant-isolation, migration, RLS, and log checks remain pending.

Deployment state: BLOCKED. Local preparation is complete, but the hosted service is not live and no live success is claimed. `DEVICE_VERIFIED` is not claimed.

RENDER_STAGING_BLOCKED
