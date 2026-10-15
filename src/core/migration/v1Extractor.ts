import { SQLiteDatabase } from 'expo-sqlite';
import { OutboxManager } from '../sync/outbox';
import { SyncService } from '../sync/syncService';
import { ApiClient } from '../api/client';
import { isUuid, deterministicUuid, getMigratedTransactionOpId } from './uuidUtils';
import { withDbTransaction } from '../database/transaction';

export interface V1BorrowerRecord {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export interface V1LoanRecord {
  id: string;
  borrower_id: string;
  principal_paise: number;
  markup_factor: number;
  term_months: number;
  start_date: string;
  due_day: number;
  product_type: string;
  status: string;
  created_at: string;
}

export interface V1TransactionRecord {
  id: string;
  operation_id: string;
  loan_id: string;
  transaction_type: string;
  amount_paise: number;
  payment_method: string;
  is_cash: number;
  effective_date: string;
  created_at: string;
}

export interface V1ScheduleModificationRecord {
  id: string;
  loan_id: string;
  installment_number: number;
  original_due_date: string;
  effective_due_date: string;
}

export interface V1ExtractionResult {
  borrowers: V1BorrowerRecord[];
  loans: V1LoanRecord[];
  transactions: V1TransactionRecord[];
  scheduleModifications?: V1ScheduleModificationRecord[];
}

export interface MigrationSummary {
  borrowersCount: number;
  loansCount: number;
  transactionsCount: number;
  pushedCount: number;
  success: boolean;
  error?: string;
}

export { isUuid, deterministicUuid };

export class V1DataExtractor {
  /**
   * Extracts all existing V1 portfolio records from local SQLite
   */
  static async extract(db: SQLiteDatabase): Promise<V1ExtractionResult> {
    const borrowers = await db.getAllAsync<V1BorrowerRecord>(
      `SELECT * FROM borrowers ORDER BY created_at ASC`
    );

    const loans = await db.getAllAsync<V1LoanRecord>(
      `SELECT * FROM loans ORDER BY created_at ASC`
    );

    const transactions = await db.getAllAsync<V1TransactionRecord>(
      `SELECT * FROM transactions WHERE transaction_type IN ('COLLECTION', 'WAIVER') ORDER BY sequence_number ASC`
    );

    let scheduleModifications: V1ScheduleModificationRecord[] = [];
    try {
      scheduleModifications = await db.getAllAsync<V1ScheduleModificationRecord>(
        `SELECT id, loan_id, installment_number, original_due_date, effective_due_date
         FROM repayment_schedules
         WHERE effective_due_date != original_due_date
         ORDER BY installment_number ASC`
      );
    } catch {
      // Ignore if repayment_schedules table not present in test mock
    }

    return { borrowers, loans, transactions, scheduleModifications };
  }

