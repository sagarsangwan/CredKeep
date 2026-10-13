# CredKeep V2 — Local Docker Development Environment Report

## 1. Environment & Branch Context
- **Current Branch**: `feat/v2/migration-and-ops`
- **Previous HEAD**: `8c45254` (`feat(integration): resolve four QA findings and verify live V2 end-to-end vertical slice`)
- **Docker Compose Status**: Healthy (`credkeep_db` running, `credkeep_migration` completed successfully, `credkeep_backend` running healthy)
- **Local Database Persistence**: Volume `credkeep_postgres_data` preserved intact. No volumes or financial records reset or destroyed.

---

## 2. Files Inspected & Verified
- `backend/docker-compose.yml` & `docker-compose.yml`: Verified Compose services, variable validation, health checks, network bindings, and container dependencies.
- `backend/Dockerfile`: Verified base image, build steps, dependencies, and CMD entrypoint.
- `backend/init-db.sql`: Verified PostgreSQL 15 syntax, environment variable loading via `\getenv`, dynamic SQL execution with `\gexec`, role creation, and permission boundaries.
- `backend/credkeep_backend/settings.py`: Verified database settings, SQLite fallback removal, and allowed hosts.
- `backend/api/urls.py` & `backend/credkeep_backend/urls.py`: Verified `/api/v2/health/` and `/api/v2/ready/` route mounting.
- `src/core/api/client.ts`: Verified base URL resolution, `__DEV__` guardrails, trailing slash normalization, and suffix handling.
- `app.json`: Verified Expo plugins and Android configuration.
- `.gitignore`: Verified local secrets (`.env`, `backend/.env`) are properly excluded from version control.
- `render.yaml`: Verified staging configuration remains completely distinct and unaffected by local Docker changes.

---

## 3. Exact Files Changed & Rationale

| File Path | Action | Rationale |
| :--- | :--- | :--- |
| `docker-compose.yml` | Modified | Bound PostgreSQL to `127.0.0.1`, removed hardcoded default passwords using `:?` Compose validation, separated privileged migration execution into a one-off `migration` service, passed restricted `credkeep_app` database URL to `backend`, escaped healthcheck container variables with `$$`, and cleaned `ALLOWED_HOSTS`. |
| `backend/docker-compose.yml` | Modified | Identical configuration to root `docker-compose.yml` with relative paths (`context: .`, `path: .env`) for developers running Docker from `backend/`. |
| `backend/Dockerfile` | Modified | Removed inline `python manage.py migrate` from `CMD` to eliminate privileged migration execution from the long-running application container. |
| `backend/init-db.sql` | Modified | Modernized with PostgreSQL 15 `\getenv` and `\gexec` to dynamically create `credkeep_app` using environment credentials without committing secrets; prevented assigning `public` schema ownership to `credkeep_app`; granted least-privilege table DML and sequence `USAGE, SELECT`. |
| `backend/credkeep_backend/settings.py` | Modified | Removed fallback `default=f'sqlite:///{BASE_DIR}/db.sqlite3'` from non-test configuration so Django fails closed with an explicit error if `DATABASE_URL` is missing or unreachable. |
| `src/core/api/client.ts` | Modified | Added development-only fallback (`http://10.0.2.2:8000/api/v2` on Android emulator, `http://localhost:8000/api/v2` on iOS/Web); throws an explicit error in production/staging if `EXPO_PUBLIC_API_URL` is unset; normalizes trailing slashes and ensures `/api/v2` suffix. |
| `src/core/api/client.test.ts` | Created | Unit tests verifying development fallbacks, production fail-closed behavior, URL suffix normalization, and runtime overrides. |
| `backend/.env.example` | Modified | Comprehensive template with placeholders covering PostgreSQL admin credentials, restricted app credentials, Django settings, mobile API URL patterns, and operational reference commands. |
| `backend/README.md` | Modified | Documented Docker Compose service architecture (`credkeep_db`, `credkeep_migration`, `credkeep_backend`) and localhost-bound port security. |

---

## 4. Read-Only Database Inventory & Privilege Analysis

A read-only inventory was conducted on the active `credkeep_db` database (`credkeep_v2`):
- **Database Owner**: `postgres`
- **Populated Records**: 2 tenants ("Lender A Enterprise", "Lender B Enterprise"), 1 borrower ("Farmer Suresh"), 2 loans, 2 users.
- **Roles**:
  - `postgres`: Superuser, Create DB, Create Role, Replication, Bypass RLS.
  - `credkeep_app`: No inheritance, No superuser, No create DB, No create role, No Bypass RLS.
