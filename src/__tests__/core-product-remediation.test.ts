// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { LoanRepository } from '../core/database/loanRepository';
import { TransactionRepository } from '../core/database/transactionRepository';
import { toPaise, formatINR, Paise } from '../core/domain/money';

function createInMemoryTestDb(): any {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
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
      created_at TEXT NOT NULL,
      collateral TEXT,
      annual_rate REAL,
      rate_basis TEXT,
      interest_paise INTEGER,
      total_paise INTEGER,
      maturity_date TEXT
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
      server_principal_paid_paise INTEGER NOT NULL DEFAULT 0,
      server_markup_paid_paise INTEGER NOT NULL DEFAULT 0,
      server_status TEXT NOT NULL DEFAULT 'PENDING',
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
      reversal_of_id TEXT,
      correction_reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE loan_terms (
      id TEXT PRIMARY KEY NOT NULL,
      loan_id TEXT NOT NULL,
      term_number INTEGER NOT NULL,
      duration_months INTEGER NOT NULL,
      annual_rate REAL NOT NULL,
      interest_paise INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      maturity_date TEXT NOT NULL,
      interest_settled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
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
    CREATE TABLE loan_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      loan_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      notes TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
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

  const dbWrapper: any = {
    sqlite,
    async execAsync(sql: string) {
      sqlite.exec(sql);
    },
    async runAsync(sql: string, params: any[] = []) {
      const bound = params.map(p => (p === undefined ? null : p));
      const stmt = sqlite.prepare(sql);
      stmt.run(...bound);
    },
    async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
      const bound = params.map(p => (p === undefined ? null : p));
      const stmt = sqlite.prepare(sql);
      return (stmt.get(...bound) as T) || null;
    },
    async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
      const bound = params.map(p => (p === undefined ? null : p));
      const stmt = sqlite.prepare(sql);
      return stmt.all(...bound) as T[];
    },
    async prepareAsync(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        async executeAsync(params: any[] = []) {
          const bound = params.map(p => (p === undefined ? null : p));
          stmt.run(...bound);
        },
        async finalizeAsync() {},
      };
    },
  };

  return dbWrapper;
}

