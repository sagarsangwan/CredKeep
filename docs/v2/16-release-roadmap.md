# Release Roadmap

The V2 transformation is executed in incremental milestones, ensuring stability at each step.

## Milestone 1: Backend Foundation (Target: Week 1)
- Scaffold Django project.
- Implement Identity & Tenancy models.
- Configure PostgreSQL and RLS policies.
- Implement core data models (Borrower, Loan, Kist, Transaction).

## Milestone 2: Financial Engine (Target: Week 2)
- Replicate mobile financial allocation logic in Python.
- Create tests for waterfall allocations and penalty calculations.
- Ensure strict integer (paise) math throughout.

## Milestone 3: Sync API (Target: Week 3)
- Implement `/sync/push` and `/sync/pull` DRF endpoints.
- Add idempotency and conflict resolution logic.
- Create robust test scenarios for network drops and concurrency.

## Milestone 4: Mobile Integration (Target: Week 4)
- Add user registration/login screens to React Native.
- Wire up local SQLite changes to an Outbox queue.
- Implement background sync logic.
- Update UI to reflect "Pending" vs "Synced" states.

## Milestone 5: V1 Data Migration & Launch (Target: Week 5)
- Implement V1 to V2 local data extraction and upload.
- Perform synthetic test migrations.
- E2E testing on physical devices.
- Launch!
