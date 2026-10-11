import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ApiClient } from '../api/client';
import { AuthStore } from '../auth/authStore';
import { OutboxManager, registerOutboxRevertHandler } from './outbox';
import { allocatePayment } from '../domain/allocation';
import { Paise } from '../domain/money';
import { isUuid, deterministicUuid } from '../migration/uuidUtils';

export interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  needsReviewCount?: number;
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
        const results = response?.results || [];
        const acknowledgedOpIds = new Set<string>();

        for (const res of results) {
          if (!res?.operation_id) continue;
          acknowledgedOpIds.add(res.operation_id);

          if (res.status === 'ACCEPTED') {
            await OutboxManager.markSynced(db, [res.operation_id]);
            totalPushed++;
          } else if (res.status === 'REJECTED') {
            await this.revertRejectedPayment(db, res.operation_id, res.error);
            batchFailed++;
          } else if (res.status === 'FAILED') {
            await OutboxManager.markStatus(db, res.operation_id, 'PENDING', res.error);
            batchFailed++;
          } else {
            await OutboxManager.markStatus(db, res.operation_id, res.status, res.error);
            batchFailed++;
          }
        }

        // Validate that every submitted operation received an acknowledgment result
        for (const op of operations) {
          if (!acknowledgedOpIds.has(op.operation_id)) {
            await OutboxManager.markStatus(db, op.operation_id, 'PENDING', 'Missing server result in push response');
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
        cursor = response.next_cursor;
        hasMore = Boolean(response.has_more);
        await db.withExclusiveTransactionAsync(async (tx) => {
          const modifiedScheduleLoanIds = new Set<string>();
          for (const change of changes) {
            await this.applyServerChange(tx, change, modifiedScheduleLoanIds);
          }
          for (const loanId of modifiedScheduleLoanIds) {
            await this.reapplyPendingCollections(tx, loanId);
          }
          await OutboxManager.setMeta(tx, 'last_pull_cursor', String(cursor));
        });
        totalPulled += changes.length;
      } else {
        cursor = response.next_cursor;
        hasMore = Boolean(response.has_more);
        await OutboxManager.setMeta(db, 'last_pull_cursor', String(cursor));
      }
    }

    await OutboxManager.setMeta(db, 'last_synced_at', new Date().toISOString());
    return { pulled: totalPulled };
  }

  /**
   * Applies an authoritative server delta event into the local SQLite database
   */
  static async applyServerChange(tx: SQLiteDatabase, change: any, modifiedLoanIds?: Set<string>): Promise<void> {
    const { record_type, operation_type, payload } = change;
    if (!payload) return;

    if (
      (record_type === 'KIST' ||
        (record_type === 'TRANSACTION' &&
          (payload.transaction_type === 'WAIVER' ||
            payload.transaction_type === 'PENALTY_ASSESSMENT' ||
            (payload.transaction_type === 'REVERSAL' && (payload.forgiven_penalty_paise || 0) > 0)))) &&
      payload.loan_id &&
      modifiedLoanIds
    ) {
      modifiedLoanIds.add(payload.loan_id);
    }

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
               principal_component_paise = ?,
               markup_component_paise = ?,
               total_due_paise = ?,
               effective_due_date = ?,
               principal_paid_paise = ?,
               markup_paid_paise = ?,
               status = ?,
               server_principal_paid_paise = ?,
               server_markup_paid_paise = ?,
               server_status = ?
             WHERE id = ?`,
            [
              payload.principal_component_paise || 0,
              payload.markup_component_paise || 0,
              payload.total_due_paise,
              payload.effective_due_date,
              payload.principal_paid_paise || 0,
              payload.markup_paid_paise || 0,
              payload.status || 'PENDING',
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
               principal_paid_paise, markup_paid_paise, status,
               server_principal_paid_paise, server_markup_paid_paise, server_status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        if (payload.principal_component_paise !== undefined || payload.markup_component_paise !== undefined || payload.total_due_paise !== undefined) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_component_paise = COALESCE(?, principal_component_paise),
               markup_component_paise = COALESCE(?, markup_component_paise),
               total_due_paise = COALESCE(?, total_due_paise)
             WHERE id = ?`,
            [payload.principal_component_paise, payload.markup_component_paise, payload.total_due_paise, kistId]
          );
        }
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
               status = COALESCE(?, status),
               server_principal_paid_paise = COALESCE(?, server_principal_paid_paise),
               server_markup_paid_paise = COALESCE(?, server_markup_paid_paise),
               server_status = COALESCE(?, server_status)
             WHERE id = ?`,
            [
              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
              kistId
            ]
          );
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
            `SELECT * FROM transactions WHERE operation_id = ? OR id = ?`,
            [payload.operation_id, payload.id || payload.operation_id]
          );
          if (!existing) {
            const allLocalTx = await tx.getAllAsync<any>(
              `SELECT id, operation_id, loan_id, effective_date, amount_paise, transaction_type, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise FROM transactions WHERE transaction_type = 'COLLECTION'`
            );
            for (const ltx of allLocalTx || []) {
              const expectedMigOpId = ltx.operation_id && isUuid(ltx.operation_id)
                ? ltx.operation_id
                : deterministicUuid(`mig-tx-${ltx.id || ltx.operation_id || `${ltx.loan_id}-${ltx.effective_date}-${ltx.amount_paise}`}`);
              if (expectedMigOpId === payload.operation_id || ltx.id === payload.id || ltx.operation_id === payload.operation_id) {
                existing = ltx;
                break;
              }
            }
          }
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
          const matchingOpIds = Array.from(
            new Set([payload.operation_id, existing.operation_id, existing.id].filter(Boolean))
          );
          const opConditions = matchingOpIds.map(() => `(
            operation_id = ?
            OR id = ?
            OR instr(operation_id, 'realloc::' || ? || '::') = 1
            OR instr(operation_id, 'reconcile::' || ? || '::') = 1
          )`).join(' OR ');

          const queryParams: any[] = [payload.loan_id];
          for (const opId of matchingOpIds) {
            queryParams.push(opId, opId, opId, opId);
          }

          const netAllocRow = await tx.getFirstAsync<{
            netPrincipal: number;
            netMarkup: number;
            netPenalty: number;
            netSurplus: number;
          }>(
            `SELECT
               COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
               COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
               COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
               COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
             FROM transactions
             WHERE loan_id = ?
               AND (${opConditions})`,
            queryParams
          );

          const currentPrincipal = netAllocRow?.netPrincipal ?? (existing.allocated_principal_paise || 0);
          const currentMarkup = netAllocRow?.netMarkup ?? (existing.allocated_markup_paise || 0);
          const currentPenalty = netAllocRow?.netPenalty ?? (existing.allocated_penalty_paise || 0);
          const currentSurplus = netAllocRow?.netSurplus ?? (existing.unallocated_surplus_paise || 0);

          const deltaPrincipal = (payload.allocated_principal_paise || 0) - currentPrincipal;
          const deltaMarkup = (payload.allocated_markup_paise || 0) - currentMarkup;
          const deltaPenalty = (payload.allocated_penalty_paise || 0) - currentPenalty;
          const deltaSurplus = (payload.unallocated_surplus_paise || 0) - currentSurplus;

          if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
            const reconId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('recon-' + Date.now() + '-' + Math.random().toString(36).substring(2));
            const reconOpId = `reconcile::${payload.operation_id}::${reconId.substring(0, 8)}`;
            await tx.runAsync(
              `INSERT INTO transactions (
                 id, operation_id, loan_id, transaction_type, is_cash, payment_method,
                 amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
                 unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                reconId,
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

  /**
   * Reapplies unacknowledged local collection allocations after server schedule snapshots
   * to ensure local pending payments are never erased.
   */
  static async reapplyPendingCollections(tx: SQLiteDatabase, loanId: string): Promise<void> {
    if (!loanId) return;

    // Reset kists to authoritative server baseline before replaying pending collections
    await tx.runAsync(
      `UPDATE repayment_schedules SET
         principal_paid_paise = COALESCE(server_principal_paid_paise, 0),
         markup_paid_paise = COALESCE(server_markup_paid_paise, 0),
         status = COALESCE(server_status, 'PENDING')
       WHERE loan_id = ?`,
      [loanId]
    );

    const pendingOutbox = await tx.getAllAsync<{ operation_id: string; payload: string }>(
      `SELECT operation_id, payload FROM sync_outbox WHERE status IN ('PENDING', 'NEEDS_REVIEW') AND operation_type = 'record_collection' ORDER BY created_at ASC`
    );

    const relevant = pendingOutbox.filter((item) => {
      try {
        const p = JSON.parse(item.payload);
        return p.loan_id === loanId;
      } catch {
        return false;
      }
    });

    const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);

    // Calculate actual outstanding penalties dynamically (excluding pending, needs-review, and rejected collections and all their adjustments)
    const penaltyRow = await tx.getFirstAsync<{ assessed: number; paid: number; forgiven: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' THEN amount_paise ELSE 0 END), 0) as assessed,
         COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECTION', 'REVERSAL')
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )
           THEN allocated_penalty_paise ELSE 0 END), 0) as paid,
         COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
       FROM transactions WHERE loan_id = ?`,
      [loanId]
    );
    let outstandingPenalty = Math.max(0, (penaltyRow?.assessed || 0) - (penaltyRow?.paid || 0) - (penaltyRow?.forgiven || 0)) as Paise;

    let replayedBulletPrincipalPaid = 0;
    if (loan?.product_type === 'bullet') {
      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )`,
        [loanId]
      );
      replayedBulletPrincipalPaid = bulletPrincipalRow?.total || 0;
    }

    if (relevant.length > 0) {
      for (const item of relevant) {
        const p = JSON.parse(item.payload);
        const paymentAmount = (p.amount_paise || 0) as Paise;
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
            amountDue: k.total_due_paise as Paise,
            principalDue: k.principal_component_paise as Paise,
            markupDue: k.markup_component_paise as Paise,
            amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
            principalPaid: k.principal_paid_paise as Paise,
            markupPaid: k.markup_paid_paise as Paise,
            isDue: k.effective_due_date <= effectiveDate,
            status: k.status,
          })),
          outstandingPenalty,
        };

        const result = allocatePayment(allocInput);
        outstandingPenalty = result.remainingPenalty;

        let newAllocPrincipal = 0;
        let newAllocMarkup = 0;
        let newAllocPenalty = 0;
        for (const a of result.allocations) {
          newAllocPrincipal += a.allocatedToPrincipal;
          newAllocMarkup += a.allocatedToMarkup;
          newAllocPenalty += a.allocatedToPenalty;
        }

        let newAllocSurplus = result.unallocatedFunds || 0;
        if (loan?.product_type === 'bullet' && newAllocSurplus > 0) {
          const remainingPrincipal = Math.max(0, loan.principal_paise - replayedBulletPrincipalPaid);
          const payPrincipal = Math.min(newAllocSurplus, remainingPrincipal);
          newAllocPrincipal += payPrincipal;
          newAllocSurplus -= payPrincipal;
          replayedBulletPrincipalPaid += payPrincipal;
        }

        // Reconcile pending collection ledger entry with replayed allocations
        const currentColNet = await tx.getFirstAsync<{
          currentPrincipal: number;
          currentMarkup: number;
          currentPenalty: number;
          currentSurplus: number;
        }>(
          `SELECT
             COALESCE(SUM(allocated_principal_paise), 0) as currentPrincipal,
             COALESCE(SUM(allocated_markup_paise), 0) as currentMarkup,
             COALESCE(SUM(allocated_penalty_paise), 0) as currentPenalty,
             COALESCE(SUM(unallocated_surplus_paise), 0) as currentSurplus
           FROM transactions
           WHERE loan_id = ?
             AND (
               operation_id = ?

               OR instr(operation_id, 'realloc::' || ? || '::') = 1

               OR instr(operation_id, 'reconcile::' || ? || '::') = 1
             )`,
          [loanId, item.operation_id, item.operation_id, item.operation_id]
        );

        const currentPrincipal = currentColNet?.currentPrincipal ?? 0;
        const currentMarkup = currentColNet?.currentMarkup ?? 0;
        const currentPenalty = currentColNet?.currentPenalty ?? 0;
        const currentSurplus = currentColNet?.currentSurplus ?? 0;

        const deltaPrincipal = newAllocPrincipal - currentPrincipal;
        const deltaMarkup = newAllocMarkup - currentMarkup;
        const deltaPenalty = newAllocPenalty - currentPenalty;
        const deltaSurplus = newAllocSurplus - currentSurplus;

        if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
          const reallocId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('realloc-' + Date.now() + '-' + Math.random().toString(36).substring(2));
          const reallocOpId = `realloc::${item.operation_id}::${reallocId.substring(0, 8)}`;
          await tx.runAsync(
            `INSERT INTO transactions (
               id, operation_id, loan_id, transaction_type, is_cash, payment_method,
               amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
               unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              reallocId,
              reallocOpId,
              loanId,
              'REVERSAL',
              0,
              'SYSTEM',
              0,
              deltaPrincipal,
              deltaMarkup,
              deltaPenalty,
              deltaSurplus,
              0,
              effectiveDate,
              new Date().toISOString(),
            ]
          );
        }

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

    // Reconcile loan status with authoritative server state and outstanding penalties
    const finalKists = await tx.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ?`,
      [loanId]
    );
    const allPaid = finalKists.length > 0 && finalKists.every((k) => k.status === 'PAID');
    if (loan) {
      if (loan.status === 'WRITTEN_OFF') {
        // Authoritative WRITTEN_OFF terminal status must be preserved
      } else {
        let isSettled = false;
        if (loan.product_type === 'instalment') {
          const totalPrincipalPaid = finalKists.reduce((acc, k) => acc + (k.principal_paid_paise || 0), 0);
          isSettled = allPaid && totalPrincipalPaid >= loan.principal_paise && outstandingPenalty <= 0;
        } else if (loan.product_type === 'bullet') {
          isSettled = allPaid && replayedBulletPrincipalPaid >= loan.principal_paise && outstandingPenalty <= 0;
        }
        await tx.runAsync(`UPDATE loans SET status = ? WHERE id = ?`, [isSettled ? 'SETTLED' : 'ACTIVE', loanId]);
      }
    }
  }

  /**
   * Compensates and reverts rejected payment mutations locally.
   * Inserts an append-only compensating REVERSAL ledger entry,
   * reverses affected kist paid amounts, and restores loan status.
   */
  static async revertRejectedPayment(db: SQLiteDatabase, operationId: string, errorReason?: string): Promise<void> {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await OutboxManager.markStatus(tx, operationId, 'REJECTED', errorReason);

      const origTx = await tx.getFirstAsync<any>(
        `SELECT * FROM transactions WHERE operation_id = ? AND transaction_type = 'COLLECTION'`,
        [operationId]
      );
      if (!origTx) return;

      const reversalOpId = `reversal-${operationId}`;
      const existingReversal = await tx.getFirstAsync<any>(
        `SELECT id FROM transactions WHERE operation_id = ?`,
        [reversalOpId]
      );
      if (existingReversal) return;

      // Query current net allocations across the original collection and any realloc adjustments
      const netAllocRow = await tx.getFirstAsync<{
        netAmount: number;
        netPrincipal: number;
        netMarkup: number;
        netPenalty: number;
        netSurplus: number;
      }>(
        `SELECT
           COALESCE(SUM(amount_paise), 0) as netAmount,
           COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
           COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
           COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
           COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
         FROM transactions
         WHERE loan_id = ?
           AND (
             operation_id = ?

             OR instr(operation_id, 'realloc::' || ? || '::') = 1

             OR instr(operation_id, 'reconcile::' || ? || '::') = 1
           )`,
        [origTx.loan_id, operationId, operationId, operationId]
      );

      const revId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('rev-' + Date.now() + '-' + Math.random().toString(36).substring(2));
      await tx.runAsync(
        `INSERT INTO transactions (
           id, operation_id, loan_id, transaction_type, is_cash, payment_method,
           amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
           unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          revId,
          reversalOpId,
          origTx.loan_id,
          'REVERSAL',
          0,
          'SYSTEM',
          -(netAllocRow?.netAmount ?? origTx.amount_paise),
          -(netAllocRow?.netPrincipal ?? origTx.allocated_principal_paise),
          -(netAllocRow?.netMarkup ?? origTx.allocated_markup_paise),
          -(netAllocRow?.netPenalty ?? origTx.allocated_penalty_paise),
          -(netAllocRow?.netSurplus ?? origTx.unallocated_surplus_paise),
          0,
          origTx.effective_date || new Date().toISOString().split('T')[0],
          new Date().toISOString(),
        ]
      );

      await SyncService.recalculateLoanSchedule(tx, origTx.loan_id);
    });
  }

  /**
   * Recalculates repayment schedules and loan status by replaying
   * all valid non-rejected collections for the loan.
   */
  static async recalculateLoanSchedule(tx: SQLiteDatabase, loanId: string): Promise<void> {
    const loan = await tx.getFirstAsync<any>(
      `SELECT * FROM loans WHERE id = ?`,
      [loanId]
    );
    if (!loan) return;

    // Reset all kists to 0 paid
    await tx.runAsync(
      `UPDATE repayment_schedules
       SET principal_paid_paise = 0, markup_paid_paise = 0, status = 'PENDING'
       WHERE loan_id = ?`,
      [loanId]
    );

    // Get all valid non-rejected collections in chronological sequence
    const collections = await tx.getAllAsync<any>(
      `SELECT t.* FROM transactions t
       WHERE t.loan_id = ? AND t.transaction_type = 'COLLECTION'
         AND t.operation_id NOT IN (
           SELECT operation_id FROM sync_outbox WHERE status = 'REJECTED'
         )
       ORDER BY t.sequence_number ASC`,
      [loanId]
    );

    let replayedPenaltyPaid = 0;
    let replayedBulletPrincipalPaid = 0;

    for (const col of collections) {
      const penaltyRow = await tx.getFirstAsync<{ assessed: number; forgiven: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ? THEN amount_paise ELSE 0 END), 0) as assessed,
           COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') AND effective_date <= ? THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
         FROM transactions WHERE loan_id = ?`,
        [col.effective_date, col.effective_date, loanId]
      );
       const reconRow = await tx.getFirstAsync<{ deltaPenalty: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN transaction_type = 'REVERSAL'
             AND NOT EXISTS (
               SELECT 1 FROM sync_outbox so
               WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
                 AND so.status = 'REJECTED'
                 AND (
                   transactions.operation_id = so.operation_id
                   OR transactions.operation_id = 'reversal-' || so.operation_id
                   OR transactions.operation_id = 'reversal::' || so.operation_id

                   OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                   OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
                 )
             )
             AND operation_id NOT LIKE 'realloc::%'
             AND operation_id NOT LIKE 'reconcile::%'
             AND effective_date <= ?
             THEN allocated_penalty_paise ELSE 0 END), 0) as deltaPenalty
         FROM transactions WHERE loan_id = ?`,
        [col.effective_date, loanId]
      );

      const assessed = penaltyRow?.assessed || 0;
      const forgiven = penaltyRow?.forgiven || 0;
      const reconPenalty = reconRow?.deltaPenalty || 0;
      const totalPaidPrior = replayedPenaltyPaid + reconPenalty;

      const outstandingPenalty = Math.max(0, assessed - totalPaidPrior - forgiven) as Paise;

      const kists = await tx.getAllAsync<any>(
        `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
        [loanId]
      );

      const allocInput = {
        paymentAmount: col.amount_paise as Paise,
        kists: kists.map((k) => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise as Paise,
          principalDue: k.principal_component_paise as Paise,
          markupDue: k.markup_component_paise as Paise,
          amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
          principalPaid: k.principal_paid_paise as Paise,
          markupPaid: k.markup_paid_paise as Paise,
          isDue: k.effective_due_date <= col.effective_date,
          status: k.status,
        })),
        outstandingPenalty,
      };

      const result = allocatePayment(allocInput);
      let newAllocPrincipal = 0;
      let newAllocMarkup = 0;
      let newAllocPenalty = 0;
      for (const a of result.allocations) {
        newAllocPrincipal += a.allocatedToPrincipal;
        newAllocMarkup += a.allocatedToMarkup;
        newAllocPenalty += a.allocatedToPenalty;
      }
      replayedPenaltyPaid += newAllocPenalty;

      let newAllocSurplus = result.unallocatedFunds || 0;
      if (loan.product_type === 'bullet' && newAllocSurplus > 0) {
        const remainingPrincipal = Math.max(0, loan.principal_paise - replayedBulletPrincipalPaid);
        const payPrincipal = Math.min(newAllocSurplus, remainingPrincipal);
        newAllocPrincipal += payPrincipal;
        newAllocSurplus -= payPrincipal;
        replayedBulletPrincipalPaid += payPrincipal;
      }

      const currentColNet = await tx.getFirstAsync<{
        currentPrincipal: number;
        currentMarkup: number;
        currentPenalty: number;
        currentSurplus: number;
      }>(
        `SELECT
           COALESCE(SUM(allocated_principal_paise), 0) as currentPrincipal,
           COALESCE(SUM(allocated_markup_paise), 0) as currentMarkup,
           COALESCE(SUM(allocated_penalty_paise), 0) as currentPenalty,
           COALESCE(SUM(unallocated_surplus_paise), 0) as currentSurplus
         FROM transactions
         WHERE loan_id = ?
           AND (
             operation_id = ?

             OR instr(operation_id, 'realloc::' || ? || '::') = 1

             OR instr(operation_id, 'reconcile::' || ? || '::') = 1
           )`,
        [loanId, col.operation_id, col.operation_id, col.operation_id]
      );

      const currentPrincipal = currentColNet?.currentPrincipal ?? (col.allocated_principal_paise || 0);
      const currentMarkup = currentColNet?.currentMarkup ?? (col.allocated_markup_paise || 0);
      const currentPenalty = currentColNet?.currentPenalty ?? (col.allocated_penalty_paise || 0);
      const currentSurplus = currentColNet?.currentSurplus ?? (col.unallocated_surplus_paise || 0);

      const deltaPrincipal = newAllocPrincipal - currentPrincipal;
      const deltaMarkup = newAllocMarkup - currentMarkup;
      const deltaPenalty = newAllocPenalty - currentPenalty;
      const deltaSurplus = newAllocSurplus - currentSurplus;

      if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
        const reallocId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('realloc-' + Date.now() + '-' + Math.random().toString(36).substring(2));
        const reallocOpId = `realloc::${col.operation_id}::${reallocId.substring(0, 8)}`;
        await tx.runAsync(
          `INSERT INTO transactions (
             id, operation_id, loan_id, transaction_type, is_cash, payment_method,
             amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
             unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reallocId,
            reallocOpId,
            col.loan_id,
            'REVERSAL',
            0,
            'SYSTEM',
            0,
            deltaPrincipal,
            deltaMarkup,
            deltaPenalty,
            deltaSurplus,
            0,
            col.effective_date || new Date().toISOString().split('T')[0],
            new Date().toISOString(),
          ]
        );
      }

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

    // Compute final remaining penalty across whole loan history
    const finalPenaltyRow = await tx.getFirstAsync<{ assessed: number; forgiven: number; reconPenalty: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' THEN amount_paise ELSE 0 END), 0) as assessed,
         COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven,
         COALESCE(SUM(CASE WHEN transaction_type = 'REVERSAL'
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status = 'REJECTED'
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )
           AND operation_id NOT LIKE 'realloc::%'
           AND operation_id NOT LIKE 'reconcile::%'
           THEN allocated_penalty_paise ELSE 0 END), 0) as reconPenalty
       FROM transactions WHERE loan_id = ?`,
      [loanId]
    );
    const finalRemainingPenalty = Math.max(
      0,
      (finalPenaltyRow?.assessed || 0) - (replayedPenaltyPaid + (finalPenaltyRow?.reconPenalty || 0)) - (finalPenaltyRow?.forgiven || 0)
    );

    // Check final settlement status of loan
    const finalKists = await tx.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ?`,
      [loanId]
    );
    const allPaid = finalKists.length > 0 && finalKists.every((k) => k.status === 'PAID');

    let isSettled = false;
    if (loan.product_type === 'instalment') {
      const totalPrincipalPaid = finalKists.reduce((acc, k) => acc + (k.principal_paid_paise || 0), 0);
      isSettled = allPaid && totalPrincipalPaid >= loan.principal_paise && finalRemainingPenalty <= 0;
    } else if (loan.product_type === 'bullet') {
      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status = 'REJECTED'
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )`,
        [loanId]
      );
      const bulletPrincipalPaid = bulletPrincipalRow?.total || 0;
      isSettled = allPaid && bulletPrincipalPaid >= loan.principal_paise && finalRemainingPenalty <= 0;
    }

    if (loan && loan.status !== 'WRITTEN_OFF') {
      const newStatus = isSettled ? 'SETTLED' : 'ACTIVE';
      await tx.runAsync(`UPDATE loans SET status = ? WHERE id = ?`, [newStatus, loanId]);
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
      const needsReviewItems = await OutboxManager.getNeedsReview(db);
      if (needsReviewItems.length > 0) {
        return {
          pushedCount: pushRes.pushed,
          pulledCount: pullRes.pulled,
          needsReviewCount: needsReviewItems.length,
          success: false,
          errors: [`${needsReviewItems.length} operation(s) require review due to server conflicts`],
        };
      }
      return {
        pushedCount: pushRes.pushed,
        pulledCount: pullRes.pulled,
        needsReviewCount: 0,
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

registerOutboxRevertHandler((db, opId, reason) => SyncService.revertRejectedPayment(db, opId, reason));
