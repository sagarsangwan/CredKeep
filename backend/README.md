# CredKeep

CredKeep is an offline-oriented lending ledger for small lenders who need to record borrowers, loans, instalments ("kists"), collections, penalties, and schedule changes while keeping each lender's data isolated. This directory contains the Django REST Framework backend for CredKeep V2: it authenticates lenders, processes idempotent batches from client devices, applies the lending rules, and exposes an ordered change feed that clients can use to reconcile local state.

## Problem it solves

Small lenders often manage repayments in notebooks or spreadsheets that are difficult to reconcile across devices and easy to update inconsistently. CredKeep provides a server-side source of truth for those workflows. Monetary values are stored as integer paise, ledger operations are processed transactionally, and offline client operations carry stable IDs so retries do not intentionally create duplicate financial events.

## Current development status

The backend is under active development and should not be treated as production-ready without deployment-specific validation.

Implemented in this codebase:

- User registration and login using Django REST Framework tokens.
- One lender workspace (`Tenant`) per Django user and registration of client devices.
- Borrowers, instalment and bullet loans, repayment schedules, collections, daily late penalties, penalty waivers, and due-date modifications.
- Integer-paise schedule generation and payment allocation rules.
- Batched sync push with per-operation results and idempotency checks.
- Cursor-based sync pull backed by a per-tenant ordered outbox.
- Application-level tenant filtering and PostgreSQL row-level security migrations.
- Append-only protections for financial transactions at the model layer and, where supported, the database layer.
- Health, readiness, OpenAPI schema, Swagger UI, and Django admin endpoints.
- Pytest coverage for domain arithmetic, API flows, sync behavior, idempotency, concurrency scenarios, tenant isolation, and ledger invariants.

Incomplete, limited, or not verified here:

- This backend directory does not verify the state or completeness of a mobile client.
- PostgreSQL RLS tests are skipped when tests run on SQLite; effective isolation also depends on using a suitably restricted PostgreSQL application role.
- Authentication uses long-lived DRF tokens; token expiry, refresh, password-reset, and account-recovery flows are not implemented.
- Business resources are primarily mutated through the sync API rather than conventional CRUD endpoints.
- The penalty rate is currently fixed in the ledger service at INR 100 per overdue calendar day.
- No code-coverage threshold or generated coverage report is configured.
- Deployment automation beyond the included Dockerfile is not present in this directory.

## Features

### Lending and ledger

- Tenant-scoped borrowers with phone uniqueness per workspace.
- Instalment loans and bullet loans with generated monthly schedules.
- Month-end-aware due dates and exact paise distribution across instalments.
- Payment allocation to due instalments, penalties, future instalments, and surplus.
- Collection methods for cash, UPI, and bank transfer.
- Daily overdue penalty assessment, bounded by the server date.
- Schedule modifications and compensating reversal transactions for penalty waivers.
- Loan settlement checks and append-only transaction history.

### Offline synchronization

- Ordered batch processing through `sync/push/`.
- Supported operation types: `create_borrower`, `create_loan`, `record_collection`, `modify_schedule`, and `waive_penalty`.
- Stable `operation_id` values for retry safety and conflict detection.
- Per-operation `ACCEPTED`, `REJECTED`, or `NEEDS_REVIEW` results.
- Tenant-scoped outbox records with monotonically increasing cursors.
- Paginated delta retrieval through `sync/pull/`.

## Tech stack

| Area | Technology |
| --- | --- |
| API | Python, Django 6.1.2, Django REST Framework 3.18.3 |
| API documentation | drf-spectacular 0.30.0 / OpenAPI |
| Authentication | Django users and DRF token authentication (`Bearer` or `Token`) |
| Database | PostgreSQL via psycopg for deployed use; SQLite fallback for local development and tests |
| Configuration | django-environ |
| Testing | pytest and pytest-django |
| Serving | Gunicorn |
| Packaging | Docker (`python:3.13-slim`) |

Dependencies are pinned in [`requirements.txt`](requirements.txt).

## Architecture

