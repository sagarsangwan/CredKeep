# Threat Model

**Protected Assets:** Borrower PII, loan contracts, financial transaction history, encryption keys, and session tokens.

## Threat Vectors & Mitigations

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Cross-tenant Data Leakage** | Lender A accesses Lender B's data via ID substitution. | Enforced `tenant_id` on all queries. PostgreSQL Row-Level Security (RLS) as a defense-in-depth safety net. |
| **Lost/Stolen Device** | Unauthorized access to local SQLite data. | Local database encrypted via SQLCipher. App locked behind a PIN/Biometric screen. Session tokens can be revoked server-side. |
| **Replay Attacks** | A network retry causes a payment to be applied twice. | All sync commands require a client-generated UUID (`operation_id`). The server idempotently discards duplicates. |
| **Unauthorized Staff Access** | A revoked device continues to issue offline receipts. | Offline receipts are explicitly marked "Pending". Upon sync, the server will reject them if the account/device is revoked. |
| **Data Manipulation in Transit** | Man-in-the-middle altering sync payloads. | Strict TLS 1.2+ requirement. DRF schema validation ensures payloads match expected types. |
| **Backend Database Compromise** | Attacker dumps the PostgreSQL database. | Infrastructure-level access controls, strong database passwords, and provider-level encryption at rest (Neon). |

## Authorization Model
- **Single-lender:** Since 1 tenant = 1 user, any valid session token for User X grants full access to Tenant X's data.
- **Backend Visibility:** The backend has read access to the plaintext data to compute reports and perform sync validations (standard HTTPS encryption, no E2E encryption).
