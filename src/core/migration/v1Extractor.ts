import { SQLiteDatabase } from 'expo-sqlite';
import { OutboxManager } from '../sync/outbox';
import { SyncService } from '../sync/syncService';
import { isUuid, deterministicUuid } from './uuidUtils';

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

export interface V1ExtractionResult {
  borrowers: V1BorrowerRecord[];
  loans: V1LoanRecord[];
  transactions: V1TransactionRecord[];
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
      `SELECT * FROM transactions WHERE transaction_type = 'COLLECTION' ORDER BY sequence_number ASC`
    );

    return { borrowers, loans, transactions };
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
        },
      });
    }

    // 3. Historical collections (preserve existing operation ID if UUID, otherwise deterministic hash)
    for (const tx of extracted.transactions) {
      const opId = tx.operation_id && isUuid(tx.operation_id)
        ? tx.operation_id
        : deterministicUuid(`mig-tx-${tx.id || tx.operation_id || `${tx.loan_id}-${tx.effective_date}-${tx.amount_paise}`}`);

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
          const opId = txRecord.operation_id && isUuid(txRecord.operation_id)
            ? txRecord.operation_id
            : deterministicUuid(`mig-tx-${txRecord.id || txRecord.operation_id || `${txRecord.loan_id}-${txRecord.effective_date}-${txRecord.amount_paise}`}`);

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
                await tx.runAsync(
                  `UPDATE transactions SET id = ?, operation_id = ? WHERE (id = ? OR operation_id = ?)`,
                  [item.opId, item.opId, item.legacyId, item.legacyOpId]
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

      if (typeof (db as any).withExclusiveTransactionAsync === 'function') {
        await (db as any).withExclusiveTransactionAsync(atomicMigrationWork);
      } else if (typeof (db as any).runAsync === 'function') {
        await db.runAsync('BEGIN IMMEDIATE');
        try {
          await atomicMigrationWork(db);
          await db.runAsync('COMMIT');
        } catch (e) {
          await db.runAsync('ROLLBACK');
          throw e;
        }
      } else {
        await atomicMigrationWork(db);
      }

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

      const isSuccessful = pushResult.failed === 0 && allSynced;

      // Record migration status ONLY when all required operations are successfully accepted
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
          : (pushResult.failed > 0
              ? `${pushResult.failed} operations failed to push to cloud`
              : 'Cloud push incomplete or authentication required'),
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