```mermaid
flowchart LR
    C[Offline client] -->|register / login| A[DRF API]
    C -->|Bearer token + operation batch| M[Tenant middleware]
    M --> S[Sync push]
    S --> E[Schedule, penalty, and allocation engine]
    E --> D[(Django models / database)]
    D --> O[Per-tenant sync outbox]
    O -->|cursor-based sync pull| C
```

Authenticated requests are associated with the tenant owned by the current user. A sync push validates and processes each operation inside a database transaction, updates the authoritative ledger state, and writes corresponding outbox records. A client then pulls ordered changes after its last cursor. PostgreSQL deployments additionally set a transaction-local tenant context used by row-level security policies.

## Repository structure

```text
backend/
|-- api/                  # HTTP endpoints, token authentication, and sync orchestration
|-- credkeep_backend/     # Django settings, root URLs, WSGI, and ASGI entry points
|-- ledger/
|   |-- engine/           # Schedule, penalty, allocation, and collection rules
|   |-- migrations/       # Ledger schema, constraints, RLS, and DB triggers
|   |-- models.py         # Borrowers, loans, kists, transactions, and sync models
|   `-- tests.py          # Ledger and domain-engine tests
|-- tenants/              # Tenant/device models, middleware, RLS migration, and tests
|-- Dockerfile            # Container build and Gunicorn startup command
|-- manage.py             # Django management entry point
|-- pytest.ini            # pytest-django configuration
`-- requirements.txt      # Pinned Python dependencies
```

## Prerequisites

- Python 3.13 is the container runtime used by the project. A local Python version compatible with the pinned dependencies is required.
- PostgreSQL is recommended for behavior equivalent to deployment, particularly row-level security.
- `pip` and Python virtual environments.
- Docker is optional.

## Local setup

From the `backend` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

For macOS or Linux, activate the environment with `source .venv/bin/activate` and copy the example file with `cp .env.example .env`.

The API is then available at `http://127.0.0.1:8000/`. Interactive API documentation is served at `http://127.0.0.1:8000/api/docs/`.

### Docker & Docker Compose

**Running the full backend stack (PostgreSQL + Django API) with Docker Compose:**

From either the repository root or the `backend` directory:

```bash
docker compose up -d
```

This starts:
- **`credkeep_db`**: PostgreSQL 15 database on internal port 5432 (mapped to host `127.0.0.1:5433` by default to avoid collision with any existing local PostgreSQL and prevent external LAN exposure), preconfigured with the restricted `credkeep_app` application role for RLS.
- **`credkeep_migration`**: One-off migration job that waits for database health and applies migrations with administrative credentials before exiting.
- **`credkeep_backend`**: Django REST Framework API with Gunicorn on port `8000`, running strictly under the restricted `credkeep_app` application role after migrations complete successfully, exposing endpoints at `http://localhost:8000/`.

To inspect logs or run commands inside the container:

```bash
docker compose logs -f backend
docker compose exec backend python manage.py createsuperuser
docker compose exec backend pytest
docker compose down
```

**Single-container build (connecting to an external database):**

```bash
docker build -t credkeep-backend .
docker run --rm -p 8000:8000 --env-file .env credkeep-backend
```

The container applies migrations before starting Gunicorn. When the database is outside the container, ensure the hostname in `DATABASE_URL` is reachable from the container; `localhost` refers to the container itself.

## Environment variables

Create `.env` from [`.env.example`](.env.example) and replace the example values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | Yes | Django cryptographic signing key. Use a strong, private value outside development. |
| `DEBUG` | No | Enables Django debug mode; defaults to `False`. |
| `ALLOWED_HOSTS` | No | Comma-separated hostnames accepted by Django. |
| `DATABASE_URL` | No | Database connection URL. Without it, settings fall back to `db.sqlite3`. |
| `TEST_DATABASE_URL` | No | Optional database used by tests; tests otherwise use in-memory SQLite. |

Safe example:

```dotenv
SECRET_KEY=replace-with-a-long-random-development-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://credkeep_app:replace-me@localhost:5432/credkeep_v2
```

Never commit a populated `.env` file.

