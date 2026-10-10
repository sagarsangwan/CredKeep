import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { allocatePayment, KistAllocationState } from '../domain/allocation';
import { Paise, toPaise } from '../domain/money';
import { LoanRepository } from './loanRepository';
import { calculateNewPenalties } from '../domain/penalty';
import { OutboxManager } from '../sync/outbox';

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
        const existing = await tx.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
        if (existing) {
          returnResult = { success: true, transactionId: existing.id, transaction: existing };
          return;
        }

        const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
        if (!loan) throw new Error('Loan not found');
        
        // Ensure schedule is up to date (for bullet loans)
        const loanRepo = new LoanRepository(tx);
        await loanRepo.extendScheduleIfNeeded(loanId, tx);

        // Load current kists
        const dbKists = await tx.getAllAsync<any>(
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
        await this.assessPenalties(loanId, effectiveDate, tx);

        // Fetch outstanding penalty
        // Outstanding penalty = (Total PENALTY_ASSESSMENT amounts) - (Total allocated_penalty_paise from collections and reversals) - (forgiven_penalty_paise from waivers)
        const penaltyAssessments = await tx.getFirstAsync<any>(
          `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
          [loanId]
        );
        const penaltyPaid = await tx.getFirstAsync<any>(
          `SELECT SUM(allocated_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
          [loanId]
        );
        const penaltyForgiven = await tx.getFirstAsync<any>(
          `SELECT SUM(forgiven_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL'`,
          [loanId]
        );
        
        const totalPenaltyAssessed = (penaltyAssessments?.total || 0) as number;
        const totalPenaltyPaid = (penaltyPaid?.total || 0) as number;
        const totalPenaltyForgiven = (penaltyForgiven?.total || 0) as number;
        const outstandingPenalty = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid - totalPenaltyForgiven) as Paise;
  
        const result = allocatePayment({ paymentAmount, kists, outstandingPenalty });
        
        const transactionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('tx-' + Date.now() + '-' + Math.random().toString(36).substring(2));
        const createdAt = new Date().toISOString();
        
        let allocatedPrincipal = 0;
        let allocatedMarkup = 0;
        let allocatedPenalty = 0;
        
        for (const a of result.allocations) {
          allocatedPrincipal += a.allocatedToPrincipal;
          allocatedMarkup += a.allocatedToMarkup;
          allocatedPenalty += a.allocatedToPenalty;
        }

        let pastPrincipalPaid = 0;
        if (loan.product_type === 'bullet') {
          const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
            [loanId]
          );
          pastPrincipalPaid = pastPrincipalPaidRes?.total || 0;
          const remainingPrincipal = loan.principal_paise - pastPrincipalPaid;
          
          if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
            const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
            allocatedPrincipal += payPrincipal;
            result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
          }
        }
        
        await tx.runAsync(`
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
        const updateStmt = await tx.prepareAsync(`
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
        let allKistsPaid = true;
        for (const k of result.updatedKists) {
          if (k.status !== 'PAID') {
            allKistsPaid = false;
            break;
          }
        }
        
        const totalPrincipalPaid = result.updatedKists.reduce((acc, k) => acc + k.principalPaid, 0);
        if (loan.product_type === 'instalment') {
          if (totalPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
          }
        } else if (loan.product_type === 'bullet') {
          if ((pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
          }
        }

        await OutboxManager.enqueue(tx || this.db, {
          operationId,
          operationType: 'record_collection',
          payload: {
            loan_id: loanId,
            amount_paise: paymentAmount,
            effective_date: effectiveDate,
            payment_method: 'CASH',
            is_cash: true,
          },
        });
        
        returnResult = { success: true, transactionId, result };
      });
      
      return returnResult;
  }

  async previewPenalties(loanId: string, currentDate: string): Promise<number> {
    const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    const loanRepo = new LoanRepository(this.db);
    await loanRepo.extendScheduleIfNeeded(loanId);

    const dbKists = await this.db.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId]
    );

    const assessments = await this.db.getAllAsync<any>(
      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
      [loanId]
    );

    const assessedDates = new Set<string>(assessments.map(a => a.effective_date));

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

  async assessPenalties(loanId: string, currentDate: string, tx: any = this.db): Promise<number> {
    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    const loanRepo = new LoanRepository(tx);
    await loanRepo.extendScheduleIfNeeded(loanId, tx);

    const dbKists = await tx.getAllAsync(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId]
    );

    const assessments = await tx.getAllAsync(
      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
      [loanId]
    );

    const assessedDates = new Set<string>(assessments.map((a: any) => a.effective_date));

    const state = {
      loanId,
      rule: { dailyRatePaise: toPaise(100) },
      kists: dbKists.map((k: any) => ({
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
      for (const date of newAssessedDates) {
        const transactionId = crypto.randomUUID();
        const operationId = `penalty-${loanId}-${date}`;
        
        // Check if it already exists to be safe (by operation_id or date)
        const existing = await tx.getFirstAsync(
          `SELECT id FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
          [operationId, loanId, date]
        );
        if (!existing) {
          await tx.runAsync(`
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
      ${whereStr} AND t.transaction_type IN ('COLLECTION', 'REVERSAL')
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

  async getBorrowerSummary(borrowerId: string) {
    const loans = await this.db.getAllAsync<any>(
      `SELECT * FROM loans WHERE borrower_id = ?`,
      [borrowerId]
    );

    let totalPrincipalRemaining = 0;
    let totalMarkupRemaining = 0;
    let totalPenaltyRemaining = 0;
    let activeLoanCount = 0;

    for (const loan of loans) {
      if (loan.status === 'ACTIVE') {
        activeLoanCount++;
      }

      const earnings = await this.getEarningsSummary({ loanId: loan.id });
      totalPenaltyRemaining += earnings.outstandingPenalty;

      const kistSum = await this.db.getFirstAsync<any>(`
        SELECT 
          SUM(principal_component_paise) as total_principal,
          SUM(markup_component_paise) as total_markup,
          SUM(principal_paid_paise) as paid_principal,
          SUM(markup_paid_paise) as paid_markup
        FROM repayment_schedules
        WHERE loan_id = ?
      `, [loan.id]);

      const markupRem = (kistSum?.total_markup || 0) - (kistSum?.paid_markup || 0);
      totalMarkupRemaining += Math.max(0, markupRem);

      if (loan.product_type === 'bullet') {
        const bulletPrincipal = loan.principal_paise;
        const paidQuery = await this.db.getFirstAsync<any>(`
          SELECT SUM(allocated_principal_paise) as paid_principal, SUM(forgiven_principal_paise) as waived_principal
          FROM transactions 
          WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
        `, [loan.id]);
        const paid = paidQuery?.paid_principal || 0;
        const waived = paidQuery?.waived_principal || 0;
        totalPrincipalRemaining += Math.max(0, bulletPrincipal - paid - waived);
      } else {
        const prinRem = (kistSum?.total_principal || 0) - (kistSum?.paid_principal || 0);
        totalPrincipalRemaining += Math.max(0, prinRem);
      }
    }

    return {
      activeLoanCount,
      totalPrincipalRemaining,
      totalMarkupRemaining,
      totalPenaltyRemaining,
      totalOutstanding: totalPrincipalRemaining + totalMarkupRemaining + totalPenaltyRemaining
    };
  }
}
