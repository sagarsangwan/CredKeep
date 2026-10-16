import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { allocatePayment, KistAllocationState } from '../domain/allocation';
import { Paise, toPaise } from '../domain/money';
import { LoanRepository } from './loanRepository';
import { calculateNewPenalties } from '../domain/penalty';
import { OutboxManager } from '../sync/outbox';
import { SyncCoordinator } from '../sync/syncCoordinator';
import { withDbTransaction } from './transaction';

export class TransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  async recordCashPayment(
    loanId: string, 
    paymentAmount: Paise, 
    operationId: string,
    effectiveDate: string
  ) {
      let returnResult: any = null;

      await withDbTransaction(this.db, async (tx) => {
        // Idempotency check
        const outboxRec = await tx.getFirstAsync<any>(
          `SELECT status, error_message FROM sync_outbox WHERE operation_id = ?`,
          [operationId]
        );
        if (outboxRec && outboxRec.status === 'REJECTED') {
          throw new Error(
            `Payment operation ${operationId} was rejected: ${outboxRec.error_message || 'Terminal rejection'}`
          );
        }

        const existing = await tx.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
        if (existing) {
          if (
            existing.loan_id !== loanId ||
            existing.amount_paise !== paymentAmount ||
            existing.effective_date !== effectiveDate ||
            existing.transaction_type !== 'COLLECTION' ||
            existing.payment_method !== 'CASH' ||
            existing.is_cash !== 1
          ) {
            throw new Error(`Idempotency conflict: operation_id ${operationId} already exists with different payment attributes.`);
          }
          returnResult = { success: true, transactionId: existing.id, transaction: existing };
          return;
        }

        const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
        if (!loan) throw new Error('Loan not found');

        if (loan.product_type === 'bullet' && loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
          // Assess penalties up to effectiveDate
          await this.assessPenalties(loanId, effectiveDate, tx);

          const penaltyAssessments = await tx.getFirstAsync<any>(
            `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
            [loanId]
          );
          const penaltyPaid = await tx.getFirstAsync<any>(
            `SELECT SUM(allocated_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
            [loanId]
          );
          const penaltyForgiven = await tx.getFirstAsync<any>(
            `SELECT SUM(forgiven_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('WAIVER', 'REVERSAL')`,
            [loanId]
          );
          const totalPenaltyAssessed = (penaltyAssessments?.total || 0) as number;
          const totalPenaltyPaid = (penaltyPaid?.total || 0) as number;
          const totalPenaltyForgiven = (penaltyForgiven?.total || 0) as number;
          const outstandingPenalty = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid - totalPenaltyForgiven) as Paise;

          let unallocated = paymentAmount;
          const allocatedPenalty = Math.min(unallocated, outstandingPenalty) as Paise;
          unallocated = (unallocated - allocatedPenalty) as Paise;

          // Contracted interest across all terms
          const terms = await tx.getAllAsync<any>(
            `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
            [loanId]
          );
          const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);

          const markupPaidRes = await tx.getFirstAsync<any>(
            `SELECT SUM(allocated_markup_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
            [loanId]
          );
          const pastMarkupPaid = markupPaidRes?.total || 0;
          const unpaidInterest = Math.max(0, totalContractInterest - pastMarkupPaid);

          const allocatedMarkup = Math.min(unallocated, unpaidInterest) as Paise;
          unallocated = (unallocated - allocatedMarkup) as Paise;

          // Remaining principal
          const prinPaidRes = await tx.getFirstAsync<any>(
            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
            [loanId]
          );
          const pastPrincipalPaid = prinPaidRes?.total || 0;
          const remainingPrincipal = Math.max(0, loan.principal_paise - pastPrincipalPaid);

          const allocatedPrincipal = Math.min(unallocated, remainingPrincipal) as Paise;
          unallocated = (unallocated - allocatedPrincipal) as Paise;
          const surplus = unallocated;

          const transactionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('tx-' + Date.now() + '-' + Math.random().toString(36).substring(2));
          const createdAt = new Date().toISOString();

          await tx.runAsync(`
            INSERT INTO transactions (
              id, operation_id, loan_id, transaction_type, is_cash, payment_method,
              amount_paise, allocated_principal_paise, allocated_markup_paise,
              allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            transactionId, operationId, loanId, 'COLLECTION', 1, 'CASH',
            paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
            surplus, effectiveDate, createdAt
          ]);

          // Update terms settled if interest paid
          if ((pastMarkupPaid + allocatedMarkup) >= totalContractInterest) {
            await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1 WHERE loan_id = ?`, [loanId]);
          }

          // Check if loan should be marked settled
          if (
            (pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise &&
            (pastMarkupPaid + allocatedMarkup) >= totalContractInterest &&
            (outstandingPenalty - allocatedPenalty) <= 0
          ) {
            await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
          }

          await OutboxManager.enqueue(tx, {
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

          returnResult = {
            success: true,
            transactionId,
            result: {
              remainingPenalty: Math.max(0, outstandingPenalty - allocatedPenalty),
              unallocatedFunds: surplus,
              allocations: [{
                kistNumber: 1,
                allocatedToPrincipal: allocatedPrincipal,
                allocatedToMarkup: allocatedMarkup,
                allocatedToPenalty: allocatedPenalty
              }],
              updatedKists: []
            }
          };
          return;
        }

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
          `SELECT SUM(allocated_penalty_paise) as total FROM transactions
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
        const penaltyForgiven = await tx.getFirstAsync<any>(
          `SELECT SUM(forgiven_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('WAIVER', 'REVERSAL')`,
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
            `SELECT SUM(allocated_principal_paise) as total FROM transactions
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
        if (loan.status !== 'WRITTEN_OFF') {
          if (loan.product_type === 'instalment') {
            if (totalPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
               await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
            }
          } else if (loan.product_type === 'bullet') {
            if ((pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
               await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
            }
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
      
      SyncCoordinator.notifyMutation();
      return returnResult;
  }

  async correctPayment(
    originalTransactionId: string,
    correctedPaise: Paise,
    reason: string,
    clientOpId?: string
  ): Promise<{ reversalTransactionId: string; replacementTransactionId: string | null }> {
    const opId = clientOpId || ((crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-' + Date.now() + '-' + Math.random().toString(36).substring(2)));
    let reversalTxId = '';
    let replacementTxId: string | null = null;

    await withDbTransaction(this.db, async (tx) => {
      const orig = await tx.getFirstAsync<any>(
        `SELECT * FROM transactions WHERE id = ?`,
        [originalTransactionId]
      );
      if (!orig) throw new Error('Original transaction not found');
      if (orig.transaction_type !== 'COLLECTION') {
        throw new Error('Only COLLECTION transactions can be corrected');
      }

      // Check if already reversed
      const existingReversal = await tx.getFirstAsync<any>(
        `SELECT id FROM transactions WHERE reversal_of_id = ? AND transaction_type = 'REVERSAL'`,
        [originalTransactionId]
      );
      if (existingReversal) {
        throw new Error('Transaction has already been reversed or corrected');
      }

      const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [orig.loan_id]);
      if (!loan) throw new Error('Loan not found');

      reversalTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('rev-' + Date.now() + '-' + Math.random().toString(36).substring(2));
      const now = new Date().toISOString();

      // 1. Insert REVERSAL transaction with negative allocations
      await tx.runAsync(`
        INSERT INTO transactions (
          id, operation_id, loan_id, transaction_type, is_cash, payment_method,
          amount_paise, allocated_principal_paise, allocated_markup_paise,
          allocated_penalty_paise, unallocated_surplus_paise, effective_date,
          reversal_of_id, correction_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        reversalTxId,
        `reversal-${opId}`,
        orig.loan_id,
        'REVERSAL',
        orig.is_cash,
        orig.payment_method,
        0,
        -(orig.allocated_principal_paise || 0),
        -(orig.allocated_markup_paise || 0),
        -(orig.allocated_penalty_paise || 0),
        -(orig.unallocated_surplus_paise || 0),
        orig.effective_date,
        orig.id,
        reason,
        now
      ]);

      // 2. Insert replacement COLLECTION transaction if correctedPaise > 0
      if (correctedPaise > 0) {
        replacementTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('repl-' + Date.now() + '-' + Math.random().toString(36).substring(2));
        await tx.runAsync(`
          INSERT INTO transactions (
            id, operation_id, loan_id, transaction_type, is_cash, payment_method,
            amount_paise, allocated_principal_paise, allocated_markup_paise,
            allocated_penalty_paise, unallocated_surplus_paise, effective_date,
            reversal_of_id, correction_reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          replacementTxId,
          opId,
          orig.loan_id,
          'COLLECTION',
          orig.is_cash,
          orig.payment_method,
          correctedPaise,
          0, 0, 0, 0,
          orig.effective_date,
          orig.id,
          reason,
          now
        ]);
      }

      // 3. Record in payment_corrections
      const correctionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-rec-' + Date.now());
      await tx.runAsync(`
        INSERT INTO payment_corrections (
          id, loan_id, original_transaction_id, reversal_transaction_id,
          replacement_transaction_id, previous_amount_paise, corrected_amount_paise,
          reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        correctionId,
        orig.loan_id,
        orig.id,
        reversalTxId,
        replacementTxId,
        orig.amount_paise,
        correctedPaise,
        reason,
        now
      ]);

      // 4. Recompute loan state
      if (loan.product_type === 'instalment' || loan.rate_basis === 'LEGACY_FIXED_TERM') {
        // Reset kists
        await tx.runAsync(`
          UPDATE repayment_schedules
          SET principal_paid_paise = 0, markup_paid_paise = 0, status = 'PENDING'
          WHERE loan_id = ?
        `, [orig.loan_id]);

        // Fetch all active non-reversed collections ordered by effective_date, created_at
        const activeCollections = await tx.getAllAsync<any>(`
          SELECT * FROM transactions
          WHERE loan_id = ? AND transaction_type = 'COLLECTION'
            AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)
          ORDER BY effective_date ASC, created_at ASC
        `, [orig.loan_id, orig.loan_id]);

        const dbKists = await tx.getAllAsync<any>(
          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
          [orig.loan_id]
        );

        let kists: KistAllocationState[] = dbKists.map(k => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise as Paise,
          principalDue: k.principal_component_paise as Paise,
          markupDue: k.markup_component_paise as Paise,
          amountPaid: 0 as Paise,
          principalPaid: 0 as Paise,
          markupPaid: 0 as Paise,
          status: 'UNPAID' as const,
          isDue: true
        }));

        for (const col of activeCollections) {
          const penaltyAssessments = await tx.getFirstAsync<any>(
            `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ?`,
            [orig.loan_id, col.effective_date]
          );
          const totalPenaltyAssessed = penaltyAssessments?.total || 0;
          const res = allocatePayment({ paymentAmount: col.amount_paise as Paise, kists, outstandingPenalty: totalPenaltyAssessed as Paise });
          let pPrin = 0, pMkp = 0, pPen = 0;
          for (const a of res.allocations) {
            pPrin += a.allocatedToPrincipal;
            pMkp += a.allocatedToMarkup;
            pPen += a.allocatedToPenalty;
          }
          if (col.id === replacementTxId) {
            await tx.runAsync(`
              UPDATE transactions SET
                allocated_principal_paise = ?,
                allocated_markup_paise = ?,
                allocated_penalty_paise = ?,
                unallocated_surplus_paise = ?
              WHERE id = ?
            `, [pPrin, pMkp, pPen, res.unallocatedFunds, replacementTxId]);
          }
          kists = res.updatedKists;
        }

        // Write final kist statuses
        for (const k of kists) {
          await tx.runAsync(`
            UPDATE repayment_schedules SET
              principal_paid_paise = ?,
              markup_paid_paise = ?,
              status = ?
            WHERE loan_id = ? AND installment_number = ?
          `, [k.principalPaid, k.markupPaid, k.status || 'PENDING', orig.loan_id, k.kistNumber]);
        }

        // Check settlement
        const allPaid = kists.every(k => k.status === 'PAID');
        const totalPrinPaid = kists.reduce((acc, k) => acc + k.principalPaid, 0);
        if (totalPrinPaid >= loan.principal_paise && allPaid) {
          await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [orig.loan_id]);
        } else {
          await tx.runAsync(`UPDATE loans SET status = 'ACTIVE' WHERE id = ?`, [orig.loan_id]);
        }
      } else {
        // Bullet with ANNUAL_SIMPLE_FLAT
        const activeCollections = await tx.getAllAsync<any>(`
          SELECT * FROM transactions
          WHERE loan_id = ? AND transaction_type = 'COLLECTION'
            AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)
          ORDER BY effective_date ASC, created_at ASC
        `, [orig.loan_id, orig.loan_id]);

        const terms = await tx.getAllAsync<any>(
          `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
          [orig.loan_id]
        );
        const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);

        let cumulativeMkpPaid = 0;
        let cumulativePrinPaid = 0;

        for (const col of activeCollections) {
          let unallocated = col.amount_paise;
          const unpaidInterest = Math.max(0, totalContractInterest - cumulativeMkpPaid);
          const aMkp = Math.min(unallocated, unpaidInterest);
          unallocated -= aMkp;
          cumulativeMkpPaid += aMkp;

          const unpaidPrin = Math.max(0, loan.principal_paise - cumulativePrinPaid);
          const aPrin = Math.min(unallocated, unpaidPrin);
          unallocated -= aPrin;
          cumulativePrinPaid += aPrin;

          if (col.id === replacementTxId) {
            await tx.runAsync(`
              UPDATE transactions SET
                allocated_principal_paise = ?,
                allocated_markup_paise = ?,
                allocated_penalty_paise = 0,
                unallocated_surplus_paise = ?
              WHERE id = ?
            `, [aPrin, aMkp, unallocated, replacementTxId]);
          }
        }

        if (cumulativeMkpPaid >= totalContractInterest) {
          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1 WHERE loan_id = ?`, [orig.loan_id]);
        } else {
          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 0 WHERE loan_id = ?`, [orig.loan_id]);
        }

        if (cumulativePrinPaid >= loan.principal_paise && cumulativeMkpPaid >= totalContractInterest) {
          await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [orig.loan_id]);
        } else {
          await tx.runAsync(`UPDATE loans SET status = 'ACTIVE' WHERE id = ?`, [orig.loan_id]);
        }
      }

      // 5. Enqueue outbox operation for sync
      await OutboxManager.enqueue(tx, {
        operationId: opId,
        operationType: 'correct_payment',
        payload: {
          loan_id: orig.loan_id,
          original_transaction_id: orig.id,
          corrected_amount_paise: correctedPaise,
          reason,
          effective_date: orig.effective_date,
        },
      });
    });

    SyncCoordinator.notifyMutation();
    return { reversalTransactionId: reversalTxId, replacementTransactionId: replacementTxId };
  }

  async previewPenalties(loanId: string, currentDate: string): Promise<number> {
    const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    if (loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
      const maturityDate = loan.maturity_date;
      if (!maturityDate || maturityDate >= currentDate) return 0;

      const terms = await this.db.getAllAsync<any>(
        `SELECT * FROM loan_terms WHERE loan_id = ?`, [loanId]
      );
      const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
      const paidRes = await this.db.getFirstAsync<any>(
        `SELECT SUM(allocated_principal_paise) as prin, SUM(allocated_markup_paise) as mkp FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
        [loanId]
      );
      const remainingTotal = (loan.principal_paise - (paidRes?.prin || 0)) + (totalContractInterest - (paidRes?.mkp || 0));
      if (remainingTotal <= 0) return 0;

      const matDateObj = new Date(maturityDate + 'T00:00:00Z');
      const curDateObj = new Date(currentDate + 'T00:00:00Z');
      let curr = new Date(matDateObj.getTime() + 86400000);
      let assessed = 0;

      while (curr <= curDateObj) {
        const dateStr = curr.toISOString().split('T')[0];
        const operationId = `penalty-${loanId}-${dateStr}`;
        const existing = await this.db.getFirstAsync(
          `SELECT id FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
          [operationId, loanId, dateStr]
        );
        if (!existing) {
          assessed += toPaise(100);
        }
        curr = new Date(curr.getTime() + 86400000);
      }
      return assessed;
    }

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
        isFullyPaid: k.status === 'PAID' || (k.total_due_paise <= (k.principal_paid_paise + k.markup_paid_paise))
      })),
      assessedDates
    };

    const { newPenaltyAmount } = calculateNewPenalties(state, currentDate);
    return newPenaltyAmount;
  }

  async assessPenalties(loanId: string, currentDate: string, tx: any = this.db): Promise<number> {
    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    if (loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
      const maturityDate = loan.maturity_date;
      if (!maturityDate || maturityDate >= currentDate) return 0;

      const terms = await tx.getAllAsync(
        `SELECT * FROM loan_terms WHERE loan_id = ?`, [loanId]
      );
      const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
      const paidRes = await tx.getFirstAsync(
        `SELECT SUM(allocated_principal_paise) as prin, SUM(allocated_markup_paise) as mkp FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
        [loanId]
      );
      const remainingTotal = (loan.principal_paise - (paidRes?.prin || 0)) + (totalContractInterest - (paidRes?.mkp || 0));
      if (remainingTotal <= 0) return 0;

      const matDateObj = new Date(maturityDate + 'T00:00:00Z');
      const curDateObj = new Date(currentDate + 'T00:00:00Z');
      let curr = new Date(matDateObj.getTime() + 86400000);
      let assessed = 0;

      while (curr <= curDateObj) {
        const dateStr = curr.toISOString().split('T')[0];
        const operationId = `penalty-${loanId}-${dateStr}`;
        const existing = await tx.getFirstAsync(
          `SELECT id FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
          [operationId, loanId, dateStr]
        );
        if (!existing) {
          assessed += toPaise(100);
          const transactionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('penalty-' + Date.now() + '-' + Math.random().toString(36).substring(2));
          await tx.runAsync(`
            INSERT INTO transactions (
              id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
              amount_paise, allocated_principal_paise, allocated_markup_paise, 
              allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            transactionId, operationId, loanId, 'PENALTY_ASSESSMENT', 0, 'SYSTEM',
            toPaise(100), 0, 0, 0, 0, dateStr, new Date().toISOString()
          ]);
        }
        curr = new Date(curr.getTime() + 86400000);
      }
      return assessed;
    }

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
        isFullyPaid: k.status === 'PAID' || (k.total_due_paise <= (k.principal_paid_paise + k.markup_paid_paise))
      })),
      assessedDates
    };

    const { newPenaltyAmount, newAssessedDates } = calculateNewPenalties(state, currentDate);

    if (newPenaltyAmount > 0) {
      for (const date of newAssessedDates) {
        const transactionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('penalty-' + Date.now() + '-' + Math.random().toString(36).substring(2));
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
