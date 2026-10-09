# 0001. SQLCipher Encrypted SQLite for Offline-First Storage

**Status**: Accepted (Amended)

## Context
CredKeep stores private financial balances, borrower identities, promissory note metadata, and transaction histories entirely on an Android device. Because field devices can be lost, stolen, or examined without authorization, data at rest must be strongly encrypted without compromising local SQLite query performance.

## Decision
We use `expo-sqlite` backed by SQLCipher (256-bit AES encryption) via the `expo-sqlite` config plugin (`useSQLCipher: true`).
- The database encryption key is a 256-bit random key generated on first launch and persisted in hardware-backed Android Keystore via `expo-secure-store`.
- Because SQLCipher requires native compilation, development and testing require custom native builds (`npx expo run:android` or EAS Dev Build); Expo Go cannot be used for native encrypted runs.
- To prevent permanent data loss upon device change or app uninstallation (where Android Keystore is cleared), database recovery relies on passphrase-encrypted portable backup files derived via PBKDF2 (100,000 iterations) and AES-256-GCM, independent of the device-bound Keystore.
