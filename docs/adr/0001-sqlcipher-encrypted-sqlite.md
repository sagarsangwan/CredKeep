# 0001. SQLCipher Encrypted SQLite, Keystore Lifecycle, and Versioned Envelope Backups

**Status**: Accepted (Amended)

## Context
CredKeep stores private financial ledger balances, promissory note metadata, and borrower KYC records entirely on an Android mobile device. In informal Indian lending, field devices face risks of physical loss, theft, unauthorized inspection, or physical seizure. Data at rest must be strongly encrypted without compromising local SQLite query performance.

However, relying uncritically on platform key storage or fixed cryptographic parameters introduces catastrophic operational risks:
1. **Android Keystore Hardware Limitations**: Hardware-backed Keymaster/StrongBox support varies wildly across budget Android devices common in India. Furthermore, Android Keystore keys are non-exportable and are irrevocably wiped upon app uninstallation or OS "Clear Data". Platform auto-backup (Google Drive / Android Backup Service) cannot restore hardware-bound Keystore keys.
2. **Biometric Invalidation**: Tying cryptographic master keys to Android biometrics (`setUserAuthenticationRequired(true)`) risks permanent data loss if the financier adds, updates, or resets device fingerprints, causing the OS to invalidate the key (`KeyPermanentlyInvalidatedException`).
3. **Static PBKDF2 Iteration Counts**: Assuming a fixed 100,000 iterations for PBKDF2 without an upgrade path fails modern security standards (OWASP recommends 600,000 iterations for PBKDF2-HMAC-SHA256) and prevents performance tuning across device tiers.

## Decision

### 1. Database Encryption via SQLCipher (`expo-sqlite`)
We use `expo-sqlite` configured with the official native plugin `useSQLCipher: true` in `app.json`.
- **Native Build Prerequisite**: SQLCipher compiles native binaries and is **unsupported in Expo Go**. All local execution and testing require custom development builds (`npx expo prebuild` followed by `npx expo run:android` or EAS Build).
- **Database Initialization Sequence**:
  1. On application launch, retrieve the 256-bit Database Master Key from `expo-secure-store`.
  2. If absent (first launch), generate 32 cryptographically secure random bytes using `expo-crypto` (`getRandomBytes(32)`), hex-encode the key, and store it in `expo-secure-store`.
  3. Open database using `openDatabaseAsync('credkeep.db')`.
  4. Immediately execute `PRAGMA key = "x'<hex_key>'";` before any schema or data query.
  5. Verify successful unlocking by querying `PRAGMA cipher_version;` and `PRAGMA integrity_check;`.
  6. **Fail-Closed Policy**: If key retrieval or database decryption fails, the app halts immediately and renders a recovery diagnostic screen. Under no circumstances will the app attempt to open an unencrypted fallback database.

### 2. Keystore Lifecycle & Decoupling
- The Database Master Key stored in `expo-secure-store` is created with `requireAuthentication: false`.
- Biometric authentication (fingerprint/face) and app PINs act strictly as **UI-level session gates**. They do not guard the hardware Keystore key directly, preventing biometric enrollment changes from bricking database access.

### 3. Versioned Encrypted Backup Envelope
Because Android Keystore keys cannot survive app uninstallation or phone replacement, recovery depends on a portable, self-contained backup file (`.ckenc`).

We establish a versioned envelope format:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (6B): 'CKENC' + Version (0x01)                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ KDF Metadata:                                                                │
│   • Algorithm ID (1B): 0x01 (PBKDF2-HMAC-SHA256)                             │
│   • Iteration Count (4B Big-Endian): 600,000                                 │
│   • Salt Length (1B): 32 bytes                                               │
│   • KDF Salt (32B)                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Cipher Metadata:                                                             │
│   • Cipher ID (1B): 0x01 (AES-256-GCM)                                       │
│   • Nonce / IV (12B)                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Ciphertext Payload:                                                          │
│   • Encrypted SQLite Database Dump (Variable Length)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Authentication Tag:                                                          │
│   • AES-GCM Tag (16B)                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Key Derivation Policy**:
  - Version 1 derives the Key Encryption Key (KEK) using PBKDF2-HMAC-SHA256 with a 32-byte CSPRNG salt and **600,000 iterations** (OWASP 2023/2024 standard).
  - The envelope stores its version and iteration count explicitly, allowing future versions to migrate to Argon2id without breaking backward-compatible restore of older archives.
- **Export Process**:
  1. Capture a consistent snapshot of the SQLite database using `VACUUM INTO 'snapshot.db'`.
  2. Prompt user for a strong **Backup Passphrase**.
  3. Derive KEK, encrypt the snapshot using AES-256-GCM, and construct the `.ckenc` envelope.
  4. Write to a temporary file (`backup.ckenc.tmp`), sync to disk, and atomically rename to `credkeep_backup_<ISO_TIMESTAMP>.ckenc`.
- **Restore & Verification Process**:
  1. Inspect the 6-byte header magic (`CKENC\x01`). If missing, reject immediately.
  2. Read KDF metadata, derive the candidate KEK from user input.
  3. Authenticate and decrypt payload. If the 16-byte GCM authentication tag fails, reject with `"Invalid Passphrase or Tampered File"` without altering the active database.
  4. Write decrypted content to `restore_test.db`, execute `PRAGMA integrity_check;`.
  5. Upon verification, replace active database and update the local Android Keystore with the restored database key.

## Recovery & Test Scenarios

The test suite must validate these five operational scenarios:
1. **App Uninstallation / Clear Data**: Verify that a freshly reinstalled app can restore all loans, borrowers, and ledgers from a `.ckenc` file using only the user passphrase.
2. **Device Migration**: Verify that a backup generated on Device A can be successfully decrypted and restored on Device B with different hardware Keystore environments.
3. **Corrupted File Detection**: Flip random bits in the ciphertext or header of a `.ckenc` file; confirm the restore aborts cleanly at the GCM tag verification stage with zero database side effects.
4. **Incorrect Passphrase**: Verify that entering the wrong passphrase rejects gracefully with zero data loss or partial writes.
5. **Biometric Reset Resilience**: Verify that clearing or updating system fingerprints in Android OS does not impede the app from opening the database on next launch.

## Consequences
- **Positive**: Complete cryptographic privacy at rest, zero risk of data loss from Keystore wipe, resilient against phone theft, future-proof backup envelope.
- **Negative**: Development requires local native builds (`npx expo run:android`), disabling quick prototyping in Expo Go. Backup creation incurs ~1-2 seconds of CPU load during the 600,000 PBKDF2 iteration derivation.