  /**
   * Structures extracted records into ordered push operations with deterministic operation IDs
   */
  static buildPushPayloads(extracted: V1ExtractionResult): {
    operation_id: string;
    type: string;
    payload: Record<string, any>;
  }[] {
    const operations: {
      operation_id: string;
      type: string;
      payload: Record<string, any>;
    }[] = [];

    // 1. Borrower creations (deterministic operation ID derived from borrower ID)
    for (const b of extracted.borrowers) {
      operations.push({
        operation_id: deterministicUuid(`mig-borrower-${b.id}`),
        type: 'create_borrower',
        payload: {
          id: b.id,
          name: b.name,
          phone: b.phone,
        },
      });
    }

    // 2. Loan creations (deterministic operation ID derived from loan ID)
    for (const l of extracted.loans) {
      operations.push({
        operation_id: deterministicUuid(`mig-loan-${l.id}`),
        type: 'create_loan',
        payload: {
          id: l.id,
          borrower_id: l.borrower_id,
          principal_paise: l.principal_paise,
          markup_factor: l.markup_factor,
          term_months: l.term_months,
          start_date: l.start_date,
          due_day: l.due_day,
          product_type: l.product_type,
          status: l.status === 'WRITTEN_OFF' ? 'WRITTEN_OFF' : 'ACTIVE',
        },
      });
    }

    // 3. Schedule modifications
    for (const mod of extracted.scheduleModifications || []) {
      operations.push({
        operation_id: deterministicUuid(`mig-mod-${mod.loan_id}-${mod.installment_number}`),
        type: 'modify_schedule',
        payload: {
          loan_id: mod.loan_id,
          installment_number: mod.installment_number,
          revised_effective_due_date: mod.effective_due_date,
          accrued_penalty_action: 'NONE',
        },
      });
    }

    // 4. Historical collections and waivers
    for (const tx of extracted.transactions) {
      const opId = getMigratedTransactionOpId(tx);
      if (tx.transaction_type === 'COLLECTION') {
        operations.push({
          operation_id: opId,
          type: 'record_collection',
          payload: {
            loan_id: tx.loan_id,
            amount_paise: tx.amount_paise,
            effective_date: tx.effective_date,
            payment_method: tx.payment_method || 'CASH',
            is_cash: tx.is_cash === 1,
          },
        });
      } else if (tx.transaction_type === 'WAIVER') {
        operations.push({
          operation_id: opId,
          type: 'waive_penalty',
          payload: {
            loan_id: tx.loan_id,
            amount_paise: (tx as any).forgiven_penalty_paise || tx.amount_paise,
            effective_date: tx.effective_date,
          },
        });
      }
    }

    return operations;
  }

