import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ScheduleOptions, generateSchedule } from '../domain/schedule';

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
    options: ScheduleOptions
  ): Promise<Loan> {
    const loanId = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    const schedule = generateSchedule(options);

    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await this.db.runAsync(
        `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [loanId, borrowerId, options.principal, options.markupFactor, options.termMonths, options.startDate, options.dueDay, options.productType, created_at]
      );
      
      const statement = await this.db.prepareAsync(`
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
    return await this.db.getAllAsync(`
      SELECT * FROM repayment_schedules 
      WHERE loan_id = ? 
      ORDER BY installment_number ASC
    `, [loanId]);
  }
}
