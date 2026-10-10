# Operations & Maintenance

This document outlines the operational procedures for managing the CredKeep V2 backend.

## Monitoring & Logging
- **Structured Logging:** Django will use structured JSON logging. Logs will be streamed to the Render console.
- **Error Tracking:** (Future) Integration with Sentry for real-time exception tracking.
- **Audit Logs:** Financial corrections or administrative overrides must be logged to the `SecurityAuditEvent` table with a timestamp, `tenant_id`, and reason.

## Database Backups
- **Neon Automation:** Neon automatically takes backups and allows point-in-time recovery (within the limits of the free tier).
- **Manual Snapshots:** Before any major schema migration, a manual snapshot of the database should be taken.

## Incident Response
- **Tenant Data Corruption:** If a tenant's local sync gets corrupted, they can clear app data and perform a full `PULL` from the server to restore their authoritative state.
- **Migration Failures:** If a Django migration fails mid-deployment, the previous Render build can be rolled back. Database rollbacks rely on Neon branching/snapshots.

## Key Rotation
- **Django SECRET_KEY:** Can be rotated by updating the environment variable. Existing sessions will be invalidated, forcing users to log in again.
- **Mobile SQLCipher Key:** Remains on the device. Not managed by the server.