## Database and migrations

Apply all migrations with:

```bash
python manage.py migrate
```

For PostgreSQL, create the database and application role before running migrations, then point `DATABASE_URL` at them. The migrations enable and force tenant RLS policies on device and ledger tables. The application role must not have privileges such as `BYPASSRLS`; the test suite only exercises restricted-role behavior when an appropriate `credkeep_app` role is available.

SQLite is useful for local work and is the default test backend. It does not provide the PostgreSQL RLS layer. The settings enable WAL mode and a busy timeout for SQLite, while application-level tenant filters continue to apply.

Financial `Transaction` rows are protected from update and deletion by Django model/queryset checks. Migrations also install an update/delete trigger on PostgreSQL and an update trigger on SQLite.

## API overview

All paths are relative to the server root.

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v2/health/` | Public | Process health check. |
| `GET` | `/api/v2/ready/` | Public | Verifies database connectivity. |
| `POST` | `/api/v2/auth/register/` | Public | Creates a user, tenant, and API token. |
| `POST` | `/api/v2/auth/login/` | Public | Returns the user's existing or newly created token. |
| `POST` | `/api/v2/auth/device/` | Token | Registers or updates a tenant-owned device. |
| `GET`, `POST` | `/api/v2/devices/` | Token | Lists or creates devices for the authenticated tenant. |
| `POST` | `/api/v2/sync/push/` | Token | Processes an ordered batch of offline operations. |
| `GET` | `/api/v2/sync/pull/?cursor=0&limit=100` | Token | Returns ordered changes after a cursor; `limit` is capped at 500. |
| `GET` | `/api/schema/` | Public | Returns the generated OpenAPI schema. |
| `GET` | `/api/docs/` | Public | Opens Swagger UI. |
| n/a | `/admin/` | Django session | Django administration site. |

Authenticated API requests accept either header form:

```http
Authorization: Bearer <token>
```

```http
Authorization: Token <token>
```

Use the generated OpenAPI schema and the tests under `api/` as the most precise references for request and response payloads while the sync contract continues to evolve.

## Security and data isolation

The source implements the following protections:

- Password hashing and password validation through Django's authentication framework.
- Token-authenticated protected endpoints.
- One-to-one user-to-tenant ownership and tenant association in request middleware.
- Explicit tenant filters in exposed device and sync queries.
- PostgreSQL RLS policies driven by a transaction-local `credkeep.current_tenant` value.
- Atomic database transactions for requests and financial mutations.
- Database constraints for positive loan inputs, valid due days, unique operation IDs, ordered tenant sequences, and collection-allocation conservation.
- Model/queryset immutability checks and database triggers for ledger transactions.

These controls have important boundaries: SQLite does not enforce RLS, DRF tokens do not expire by default, TLS is an infrastructure concern not configured here, and correct PostgreSQL role privileges are required for RLS to provide defense in depth. No security certification or production penetration test is claimed.

## Testing

Run the configured test suite from this directory:

```bash
pytest
```

The checked-in tests cover authentication, device and tenant isolation, sync push/pull, cursor ordering, idempotent retries and conflicts, schedule generation, integer-paise conservation, payment allocation, penalties and waivers, append-only behavior, and selected concurrent-update scenarios. PostgreSQL-specific RLS tests skip on SQLite, and no coverage-report command or minimum threshold is configured.

Useful Django checks include:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
```

## Known limitations and roadmap

- Replace fixed penalty policy values with tenant-configurable, versioned rules if product requirements call for it.
- Add expiring credentials and account recovery before exposing authentication to production users.
- Validate the full sync contract against the mobile client and maintain explicit API versioning as it evolves.
- Add deployment-specific PostgreSQL role provisioning, secret management, TLS, monitoring, backups, and restore drills.
- Run the complete suite against PostgreSQL in CI so RLS and database-specific triggers are continuously exercised.
- Add coverage reporting and define an evidence-based acceptance threshold.

These are engineering gaps and candidate next steps, not commitments to a published release schedule.

## Author

[Sagar Sangwan](https://github.com/sagarsangwan)