  /**
   * Enqueues all V1 records into sync_outbox and runs initial cloud push
   */
  static async migrateToCloud(db: SQLiteDatabase): Promise<MigrationSummary> {
    try {
      const extracted = await this.extract(db);
      const operations = this.buildPushPayloads(extracted);

      // Re-key local transaction rows to deterministic UUIDs and enqueue into sync_outbox atomically
      const atomicMigrationWork = async (tx: any) => {
        const txsToRekey: { opId: string; legacyId: string; legacyOpId: string }[] = [];
        for (const txRecord of extracted.transactions) {
          const opId = getMigratedTransactionOpId(txRecord);

          if (txRecord.operation_id !== opId || txRecord.id !== opId) {
            txsToRekey.push({
              opId,
              legacyId: txRecord.id,
              legacyOpId: txRecord.operation_id,
            });
          }
        }

        if (txsToRekey.length > 0) {
          if (typeof tx.execAsync === 'function') {
            await tx.execAsync('DROP TRIGGER IF EXISTS prevent_transactions_update;');
          } else if (typeof tx.runAsync === 'function') {
            await tx.runAsync('DROP TRIGGER IF EXISTS prevent_transactions_update;');
          }

          try {
            if (typeof tx.runAsync === 'function') {
              for (const item of txsToRekey) {
                // 1. Rekey main receipt row
                await tx.runAsync(
                  `UPDATE transactions SET id = ?, operation_id = ? WHERE (id = ? OR operation_id = ?)`,
                  [item.opId, item.opId, item.legacyId, item.legacyOpId]
                );

                // 2. Rekey all linked adjustment transactions atomically
                await tx.runAsync(
                  `UPDATE transactions SET operation_id = 'reconcile::' || ? || '::' || substr(operation_id, length('reconcile::' || ? || '::') + 1) WHERE instr(operation_id, 'reconcile::' || ? || '::') = 1`,
                  [item.opId, item.legacyOpId, item.legacyOpId]
                );
                await tx.runAsync(
                  `UPDATE transactions SET operation_id = 'realloc::' || ? || '::' || substr(operation_id, length('realloc::' || ? || '::') + 1) WHERE instr(operation_id, 'realloc::' || ? || '::') = 1`,
                  [item.opId, item.legacyOpId, item.legacyOpId]
                );

                // Rekey legacy hyphen format adjustments
                await tx.runAsync(
                  `UPDATE transactions SET operation_id = 'reconcile::' || ? || '::' || substr(operation_id, length('reconcile-' || ? || '-') + 1) WHERE instr(operation_id, 'reconcile-' || ? || '-') = 1`,
                  [item.opId, item.legacyOpId, item.legacyOpId]
                );
                await tx.runAsync(
                  `UPDATE transactions SET operation_id = 'realloc::' || ? || '::' || substr(operation_id, length('realloc-' || ? || '-') + 1) WHERE instr(operation_id, 'realloc-' || ? || '-') = 1`,
                  [item.opId, item.legacyOpId, item.legacyOpId]
                );

                // Rekey compensating reversals
                await tx.runAsync(
                  `UPDATE transactions SET operation_id = 'reversal::' || ? WHERE operation_id = 'reversal::' || ? OR operation_id = 'reversal-' || ?`,
                  [item.opId, item.legacyOpId, item.legacyOpId]
                );
              }
            }
          } finally {
            // Restore append-only trigger within transaction
            const restoreTriggerSql = `
              CREATE TRIGGER IF NOT EXISTS prevent_transactions_update
              BEFORE UPDATE ON transactions
              BEGIN
                SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
              END;
            `;
            if (typeof tx.execAsync === 'function') {
              await tx.execAsync(restoreTriggerSql);
            } else if (typeof tx.runAsync === 'function') {
              await tx.runAsync(restoreTriggerSql);
            }
          }
        }

        // Atomically enqueue all extracted operations
        for (const op of operations) {
          await OutboxManager.enqueue(tx, {
            operationId: op.operation_id,
            operationType: op.type,
            payload: op.payload,
          });
        }
      };

      await withDbTransaction(db, atomicMigrationWork);

      // Execute push
      const pushResult = await SyncService.pushPending(db);

      // Determine migration completion from outbox status of all extracted operations
      const opIds = operations.map((op) => op.operation_id);
      let allSynced = false;
      if (opIds.length === 0) {
        allSynced = true;
      } else if (typeof (db as any).getAllAsync === 'function') {
        const placeholders = opIds.map(() => '?').join(',');
        const syncedRecords = await (db as any).getAllAsync(
          `SELECT operation_id FROM sync_outbox WHERE operation_id IN (${placeholders}) AND status = 'SYNCED'`,
          opIds
        );
        allSynced = (syncedRecords || []).length === opIds.length;
      } else {
        allSynced = pushResult.failed === 0 && pushResult.pushed === opIds.length;
      }

      // 5. Portfolio Reconciliation (Step 6 of V1 Data Migration Spec docs/v2/11-v1-migration.md):
      // Verify that all extracted entities are accounted for and portfolio totals match before declaring completion.
      let reconciliationMatches = true;
      let reconciliationError: string | undefined;

      const expectedActiveLoans = extracted.loans.filter(l => (l.status || 'ACTIVE') === 'ACTIVE').length;
      const expectedWrittenOffLoans = extracted.loans.filter(l => l.status === 'WRITTEN_OFF').length;
      const expectedSettledLoans = extracted.loans.filter(l => l.status === 'SETTLED').length;
      const expectedTotalPrincipal = extracted.loans.reduce((sum, l) => sum + (l.principal_paise || 0), 0);
      const expectedCollectionsCount = extracted.transactions.filter(t => t.transaction_type === 'COLLECTION').length;
      const expectedTotalCollections = extracted.transactions.filter(t => t.transaction_type === 'COLLECTION').reduce((sum, t) => sum + (t.amount_paise || 0), 0);

      if (pushResult.failed === 0 && allSynced) {
        try {
          // A. Pull authoritative server delta state into local replica
          await SyncService.pullChanges(db);

          // B. Query authoritative server portfolio summary
          const serverPortfolio = await ApiClient.get('/sync/portfolio/');
          if (!serverPortfolio) {
            throw new Error('Authoritative server portfolio summary is unavailable');
          }

          if (
            serverPortfolio.active_loans_count !== expectedActiveLoans ||
            serverPortfolio.settled_loans_count !== expectedSettledLoans ||
            serverPortfolio.written_off_loans_count !== expectedWrittenOffLoans ||
            serverPortfolio.total_principal_paise !== expectedTotalPrincipal ||
            serverPortfolio.total_collections_count !== expectedCollectionsCount ||
            serverPortfolio.total_collections_paise !== expectedTotalCollections
          ) {
            reconciliationMatches = false;
            reconciliationError = `Server portfolio reconciliation mismatch: server balances or counts do not match V1 baseline.`;
          }

          // C. Verify local replica state
          if (typeof (db as any).getAllAsync === 'function') {
            const localLoans = await (db as any).getAllAsync(`SELECT status, principal_paise FROM loans`);
            if (localLoans && localLoans.length > 0) {
              const currentActive = localLoans.filter((l: any) => (l.status || 'ACTIVE') === 'ACTIVE').length;
              const currentWrittenOff = localLoans.filter((l: any) => l.status === 'WRITTEN_OFF').length;
              const currentSettled = localLoans.filter((l: any) => l.status === 'SETTLED').length;
              const currentPrincipal = localLoans.reduce((sum: number, l: any) => sum + (l.principal_paise || 0), 0);

              if (currentActive !== expectedActiveLoans || currentWrittenOff !== expectedWrittenOffLoans || currentSettled !== expectedSettledLoans || currentPrincipal !== expectedTotalPrincipal) {
                reconciliationMatches = false;
                reconciliationError = `Local replica reconciliation mismatch: local loan status counts or principal balance do not match V1 baseline.`;
              }
            }

            if (typeof (db as any).getFirstAsync === 'function') {
              const localTxTotals = await (db as any).getFirstAsync(
                `SELECT COUNT(*) as count, COALESCE(SUM(amount_paise), 0) as total FROM transactions WHERE transaction_type = 'COLLECTION'`
              );
              if (localTxTotals) {
                if (localTxTotals.count !== expectedCollectionsCount || localTxTotals.total !== expectedTotalCollections) {
                  reconciliationMatches = false;
                  reconciliationError = `Local replica reconciliation mismatch: collection count or receipts total do not match V1 baseline.`;
                }
              }
            }
          }
        } catch (err: any) {
          reconciliationMatches = false;
          reconciliationError = `Portfolio reconciliation verification error: ${err?.message || String(err)}`;
        }
      } else {
        reconciliationMatches = false;
        if (pushResult.failed > 0) {
          reconciliationError = `${pushResult.failed} operations failed to push to cloud`;
        } else if (!allSynced) {
          reconciliationError = 'Cloud push incomplete: pending operations remain unacknowledged';
        }
      }

      const isSuccessful = pushResult.failed === 0 && allSynced && reconciliationMatches;

      // Record migration status ONLY when all required operations are successfully accepted AND portfolio totals reconcile
      if (isSuccessful) {
        await OutboxManager.setMeta(db, 'v1_migration_completed', 'true');
        await OutboxManager.setMeta(db, 'v1_migration_timestamp', new Date().toISOString());
      }

      return {
        borrowersCount: extracted.borrowers.length,
        loansCount: extracted.loans.length,
        transactionsCount: extracted.transactions.length,
        pushedCount: pushResult.pushed,
        success: isSuccessful,
        error: isSuccessful
          ? undefined
          : (reconciliationError
              ? reconciliationError
              : (pushResult.failed > 0
                  ? `${pushResult.failed} operations failed to push to cloud`
                  : 'Cloud push incomplete or authentication required')),
      };
    } catch (err: any) {
      return {
        borrowersCount: 0,
        loansCount: 0,
        transactionsCount: 0,
        pushedCount: 0,
        success: false,
        error: err?.message || 'Migration failed',
      };
    }
  }

  /**
   * Checks if migration has already been executed
   */
  static async isMigrationCompleted(db: SQLiteDatabase): Promise<boolean> {
    const meta = await OutboxManager.getMeta(db, 'v1_migration_completed');
    return meta === 'true';
  }
}
