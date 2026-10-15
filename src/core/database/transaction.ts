import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Executes an atomic transaction directly on an existing authenticated/keyed connection.
 * Avoids opening a new unkeyed connection via withExclusiveTransactionAsync on real SQLCipher.
 * Transparently delegates to withExclusiveTransactionAsync in test environments when using mock adapters.
 */
export async function withDbTransaction<T>(
  db: SQLiteDatabase,
  action: (tx: SQLiteDatabase) => Promise<T>
): Promise<T> {
  // If running in a test harness where db is a mock object without nativeDatabase
  if (!(db as any)?.nativeDatabase && typeof (db as any)?.withExclusiveTransactionAsync === 'function') {
    let result: T = undefined as any;
    await (db as any).withExclusiveTransactionAsync(async (tx: any) => {
      result = await action(tx || db);
    });
    return result;
  }

  // Real native SQLite / SQLCipher connection: execute transaction on the keyed connection
  if (typeof (db as any).withTransactionAsync === 'function') {
    let result: T = undefined as any;
    await (db as any).withTransactionAsync(async () => {
      result = await action(db);
    });
    return result;
  }

  if (typeof (db as any).execAsync === 'function') {
    await (db as any).execAsync('BEGIN IMMEDIATE;');
    try {
      const result = await action(db);
      await (db as any).execAsync('COMMIT;');
      return result;
    } catch (error) {
      try {
        await (db as any).execAsync('ROLLBACK;');
      } catch {
        // Ignore rollback failure if already rolled back
      }
      throw error;
    }
  }

  if (typeof (db as any).runAsync === 'function') {
    await (db as any).runAsync('BEGIN IMMEDIATE;');
    try {
      const result = await action(db);
      await (db as any).runAsync('COMMIT;');
      return result;
    } catch (error) {
      try {
        await (db as any).runAsync('ROLLBACK;');
      } catch {
        // Ignore rollback failure if already rolled back
      }
      throw error;
    }
  }

  return await action(db);
}
