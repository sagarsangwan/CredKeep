# Open Decisions

This document tracks decisions that have been resolved during the architecture planning phase.

## Resolved Decisions (Agreed upon with Product Owner)
1. **Tenant Structure:** 1 Tenant = 1 User (Individual Lender). No organizational hierarchies or staff roles.
2. **Offline Receipts:** Locally recorded pending server acceptance. The client trusts its ledger optimistically, showing "pending" until synced.
3. **Concurrent Collections:** Allowed. If two devices record a payment offline for the same loan, the server resolves conflicts upon sync by recalculating allocations.
4. **Backend Encryption:** Standard HTTPS/Database encryption. The backend is allowed to read plaintext data to compute reports and validate syncs.
5. **Financial Rules:** No changes. V1 rules (Paise, ₹100/day non-compounding penalty, specific bullet/instalment logic) remain perfectly intact.

*There are currently no outstanding open decisions blocking implementation.*
