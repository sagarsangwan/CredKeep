import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ScheduleOptions, generateSchedule, calculateNextDueDate, calculateContractInterest, calculateMaturityDate } from '../domain/schedule';
import { multiplyPaise, Paise } from '../domain/money';
import { OutboxManager } from '../sync/outbox';
import { SyncCoordinator } from '../sync/syncCoordinator';
import { withDbTransaction } from './transaction';

export type Loan = {
  id: string;
  borrower_id: string;
  principal_paise: number;
  markup_factor: number;
  annual_rate?: number | null;
  rate_basis?: 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM' | null;
  interest_paise?: number | null;
  total_paise?: number | null;
  maturity_date?: string | null;
  term_months: number;
  start_date: string;
  due_day: number;
  product_type: string;
  status: string;
  collateral?: string | null;
  created_at: string;
};

export type LoanTerm = {
  id: string;
  loan_id: string;
  term_number: number;
  duration_months: number;
  annual_rate: number;
  interest_paise: number;
  start_date: string;
  maturity_date: string;
  interest_settled: number;
  settled?: number;
  operation_id?: string | null;
  created_at: string;
};

export type LoanAttachmentInput = {
  uri?: string;
  file_path?: string;
  doc_type: string;
  notes?: string;
};

export interface CreateLoanOptions extends ScheduleOptions {
  attachments?: LoanAttachmentInput[];
}