describe('Core Product Remediation — Mobile Financial Engine & Workflows', () => {
  let db: any;
  let loanRepo: LoanRepository;
  let txRepo: TransactionRepository;

  beforeEach(async () => {
    db = createInMemoryTestDb();
    loanRepo = new LoanRepository(db);
    txRepo = new TransactionRepository(db);

    await db.runAsync(
      `INSERT INTO borrowers VALUES ('borrower-1', 'Rajesh Kumar', '9876543210', '2026-01-01')`
    );
  });

  describe('Section 4: Monthly Kist Financial Engine', () => {
    it('creates Monthly Kist: ₹50,000 at 24% p.a. for 10 months -> ₹10,000 interest, ₹60,000 repayment, 10 x ₹6,000', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(50000),
        annualRate: 24,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 10,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'instalment',
      });

      expect(loan.principal_paise).toBe(toPaise(50000));
      expect(loan.annual_rate).toBe(24);
      expect(loan.rate_basis).toBe('ANNUAL_SIMPLE_FLAT');
      expect(loan.interest_paise).toBe(toPaise(10000));
      expect(loan.total_paise).toBe(toPaise(60000));
      expect(loan.term_months).toBe(10);

      const schedule = await loanRepo.getSchedule(loan.id);
      expect(schedule.length).toBe(10);

      // Verify all installments sum exactly to ₹60,000
      let totalDue = 0;
      for (const kist of schedule as any[]) {
        expect((kist as any).total_due_paise).toBe(toPaise(6000));
        totalDue += (kist as any).total_due_paise;
      }
      expect(totalDue).toBe(toPaise(60000));
    });

    it('records multiple payments and tracks installments paid and pending', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(50000),
        annualRate: 24,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 10,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'instalment',
      });

      // Pay installment 1 (₹6,000)
      await txRepo.recordCashPayment(loan.id, toPaise(6000), 'pay-1', '2026-01-05');

      let schedule: any[] = await loanRepo.getSchedule(loan.id);
      expect(schedule[0].status).toBe('PAID');
      expect(schedule[1].status).toBe('UNPAID');

      // Pay installment 2 (₹6,000)
      await txRepo.recordCashPayment(loan.id, toPaise(6000), 'pay-2', '2026-02-05');

      schedule = await loanRepo.getSchedule(loan.id);
      expect(schedule[0].status).toBe('PAID');
      expect(schedule[1].status).toBe('PAID');
      expect(schedule[2].status).toBe('UNPAID');

      const earnings = await txRepo.getEarningsSummary({ loanId: loan.id });
      expect(earnings.principalReturned).toBe(toPaise(10000));
      expect(earnings.markupReceived).toBe(toPaise(2000));
    });
  });

  describe('Section 5: One-Time Repayment Engine', () => {
    it('creates One-Time Repayment: ₹10,000 at 30% p.a. for 3 months -> ₹750 interest, ₹10,750 at maturity, NO monthly kists', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(10000),
        annualRate: 30,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'bullet',
      });

      expect(loan.principal_paise).toBe(toPaise(10000));
      expect(loan.annual_rate).toBe(30);
      expect(loan.rate_basis).toBe('ANNUAL_SIMPLE_FLAT');
      expect(loan.interest_paise).toBe(toPaise(750));
      expect(loan.total_paise).toBe(toPaise(10750));

      // CRITICAL: NO repayment schedule generated!
      const schedule = await loanRepo.getSchedule(loan.id);
      expect(schedule.length).toBe(0);

      // Initial LoanTerm created
      const terms = await loanRepo.getLoanTerms(loan.id);
      expect(terms.length).toBe(1);
      expect(terms[0].term_number).toBe(1);
      expect(terms[0].duration_months).toBe(3);
      expect(terms[0].interest_paise).toBe(toPaise(750));
      expect(terms[0].interest_settled).toBe(0);
    });

    it('extends One-Time Repayment loan atomically: collects interest, appends term, NO monthly kists created', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(10000),
        annualRate: 30,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'bullet',
      });

      // At maturity: borrower pays ₹750 interest and lender extends loan by 6 additional months
      const { loan: extendedLoan, term: newTerm } = await loanRepo.extendBulletLoan(
        loan.id,
        6,
        toPaise(750),
        'op-ext-1'
      );

      expect(extendedLoan.term_months).toBe(9); // 3 + 6 = 9 months cumulative
      expect(extendedLoan.interest_paise).toBe(toPaise(2250)); // ₹750 + ₹1500 = ₹2,250
      expect(extendedLoan.total_paise).toBe(toPaise(12250)); // Principal ₹10,000 + ₹2,250

      const terms = await loanRepo.getLoanTerms(loan.id);
      expect(terms.length).toBe(2);
      expect(terms[0].interest_settled).toBe(1); // Term 1 interest settled
      expect(terms[1].term_number).toBe(2);
      expect(terms[1].duration_months).toBe(6);
      expect(terms[1].interest_paise).toBe(toPaise(1500));
      expect(terms[1].interest_settled).toBe(0);

      // Verify still NO monthly kists
      const schedule = await loanRepo.getSchedule(loan.id);
      expect(schedule.length).toBe(0);

      // Verify collected cash
      const earnings = await txRepo.getEarningsSummary({ loanId: loan.id });
      expect(earnings.markupReceived).toBe(toPaise(750));
      expect(earnings.principalReturned).toBe(0);
    });

    it('settles and closes One-Time Repayment loan', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(10000),
        annualRate: 30,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'bullet',
      });

      // Pay full maturity amount: ₹10,750 (₹750 interest + ₹10,000 principal)
      await txRepo.recordCashPayment(loan.id, toPaise(10750), 'pay-settle', '2026-04-05');

      const updated = await loanRepo.getById(loan.id);
      expect(updated?.status).toBe('SETTLED');

      const earnings = await txRepo.getEarningsSummary({ loanId: loan.id });
      expect(earnings.principalReturned).toBe(toPaise(10000));
      expect(earnings.markupReceived).toBe(toPaise(750));
    });
  });

  describe('Section 6: Payment Correction Workflow', () => {
    it('corrects payment from ₹25,000 to ₹2,500 with auditable reversal and replacement events', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(50000),
        annualRate: 24,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 10,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'instalment',
      });

      // Incorrect payment recorded: ₹25,000
      const payRes = await txRepo.recordCashPayment(
        loan.id,
        toPaise(25000),
        'pay-wrong',
        '2026-01-05'
      );
      const originalTxId = payRes.transactionId;

      // Correct payment: actual received is ₹2,500
      const correctionRes = await txRepo.correctPayment(
        originalTxId,
        toPaise(2500),
        'Data Entry Error',
        'op-correction-1'
      );

      expect(correctionRes.reversalTransactionId).toBeDefined();
      expect(correctionRes.replacementTransactionId).toBeDefined();

      // Check earnings summary: effective collected amount MUST be ₹2,500, NOT ₹27,500!
      const earnings = await txRepo.getEarningsSummary({ loanId: loan.id });
      const totalCashReceived = earnings.principalReturned + earnings.markupReceived;
      expect(totalCashReceived).toBe(toPaise(2500));

      // Verify audit trail in transactions
      const allTx = await db.getAllAsync(`SELECT * FROM transactions WHERE loan_id = ? ORDER BY sequence_number ASC`, [loan.id]);
      expect(allTx.length).toBe(3); // Original COLLECTION, REVERSAL, and replacement COLLECTION

      const reversalTx = allTx.find((t: any) => t.transaction_type === 'REVERSAL');
      expect(reversalTx.reversal_of_id).toBe(originalTxId);
      expect(reversalTx.correction_reason).toBe('Data Entry Error');

      const replTx = allTx.find((t: any) => t.id === correctionRes.replacementTransactionId);
      expect(replTx.amount_paise).toBe(toPaise(2500));
      expect(replTx.reversal_of_id).toBe(originalTxId);

      // Verify payment_corrections record
      const corrRecord = await db.getFirstAsync(
        `SELECT * FROM payment_corrections WHERE original_transaction_id = ?`,
        [originalTxId]
      );
      expect(corrRecord.previous_amount_paise).toBe(toPaise(25000));
      expect(corrRecord.corrected_amount_paise).toBe(toPaise(2500));
      expect(corrRecord.reason).toBe('Data Entry Error');

      // Outbox has correct_payment operation
      const outbox = await db.getFirstAsync(
        `SELECT * FROM sync_outbox WHERE operation_type = 'correct_payment'`
      );
      expect(outbox).not.toBeNull();
      const payload = JSON.parse(outbox.payload);
      expect(payload.corrected_amount_paise).toBe(toPaise(2500));
    });

    it('reopens previously settled loan if payment correction reduces amount below full settlement', async () => {
      const loan = await loanRepo.createLoanWithSchedule('borrower-1', {
        principal: toPaise(10000),
        annualRate: 30,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 5,
        productType: 'bullet',
      });

      // Pay full maturity amount ₹10,750 settling loan
      const payRes = await txRepo.recordCashPayment(
        loan.id,
        toPaise(10750),
        'pay-full',
        '2026-04-05'
      );

      let currentLoan = await loanRepo.getById(loan.id);
      expect(currentLoan?.status).toBe('SETTLED');

      // Correct payment to ₹1,000 (meaning borrower actually only paid ₹1,000)
      await txRepo.correctPayment(
        payRes.transactionId,
        toPaise(1000),
        'Cheque partial clearance',
        'op-corr-reopen'
      );

      // Loan MUST reopen to ACTIVE state!
      currentLoan = await loanRepo.getById(loan.id);
      expect(currentLoan?.status).toBe('ACTIVE');

      const earnings = await txRepo.getEarningsSummary({ loanId: loan.id });
      expect(earnings.markupReceived).toBe(toPaise(750));
      expect(earnings.principalReturned).toBe(toPaise(250));
    });
  });
});
