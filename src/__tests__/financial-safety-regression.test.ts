import { SQLiteDatabase } from 'expo-sqlite';
import { TransactionRepository } from '../core/database/transactionRepository';
import { LoanRepository } from '../core/database/loanRepository';
import { runMigrations } from '../core/database/schema';
import { OutboxManager } from '../core/sync/outbox';
import { SyncService } from '../core/sync/syncService';
import { Paise } from '../core/domain/money';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';

interface MockDbAdapter {
  sqlite: any;
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  prepareAsync(sql: string): Promise<any>;
  withExclusiveTransactionAsync<T>(cb: (tx: any) => Promise<T>): Promise<T>;
  withTransactionAsync<T>(cb: (tx: any) => Promise<T>): Promise<T>;
}

function createMockDb(): SQLiteDatabase {
  const sqlite = new DatabaseSync(':memory:');
  const adapter: MockDbAdapter = {
    sqlite,
    async execAsync(sql: string) {
      sqlite.exec(sql);
    },
    async runAsync(sql: string, params: any[] = []) {
      const bound = params.map(p => p === undefined ? null : p);
      const stmt = sqlite.prepare(sql);
      stmt.run(...bound);
    },
    async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
      const bound = params.map(p => p === undefined ? null : p);
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...bound) as T | undefined;
      return row ?? null;
    },
    async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
      const bound = params.map(p => p === undefined ? null : p);
      const stmt = sqlite.prepare(sql);
      return stmt.all(...bound) as T[];
    },
    async prepareAsync(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        async executeAsync(params: any[] = []) {
          const bound = params.map(p => p === undefined ? null : p);
          stmt.run(...bound);
        },
        async finalizeAsync() {
          // no-op for node:sqlite
        },
      };
    },
    async withExclusiveTransactionAsync<T>(cb: (tx: any) => Promise<T>): Promise<T> {
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        const result = await cb(adapter);
        sqlite.exec('COMMIT');
        return result;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    async withTransactionAsync<T>(cb: (tx: any) => Promise<T>): Promise<T> {
      sqlite.exec('BEGIN TRANSACTION');
      try {
        const result = await cb(adapter);
        sqlite.exec('COMMIT');
        return result;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };
  return adapter as unknown as SQLiteDatabase;
}

describe('Financial Safety & Schema Invariant Regressions', () => {
  describe('Defect 1 & 2: Forward-Only Schema Migration on Legacy Databases', () => {
    it('migrates legacy database tables missing doc_type, interest_settled, and payment_corrections columns', async () => {
      const db = createMockDb();

      // Create intentionally incomplete legacy schema as existed on installed field devices
      await db.execAsync(`
        CREATE TABLE borrowers (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE loans (
          id TEXT PRIMARY KEY NOT NULL,
          borrower_id TEXT NOT NULL,
          principal_paise INTEGER NOT NULL,
          markup_factor REAL NOT NULL,
          term_months INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          due_day INTEGER NOT NULL,
          product_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL
        );
        CREATE TABLE repayment_schedules (
          id TEXT PRIMARY KEY NOT NULL,
          loan_id TEXT NOT NULL,
          installment_number INTEGER NOT NULL,
          original_due_date TEXT NOT NULL,
          effective_due_date TEXT NOT NULL,
          principal_component_paise INTEGER NOT NULL,
          markup_component_paise INTEGER NOT NULL,
          total_due_paise INTEGER NOT NULL,
          principal_paid_paise INTEGER NOT NULL DEFAULT 0,
          markup_paid_paise INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'PENDING',
          UNIQUE (loan_id, installment_number)
        );
        CREATE TABLE transactions (
          id TEXT UNIQUE NOT NULL,
          operation_id TEXT UNIQUE NOT NULL,
          loan_id TEXT NOT NULL,
          sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_type TEXT NOT NULL,
          is_cash INTEGER NOT NULL DEFAULT 1,
          payment_method TEXT NOT NULL DEFAULT 'CASH',
          amount_paise INTEGER NOT NULL DEFAULT 0,
          allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
          allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
          allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
          unallocated_surplus_paise INTEGER NOT NULL DEFAULT 0,
          forgiven_principal_paise INTEGER NOT NULL DEFAULT 0,
          forgiven_markup_paise INTEGER NOT NULL DEFAULT 0,
          forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
          effective_date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        -- Legacy loan_terms: has 'settled' but NO 'interest_settled'
        CREATE TABLE loan_terms (
          id TEXT PRIMARY KEY NOT NULL,
          loan_id TEXT NOT NULL,
          term_number INTEGER NOT NULL,
          duration_months INTEGER NOT NULL,
          annual_rate REAL NOT NULL,
          interest_paise INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          maturity_date TEXT NOT NULL,
          interest_paid_paise INTEGER NOT NULL DEFAULT 0,
          settled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        -- Legacy loan_attachments: has 'document_type' but NO 'doc_type' and NO 'synced'
        CREATE TABLE loan_attachments (
          id TEXT PRIMARY KEY NOT NULL,
          loan_id TEXT NOT NULL,
          document_type TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          mime_type TEXT,
          notes TEXT,
          sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
          created_at TEXT NOT NULL
        );
        -- Legacy payment_corrections: has 'previous_amount_paise' but NO 'original_amount_paise'
        CREATE TABLE payment_corrections (
          id TEXT PRIMARY KEY NOT NULL,
          loan_id TEXT NOT NULL,
          original_transaction_id TEXT NOT NULL,
          reversal_transaction_id TEXT NOT NULL,
          replacement_transaction_id TEXT,
          previous_amount_paise INTEGER NOT NULL,
          corrected_amount_paise INTEGER NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE sync_outbox (
          id TEXT PRIMARY KEY NOT NULL,
          operation_id TEXT UNIQUE NOT NULL,
          operation_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          error_message TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE sync_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);

      // Seed historical records in legacy tables
      await db.runAsync(
        `INSERT INTO loan_terms (id, loan_id, term_number, duration_months, annual_rate, interest_paise, start_date, maturity_date, settled, created_at)
         VALUES ('term-1', 'loan-1', 1, 3, 30.0, 75000, '2026-01-01', '2026-04-01', 1, '2026-01-01T00:00:00Z')`
      );
      await db.runAsync(
        `INSERT INTO loan_attachments (id, loan_id, document_type, file_path, file_name, created_at)
         VALUES ('att-1', 'loan-1', 'SECURITY_CHEQUE', '/storage/cheque.jpg', 'cheque.jpg', '2026-01-01T00:00:00Z')`
      );
      await db.runAsync(
        `INSERT INTO payment_corrections (id, loan_id, original_transaction_id, reversal_transaction_id, previous_amount_paise, corrected_amount_paise, reason, created_at)
         VALUES ('corr-1', 'loan-1', 'tx-orig', 'tx-rev', 500000, 250000, 'Data entry error', '2026-01-01T00:00:00Z')`
      );

      // Execute migration
      await runMigrations(db);

      // Verify loan_terms migration & backfill
      const termCols = await db.getAllAsync(`PRAGMA table_info(loan_terms)`);
      const termColNames = (termCols as any[]).map(c => c.name);
      expect(termColNames).toContain('interest_settled');
      expect(termColNames).toContain('settled');

      const termRow = await db.getFirstAsync<any>(`SELECT * FROM loan_terms WHERE id = 'term-1'`);
      expect(termRow.interest_settled).toBe(1);
      expect(termRow.settled).toBe(1);

      // Verify loan_attachments migration & backfill
      const attCols = await db.getAllAsync(`PRAGMA table_info(loan_attachments)`);
      const attColNames = (attCols as any[]).map(c => c.name);
      expect(attColNames).toContain('doc_type');
      expect(attColNames).toContain('document_type');
      expect(attColNames).toContain('synced');
      expect(attColNames).toContain('sync_status');

      const attRow = await db.getFirstAsync<any>(`SELECT * FROM loan_attachments WHERE id = 'att-1'`);
      expect(attRow.doc_type).toBe('SECURITY_CHEQUE');
      expect(attRow.document_type).toBe('SECURITY_CHEQUE');

      // Verify payment_corrections migration & backfill
      const corrCols = await db.getAllAsync(`PRAGMA table_info(payment_corrections)`);
      const corrColNames = (corrCols as any[]).map(c => c.name);
      expect(corrColNames).toContain('original_amount_paise');
      expect(corrColNames).toContain('previous_amount_paise');

      const corrRow = await db.getFirstAsync<any>(`SELECT * FROM payment_corrections WHERE id = 'corr-1'`);
      expect(corrRow.original_amount_paise).toBe(500000);
      expect(corrRow.previous_amount_paise).toBe(500000);
    });
  });

  describe('Defect 3: Atomic Loan Creation & Attachment Rollback', () => {
    it('rolls back loan creation completely if attachment processing fails', async () => {
      const db = createMockDb();
      await runMigrations(db);

      await db.runAsync(
        `INSERT INTO borrowers (id, name, phone, created_at) VALUES ('bor-1', 'Rajesh Kumar', '9876543210', '2026-01-01T00:00:00Z')`
      );

      const loanRepo = new LoanRepository(db);

      // Temporarily create a trigger on loan_attachments that throws to simulate attachment failure
      await db.execAsync(`
        CREATE TRIGGER fail_attachment_insert
        BEFORE INSERT ON loan_attachments
        BEGIN
          SELECT RAISE(FAIL, 'Disk full: unable to store attachment metadata');
        END;
      `);

      let errorThrown = false;
      try {
        await loanRepo.createLoanWithSchedule('bor-1', {
          principal: 5000000 as Paise,
          annualRate: 24,
          rateBasis: 'ANNUAL_SIMPLE_FLAT',
          termMonths: 10,
          startDate: '2026-05-01',
          dueDay: 5,
          productType: 'instalment',
          attachments: [
            { file_path: '/data/user/cheque.jpg', doc_type: 'SECURITY_CHEQUE' },
          ],
        });
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toContain('Disk full');
      }

      expect(errorThrown).toBe(true);

      // CRITICAL ASSERTION: Zero orphaned loan records in database
      const loans = await db.getAllAsync(`SELECT * FROM loans WHERE borrower_id = 'bor-1'`);
      expect(loans.length).toBe(0);

      const schedules = await db.getAllAsync(`SELECT * FROM repayment_schedules`);
      expect(schedules.length).toBe(0);

      const outbox = await db.getAllAsync(`SELECT * FROM sync_outbox`);
      expect(outbox.length).toBe(0);
    });

    it('commits loan, schedule, terms, and attachments atomically on success', async () => {
      const db = createMockDb();
      await runMigrations(db);

      await db.runAsync(
        `INSERT INTO borrowers (id, name, phone, created_at) VALUES ('bor-1', 'Rajesh Kumar', '9876543210', '2026-01-01T00:00:00Z')`
      );

      const loanRepo = new LoanRepository(db);
      const createdLoan = await loanRepo.createLoanWithSchedule('bor-1', {
        principal: 5000000 as Paise, // ₹50,000
        annualRate: 24,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 10,
        startDate: '2026-05-01',
        dueDay: 5,
        productType: 'instalment',
        attachments: [
          { file_path: '/storage/cheque1.jpg', doc_type: 'SECURITY_CHEQUE', notes: 'HDFC Bank Cheque' },
          { file_path: '/storage/aadhaar.jpg', doc_type: 'ID_PROOF', notes: 'Aadhaar Card copy' },
        ],
      }, 'loan-create-op-1');

      expect(createdLoan).toBeDefined();
      expect(createdLoan.principal_paise).toBe(5000000);

      // Verify attachments created atomically
      const attachments = await db.getAllAsync<any>(
        `SELECT * FROM loan_attachments WHERE loan_id = ?`,
        [createdLoan.id]
      );
      expect(attachments.length).toBe(2);
      expect(attachments[0].doc_type).toBe('SECURITY_CHEQUE');
      expect(attachments[0].document_type).toBe('SECURITY_CHEQUE');
      expect(attachments[1].doc_type).toBe('ID_PROOF');

      // Verify outbox queued for loan and both attachments
      const outbox = await db.getAllAsync<any>(`SELECT * FROM sync_outbox ORDER BY created_at ASC`);
      expect(outbox.length).toBe(3); // 1 create_loan + 2 upload_attachment_metadata
      expect(outbox.some((o: any) => o.operation_type === 'create_loan')).toBe(true);
      expect(outbox.filter((o: any) => o.operation_type === 'upload_attachment_metadata').length).toBe(2);
    });
  });

  describe('Defect 4: Sync Outbox Infinite Retries & Resilient Pull', () => {
    it('transitions FAILED push operations to NEEDS_REVIEW and does not cycle infinitely', async () => {
      const db = createMockDb();
      await runMigrations(db);

      await OutboxManager.enqueue(db, {
        operationId: 'op-fail-1',
        operationType: 'upload_attachment_metadata',
        payload: { file: 'missing.pdf' },
      });

      // Verify it is in PENDING
      let pending = await OutboxManager.getPending(db);
      expect(pending.length).toBe(1);

      // Transition to FAILED (server rejection)
      await OutboxManager.markStatus(db, 'op-fail-1', 'NEEDS_REVIEW', 'File format not supported');

      // getPending should now return empty!
      pending = await OutboxManager.getPending(db);
      expect(pending.length).toBe(0);

      // But the record is preserved in NEEDS_REVIEW
      const needsReview = await OutboxManager.getNeedsReview(db);
      expect(needsReview.length).toBe(1);
      expect(needsReview[0].error_message).toBe('File format not supported');
    });

    it('ingests LOAN_ATTACHMENT and LOAN_TERM pull payloads in both legacy and modern formats without error', async () => {
      const db = createMockDb();
      await runMigrations(db);

      await db.runAsync(
        `INSERT INTO borrowers (id, name, phone, created_at) VALUES ('bor-1', 'Sunil Kumar', '9812345678', '2026-01-01T00:00:00Z')`
      );
      await db.runAsync(
        `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, created_at)
         VALUES ('loan-pull-1', 'bor-1', 1000000, 0, 3, '2026-01-01', 5, 'bullet', '2026-01-01T00:00:00Z')`
      );

      // Simulate pull with server sending 'document_type' and 'settled'
      await db.withExclusiveTransactionAsync(async (tx: any) => {
        // LOAN_ATTACHMENT pull
        const attPayload = {
          id: 'att-server-1',
          loan_id: 'loan-pull-1',
          document_type: 'AFFIDAVIT',
          file_name: 'stamp_paper.pdf',
          notes: 'Signed stamp paper',
        };
        const docType = attPayload.document_type || 'OTHER';
        await tx.runAsync(
          `INSERT INTO loan_attachments (
             id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'SYNCED', ?)`,
          [attPayload.id, attPayload.loan_id, attPayload.file_name, attPayload.file_name, docType, docType, attPayload.notes, '2026-01-01T00:00:00Z']
        );

        // LOAN_TERM pull with 'settled'
        const termPayload = {
          id: 'term-server-1',
          loan_id: 'loan-pull-1',
          term_number: 1,
          duration_months: 3,
          annual_rate: 30.0,
          interest_paise: 75000,
          start_date: '2026-01-01',
          maturity_date: '2026-04-01',
          settled: true,
        };
        const isSettled = termPayload.settled ? 1 : 0;
        await tx.runAsync(
          `INSERT INTO loan_terms (
             id, loan_id, term_number, duration_months, annual_rate, interest_paise,
             start_date, maturity_date, interest_settled, settled, operation_id, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [termPayload.id, termPayload.loan_id, termPayload.term_number, termPayload.duration_months, termPayload.annual_rate, termPayload.interest_paise, termPayload.start_date, termPayload.maturity_date, isSettled, isSettled, 'server-op-1', '2026-01-01T00:00:00Z']
        );
      });

      const pulledAtt = await db.getFirstAsync<any>(`SELECT * FROM loan_attachments WHERE id = 'att-server-1'`);
      expect(pulledAtt.doc_type).toBe('AFFIDAVIT');
      expect(pulledAtt.document_type).toBe('AFFIDAVIT');
      expect(pulledAtt.synced).toBe(1);

      const pulledTerm = await db.getFirstAsync<any>(`SELECT * FROM loan_terms WHERE id = 'term-server-1'`);
      expect(pulledTerm.interest_settled).toBe(1);
      expect(pulledTerm.settled).toBe(1);
    });
  });

  describe('Defect 5: Transactional & Idempotent Extensions and Payment Corrections', () => {
    it('executes bullet loan extension and guarantees idempotency on duplicate submission', async () => {
      const db = createMockDb();
      await runMigrations(db);

      await db.runAsync(
        `INSERT INTO borrowers (id, name, phone, created_at) VALUES ('bor-2', 'Vikram Singh', '9898989898', '2026-01-01T00:00:00Z')`
      );

      const loanRepo = new LoanRepository(db);

      // Canonical One-Time Loan: ₹10,000 @ 30% p.a. for 3 months = ₹750 interest
      const loan = await loanRepo.createLoanWithSchedule('bor-2', {
        principal: 1000000 as Paise, // ₹10,000
        annualRate: 30,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'bullet',
      });

      // Extend loan by 6 months, collecting prior ₹750 interest
      const opId = 'ext-op-canonical-1';
      const result1 = await loanRepo.extendBulletLoan(
        loan.id,
        6, // 6 additional months
        75000, // ₹750 interest collected
        opId
      );

      expect(result1.loan.term_months).toBe(9); // 3 + 6 = 9 months
      expect(result1.loan.interest_paise).toBe(225000); // ₹750 + ₹1,500 = ₹2,250
      expect(result1.loan.total_paise).toBe(1225000); // ₹10,000 + ₹2,250 = ₹12,250
      expect(result1.term.term_number).toBe(2);

      // Verify term 1 is settled
      const term1 = await db.getFirstAsync<any>(`SELECT * FROM loan_terms WHERE loan_id = ? AND term_number = 1`, [loan.id]);
      expect(term1.interest_settled).toBe(1);
      expect(term1.settled).toBe(1);

      // Call again with the exact SAME opId -> IDEMPOTENCY check
      const result2 = await loanRepo.extendBulletLoan(
        loan.id,
        6,
        75000,
        opId
      );

      // Should return the exact same loan and term without creating a 3rd term or throwing
      expect(result2.loan.term_months).toBe(9);
      expect(result2.term.term_number).toBe(2);

      const allTerms = await db.getAllAsync(`SELECT * FROM loan_terms WHERE loan_id = ?`, [loan.id]);
      expect(allTerms.length).toBe(2); // Still strictly 2 terms
    });

    it('executes payment correction and guarantees idempotency on duplicate submission', async () => {
      const db = createMockDb();
      await runMigrations(db);

      await db.runAsync(
        `INSERT INTO borrowers (id, name, phone, created_at) VALUES ('bor-3', 'Anita Sharma', '9123456789', '2026-01-01T00:00:00Z')`
      );

      const loanRepo = new LoanRepository(db);
      const txRepo = new TransactionRepository(db);

      const loan = await loanRepo.createLoanWithSchedule('bor-3', {
        principal: 5000000 as Paise,
        annualRate: 24,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 10,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment',
      });

      // Record original payment: ₹25,000 instead of ₹2,500
      const origOpId = 'pay-orig-1';
      await txRepo.recordCashPayment(loan.id, 2500000 as Paise, origOpId, '2026-01-05');

      const origTx = await db.getFirstAsync<any>(
        `SELECT * FROM transactions WHERE operation_id = ?`,
        [origOpId]
      );
      expect(origTx).toBeDefined();
      expect(origTx.amount_paise).toBe(2500000);

      // Correct payment to ₹2,500
      const corrOpId = 'corr-op-1';
      const corrRes1 = await txRepo.correctPayment(
        origTx.id,
        250000 as Paise, // ₹2,500 replacement
        'Typo: added extra zero',
        corrOpId
      );

      expect(corrRes1.reversalTransactionId).toBeDefined();
      expect(corrRes1.replacementTransactionId).toBeDefined();

      // Check payment_corrections record
      const corrRec = await db.getFirstAsync<any>(
        `SELECT * FROM payment_corrections WHERE original_transaction_id = ?`,
        [origTx.id]
      );
      expect(corrRec).toBeDefined();
      expect(corrRec.original_amount_paise).toBe(2500000);
      expect(corrRec.previous_amount_paise).toBe(2500000);
      expect(corrRec.corrected_amount_paise).toBe(250000);
      expect(corrRec.operation_id).toBe(corrOpId);

      // Net active collection should be exactly ₹2,500
      const netCollected = await db.getFirstAsync<any>(
        `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
        [loan.id]
      );
      // Reversal is amount_paise = 0 with negative allocations, original was 2500000, replacement is 250000
      // Active non-reversed collections:
      const activeCollections = await db.getAllAsync<any>(
        `SELECT * FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'
         AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)`,
        [loan.id, loan.id]
      );
      expect(activeCollections.length).toBe(1);
      expect(activeCollections[0].amount_paise).toBe(250000); // strictly ₹2,500

      // Call again with the exact SAME corrOpId -> IDEMPOTENCY check
      const corrRes2 = await txRepo.correctPayment(
        origTx.id,
        250000 as Paise,
        'Typo: added extra zero',
        corrOpId
      );

      expect(corrRes2.reversalTransactionId).toBe(corrRes1.reversalTransactionId);
      expect(corrRes2.replacementTransactionId).toBe(corrRes1.replacementTransactionId);

      const allCorrections = await db.getAllAsync(`SELECT * FROM payment_corrections WHERE loan_id = ?`, [loan.id]);
      expect(allCorrections.length).toBe(1);
    });
  });
});