- **Schema & Table Ownership in Existing Volume**:
  - `public` schema and the 20 tables were created during earlier development iterations under `credkeep_app`.
  - Row Level Security is active with `FORCE ROW LEVEL SECURITY` (`relrowsecurity = true`, `relforcerowsecurity = true`).
  - Policies enforce:
    ```sql
    POLICY "tenant_isolation_policy"
      USING ((tenant_id = (NULLIF(current_setting('credkeep.current_tenant'::text, true), ''::text))::uuid))
    ```

### Read-Only RLS Verification via Application Role (`credkeep_app`)
Verified directly inside `credkeep_backend` using Django's runtime database connection:
- `Active user`: `credkeep_app`
- **Unscoped Query**: `Borrower.objects.count()` returned `0` (fails closed).
- **Tenant A Scoped Query**: Returned `1` record (`Farmer Suresh`).
- **Tenant B Scoped Query**: Returned `0` records (cross-tenant access denied).

### Proposed Future Ownership Repair (For Review Only — NOT Automatically Applied)
Because `FORCE ROW LEVEL SECURITY` currently enforces tenant isolation even with `credkeep_app` as owner, and per product owner constraints, ownership commands were **not** automatically run on the existing persistent database.

When approved, the recommended repair is:
```sql
-- Step 1: Reassign object ownership to postgres
REASSIGN OWNED BY credkeep_app TO postgres;
ALTER SCHEMA public OWNER TO postgres;

-- Step 2: Grant least-privilege DML and sequence usage to credkeep_app
GRANT USAGE ON SCHEMA public TO credkeep_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO credkeep_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO credkeep_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO credkeep_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO credkeep_app;
```
*Rollback considerations:* `ALTER SCHEMA public OWNER TO credkeep_app; REASSIGN OWNED BY postgres TO credkeep_app;` can restore ownership if necessary.

---

## 5. Container & Service Verification Results

1. **Docker Compose Validation**:
   - `docker compose config`: Validated with zero syntax errors.
   - Compose validation triggers cleanly if required variables (`POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `SECRET_KEY`) are missing.
2. **Container Build**:
   - `docker compose build backend`: Image `credkeep-backend:latest` built successfully.
3. **Container Startup Sequence**:
   - `credkeep_db` started and reached `healthy` status via `pg_isready`.
   - `credkeep_migration` started, executed `python manage.py migrate --noinput`, and exited with code `0`.
   - `credkeep_backend` started Gunicorn under restricted credentials and reached `healthy` status.
4. **Port Binding Security**:
   - Host port 5434 bound strictly to `127.0.0.1:5434->5432/tcp`.
   - Native host PostgreSQL instances (port 5432 and 5433) are unaffected and non-conflicting.
5. **Endpoint Health & Database Connectivity**:
   - `GET http://127.0.0.1:8000/api/v2/health/`: HTTP 200 `{"status":"ok"}`.
   - `GET http://127.0.0.1:8000/api/v2/ready/`: HTTP 200 `{"status":"ready"}` (executes `SELECT 1` on PostgreSQL).
6. **Backend Pytest Suite**:
   - `docker exec credkeep_backend pytest`: 78 passed, 3 skipped in 45.24s.
7. **Mobile Client Tests & Typecheck**:
   - `npx jest src/core/api/client.test.ts`: 9 passed, 9 total.
   - `npx tsc --noEmit`: 0 errors.

---

## 6. Android Development Connection Guide

| Environment | Configuration | Resulting API URL |
| :--- | :--- | :--- |
| **Android Emulator** | Leave `EXPO_PUBLIC_API_URL` unset (in `__DEV__`) | `http://10.0.2.2:8000/api/v2` |
| **Physical Device (ADB Reverse)** | `adb reverse tcp:8000 tcp:8000`<br/>`EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` | `http://127.0.0.1:8000/api/v2` |
| **Physical Device (Wi-Fi LAN)** | Add workstation IP to `LAN_IP` in `backend/.env`<br/>`EXPO_PUBLIC_API_URL=http://<YOUR_PC_LAN_IP>:8000` | `http://<YOUR_PC_LAN_IP>:8000/api/v2` |
| **Render Staging** | `EXPO_PUBLIC_API_URL=https://<YOUR_SERVICE>.onrender.com` | `https://<YOUR_SERVICE>.onrender.com/api/v2` |
| **Production Build** | `EXPO_PUBLIC_API_URL` must be set | Fails closed with an explicit error if missing |

---

## 7. Blockers & Next Steps
- **Blockers**: None.
- **Next Steps**:
  1. Product Owner can review the read-only ownership inventory and decide whether to schedule the non-destructive ownership repair.
  2. Developers can start the full stack using `docker compose up -d` and connect via emulator or physical Android device.
