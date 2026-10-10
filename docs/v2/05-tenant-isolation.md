# Tenant Isolation

CredKeep V2 is a multi-tenant application where each registered Lender acts as a unique tenant. Data isolation between tenants is the most critical security requirement.

## Application-Layer Isolation
1. **Implicit Scoping:** Every authenticated request is tied to a user, and thus a `tenant_id`. API endpoints do not accept `tenant_id` as a parameter; it is injected from the session.
2. **Foreign Key Integrity:** Every top-level model (Borrower, Loan, Transaction, Device) must include a `tenant_id` foreign key.
3. **Composite Relationships:** Relationships across models implicitly validate tenancy (e.g., `LoanAccount(tenant_id, id)`).

## Database-Layer Isolation (PostgreSQL RLS)
To guard against accidental application-level query bugs, PostgreSQL Row-Level Security (RLS) will be employed.

1. **Policies:** Tables will have policies enforcing `tenant_id = current_setting('credkeep.current_tenant')`.
2. **Transaction Context:** Django middleware or a custom database router will execute `SET LOCAL credkeep.current_tenant = X` at the beginning of every request transaction.
3. **Restricted DB Role:** The Django application connects using a PostgreSQL role that is not a superuser and does not own the tables (thereby preventing it from bypassing RLS by default).

## Testing Tenant Isolation
Automated test suites MUST include scenarios where:
- Lender A attempts to fetch Borrower B using a direct URL.
- Lender A attempts to submit a `record_collection` operation against Loan B.
- Global queries (e.g., aggregate reports) are executed, proving they only sum data within the active `tenant_id` scope.
