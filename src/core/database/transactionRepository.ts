import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { allocatePayment, KistAllocationState } from '../domain/allocation';
import { Paise } from '../domain/money';

export class TransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  async recordCashPayment(
    loanId: string, 
    paymentAmount: Paise, 
    operationId: string,
    effectiveDate: string
  ) {
      let returnResult: any = null;

      await this.db.withExclusiveTransactionAsync(async (tx) => {
        // Idempotency check
        const existing = await this.db.getFirstAsync(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
        if (existing) {
          returnResult = existing;
          return;
        }
        
        // Load current kists
        const dbKists = await this.db.getAllAsync<any>(
          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`, 
          [loanId]
        );
        
        const kists: KistAllocationState[] = dbKists.map(k => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise as Paise,
          principalDue: k.principal_component_paise as Paise,
          markupDue: k.markup_component_paise as Paise,
          amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
          principalPaid: k.principal_paid_paise as Paise,
          markupPaid: k.markup_paid_paise as Paise,
          status: k.status,
          isDue: k.effective_due_date <= effectiveDate
        }));
        
        // Assess penalties up to effectiveDate
        await this.assessPenalties(loanId, effectiveDate);

        // Fetch outstanding penalty
        // Outstanding penalty = (Total PENALTY_ASSESSMENT amounts) - (Total allocated_penalty_paise from all collections)
        const penaltyAssessments = await this.db.getFirstAsync<any>(
          `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
          [loanId]
        );
        const penaltyPaid = await this.db.getFirstAsync<any>(
          `SELECT SUM(allocated_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
          [loanId]
        );
        
        const totalPenaltyAssessed = (penaltyAssessments?.total || 0) as number;
        const totalPenaltyPaid = (penaltyPaid?.total || 0) as number;
        const outstandingPenalty = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid) as Paise;
  
        const result = allocatePayment({ paymentAmount, kists, outstandingPenalty });
        
        const transactionId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        
        let allocatedPrincipal = 0;
        let allocatedMarkup = 0;
        let allocatedPenalty = 0;
        
        for (const a of result.allocations) {
          allocatedPrincipal += a.allocatedToPrincipal;
          allocatedMarkup += a.allocatedToMarkup;
          allocatedPenalty += a.allocatedToPenalty;
        }
        
        await this.db.runAsync(`
          INSERT INTO transactions (
            id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
            amount_paise, allocated_principal_paise, allocated_markup_paise, 
            allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          transactionId, operationId, loanId, 'COLLECTION', 1, 'CASH',
          paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
          result.unallocatedFunds, effectiveDate, createdAt
        ]);
        
        // Update repayment schedules
        const updateStmt = await this.db.prepareAsync(`
          UPDATE repayment_schedules
          SET principal_paid_paise = ?, markup_paid_paise = ?, status = ?
          WHERE loan_id = ? AND installment_number = ?
        `);
        
        try {
          for (const k of result.updatedKists) {
            // Only update if changed
            const orig = kists.find(o => o.kistNumber === k.kistNumber)!;
            if (k.amountPaid !== orig.amountPaid || k.status !== orig.status) {
               await updateStmt.executeAsync([
                 k.principalPaid, k.markupPaid, k.status || 'PENDING', loanId, k.kistNumber
               ]);
            }
          }
        } finally {
          await updateStmt.finalizeAsync();
        }
        // Check if loan should be closed
        const loan = await this.db.getFirstAsync<any>(`SELECT product_type FROM loans WHERE id = ?`, [loanId]);
        
        let allKistsPaid = true;
        for (const k of result.updatedKists) {
          if (k.status !== 'PAID') {
            allKistsPaid = false;
            break;
          }
        }
        
        // For instalment loans, if all kists are paid and no outstanding penalty remains, settle the loan
        // For bullet loans, they require an explicit principal repayment transaction to settle (not yet implemented in this method)
        if (loan && loan.product_type === 'instalment' && allKistsPaid && result.remainingPenalty <= 0) {
           await this.db.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
        }
        
        returnResult = { success: true, transactionId, result };
      });
      
      return returnResult;
  }

  async previewPenalties(loanId: string, currentDate: string): Promise<number> {
    const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    const dbKists = await this.db.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId]
    );

    const assessments = await this.db.getAllAsync<any>(
      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
      [loanId]
    );

    const assessedDates = new Set<string>(assessments.map(a => a.effective_date));

    // Dynamic import to avoid circular dep
    const { calculateNewPenalties } = require('../domain/penalty');
    const { toPaise } = require('../domain/money');

    const state = {
      loanId,
      rule: { dailyRatePaise: toPaise(100) },
      kists: dbKists.map(k => ({
        kistNumber: k.installment_number,
        dueDate: k.effective_due_date,
        amountDue: k.total_due_paise,
        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
        isFullyPaid: k.status === 'PAID'
      })),
      assessedDates
    };

    const { newPenaltyAmount } = calculateNewPenalties(state, currentDate);
    return newPenaltyAmount;
  }

  async assessPenalties(loanId: string, currentDate: string): Promise<number> {
    const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    const dbKists = await this.db.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId]
    );

    const assessments = await this.db.getAllAsync<any>(
      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
      [loanId]
    );

    const assessedDates = new Set<string>(assessments.map(a => a.effective_date));

    // Dynamic import to avoid circular dep if any, or just require
    const { calculateNewPenalties, LoanPenaltyState } = require('../domain/penalty');
    const { toPaise } = require('../domain/money');

    const state = {
      loanId,
      rule: { dailyRatePaise: toPaise(100) },
      kists: dbKists.map(k => ({
        kistNumber: k.installment_number,
        dueDate: k.effective_due_date,
        amountDue: k.total_due_paise,
        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
        isFullyPaid: k.status === 'PAID'
      })),
      assessedDates
    };

    const { newPenaltyAmount, newAssessedDates } = calculateNewPenalties(state, currentDate);

    if (newPenaltyAmount > 0) {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        for (const date of newAssessedDates) {
          const transactionId = crypto.randomUUID();
          const operationId = `penalty-${loanId}-${date}`;
          
          // Check if it already exists to be safe
          const existing = await this.db.getFirstAsync(`SELECT id FROM transactions WHERE operation_id = ?`, [operationId]);
          if (!existing) {
            await this.db.runAsync(`
              INSERT INTO transactions (
                id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
                amount_paise, allocated_principal_paise, allocated_markup_paise, 
                allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              transactionId, operationId, loanId, 'PENALTY_ASSESSMENT', 0, 'SYSTEM',
              toPaise(100), 0, 0, 0, 0, date, new Date().toISOString()
            ]);
          }
        }
      });
    }

    return newPenaltyAmount;
  }

  async getEarningsSummary(filter?: { loanId?: string, borrowerId?: string, loanStatus?: string }) {
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filter?.loanId) {
      whereClauses.push('t.loan_id = ?');
      params.push(filter.loanId);
    }
    if (filter?.borrowerId) {
      whereClauses.push('l.borrower_id = ?');
      params.push(filter.borrowerId);
    }
    if (filter?.loanStatus) {
      whereClauses.push('l.status = ?');
      params.push(filter.loanStatus);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Calculate actual cash received
    const collectedQuery = await this.db.getFirstAsync<any>(`
      SELECT 
        SUM(t.allocated_principal_paise) as principal_returned,
        SUM(t.allocated_markup_paise) as markup_received,
        SUM(t.allocated_penalty_paise) as penalty_received,
        SUM(t.forgiven_principal_paise) as principal_waived,
        SUM(t.forgiven_markup_paise) as markup_waived,
        SUM(t.forgiven_penalty_paise) as penalty_waived
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      ${whereStr} AND t.transaction_type = 'COLLECTION'
    `, params);

    // Calculate outstanding (what is due but not paid)
    // For outstanding penalty, sum PENALTY_ASSESSMENT minus collected penalty
    const penaltyAssessments = await this.db.getFirstAsync<any>(`
      SELECT SUM(t.amount_paise) as total
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      ${whereStr} AND t.transaction_type = 'PENALTY_ASSESSMENT'
    `, params);

    const totalPenaltyAssessed = penaltyAssessments?.total || 0;
    const penaltyReceived = collectedQuery?.penalty_received || 0;
    const penaltyWaived = collectedQuery?.penalty_waived || 0;
    const outstandingPenalty = Math.max(0, totalPenaltyAssessed - penaltyReceived - penaltyWaived);

    return {
      principalReturned: collectedQuery?.principal_returned || 0,
      markupReceived: collectedQuery?.markup_received || 0,
      penaltyReceived,
      principalWaived: collectedQuery?.principal_waived || 0,
      markupWaived: collectedQuery?.markup_waived || 0,
      penaltyWaived,
      outstandingPenalty,
      totalEarnings: (collectedQuery?.markup_received || 0) + penaltyReceived
    };
  }
}
