# Sync Failure Matrix

This matrix defines the expected system behavior when various edge cases or failures occur during the offline-to-online synchronization process.

| Scenario | Expected Behavior |
|----------|-------------------|
| **Network drops during PUSH** | Client receives no ACK. Client will retry the exact same batch later. Server uses `operation_id` to ignore duplicates if it actually processed the original request. |
| **Two devices create a borrower offline** | Both are uploaded. If names/phones differ, they are treated as two distinct borrowers. Duplicate detection via phone number can surface a warning, but they remain separate entities unless merged. |
| **Device A and Device B record a payment on the same loan concurrently** | Both devices upload their receipts. The server accepts both, allocating the first arrival normally, and allocating the second arrival against the *newly updated* balances (which may reduce future kists or settle the loan). Both clients pull the updated allocations. |
| **Client sends a payment for a settled loan** | The server records the transaction (money was received), but marks it as `unallocated_surplus_paise`. The loan remains settled. |
| **Clock Skew (Device time is 2 days behind)** | The server accepts the client's `timestamp` as the *claimed collection time* but stamps it with the *server receipt time*. Penalties are strictly governed by the server's timezone-aware clock to prevent devices from avoiding late fees by backdating payments. |
| **Device wiped / reinstalled** | User logs in. Client performs a full PULL. Any un-synced "pending" operations from the wiped installation are permanently lost (cannot recover offline data that never reached the server). |
| **Client attempts cross-tenant sync** | The server's authentication middleware scopes all operations to the logged-in user's `tenant_id`. Any `loan_id` referenced that belongs to another tenant will result in a 404/403, and the operation is `REJECTED`. |
