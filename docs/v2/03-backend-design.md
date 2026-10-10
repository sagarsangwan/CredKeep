# Backend Design

## Framework
- **Language:** Python 3.x
- **Framework:** Django (Stable)
- **API:** Django REST Framework (DRF)
- **Database:** PostgreSQL (via psycopg2 / psycopg3)
- **Testing:** pytest & pytest-django

## Domain Modules (Django Apps)
The backend is structured as a modular monolith. Each domain module encapsulates its own models, services, and APIs.

| Module | Responsibility |
|--------|----------------|
| `accounts` | Identity, login, registration, and devices |
| `tenants` | Lender scopes, isolation boundaries |
| `borrowers` | Borrower metadata |
| `loans` | Loan contracts, product parameters, schedules |
| `ledger` | Financial engine, transactions, allocations |
| `sync` | Offline-to-online change feeds, conflict resolution |
| `reports` | Aggregation and receipt generation |

## Request Flow
1. **Authentication:** Bearer tokens (JWT or DRF TokenAuth) identify the lender.
2. **Context Establishment:** Middleware establishes the `tenant_id` context for the request.
3. **Idempotency Check:** Command APIs check for previously processed `operation_id`s.
4. **Validation:** DRF Serializers perform schema validation. Domain services enforce business rules (e.g., verifying a loan belongs to the tenant).
5. **Database Transaction:** A single `transaction.atomic()` block commits the business logic, ledger entries, and outbox events simultaneously.
6. **Response:** A deterministic response (e.g., `accepted`, `needs_review`) is returned.
