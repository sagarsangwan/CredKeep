import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { OutboxManager } from '../sync/outbox';
import { SyncCoordinator } from '../sync/syncCoordinator';
import { withDbTransaction } from './transaction';

export type Borrower = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

function generateUuid(): string {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') {
      const id = crypto.randomUUID();
      if (id) return id;
    }
  } catch {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      const id = globalThis.crypto.randomUUID();
      if (id) return id;
    }
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class BorrowerRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(name: string, phone: string, clientOpId?: string): Promise<Borrower> {
    const id = generateUuid();
    const created_at = new Date().toISOString();
    
    await withDbTransaction(this.db, async (txHandle) => {
      await txHandle.runAsync(
        `INSERT INTO borrowers (id, name, phone, created_at) VALUES (?, ?, ?, ?)`,
        [id, name, phone, created_at]
      );

      await OutboxManager.enqueue(txHandle, {
        operationId: clientOpId,
        operationType: 'create_borrower',
        payload: { id, name, phone },
      });
    });
    
    SyncCoordinator.notifyMutation();
    return { id, name, phone, created_at };
  }

  async update(id: string, name: string, phone: string, clientOpId?: string): Promise<Borrower> {
    await withDbTransaction(this.db, async (txHandle) => {
      await txHandle.runAsync(
        `UPDATE borrowers SET name = ?, phone = ? WHERE id = ?`,
        [name.trim(), phone.trim(), id]
      );

      await OutboxManager.enqueue(txHandle, {
        operationId: clientOpId,
        operationType: 'create_borrower',
        payload: { id, name: name.trim(), phone: phone.trim() },
      });
    });

    SyncCoordinator.notifyMutation();
    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Borrower ${id} not found after update`);
    }
    return updated;
  }

  async getAll(): Promise<Borrower[]> {
    return await this.db.getAllAsync<Borrower>(`SELECT * FROM borrowers ORDER BY name ASC`);
  }

  async getById(id: string): Promise<Borrower | null> {
    return await this.db.getFirstAsync<Borrower>(`SELECT * FROM borrowers WHERE id = ?`, [id]);
  }
}
