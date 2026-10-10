import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { OutboxManager } from '../sync/outbox';
import { SyncService } from '../sync/syncService';

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
   * Structures extracted records into ordered push operations
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

    // 1. Borrower creations
    for (const b of extracted.borrowers) {
      operations.push({
        operation_id: crypto.randomUUID(),
        type: 'create_borrower',
        payload: {
          id: b.id,
          name: b.name,
          phone: b.phone,
        },
      });
    }

    // 2. Loan creations
    for (const l of extracted.loans) {
      operations.push({
        operation_id: crypto.randomUUID(),
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

    // 3. Historical collections
    for (const tx of extracted.transactions) {
      operations.push({
        operation_id: tx.operation_id || crypto.randomUUID(),
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

      // Enqueue all extracted operations
      for (const op of operations) {
        await OutboxManager.enqueue(db, {
          operationId: op.operation_id,
          operationType: op.type,
          payload: op.payload,
        });
      }

      // Execute push
      const pushResult = await SyncService.pushPending(db);

      // Record migration status
      await OutboxManager.setMeta(db, 'v1_migration_completed', 'true');
      await OutboxManager.setMeta(db, 'v1_migration_timestamp', new Date().toISOString());

      return {
        borrowersCount: extracted.borrowers.length,
        loansCount: extracted.loans.length,
        transactionsCount: extracted.transactions.length,
        pushedCount: pushResult.pushed,
        success: pushResult.failed === 0,
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
