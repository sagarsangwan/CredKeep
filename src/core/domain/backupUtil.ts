import CryptoJS from 'crypto-js';

export function createEncryptedBackupPayload(key: string, dbBase64: string, password: string): string {
  const payload = JSON.stringify({ key, dbBase64 });
  return CryptoJS.AES.encrypt(payload, password).toString();
}

export function decryptBackupPayload(encryptedPayload: string, password: string): { key: string, dbBase64: string } {
  const bytes = CryptoJS.AES.decrypt(encryptedPayload, password);
  const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
  
  if (!decryptedText) {
    throw new Error('Decryption failed. Incorrect password or corrupt file.');
  }

  const payload = JSON.parse(decryptedText);
  if (!payload.key || !payload.dbBase64) {
    throw new Error('Invalid backup file format.');
  }

  return payload;
}
