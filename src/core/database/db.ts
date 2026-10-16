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

export { withDbTransaction } from './transaction';

export async function initDatabase(tenantId?: string | null): Promise<SQLite.SQLiteDatabase> {
  const t0 = Date.now();
  const dbName = await getDatabaseName(tenantId);
  if (!dbName) {
    throw new Error('Authentication required: cannot open database without active tenant.');
  }

  const key = await getDatabaseKey();
  console.log(`[LIFECYCLE] DATABASE_OPENING: opening ${dbName}`);

  // Support both Build 2 ('...' passphrase standard) and legacy Build 1 (x'...' raw hex) key formats
  const candidates = [
    { label: "passphrase (standard)", pragma: `PRAGMA key = '${key}';` },
    { label: "raw hex (legacy Build 1)", pragma: `PRAGMA key = "x'${key}'";` },
  ];

  let openedDb: SQLite.SQLiteDatabase | null = null;
  let lastError: any = null;

  for (const candidate of candidates) {
    let db: SQLite.SQLiteDatabase | null = null;
    try {
      db = await SQLite.openDatabaseAsync(dbName);
      await db.execAsync(candidate.pragma);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
      `);
      // Verify decryption by reading schema
      await db.getFirstAsync('SELECT 1');
      console.log(`[LIFECYCLE] SQLCIPHER_VERIFIED: unlocked ${dbName} using ${candidate.label} in ${Date.now() - t0}ms`);
      openedDb = db;
      break;
    } catch (err: any) {
      lastError = err;
      if (db && typeof (db as any).closeAsync === 'function') {
        try {
          await (db as any).closeAsync();
        } catch {}
      }
    }
  }

  if (!openedDb) {
    console.error(`[LIFECYCLE] DATABASE_OPEN_FAILED: could not unlock ${dbName}: ${lastError?.message || lastError}`);
    throw new Error(`Database unlock failed: ${lastError?.message || 'Invalid key or corrupted database'}`);
  }

  return openedDb;
}
