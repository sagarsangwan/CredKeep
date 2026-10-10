# CredKeep V2 Architecture Documentation

This directory contains the complete architectural blueprint for transforming CredKeep from a V1 local-only application to a V2 offline-first, cloud-synchronized multi-tenant platform.

## Navigation
1. [01-v1-audit.md](01-v1-audit.md) - Baseline audit of the current V1 application.
2. [02-system-architecture.md](02-system-architecture.md) - High-level system topology.
3. [03-backend-design.md](03-backend-design.md) - Django/DRF application structure.
4. [04-threat-model.md](04-threat-model.md) - Security and risk mitigations.
5. [05-tenant-isolation.md](05-tenant-isolation.md) - Strategy for isolating lender data.
6. [06-data-model.md](06-data-model.md) - PostgreSQL schema and ER diagram.
7. [07-financial-invariants.md](07-financial-invariants.md) - Strict business rules for the ledger.
8. [08-migrations.md](08-migrations.md) - Django and SQL migration guidelines.
9. [09-sync-protocol.md](09-sync-protocol.md) - Offline-first synchronization design.
10. [10-sync-failure-matrix.md](10-sync-failure-matrix.md) - Edge cases and conflict resolution.
11. [11-v1-migration.md](11-v1-migration.md) - Upgrading local data to the cloud.
12. [12-api-contract.md](12-api-contract.md) - Backend REST endpoints.
13. [13-hosting.md](13-hosting.md) - Deployment to Render and Neon.
14. [14-operations.md](14-operations.md) - Maintenance and incident response.
15. [15-test-strategy.md](15-test-strategy.md) - Quality assurance gates.
16. [16-release-roadmap.md](16-release-roadmap.md) - Incremental delivery milestones.
17. [17-risk-register.md](17-risk-register.md) - Identified risks and mitigations.
18. [18-open-decisions.md](18-open-decisions.md) - Log of finalized product decisions.

## Execution
The execution of this architecture is tracked in the executable backlog located at `.workflow/V2_TASKS.md`.
