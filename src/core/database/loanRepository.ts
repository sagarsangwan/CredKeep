import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ScheduleOptions, generateSchedule, calculateNextDueDate } from '../domain/schedule';
import { multiplyPaise, Paise } from '../domain/money';
import { OutboxManager } from '../sync/outbox';
import { SyncCoordinator } from '../sync/syncCoordinator';
import { withDbTransaction } from './transaction';

export type Loan = {
  id: string;
  borrower_id: string;
  principal_paise: number;
  markup_factor: number;
  term_months: number;
  start_date: string;
  due_day: number;
  product_type: string;
  status: string;
  collateral?: string | null;
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

export class LoanRepository {
  constructor(private db: SQLiteDatabase) {}

  async createLoanWithSchedule(
    borrowerId: string, 
    options: ScheduleOptions,
    clientOpId?: string
  ): Promise<Loan> {
    let resolvedLoan: Loan | null = null;
    const loanId = generateUuid();
    const created_at = new Date().toISOString();
    
    const schedule = generateSchedule(options);

    await withDbTransaction(this.db, async (tx) => {
      const txHandle = tx || this.db;

      if (clientOpId) {
        const existingOutbox = await txHandle.getFirstAsync<any>(
          `SELECT status, error_message, payload FROM sync_outbox WHERE operation_id = ?`,
          [clientOpId]
        );
        if (existingOutbox) {
          if (existingOutbox.status === 'REJECTED') {
            throw new Error(
              `Loan creation operation ${clientOpId} was rejected: ${existingOutbox.error_message || 'Terminal rejection'}`
            );
          }
          let parsed: any;
          try {
            parsed = JSON.parse(existingOutbox.payload);
          } catch {
            parsed = {};
          }
          if (
            parsed.borrower_id !== borrowerId ||
            parsed.principal_paise !== options.principal ||
            parsed.markup_factor !== options.markupFactor ||
            parsed.term_months !== options.termMonths ||
            parsed.start_date !== options.startDate ||
            parsed.due_day !== options.dueDay ||
            parsed.product_type !== options.productType
          ) {
            throw new Error(`Idempotency conflict: operation_id ${clientOpId} already exists with different loan attributes.`);
          }
          const existingLoan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [parsed.id]);
          if (existingLoan) {
            resolvedLoan = existingLoan;
            return;
          }
        }
      }

      if (options.collateral) {
        await txHandle.runAsync(
          `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, collateral, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [loanId, borrowerId, options.principal, options.markupFactor, options.termMonths, options.startDate, options.dueDay, options.productType, options.collateral, created_at]
        );
      } else {
        await txHandle.runAsync(
          `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [loanId, borrowerId, options.principal, options.markupFactor, options.termMonths, options.startDate, options.dueDay, options.productType, created_at]
        );
      }
      
      const statement = await txHandle.prepareAsync(`
        INSERT INTO repayment_schedules 
        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        for (const kist of schedule) {
          await statement.executeAsync([
            generateUuid(),
            loanId,
            kist.kistNumber,
            kist.dueDate,
            kist.dueDate,
            kist.principalDue || 0,
            kist.markupDue || 0,
            kist.amountDue
          ]);
        }
      } finally {
        await statement.finalizeAsync();
      }

      await OutboxManager.enqueue(txHandle, {
        operationId: clientOpId,
        operationType: 'create_loan',
        payload: {
          id: loanId,
          borrower_id: borrowerId,
          principal_paise: options.principal,
          markup_factor: options.markupFactor,
          term_months: options.termMonths,
          start_date: options.startDate,
          due_day: options.dueDay,
          product_type: options.productType,
          collateral: options.collateral || null,
        },
      });
    });

    SyncCoordinator.notifyMutation();

    if (resolvedLoan) {
      return resolvedLoan;
    }

    return (await this.getById(loanId))!;
  }

  async getAll(): Promise<Loan[]> {
    return await this.db.getAllAsync<Loan>(`SELECT * FROM loans ORDER BY created_at DESC`);
  }
  
  async getByBorrowerId(borrowerId: string): Promise<Loan[]> {
    return await this.db.getAllAsync<Loan>(`SELECT * FROM loans WHERE borrower_id = ? ORDER BY created_at DESC`, [borrowerId]);
  }

  async getById(id: string): Promise<Loan | null> {
    return await this.db.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [id]);
  }
  
  async getSchedule(loanId: string) {
    await this.extendScheduleIfNeeded(loanId);
    return await this.db.getAllAsync(`
      SELECT * FROM repayment_schedules 
      WHERE loan_id = ? 
      ORDER BY installment_number ASC
    `, [loanId]);
  }

  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE') return;

    const kists = await tx.getAllAsync(`
      SELECT * FROM repayment_schedules 
      WHERE loan_id = ? 
      ORDER BY installment_number ASC
    `, [loanId]);
    
    if (kists.length === 0) return;
    const lastKist = kists[kists.length - 1];
    const currentDate = new Date().toISOString().split('T')[0];
    
    // If the last kist's due date is in the past, generate new ones until we pass currentDate
    if (lastKist.effective_due_date < currentDate) {
      const totalMarkup = multiplyPaise(loan.principal_paise as Paise, loan.markup_factor);
      const markupDuePerMonth = Math.floor(totalMarkup / loan.term_months);
      
      let nextInstalmentNumber = lastKist.installment_number + 1;
      let monthsToAddFromStart = nextInstalmentNumber;
      
      let nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
      
      const statement = await tx.prepareAsync(`
        INSERT INTO repayment_schedules 
        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        while (nextDueDate <= currentDate || nextInstalmentNumber === lastKist.installment_number + 1 /* always add at least one if we entered */) {
          const kistId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('kist-' + Date.now() + '-' + Math.random().toString(36).substring(2));
          await statement.executeAsync([
            kistId,
            loanId,
            nextInstalmentNumber,
            nextDueDate,
            nextDueDate,
            0,
            markupDuePerMonth,
            markupDuePerMonth
          ]);
          
          if (nextDueDate > currentDate) break;
          
          nextInstalmentNumber++;
          monthsToAddFromStart++;
          nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
        }
      } finally {
        await statement.finalizeAsync();
      }
    }
  }
}
