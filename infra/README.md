# CredKeep V2 — Infrastructure & Docker Compose

This directory contains the canonical local container infrastructure for CredKeep V2. It provisions a multi-container stack with dedicated privilege boundaries for database schema migrations, runtime API serving, and PostgreSQL Row Level Security (RLS).

---

## Architecture Overview

```
                      +---------------------------------------+
                      |               Host Machine            |
                      |  127.0.0.1:8000       127.0.0.1:5434  |
                      +-------+-------------------+-----------+
                              |                   |
                     [HTTP API Traffic]    [Host DB Tools / psql]
                              |                   |
+-----------------------------v-------------------v-------------------------------+
| Docker Bridge Network ('credkeep_default')                                     |
|                                                                                 |
|   +-----------------------+     depends_on     +----------------------------+   |
|   |   credkeep_backend    | -----------------> |       credkeep_db          |   |
|   |  (Django / Gunicorn)  |                    |   (PostgreSQL 15 Alpine)   |   |
|   |  Role: 'credkeep_app' |                    |   Port: 5432 (internal)    |   |
|   +-----------------------+                    |   Volume: postgres_data    |   |
|               ^                                +----------------------------+   |
|               | depends_on (success)                          ^                 |
|   +-----------+-----------+                                   |                 |
|   |   credkeep_migration  | ----------------------------------+                 |
|   |  (One-off Django DDL) |   (privileged connection)                           |
|   |  Role: 'postgres'     |                                                     |
|   +-----------------------+                                                     |
+---------------------------------------------------------------------------------+
```

### Services

| Service | Container Name | Image / Context | Role & Privilege | Lifecycle |
|---|---|---|---|---|
| `db` | `credkeep_db` | `postgres:15-alpine` | PostgreSQL 15 server with RLS enabled | Long-running service (`restart: unless-stopped`) |
| `migration` | `credkeep_migration` | Built from `../backend` | Superuser (`postgres`) for DDL migrations | One-off task (`restart: "no"`); exits after migration |
| `backend` | `credkeep_backend` | Built from `../backend` | Restricted application role (`credkeep_app`) | Long-running service (`restart: unless-stopped`) |

---

## Security Boundaries & Least Privilege

1. **Restricted Runtime Role (`credkeep_app`):**
   - The backend runs strictly under `credkeep_app`.
   - This role has `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, and `NOBYPASSRLS`.
   - It cannot create, alter, or drop tables, schemas, or RLS policies.
   - It only possesses DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on existing tenant tables.

2. **Privileged Migration Separation:**
   - Schema modifications (DDL) are performed only by the `migration` container using the `postgres` administrative role.
   - The runtime `backend` container waits for `migration` to complete before starting, ensuring that the runtime application never needs elevated database permissions.

3. **Row Level Security (RLS):**
   - RLS is forced on all tenant-owned ledger and device tables (`FORCE ROW LEVEL SECURITY`).
   - Every request is filtered by `TenantMiddleware` setting the session-local `credkeep.current_tenant` variable.
   - Startup verification (`verify_database_role` and `verify_rls`) fails closed if the database connection has superuser privileges or if RLS is inactive.

4. **Network Exposure:**
   - The PostgreSQL port is bound strictly to `127.0.0.1:${DB_PORT:-5434}` to eliminate accidental exposure to the local network (LAN/Wi-Fi).
   - Only port `8000` is published for HTTP API clients.

---

## Environment Configuration

The local stack separates database credentials from application configuration:

| File | Purpose | Version Control |
|---|---|---|
| `infra/db.env.example` | Template for local database credentials | Tracked in Git |
| `infra/db.env` | Local PostgreSQL credentials and internal migration URL | Git-ignored (Local only) |
| `backend/.env.example` | Template for Django backend settings | Tracked in Git |
| `backend/.env` | Local Django secret key, debug mode, and runtime database URL | Git-ignored (Local only) |

### Initial Setup

```bash
# 1. Copy infrastructure environment file
cp infra/db.env.example infra/db.env

# 2. Copy backend environment file
cp backend/.env.example backend/.env

# 3. Edit infra/db.env and backend/.env with your local development passwords
```

---

## Essential Commands

Run these commands from the repository root:

### 1. Start Stack
Starts the database, runs schema migrations, and starts the Django backend API:
```bash
docker compose -f infra/docker-compose.yml up -d
```
*(Alternatively, from the `infra/` directory, simply run `docker compose up -d`)*

### 2. View Logs
Follow real-time backend API logs:
```bash
docker compose -f infra/docker-compose.yml logs -f backend
```
Follow database logs:
```bash
docker compose -f infra/docker-compose.yml logs -f db
```

### 3. Check Container Status
Inspect service health states:
```bash
docker compose -f infra/docker-compose.yml ps
```

### 4. Stop Stack (Safe & Preserving)
Stops and removes containers while **preserving** the persistent PostgreSQL volume:
```bash
docker compose -f infra/docker-compose.yml down
```
> [!CAUTION]
> **NEVER** use `docker compose down -v` or `docker volume rm`.
> The `-v` flag destroys persistent volumes and will permanently erase local test lenders, borrowers, and transaction histories.

---

## Verification & Diagnostics

### Health & Readiness Endpoints
```bash
# Process health check
curl http://127.0.0.1:8000/api/v2/health/
# Response: {"status":"ok"}

# Database connectivity & readiness
curl http://127.0.0.1:8000/api/v2/ready/
# Response: {"status":"ready"}
```

### Verify Runtime Database Role
Ensures the runtime application role is restricted and does not have `SUPERUSER` or `BYPASSRLS`:
```bash
docker compose -f infra/docker-compose.yml exec backend python manage.py verify_database_role
# Output: Database role is restricted and RLS-capable.
```

### Verify Row Level Security (RLS)
Verifies that all tenant-owned tables have enabled and forced RLS policies:
```bash
docker compose -f infra/docker-compose.yml exec backend python manage.py verify_rls
# Output: RLS is enabled, forced, and policy-backed on 8 tables.
```

### Run One-Off Migrations Manually
If you add new Django models or migrations during development:
```bash
docker compose -f infra/docker-compose.yml run --rm migration
```

### Run Test Suite in Container
Execute sync API and ledger unit tests against the running container environment:
```bash
docker compose -f infra/docker-compose.yml exec backend pytest api/tests_sync.py
```

---

## Reset-Free Troubleshooting

1. **Port 5434 / 5432 Already in Use:**
   If another PostgreSQL instance is running locally on port 5434, change `DB_PORT` in `infra/db.env`:
   ```dotenv
   DB_PORT=5435
   ```
   Then recreate the containers:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

2. **Rebuilding Backend Image:**
   When Python dependencies or Dockerfile scripts change:
   ```bash
   docker compose -f infra/docker-compose.yml build backend
   docker compose -f infra/docker-compose.yml up -d
   ```

3. **Connecting via Host Tools (TablePlus, DBeaver, psql):**
   Connect using the restricted application role to test RLS queries as a client:
   ```bash
   psql -h 127.0.0.1 -p 5434 -U credkeep_app -d credkeep_v2
   ```
   Or connect using the administrative role for inspection:
   ```bash
   psql -h 127.0.0.1 -p 5434 -U postgres -d credkeep_v2
   ```
