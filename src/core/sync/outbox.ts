import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';

export type OutboxStatus = 'PENDING' | 'SYNCED' | 'NEEDS_REVIEW' | 'REJECTED';

export interface OutboxRecord {
  id: string;
  operation_id: string;
  operation_type: string;
  payload: string; // JSON string
  status: OutboxStatus;
  error_message: string | null;
  created_at: string;
}

export interface EnqueueParams {
  operationId?: string;
  operationType: string;
  payload: Record<string, any>;
}

export type DatabaseHandle = {
  runAsync: (sql: string, ...params: any[]) => Promise<any>;
};

export class OutboxManager {
  static async enqueue(
    db: SQLiteDatabase | DatabaseHandle,
    params: EnqueueParams
  ): Promise<OutboxRecord> {
    const id = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('outbox-' + Date.now() + '-' + Math.random().toString(36).substring(2));
    const operationId = params.operationId || (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('op-' + Date.now() + '-' + Math.random().toString(36).substring(2));
    const createdAt = new Date().toISOString();
    const payloadStr = JSON.stringify(params.payload);

    await db.runAsync(
      `INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, error_message, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', NULL, ?)`,
      [id, operationId, params.operationType, payloadStr, createdAt]
    );

    return {
      id,
      operation_id: operationId,
      operation_type: params.operationType,
      payload: payloadStr,
      status: 'PENDING',
      error_message: null,
      created_at: createdAt,
    };
  }

  static async getPending(db: SQLiteDatabase, limit: number = 50): Promise<OutboxRecord[]> {
    return await db.getAllAsync<OutboxRecord>(
      `SELECT * FROM sync_outbox WHERE status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
  }

  static async markSynced(db: SQLiteDatabase, operationIds: string[]): Promise<void> {
    if (operationIds.length === 0) return;
    const placeholders = operationIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'SYNCED', error_message = NULL WHERE operation_id IN (${placeholders})`,
      operationIds
    );
  }

  static async markStatus(
    db: SQLiteDatabase,
    operationId: string,
    status: OutboxStatus,
    errorMessage?: string
  ): Promise<void> {
    await db.runAsync(
      `UPDATE sync_outbox SET status = ?, error_message = ? WHERE operation_id = ?`,
      [status, errorMessage || null, operationId]
    );
  }

  static async getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [key]
    );
    return row ? row.value : null;
  }

  static async getNeedsReview(db: SQLiteDatabase): Promise<OutboxRecord[]> {
    return await db.getAllAsync<OutboxRecord>(
      `SELECT * FROM sync_outbox WHERE status = 'NEEDS_REVIEW' ORDER BY created_at ASC`
    );
  }

  static async resolveNeedsReview(
    db: SQLiteDatabase,
    operationId: string,
    action: 'DISCARD' | 'RETRY_PENDING'
  ): Promise<void> {
    if (action === 'DISCARD') {
      await db.runAsync(
        `UPDATE sync_outbox SET status = 'REJECTED', error_message = 'Resolved: discarded by user' WHERE operation_id = ?`,
        [operationId]
      );
    } else if (action === 'RETRY_PENDING') {
      await db.runAsync(
        `UPDATE sync_outbox SET status = 'PENDING', error_message = NULL WHERE operation_id = ?`,
        [operationId]
      );
    }
  }

  static async setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }
}
