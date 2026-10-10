import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ApiClient } from '../api/client';
import { AuthStore } from '../auth/authStore';
import { OutboxManager } from './outbox';
import { allocatePayment } from '../domain/allocation';

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

    let totalPushed = 0;
    let totalFailed = 0;

    while (true) {
      const pending = await OutboxManager.getPending(db, 50);
      if (pending.length === 0) break;

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

        let batchFailed = 0;
        for (const res of response.results || []) {
          if (res.status === 'ACCEPTED') {
            await OutboxManager.markSynced(db, [res.operation_id]);
            totalPushed++;
          } else if (res.status === 'FAILED') {
            await OutboxManager.markStatus(db, res.operation_id, 'PENDING', res.error);
            batchFailed++;
          } else {
            await OutboxManager.markStatus(db, res.operation_id, res.status, res.error);
            batchFailed++;
          }
        }

        totalFailed += batchFailed;
        if (batchFailed > 0) {
          // Stop further batch execution on failure to preserve sequential dependency
          break;
        }
      } catch {
        totalFailed += pending.length;
        break;
      }
    }

    return { pushed: totalPushed, failed: totalFailed };
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
        const existingKist = await tx.getFirstAsync<{ id: string }>(
          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
          [payload.id, payload.loan_id, payload.installment_number]
        );
        if (existingKist) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               effective_due_date = ?,
               principal_paid_paise = ?,
               markup_paid_paise = ?,
               status = ?
             WHERE id = ?`,
            [
              payload.effective_due_date,
              payload.principal_paid_paise || 0,
              payload.markup_paid_paise || 0,
              payload.status || 'PENDING',
              existingKist.id,
            ]
          );
        } else {
          await tx.runAsync(
            `INSERT INTO repayment_schedules (
               id, loan_id, installment_number, original_due_date, effective_due_date,
               principal_component_paise, markup_component_paise, total_due_paise,
               principal_paid_paise, markup_paid_paise, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        }
      } else if (operation_type === 'UPDATE') {
        const existingKist = await tx.getFirstAsync<{ id: string }>(
          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
          [payload.id, payload.loan_id, payload.installment_number]
        );
        const kistId = existingKist ? existingKist.id : payload.id;
        if (payload.effective_due_date) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET effective_due_date = ? WHERE id = ?`,
            [payload.effective_due_date, kistId]
          );
        }
        if (payload.status !== undefined || payload.principal_paid_paise !== undefined) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_paid_paise = COALESCE(?, principal_paid_paise),
               markup_paid_paise = COALESCE(?, markup_paid_paise),
               status = COALESCE(?, status)
             WHERE id = ?`,
            [payload.principal_paid_paise, payload.markup_paid_paise, payload.status, kistId]
          );
          if (payload.loan_id) {
            await this.reapplyPendingCollections(tx, payload.loan_id);
          }
        }
      }
    } else if (record_type === 'TRANSACTION') {
      if (operation_type === 'INSERT') {
        const isCash = payload.is_cash !== undefined ? (payload.is_cash ? 1 : 0) : 1;
        const paymentMethod = payload.payment_method || (isCash ? 'CASH' : 'ONLINE');
        let existing: any = null;
        if (payload.transaction_type === 'PENALTY_ASSESSMENT') {
          existing = await tx.getFirstAsync<any>(
            `SELECT * FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
            [payload.operation_id, payload.loan_id, payload.effective_date]
          );
        } else {
          existing = await tx.getFirstAsync<any>(
            `SELECT * FROM transactions WHERE operation_id = ?`,
            [payload.operation_id]
          );
        }
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
              isCash,
              paymentMethod,
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
        } else if (existing.transaction_type === 'COLLECTION' && payload.transaction_type === 'COLLECTION') {
          // Reconcile authoritative server allocations via append-only adjustment transaction, respecting trigger
          const deltaPrincipal = (payload.allocated_principal_paise || 0) - (existing.allocated_principal_paise || 0);
          const deltaMarkup = (payload.allocated_markup_paise || 0) - (existing.allocated_markup_paise || 0);
          const deltaPenalty = (payload.allocated_penalty_paise || 0) - (existing.allocated_penalty_paise || 0);
          const deltaSurplus = (payload.unallocated_surplus_paise || 0) - (existing.unallocated_surplus_paise || 0);

          if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
            const reconOpId = `reconcile-${payload.operation_id}`;
            const existingRecon = await tx.getFirstAsync<{ id: string }>(
              `SELECT id FROM transactions WHERE operation_id = ?`,
              [reconOpId]
            );
            if (!existingRecon) {
              await tx.runAsync(
                `INSERT INTO transactions (
                   id, operation_id, loan_id, transaction_type, is_cash, payment_method,
                   amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
                   unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  crypto.randomUUID(),
                  reconOpId,
                  payload.loan_id,
                  'REVERSAL',
                  0,
                  'SYSTEM',
                  0,
                  deltaPrincipal,
                  deltaMarkup,
                  deltaPenalty,
                  deltaSurplus,
                  0,
                  payload.effective_date,
                  new Date().toISOString(),
                ]
              );
            }
          }
        }
      }
    }
  }

  /**
   * Reapplies unacknowledged local collection allocations after server schedule snapshots
   * to ensure local pending payments are never erased.
   */
  static async reapplyPendingCollections(tx: SQLiteDatabase, loanId: string): Promise<void> {
    if (!loanId) return;

    const pendingOutbox = await tx.getAllAsync<{ operation_id: string; payload: string }>(
      `SELECT operation_id, payload FROM sync_outbox WHERE status = 'PENDING' AND operation_type = 'record_collection' ORDER BY created_at ASC`
    );

    const relevant = pendingOutbox.filter((item) => {
      try {
        const p = JSON.parse(item.payload);
        return p.loan_id === loanId;
      } catch {
        return false;
      }
    });

    if (relevant.length === 0) return;

    for (const item of relevant) {
      const p = JSON.parse(item.payload);
      const paymentAmount = p.amount_paise || 0;
      const effectiveDate = p.effective_date || new Date().toISOString().split('T')[0];

      const kists = await tx.getAllAsync<any>(
        `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
        [loanId]
      );
      if (!kists || kists.length === 0) continue;

      const allocInput = {
        paymentAmount,
        kists: kists.map((k) => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise,
          principalDue: k.principal_component_paise,
          markupDue: k.markup_component_paise,
          amountPaid: k.principal_paid_paise + k.markup_paid_paise,
          principalPaid: k.principal_paid_paise,
          markupPaid: k.markup_paid_paise,
          isDue: k.effective_due_date <= effectiveDate,
          status: k.status,
        })),
        outstandingPenalty: 0 as any,
      };

      const result = allocatePayment(allocInput);
      for (const uk of result.updatedKists) {
        await tx.runAsync(
          `UPDATE repayment_schedules SET
             principal_paid_paise = ?,
             markup_paid_paise = ?,
             status = ?
           WHERE loan_id = ? AND installment_number = ?`,
          [uk.principalPaid, uk.markupPaid, uk.status || 'PENDING', loanId, uk.kistNumber]
        );
      }
    }
  }

  /**
   * Full Sync: Pushes pending operations then pulls authoritative state
   */
  static async syncAll(db: SQLiteDatabase): Promise<SyncResult> {
    try {
      const pushRes = await this.pushPending(db);
      if (pushRes.failed > 0) {
        return {
          pushedCount: pushRes.pushed,
          pulledCount: 0,
          success: false,
          errors: [`${pushRes.failed} operations failed to push to server; pull halted to protect local state`],
        };
      }
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
