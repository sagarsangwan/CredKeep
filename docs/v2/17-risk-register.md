# Risk Register

| Risk ID | Description | Impact | Probability | Mitigation Strategy |
|---------|-------------|--------|-------------|---------------------|
| **R01** | **Sync Conflicts on Concurrent Writes:** Two devices attempt conflicting actions on the same loan offline. | High | Low | Implement robust server-side re-allocation. Never discard cash receipts. |
| **R02** | **Floating Point Errors:** Python or JS accidentally introduces rounding errors in financial data. | High | Medium | Strictly enforce integer (paise) types in models. Linting rules against float division. |
| **R03** | **RLS Misconfiguration:** Row-Level Security policy contains a flaw, leaking tenant data. | Critical | Low | Comprehensive automated isolation tests. Use DRF query scoping as primary defense; RLS is secondary. |
| **R04** | **Render Free Tier Cold Starts:** Server spins down, causing the first mobile sync to take 10-15 seconds. | Low | High | The app is offline-first. The user doesn't wait for sync to use the app. Background tasks handle the delay gracefully. |
| **R05** | **V1 Migration Failure:** Extracting data from the V1 encrypted DB fails on some edge-case devices. | High | Medium | Migration is non-destructive. If it fails, the user remains on V1 offline mode until a patch is released. |
