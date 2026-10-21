# Test Strategy

Quality assurance for CredKeep V2 relies on strict automated testing and independent QA validation (via Codex) before any feature is considered complete.

## 1. Backend Testing (pytest)
- **Unit Tests:** Validate financial algorithms (e.g., penalty calculations, waterfall allocations) independently of the database.
- **Integration Tests:** Use `pytest-django` to spin up a test PostgreSQL database.
  - Test transaction immutability and constraints.
  - Test API endpoint schemas and responses.
- **Tenant Isolation Tests:** Ensure `tenant_id` boundaries cannot be bypassed by spoofing parameters or using another tenant's object IDs.

## 2. Sync Protocol Testing
- Simulate network drops (e.g., returning 500 midway through a batch).
- Simulate concurrent pushes from two simulated devices to the same `loan_id`.
- Verify idempotency by submitting the same `operation_id` twice.

## 3. Mobile Testing (React Native)
- **Unit Tests:** Continue using Jest for local business logic (35 tests currently passing).
- **Sync Integration:** Test the UI behavior when operations are pending vs. synced. Ensure rejected operations flag a clear error for the user.

## 4. QA Gates
- **Local Quality Gates First:** All static checks (`npx tsc --noEmit`, `npx expo lint`), unit tests (Jest), and backend integration tests (pytest) must pass before a milestone is declared ready for review.
- **Milestone Codex QA:** Independent QA validation (via Codex `gpt-6.1-sol`, Medium reasoning, read-only sandbox) is executed at most ONCE per completed milestone for high-risk domains (financial logic, payment corrections, tenant isolation, SQLCipher, auth, migrations, sync protocol).
- **Zero-Loop Remediation:** Any findings (capped at 5 actionable issues) are remediated locally and verified with local tests without automatic re-review loops.
- **Physical Acceptance:** No mobile deployment is `DEPLOYMENT_VERIFIED` without physical device validation.
