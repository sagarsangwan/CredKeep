import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ScheduleOptions, generateSchedule, calculateNextDueDate } from '../domain/schedule';
import { multiplyPaise, Paise } from '../domain/money';
import { OutboxManager } from '../sync/outbox';

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
  created_at: string;
};

export class LoanRepository {
  constructor(private db: SQLiteDatabase) {}

  async createLoanWithSchedule(
    borrowerId: string, 
    options: ScheduleOptions,
    clientOpId?: string
  ): Promise<Loan> {
    const loanId = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    const schedule = generateSchedule(options);

    await this.db.withExclusiveTransactionAsync(async (tx) => {
      const txHandle = tx || this.db;
      await txHandle.runAsync(
        `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [loanId, borrowerId, options.principal, options.markupFactor, options.termMonths, options.startDate, options.dueDay, options.productType, created_at]
      );
      
      const statement = await txHandle.prepareAsync(`
        INSERT INTO repayment_schedules 
        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        for (const kist of schedule) {
          await statement.executeAsync([
            crypto.randomUUID(),
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
        },
      });
    });

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
