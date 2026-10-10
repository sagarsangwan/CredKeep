# API Contract

The API uses JSON over HTTPS. Authentication is via Bearer Token.

## Base URL
`/api/v2/`

## Core Endpoints

### Authentication
- `POST /auth/register/` - Create a lender account.
- `POST /auth/login/` - Obtain session token.
- `POST /auth/device/` - Register a device push token.

### Sync Protocol
- `POST /sync/push/`
  - **Body:** `{ "operations": [ ... ] }`
  - **Response:** `{ "results": [ { "operation_id": "...", "status": "ACCEPTED" } ] }`
  - **Behavior:** Processes a batch of client operations idempotently.
- `GET /sync/pull/?cursor={cursor}`
  - **Response:** `{ "next_cursor": "...", "changes": [ ... ] }`
  - **Behavior:** Returns authoritative state changes since the last cursor.

### Reports (Online Only)
- `GET /reports/portfolio/`
  - **Response:** Summary of total outstanding principal, total active loans.
- `GET /reports/earnings/?month=YYYY-MM`
  - **Response:** Breakdown of realized markup and collected penalties.

## Operation Types (For Push)
- `create_borrower`
- `create_loan`
- `record_collection`
- `waive_penalty`
- `modify_schedule`

## Error Handling
Standard HTTP status codes are used:
- `400 Bad Request` (Invalid payload shape)
- `401 Unauthorized` (Missing/Invalid token)
- `403 Forbidden` (Tenant isolation breach attempted)
- `422 Unprocessable Entity` (Domain rule violated)
