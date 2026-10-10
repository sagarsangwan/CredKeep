import { SQLiteDatabase } from 'expo-sqlite';
import { ApiClient } from '../api/client';
import { AuthStore } from '../auth/authStore';
import { OutboxManager } from './outbox';

export interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  success: boolean;
  errors?: string[];
}

export class SyncService {
  /**
   * PUSH Protocol: Sends un-synced local operations to /api/v2/sync/push/
   */
  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number }> {
    const token = await AuthStore.getToken();
    if (!token) return { pushed: 0, failed: 0 };

    const pending = await OutboxManager.getPending(db, 50);
    if (pending.length === 0) return { pushed: 0, failed: 0 };

    const deviceId = await AuthStore.getDeviceId();
    const operations = pending.map((record) => ({
      operation_id: record.operation_id,
      type: record.operation_type,
      timestamp: record.created_at,
      payload: JSON.parse(record.payload),
    }));

    try {
      const response = await ApiClient.post('/sync/push/', {
        device_id: deviceId,
        operations,
      });

      let pushed = 0;
      let failed = 0;

      for (const res of response.results || []) {
        if (res.status === 'ACCEPTED') {
          await OutboxManager.markSynced(db, [res.operation_id]);
          pushed++;
        } else {
          await OutboxManager.markStatus(db, res.operation_id, res.status, res.error);
          failed++;
        }
      }

      return { pushed, failed };
    } catch {
      return { pushed: 0, failed: pending.length };
    }
  }

  /**
   * PULL Protocol: Queries /api/v2/sync/pull/?cursor={cursor} and merges state changes
   */
  static async pullChanges(db: SQLiteDatabase): Promise<{ pulled: number }> {
    const token = await AuthStore.getToken();
    if (!token) return { pulled: 0 };

    const cursorStr = await OutboxManager.getMeta(db, 'last_pull_cursor');
    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
    if (isNaN(cursor)) cursor = 0;

    let hasMore = true;
    let totalPulled = 0;

    while (hasMore) {
      const response = await ApiClient.get(`/sync/pull/?cursor=${cursor}&limit=100`);
      const changes = response.changes || [];

      if (changes.length > 0) {
        await db.withExclusiveTransactionAsync(async (tx) => {
          for (const change of changes) {
            await this.applyServerChange(tx, change);
          }
        });
        totalPulled += changes.length;
      }

      cursor = response.next_cursor;
      hasMore = Boolean(response.has_more);
      await OutboxManager.setMeta(db, 'last_pull_cursor', String(cursor));
    }

    await OutboxManager.setMeta(db, 'last_synced_at', new Date().toISOString());
    return { pulled: totalPulled };
  }

  /**
   * Applies an authoritative server delta event into the local SQLite database
   */
  static async applyServerChange(tx: SQLiteDatabase, change: any): Promise<void> {
    const { record_type, operation_type, payload } = change;
    if (!payload) return;

    if (record_type === 'BORROWER') {
      if (operation_type === 'INSERT') {
        await tx.runAsync(
          `INSERT INTO borrowers (id, name, phone, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone`,
          [payload.id, payload.name, payload.phone, payload.created_at || new Date().toISOString()]
        );
      } else if (operation_type === 'UPDATE') {
        await tx.runAsync(
          `UPDATE borrowers SET name = ?, phone = ? WHERE id = ?`,
          [payload.name, payload.phone, payload.id]
        );
      }
    } else if (record_type === 'LOAN') {
      if (operation_type === 'INSERT') {
        await tx.runAsync(
          `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status`,
          [
            payload.id,
            payload.borrower_id,
            payload.principal_paise,
            parseFloat(payload.markup_factor),
            payload.term_months,
            payload.start_date,
            payload.due_day,
            payload.product_type,
            payload.status || 'ACTIVE',
            payload.created_at || new Date().toISOString(),
          ]
        );
      } else if (operation_type === 'UPDATE') {
        if (payload.status) {
          await tx.runAsync(`UPDATE loans SET status = ? WHERE id = ?`, [payload.status, payload.id]);
        }
      }
    } else if (record_type === 'KIST') {
      if (operation_type === 'INSERT') {
        await tx.runAsync(
          `INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             effective_due_date = excluded.effective_due_date,
             principal_paid_paise = excluded.principal_paid_paise,
             markup_paid_paise = excluded.markup_paid_paise,
             status = excluded.status`,
          [
            payload.id,
            payload.loan_id,
            payload.installment_number,
            payload.original_due_date,
            payload.effective_due_date,
            payload.principal_component_paise || 0,
            payload.markup_component_paise || 0,
            payload.total_due_paise,
            payload.principal_paid_paise || 0,
            payload.markup_paid_paise || 0,
            payload.status || 'PENDING',
          ]
        );
      } else if (operation_type === 'UPDATE') {
        if (payload.effective_due_date) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET effective_due_date = ? WHERE id = ?`,
            [payload.effective_due_date, payload.id]
          );
        }
        if (payload.status !== undefined || payload.principal_paid_paise !== undefined) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_paid_paise = COALESCE(?, principal_paid_paise),
               markup_paid_paise = COALESCE(?, markup_paid_paise),
               status = COALESCE(?, status)
             WHERE id = ?`,
            [payload.principal_paid_paise, payload.markup_paid_paise, payload.status, payload.id]
          );
        }
      }
    } else if (record_type === 'TRANSACTION') {
      if (operation_type === 'INSERT') {
        const existing = await tx.getFirstAsync<{ id: string }>(
          `SELECT id FROM transactions WHERE operation_id = ?`,
          [payload.operation_id]
        );
        if (!existing) {
          await tx.runAsync(
            `INSERT INTO transactions (
               id, operation_id, loan_id, transaction_type, is_cash, payment_method,
               amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
               unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.id,
              payload.operation_id,
              payload.loan_id,
              payload.transaction_type,
              payload.is_cash ? 1 : 0,
              payload.payment_method || 'CASH',
              payload.amount_paise || 0,
              payload.allocated_principal_paise || 0,
              payload.allocated_markup_paise || 0,
              payload.allocated_penalty_paise || 0,
              payload.unallocated_surplus_paise || 0,
              payload.forgiven_penalty_paise || 0,
              payload.effective_date,
              payload.created_at || new Date().toISOString(),
            ]
          );
        }
      }
    }
  }

  /**
   * Full Sync: Pushes pending operations then pulls authoritative state
   */
  static async syncAll(db: SQLiteDatabase): Promise<SyncResult> {
    try {
      const pushRes = await this.pushPending(db);
      const pullRes = await this.pullChanges(db);
      return {
        pushedCount: pushRes.pushed,
        pulledCount: pullRes.pulled,
        success: true,
      };
    } catch (err: any) {
      return {
        pushedCount: 0,
        pulledCount: 0,
        success: false,
        errors: [err?.message || 'Sync failed'],
      };
    }
  }
}
