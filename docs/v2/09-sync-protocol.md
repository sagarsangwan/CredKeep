# Offline-to-Online Sync Protocol

CredKeep V2 is an offline-first system. Mobile devices maintain a complete local replica of the lender's active portfolio.

## Core Concepts
1. **Client-Generated IDs:** The mobile app generates UUIDs for all new records (Borrowers, Loans, Transactions) and an `operation_id` for every action.
2. **Idempotent Push:** The client PUSHES operations to the server. The server tracks `operation_id`s per tenant to prevent duplicate processing.
3. **Optimistic Local State:** Locally recorded transactions instantly update the mobile UI (marked as "Pending").
4. **Server Authority:** The server re-validates the transaction against its current authoritative state.

## Protocol Flow

### 1. PUSH (Client -> Server)
- The client sends an ordered batch of unacknowledged operations.
- Example Payload:
  ```json
  {
    "device_id": "uuid",
    "operations": [
      {
        "operation_id": "uuid-1",
        "type": "record_collection",
        "loan_id": "uuid",
        "timestamp": "2026-10-10T12:00:00Z",
        "payload": { "amount_paise": 500000, "is_cash": true }
      }
    ]
  }
  ```
- The server processes them transactionally. It returns a status for each `operation_id`: `ACCEPTED`, `REJECTED`, or `NEEDS_REVIEW`.
- The client marks `ACCEPTED` items as "Synced" and clears them from the outbox.

### 2. PULL (Server -> Client)
- The client requests state changes since its last `sync_cursor`.
- The server returns all authoritative state changes (new loans, updated balances, penalty assessments).
- The client merges these updates into its SQLite database.

## Conflict Resolution
- **Concurrent Collections:** If the user records a payment on Phone A and Phone B while offline, the server accepts both. Both receipts are valid cash collections. The server re-allocates the second payment based on the updated ledger state (e.g., it might clear a newly accrued penalty or reduce future kists).
- **Stale Updates:** If a client tries to modify a loan that was settled by another device, the server returns `NEEDS_REVIEW` for the operation. The client UI will prompt the user to resolve it.
