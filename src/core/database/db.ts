import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDatabaseName } from './dbName';
export { getDatabaseName };

const DB_KEY_NAME = 'credkeep_db_master_key';

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getDatabaseKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DB_KEY_NAME);

  if (!key) {
    // Generate a 32-byte cryptographically secure random key
    const randomBytes = Crypto.getRandomBytes(32);
    key = bufferToHex(randomBytes.buffer as ArrayBuffer);

    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
      requireAuthentication: false,
    });
  }

  return key;
}

export async function initDatabase(tenantId?: string | null): Promise<SQLite.SQLiteDatabase> {
  const dbName = await getDatabaseName(tenantId);
  if (!dbName) {
    throw new Error('Authentication required: cannot open database without active tenant.');
  }

  const key = await getDatabaseKey();

  // Open database handle
  const db = await SQLite.openDatabaseAsync(dbName);

  // SQLCipher: Key MUST be executed as the very first single statement before any pager access
  await db.execAsync(`PRAGMA key = '${key}';`);

  // Performance and integrity pragmas
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);

  // Verify encryption by querying schema/page 1
  await db.getFirstAsync('SELECT 1');

  return db;
}
