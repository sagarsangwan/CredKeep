# 0002. Append-Only Double-Entry Ledger and Waterfall Engine

**Status**: Superseded by ADR-0003

## Context
Earlier planning proposed a full event-sourced double-entry accounting engine with SHA-256 cryptographic hash chaining for each collection receipt, emulating distributed ledgers.

## Reason for Superseding
1. **Unnecessary Complexity**: For a single-financier offline ledger, full event-sourcing with event reducers adds substantial query latency, complex snapshotting, and difficult schema migrations without providing business value over relational tables with immutable transaction journals.
2. **False Security Illusion**: A SHA-256 hash chain stored inside an on-device SQLite database does not protect against tampering by someone with root access to the device or database file, because an attacker with the write key can simply recompute the entire hash chain. True tamper-evidence requires external hardware HSMs or remote timestamping authorities, which are deferred.
3. **Auditability Without Overkill**: Single-financier compliance requires immutable transaction logs, explicit correction records with timestamps, and foreign-key integrity, which relational tables provide naturally.
