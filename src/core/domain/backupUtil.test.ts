import { createEncryptedBackupPayload, decryptBackupPayload } from './backupUtil';

describe('Backup & Restore Utility', () => {
  it('should successfully round-trip a valid payload with correct password', () => {
    const originalKey = 'fake_secure_store_key_12345';
    const originalDb = 'U1FMaXRlIGZvcm1hdCAzAAQAAA=='; // Mock Base64
    const password = 'my_super_secret_password';

    // 1. Export (Encrypt)
    const encrypted = createEncryptedBackupPayload(originalKey, originalDb, password);
    expect(encrypted).not.toContain(originalKey);
    expect(encrypted).not.toContain(originalDb);

    // 2. Import (Decrypt)
    const restored = decryptBackupPayload(encrypted, password);
    expect(restored.key).toBe(originalKey);
    expect(restored.dbBase64).toBe(originalDb);
  });

  it('should throw an error on incorrect password', () => {
    const originalKey = 'fake_secure_store_key_12345';
    const originalDb = 'U1FMaXRlIGZvcm1hdCAzAAQAAA==';
    const password = 'my_super_secret_password';

    const encrypted = createEncryptedBackupPayload(originalKey, originalDb, password);

    expect(() => {
      decryptBackupPayload(encrypted, 'wrong_password');
    }).toThrow('Decryption failed. Incorrect password or corrupt file.');
  });

  it('should throw an error on corrupted JSON after decryption', () => {
    // Manually create a bad payload (missing dbBase64)
    const badPayload = JSON.stringify({ key: 'only_key_no_db' });
    const encrypted = require('crypto-js').AES.encrypt(badPayload, 'password').toString();

    expect(() => {
      decryptBackupPayload(encrypted, 'password');
    }).toThrow('Invalid backup file format.');
  });
});