export type LoanAttachment = {
  id: string;
  loan_id: string;
  file_path: string;
  file_name?: string;
  doc_type: string;
  document_type?: string;
  notes?: string | null;
  synced: number;
  sync_status?: string;
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
    options: CreateLoanOptions,
    clientOpId?: string
  ): Promise<Loan> {
    let resolvedLoan: Loan | null = null;
    const loanId = generateUuid();
    const created_at = new Date().toISOString();
    
    const annualRate = options.annualRate ?? (options.markupFactor ? Math.round(options.markupFactor * 100 * 12 / (options.termMonths || 1)) : 0);
    const rateBasis = options.rateBasis || (options.annualRate !== undefined ? 'ANNUAL_SIMPLE_FLAT' : 'LEGACY_FIXED_TERM');
    const interestPaise = (rateBasis === 'ANNUAL_SIMPLE_FLAT' || options.annualRate !== undefined)
      ? calculateContractInterest(options.principal, annualRate, options.termMonths)
      : multiplyPaise(options.principal as Paise, options.markupFactor || 0);
    const totalPaise = options.principal + interestPaise;
    const maturityDate = calculateMaturityDate(options.startDate, options.termMonths, options.dueDay);

    const schedule = generateSchedule({
      ...options,
      annualRate,
      rateBasis,
    });

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

      await txHandle.runAsync(
        `INSERT INTO loans (
          id, borrower_id, principal_paise, markup_factor, annual_rate, rate_basis,
          interest_paise, total_paise, maturity_date, term_months, start_date, due_day,
          product_type, collateral, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          loanId,
          borrowerId,
          options.principal,
          options.markupFactor || 0,
          annualRate,
          rateBasis,
          interestPaise,
          totalPaise,
          maturityDate,
          options.termMonths,
          options.startDate,
          options.dueDay,
          options.productType,
          options.collateral || null,
          created_at,
        ]
      );

      // If bullet with ANNUAL_SIMPLE_FLAT, insert term 1 into loan_terms
      if (options.productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
        await txHandle.runAsync(
          `INSERT INTO loan_terms (
            id, loan_id, term_number, duration_months, annual_rate, interest_paise,
            start_date, maturity_date, interest_settled, settled, operation_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateUuid(),
            loanId,
            1,
            options.termMonths,
            annualRate,
            interestPaise,
            options.startDate,
            maturityDate,
            0,
            0,
            clientOpId || null,
            created_at,
          ]
        );
      }
      
      if (schedule.length > 0) {
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
      }

      await OutboxManager.enqueue(txHandle, {
        operationId: clientOpId,
        operationType: 'create_loan',
        payload: {
          id: loanId,
          borrower_id: borrowerId,
          principal_paise: options.principal,
          markup_factor: options.markupFactor || 0,
          annual_rate: annualRate,
          rate_basis: rateBasis,
          interest_paise: interestPaise,
          total_paise: totalPaise,
          maturity_date: maturityDate,
          term_months: options.termMonths,
          start_date: options.startDate,
          due_day: options.dueDay,
          product_type: options.productType,
          collateral: options.collateral || null,
        },
      });

      if (options.attachments && options.attachments.length > 0) {
        for (const att of options.attachments) {
          const attPath = att.file_path || att.uri || '';
          const fileName = attPath.split('/').pop()?.split('\\').pop() || 'attachment';
          const attId = generateUuid();
          const attOpId = generateUuid();
          await txHandle.runAsync(
            `INSERT INTO loan_attachments (
              id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'LOCAL_ONLY', ?)`,
            [
              attId,
              loanId,
              attPath,
              fileName,
              att.doc_type,
              att.doc_type,
              att.notes || null,
              created_at,
            ]
          );

          await OutboxManager.enqueue(txHandle, {
            operationId: attOpId,
            operationType: 'upload_attachment_metadata',
            payload: {
              id: attId,
              loan_id: loanId,
              file_path: attPath,
              file_name: fileName,
              doc_type: att.doc_type,
              document_type: att.doc_type,
              notes: att.notes || null,
            },
          });
        }
      }
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
    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE' || loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') return;

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
        while (nextDueDate <= currentDate || nextInstalmentNumber === lastKist.installment_number + 1) {
          const kistId = generateUuid();
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

  async getLoanTerms(loanId: string): Promise<LoanTerm[]> {
    return await this.db.getAllAsync<LoanTerm>(
      `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
      [loanId]
    );
  }

  async extendBulletLoan(
    loanId: string,
    additionalMonths: number,
    interestCollectedPaise: number,
    clientOpId?: string
  ): Promise<{ loan: Loan; term: LoanTerm }> {
    const opId = clientOpId || generateUuid();

    // Idempotency pre-check
    if (clientOpId) {
      const existingOutbox = await this.db.getFirstAsync<any>(
        `SELECT * FROM sync_outbox WHERE operation_id = ?`,
        [clientOpId]
      );
      if (existingOutbox) {
        const existingLoan = await this.getById(loanId);
        const existingTerm = await this.db.getFirstAsync<LoanTerm>(
          `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number DESC LIMIT 1`,
          [loanId]
        );
        if (existingLoan && existingTerm) {
          return { loan: existingLoan, term: existingTerm };
        }
      }
    }

    let updatedLoan: Loan | null = null;
    let createdTerm: LoanTerm | null = null;

    await withDbTransaction(this.db, async (tx) => {
      const txHandle = tx || this.db;
      const loan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
      if (!loan) throw new Error('Loan not found');
      if (loan.product_type !== 'bullet') throw new Error('Only One-Time Repayment (bullet) loans can be extended');
      if (loan.status !== 'ACTIVE') throw new Error('Only active loans can be extended');

      const terms = await txHandle.getAllAsync<LoanTerm>(
        `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
        [loanId]
      );

      const lastTerm = terms.length > 0 ? terms[terms.length - 1] : null;
      if (lastTerm && !lastTerm.interest_settled && !lastTerm.settled) {
        if (interestCollectedPaise < lastTerm.interest_paise) {
          throw new Error(
            `Prior term's contractual interest must be fully settled before extending the loan. Required: ${lastTerm.interest_paise} paise, collected: ${interestCollectedPaise} paise.`
          );
        }
      }
      const termNumber = (lastTerm ? lastTerm.term_number : 0) + 1;
      const startDate = lastTerm ? lastTerm.maturity_date : (loan.maturity_date || loan.start_date);
      const maturityDate = calculateMaturityDate(startDate, additionalMonths, loan.due_day);
      const annualRate = loan.annual_rate || 0;
      const termInterest = calculateContractInterest(loan.principal_paise as Paise, annualRate, additionalMonths);

      const termId = generateUuid();
      const createdAt = new Date().toISOString();
      const todayStr = createdAt.split('T')[0];

      // Record interest collected now if any
      if (interestCollectedPaise > 0) {
        const txId = generateUuid();
        await txHandle.runAsync(
          `INSERT INTO transactions (
            id, operation_id, loan_id, transaction_type, is_cash, payment_method,
            amount_paise, allocated_principal_paise, allocated_markup_paise,
            allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            txId,
            `interest-collection-${opId}`,
            loanId,
            'COLLECTION',
            1,
            'CASH',
            interestCollectedPaise,
            0,
            interestCollectedPaise,
            0,
            0,
            todayStr,
            createdAt,
          ]
        );

        if (lastTerm) {
          await txHandle.runAsync(
            `UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE id = ?`,
            [lastTerm.id]
          );
        }
      }

      await txHandle.runAsync(
        `INSERT INTO loan_terms (
          id, loan_id, term_number, duration_months, annual_rate, interest_paise,
          start_date, maturity_date, interest_settled, settled, operation_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          termId,
          loanId,
          termNumber,
          additionalMonths,
          annualRate,
          termInterest,
          startDate,
          maturityDate,
          0,
          0,
          opId,
          createdAt,
        ]
      );

      const newCumulativeDuration = loan.term_months + additionalMonths;
      const newCumulativeInterest = (loan.interest_paise || 0) + termInterest;
      const newTotalPaise = loan.principal_paise + newCumulativeInterest;

      await txHandle.runAsync(
        `UPDATE loans SET
          term_months = ?,
          interest_paise = ?,
          total_paise = ?,
          maturity_date = ?
         WHERE id = ?`,
        [newCumulativeDuration, newCumulativeInterest, newTotalPaise, maturityDate, loanId]
      );

      await OutboxManager.enqueue(txHandle, {
        operationId: opId,
        operationType: 'extend_loan',
        payload: {
          loan_id: loanId,
          additional_months: additionalMonths,
          interest_collected_paise: interestCollectedPaise,
          effective_date: todayStr,
        },
      });

      updatedLoan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
      createdTerm = await txHandle.getFirstAsync<LoanTerm>(`SELECT * FROM loan_terms WHERE id = ?`, [termId]);
    });

    SyncCoordinator.notifyMutation();
    return { loan: updatedLoan!, term: createdTerm! };
  }

  async closeLoan(loanId: string, clientOpId?: string): Promise<Loan> {
    const opId = clientOpId || generateUuid();
    let updatedLoan: Loan | null = null;

    await withDbTransaction(this.db, async (tx) => {
      const txHandle = tx || this.db;
      const loan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
      if (!loan) throw new Error('Loan not found');
      if (loan.status === 'SETTLED' || loan.status === 'CLOSED') {
        updatedLoan = loan;
        return;
      }

      await txHandle.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);

      await OutboxManager.enqueue(txHandle, {
        operationId: opId,
        operationType: 'close_loan',
        payload: {
          loan_id: loanId,
        },
      });

      updatedLoan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    });

    SyncCoordinator.notifyMutation();
    return updatedLoan!;
  }

  async getAttachments(loanId: string): Promise<LoanAttachment[]> {
    return await this.db.getAllAsync<LoanAttachment>(
      `SELECT * FROM loan_attachments WHERE loan_id = ? ORDER BY created_at DESC`,
      [loanId]
    );
  }

  async addAttachment(
    attachment: { loan_id: string; file_path: string; doc_type: string; notes?: string },
    clientOpId?: string
  ): Promise<LoanAttachment> {
    const opId = clientOpId || generateUuid();
    const id = generateUuid();
    const createdAt = new Date().toISOString();
    const fileName = attachment.file_path ? attachment.file_path.split('/').pop()?.split('\\').pop() || 'attachment' : 'attachment';

    await withDbTransaction(this.db, async (tx) => {
      const txHandle = tx || this.db;
      await txHandle.runAsync(
        `INSERT INTO loan_attachments (
          id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'LOCAL_ONLY', ?)`,
        [
          id,
          attachment.loan_id,
          attachment.file_path,
          fileName,
          attachment.doc_type,
          attachment.doc_type,
          attachment.notes || null,
          createdAt,
        ]
      );

      await OutboxManager.enqueue(txHandle, {
        operationId: opId,
        operationType: 'upload_attachment_metadata',
        payload: {
          id,
          loan_id: attachment.loan_id,
          file_path: attachment.file_path,
          file_name: fileName,
          doc_type: attachment.doc_type,
          document_type: attachment.doc_type,
          notes: attachment.notes || null,
        },
      });
    });

    SyncCoordinator.notifyMutation();
    return (await this.db.getFirstAsync<LoanAttachment>(`SELECT * FROM loan_attachments WHERE id = ?`, [id]))!;
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM loan_attachments WHERE id = ?`, [attachmentId]);
    SyncCoordinator.notifyMutation();
  }
}
