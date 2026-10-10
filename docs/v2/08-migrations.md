# Migrations (Django & Database)

CredKeep V2 relies on Django's ORM and migration system to manage the PostgreSQL schema.

## Guidelines
1. **Non-Destructive Migrations:** No migration may drop a table, remove a column, or alter a column type in a way that destroys data, without explicit product-owner approval.
2. **Sequential Integrity:** Migrations must run cleanly on a fresh database and successfully upgrade an existing database.
3. **Data Migrations:** When business logic dictates changing how data is represented (e.g., changing status strings), a `RunPython` data migration must be created to safely transition existing rows.

## Initial Setup
The initial migration (`0001_initial.py`) will mirror the finalized V2 Data Model, including:
- UUID primary keys.
- `tenant_id` foreign keys on all business models.
- Database constraints (e.g., `CheckConstraint` to ensure allocation math is correct).

## Row-Level Security (RLS) Migrations
Because Django ORM does not natively manage PostgreSQL RLS policies, custom SQL migrations (`RunSQL`) will be required immediately after the table creation migrations.
Example:
```sql
ALTER TABLE ledger_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON ledger_transaction
    USING (tenant_id = current_setting('credkeep.current_tenant')::uuid);
```
These policies must be maintained alongside schema changes.
