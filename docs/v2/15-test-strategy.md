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
No task advances to `SOURCE_QA_APPROVED` without evidence of test execution and an independent Codex review. No deployment is `DEPLOYMENT_VERIFIED` without manual device validation.
