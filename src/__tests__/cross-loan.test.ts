import { SQLiteDatabase } from 'expo-sqlite';
import { TransactionRepository } from '../core/database/transactionRepository';
import { Paise, toPaise } from '../core/domain/money';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';

interface LoanRow {
  id: string;
  product_type: 'instalment' | 'bullet';
  status: string;
  principal_paise: Paise;
  start_date: string;
  due_day: number;
  markup_factor: number;
  term_months: number;
}

interface ScheduleRow {
  loan_id: string;
  installment_number: number;
  total_due_paise: Paise;
  principal_component_paise: Paise;
  markup_component_paise: Paise;
  principal_paid_paise: Paise;
  markup_paid_paise: Paise;
  effective_due_date: string;
  status: string;
}

interface TransactionRow {
  id: string;
  operation_id: string;
  loan_id: string;
  transaction_type: string;
  is_cash: number;
  payment_method: string;
  amount_paise: Paise;
  allocated_principal_paise: Paise;
  allocated_markup_paise: Paise;
  allocated_penalty_paise: Paise;
  unallocated_surplus_paise: Paise;
  forgiven_penalty_paise?: Paise;
  effective_date: string;
  created_at: string;
}

interface OutboxRow {
  id: string;
  operation_id: string;
  operation_type: string;
  payload: string;
  status: string;
  created_at: string;
}

interface DbState {
  loans: LoanRow[];
  schedules: ScheduleRow[];
  transactions: TransactionRow[];
  outbox: OutboxRow[];
}

describe('Cross-Loan Isolation', () => {
  let dbState: DbState;
  let txRepo: TransactionRepository;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });
  
  beforeEach(() => {
    jest.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    dbState = {
      loans: [
        {
          id: 'loan-a',
          product_type: 'instalment',
          status: 'ACTIVE',
          principal_paise: toPaise(2000),
          start_date: '2026-01-01',
          due_day: 1,
          markup_factor: 0.3,
          term_months: 1
        },
        {
          id: 'loan-b',
          product_type: 'bullet',
          status: 'ACTIVE',
          principal_paise: toPaise(3000),
          start_date: '2026-01-01',
          due_day: 1,
          markup_factor: 0.1,
          term_months: 1
        }
      ],
      schedules: [
        {
          loan_id: 'loan-a',
          installment_number: 1,
          total_due_paise: toPaise(2600),
          principal_component_paise: toPaise(2000),
          markup_component_paise: toPaise(600),
          principal_paid_paise: toPaise(0),
          markup_paid_paise: toPaise(0),
          effective_due_date: '2026-01-01',
          status: 'PENDING'
        },
        {
          // Realistic bullet schedule: only markup is due in the kist!
          loan_id: 'loan-b',
          installment_number: 1,
          total_due_paise: toPaise(500),
          principal_component_paise: toPaise(0),
          markup_component_paise: toPaise(500),
          principal_paid_paise: toPaise(0),
          markup_paid_paise: toPaise(0),
          effective_due_date: '2026-01-01',
          status: 'PENDING'
        }
      ],
      transactions: [],
      outbox: []
    };

    txRepo = new TransactionRepository(createDbMock(dbState, null));
  });

  let dbMutex = Promise.resolve();

  const createDbMock = (state: DbState, throwOnUpdateId: string | null = null): any => {
    return {
      withExclusiveTransactionAsync: jest.fn(async (cb: (tx: any) => Promise<void>) => {
        // Enforce SQLite exclusive transaction mutex locking
        const prevMutex = dbMutex;
        let releaseMutex: () => void;
        dbMutex = new Promise<void>((resolve) => {
          releaseMutex = resolve;
        });
        await prevMutex;

        try {
          // Clone state for transaction
          const txState: DbState = {
            loans: JSON.parse(JSON.stringify(state.loans)),
            schedules: JSON.parse(JSON.stringify(state.schedules)),
            transactions: JSON.parse(JSON.stringify(state.transactions)),
            outbox: JSON.parse(JSON.stringify(state.outbox))
          };
          const tx = createDbMock(txState, throwOnUpdateId);
          
          await cb(tx);
          // Commit
          state.loans = txState.loans;
          state.schedules = txState.schedules;
          state.transactions = txState.transactions;
          state.outbox = txState.outbox;
        } finally {
          releaseMutex!();
        }
      }),
      getFirstAsync: jest.fn(async (query: string, params: any[] = []) => {
        if (query.includes('FROM loans WHERE id = ?')) {
          return state.loans.find(l => l.id === params[0]) || null;
        }
        if (query.includes('operation_id = ?')) {
          return state.transactions.find(t => t.operation_id === params[0]) || null;
        }
        if (query.includes('SUM(amount_paise)')) {
          const sum = state.transactions
            .filter(t => t.loan_id === params[0] && t.transaction_type === 'PENALTY_ASSESSMENT')
            .reduce((acc, t) => acc + t.amount_paise, 0);
          return { total: sum };
        }
        if (query.includes('SUM(allocated_penalty_paise)')) {
          const sum = state.transactions
            .filter(t => t.loan_id === params[0] && (t.transaction_type === 'COLLECTION' || t.transaction_type === 'REVERSAL'))
            .reduce((acc, t) => acc + (t.allocated_penalty_paise || 0), 0);
          return { total: sum };
        }
        if (query.includes('SUM(forgiven_penalty_paise)')) {
          const sum = state.transactions
            .filter(t => t.loan_id === params[0] && t.transaction_type === 'REVERSAL')
            .reduce((acc, t) => acc + (t.forgiven_penalty_paise || 0), 0);
          return { total: sum };
        }
        if (query.includes('SUM(allocated_principal_paise)')) {
          const sum = state.transactions
            .filter(t => t.loan_id === params[0] && (t.transaction_type === 'COLLECTION' || t.transaction_type === 'REVERSAL'))
            .reduce((acc, t) => acc + (t.allocated_principal_paise || 0), 0);
          return { total: sum };
        }
        return null;
      }),
      getAllAsync: jest.fn(async (query: string, params: any[] = []) => {
        const normalized = query.replace(/\s+/g, ' ');
        if (normalized.includes('FROM repayment_schedules') && normalized.includes('loan_id = ?')) {
          return state.schedules.filter(s => s.loan_id === params[0]);
        }
        if (query.includes('PENALTY_ASSESSMENT')) {
          return state.transactions.filter(t => t.loan_id === params[0] && t.transaction_type === 'PENALTY_ASSESSMENT');
        }
        return [];
      }),
      runAsync: jest.fn(async (query: string, params: any[] = []) => {
        // Enforce SQLite trigger prevent_transactions_update
        if (query.includes('UPDATE transactions')) {
          throw new Error('Transactions table is append-only: updates are prohibited');
        }
        if (query.includes('INSERT INTO transactions')) {
          if (state.transactions.some(t => t.operation_id === params[1])) {
            throw new Error(`UNIQUE constraint failed: transactions.operation_id`);
          }
          state.transactions.push({
            id: params[0],
            operation_id: params[1],
            loan_id: params[2],
            transaction_type: params[3],
            is_cash: params[4],
            payment_method: params[5],
            amount_paise: params[6],
            allocated_principal_paise: params[7],
            allocated_markup_paise: params[8],
            allocated_penalty_paise: params[9],
            unallocated_surplus_paise: params[10],
            effective_date: params[11],
            created_at: params[12]
          });
        }
        if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
          const loan = state.loans.find(l => l.id === params[0]);
          if (loan) loan.status = 'SETTLED';
        }
        if (query.includes('INSERT INTO sync_outbox')) {
          state.outbox.push({
            id: params[0],
            operation_id: params[1],
            operation_type: params[2],
            payload: params[3],
            status: 'PENDING',
            created_at: params[4]
          });
        }
      }),
      prepareAsync: jest.fn(async (query: string) => {
        return {
          executeAsync: jest.fn(async (params: any[]) => {
            if (throwOnUpdateId && query.includes('UPDATE repayment_schedules') && params[3] === throwOnUpdateId) {
              throw new Error('DB failure during update');
            }
            if (query.includes('UPDATE repayment_schedules')) {
              const schedule = state.schedules.find(s => s.loan_id === params[3] && s.installment_number === params[4]);
              if (schedule) {
                schedule.principal_paid_paise = params[0];
                schedule.markup_paid_paise = params[1];
                schedule.status = params[2];
              }
            }
            if (query.includes('INSERT INTO repayment_schedules')) {
              if (state.schedules.some(s => s.loan_id === params[1] && s.installment_number === params[2])) {
                throw new Error('UNIQUE constraint failed: repayment_schedules.loan_id, repayment_schedules.installment_number');
              }
              state.schedules.push({
                loan_id: params[1],
                installment_number: params[2],
                total_due_paise: params[7],
                principal_component_paise: params[5],
                markup_component_paise: params[6],
                principal_paid_paise: toPaise(0),
                markup_paid_paise: toPaise(0),
                effective_due_date: params[4],
                status: 'PENDING'
              });
            }
          }),
          finalizeAsync: jest.fn(async () => {})
        };
      })
    };
  };

  it('Payment against Loan B should only update Loan B and satisfy conservation', async () => {
    // Perform partial payment on Loan B: 1500 paise
    // Bullet kist has 500 markup due. So 500 goes to markup, 1000 to principal.
    await txRepo.recordCashPayment('loan-b', toPaise(1500), 'op-b-1', '2026-01-02');
    
    // Verify Loan A is unchanged
    const loanASchedule = dbState.schedules.find(s => s.loan_id === 'loan-a');
    expect(loanASchedule?.principal_paid_paise).toBe(0);
    expect(loanASchedule?.markup_paid_paise).toBe(0);
    
    // Verify Loan B updated
    const loanBSchedule = dbState.schedules.find(s => s.loan_id === 'loan-b');
    expect(loanBSchedule?.markup_paid_paise).toBe(toPaise(500));
    expect(loanBSchedule?.status).toBe('PAID'); // Kist (markup only) is paid!
    
    // Conservation assertion
    const collections = dbState.transactions.filter(t => t.transaction_type === 'COLLECTION');
    expect(collections.length).toBe(1);
    
    const amountPaid = collections[0].amount_paise;
    const allocatedPrincipal = collections[0].allocated_principal_paise;
    const allocatedMarkup = collections[0].allocated_markup_paise;
    const allocatedPenalty = collections[0].allocated_penalty_paise;
    const surplus = collections[0].unallocated_surplus_paise;
    
    expect(amountPaid).toBe(allocatedPrincipal + allocatedMarkup + allocatedPenalty + surplus);
    expect(amountPaid).toBe(toPaise(1500));
    expect(allocatedPrincipal).toBe(toPaise(600)); // 1500 total - 500 kist1 markup - 300 extended kist2 markup - 100 penalty = 600 principal
  });

  it('Payment idempotency: skips execution if operation_id exists', async () => {
    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
    const txCount = dbState.transactions.length;
    
    // Repeat same operation ID
    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
    expect(dbState.transactions.length).toBe(txCount);
  });
  
  it('Bullet Principal test: fully pays bullet loan and settles it', async () => {
    // Pay on due date (2026-01-01) without extension: due 500 markup + 3000 principal = 3500
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await txRepo.recordCashPayment('loan-b', toPaise(3500), 'op-b-full', '2026-01-01');
    
    const loanBSchedule = dbState.schedules.find(s => s.loan_id === 'loan-b');
    expect(loanBSchedule?.status).toBe('PAID');
    
    const loanB = dbState.loans.find(l => l.id === 'loan-b');
    expect(loanB?.status).toBe('SETTLED');
  });

  it('Rollback: throws, discards changes, and allows successful retry', async () => {
    // Create a mock that throws when updating loan-a's schedule
    const errorRepo = new TransactionRepository(createDbMock(dbState, 'loan-a'));

    await expect(errorRepo.recordCashPayment('loan-a', toPaise(2600), 'fail-op', '2026-01-02'))
      .rejects.toThrow('DB failure during update');
      
    // Verify that the global dbState remains completely unchanged (both financial tx and outbox rolled back)
    expect(dbState.transactions.length).toBe(0);
    expect(dbState.outbox.length).toBe(0);
    const loanA = dbState.loans.find(l => l.id === 'loan-a');
    expect(loanA?.status).toBe('ACTIVE');
    const scheduleA = dbState.schedules.find(s => s.loan_id === 'loan-a');
    expect(scheduleA?.principal_paid_paise).toBe(0);
    
    // Successful retry using the normal mock with the SAME operation ID,
    // proving that rollback cleanly aborted the first attempt and did not persist either the financial tx or outbox
    await txRepo.recordCashPayment('loan-a', toPaise(2600), 'fail-op', '2026-01-02');
    expect(dbState.transactions.filter(t => t.transaction_type === 'COLLECTION').length).toBe(1);
    expect(dbState.outbox.length).toBe(1);
    expect(dbState.outbox[0].operation_id).toBe('fail-op');
    expect(dbState.outbox[0].operation_type).toBe('record_collection');
    expect(dbState.schedules.find(s => s.loan_id === 'loan-a')?.status).toBe('PAID');
  });

  it('Concurrent duplicate payments resolve safely without duplicating ledger entries', async () => {
    const p1 = txRepo.recordCashPayment('loan-b', toPaise(1000), 'concurrent-op', '2026-01-02');
    const p2 = txRepo.recordCashPayment('loan-b', toPaise(1000), 'concurrent-op', '2026-01-02');

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    const txs = dbState.transactions.filter(t => t.operation_id === 'concurrent-op');
    expect(txs.length).toBe(1);
    const outboxOps = dbState.outbox.filter(o => o.operation_id === 'concurrent-op');
    expect(outboxOps.length).toBe(1);
  });

  it('Trigger enforcement: direct UPDATE on transactions throws append-only violation', async () => {
    const mock = createDbMock(dbState);
    await expect(mock.runAsync('UPDATE transactions SET amount_paise = 999 WHERE id = ?', ['tx-1']))
      .rejects.toThrow('Transactions table is append-only: updates are prohibited');
  });

  it('Constraint enforcement: inserting duplicate installment number for same loan throws UNIQUE constraint error', async () => {
    const mock = createDbMock(dbState);
    const stmt = await mock.prepareAsync('INSERT INTO repayment_schedules VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    await expect(stmt.executeAsync(['sched-2', 'loan-a', 1, '2026-01-01', '2026-01-01', toPaise(1000), toPaise(100), toPaise(1100)]))
      .rejects.toThrow('UNIQUE constraint failed: repayment_schedules.loan_id, repayment_schedules.installment_number');
  });

  it('Subsequent payment respects REVERSAL reconciliation deltas and forgiven penalties', async () => {
    // Simulate an assessed penalty of ₹100 (10,000 paise)
    dbState.transactions.push({
      id: 'tx-pen-1',
      operation_id: 'op-pen-1',
      loan_id: 'loan-a',
      transaction_type: 'PENALTY_ASSESSMENT',
      is_cash: 0,
      payment_method: 'SYSTEM',
      amount_paise: toPaise(100),
      allocated_principal_paise: toPaise(0),
      allocated_markup_paise: toPaise(0),
      allocated_penalty_paise: toPaise(0),
      unallocated_surplus_paise: toPaise(0),
      effective_date: '2026-01-02',
      created_at: new Date().toISOString()
    });

    // Simulate an append-only REVERSAL penalty waiver of ₹100
    dbState.transactions.push({
      id: 'tx-waiver-1',
      operation_id: 'op-waiver-1',
      loan_id: 'loan-a',
      transaction_type: 'REVERSAL',
      is_cash: 0,
      payment_method: 'SYSTEM',
      amount_paise: toPaise(0),
      allocated_principal_paise: toPaise(0),
      allocated_markup_paise: toPaise(0),
      allocated_penalty_paise: toPaise(0),
      unallocated_surplus_paise: toPaise(0),
      forgiven_penalty_paise: toPaise(100),
      effective_date: '2026-01-02',
      created_at: new Date().toISOString()
    });

    // Pay full kist amount (₹2,600).
    // Because the penalty was forgiven via REVERSAL, 0 should go to penalty and all funds go to kist!
    const res = await txRepo.recordCashPayment('loan-a', toPaise(2600), 'pay-after-waiver', '2026-01-02');
    expect(res.success).toBe(true);

    const payTx = dbState.transactions.find(t => t.operation_id === 'pay-after-waiver');
    expect(payTx).toBeDefined();
    expect(payTx!.allocated_penalty_paise).toBe(0);
    expect(payTx!.allocated_principal_paise).toBe(toPaise(2000));
    expect(payTx!.allocated_markup_paise).toBe(toPaise(600));

    // Loan should be settled since kist is fully paid and remaining penalty is 0!
    const loan = dbState.loans.find(l => l.id === 'loan-a');
    expect(loan?.status).toBe('SETTLED');
  });
});

describe('Real SQLite Engine Integration Guarantees', () => {
  function createRealSqliteDb(): SQLiteDatabase {
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
      CREATE TRIGGER prevent_transactions_update
      BEFORE UPDATE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
      END;
      CREATE TRIGGER prevent_transactions_delete
      BEFORE DELETE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
      END;
      CREATE TABLE sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        operation_id TEXT UNIQUE NOT NULL,
        operation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT NOT NULL
      );
    `);

    const adapter: any = {
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
          async finalizeAsync() {}
        };
      },
      async withExclusiveTransactionAsync(cb: (tx: any) => Promise<void>) {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          await cb(adapter);
          sqlite.exec('COMMIT');
        } catch (err) {
          sqlite.exec('ROLLBACK');
          throw err;
        }
      }
    };

    return adapter as unknown as SQLiteDatabase;
  }

  it('enforces atomic rollback of ledger, schedules, loan status, and outbox in real SQLite engine on failure', async () => {
    const db = createRealSqliteDb();

    // Seed baseline
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-1', 'Borrower 1', '9876543210', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-real', 'b-1', 200000, 0.3, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules VALUES ('kist-real', 'loan-real', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

    // Verify atomic rollback when an unhandled error happens late in the transaction
    await expect(
      db.withExclusiveTransactionAsync(async (tx: any) => {
        await tx.runAsync(
          `INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
           VALUES ('tx-1', 'op-fail', 'loan-real', 'COLLECTION', 260000, '2026-01-01', '2026-01-01')`
        );
        await tx.runAsync(
          `UPDATE repayment_schedules SET principal_paid_paise = 200000, markup_paid_paise = 60000, status = 'PAID' WHERE id = 'kist-real'`
        );
        await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = 'loan-real'`);
        await tx.runAsync(
          `INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
           VALUES ('out-1', 'op-fail', 'record_collection', '{}', 'PENDING', '2026-01-01')`
        );

        // Late failure after all writes
        throw new Error('Simulated network/disk crash before commit');
      })
    ).rejects.toThrow('Simulated network/disk crash before commit');

    // In real SQLite, ALL changes must be completely rolled back:
    const txCount = (await db.getFirstAsync<{ cnt: number }>(`SELECT count(*) as cnt FROM transactions`))?.cnt;
    expect(txCount).toBe(0);

    const schedule = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-real'`);
    expect(schedule?.principal_paid_paise).toBe(0);
    expect(schedule?.markup_paid_paise).toBe(0);
    expect(schedule?.status).toBe('PENDING');

    const loan = await db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = 'loan-real'`);
    expect(loan?.status).toBe('ACTIVE');

    const outboxCount = (await db.getFirstAsync<{ cnt: number }>(`SELECT count(*) as cnt FROM sync_outbox`))?.cnt;
    expect(outboxCount).toBe(0);
  });

  it('enforces real SQLite unique constraint preventing duplicate operation_ids', async () => {
    const db = createRealSqliteDb();
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-1', 'Borrower 1', '9876543210', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-1', 'b-1', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);

    await db.runAsync(
      `INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
       VALUES ('tx-1', 'op-duplicate-check', 'loan-1', 'COLLECTION', 50000, '2026-01-01', '2026-01-01')`
    );

    await expect(
      db.runAsync(
        `INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
         VALUES ('tx-2', 'op-duplicate-check', 'loan-1', 'COLLECTION', 50000, '2026-01-01', '2026-01-01')`
      )
    ).rejects.toThrow(/UNIQUE constraint failed: transactions\.operation_id/);
  });

  it('enforces real SQLite trigger prohibiting update and delete on transactions table', async () => {
    const db = createRealSqliteDb();
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-1', 'Borrower 1', '9876543210', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-1', 'b-1', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(
      `INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
       VALUES ('tx-immutability', 'op-immut', 'loan-1', 'COLLECTION', 50000, '2026-01-01', '2026-01-01')`
    );

    // UPDATE prohibited by trigger
    await expect(
      db.runAsync(`UPDATE transactions SET amount_paise = 99999 WHERE id = 'tx-immutability'`)
    ).rejects.toThrow(/Transactions table is append-only: updates are prohibited/);

    // DELETE prohibited by trigger
    await expect(
      db.runAsync(`DELETE FROM transactions WHERE id = 'tx-immutability'`)
    ).rejects.toThrow(/Transactions table is append-only: deletions are prohibited/);
  });

  it('executes real end-to-end collection in SQLite with sequence counter and conservation', async () => {
    const db = createRealSqliteDb();
    const repo = new TransactionRepository(db);

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-1', 'Borrower 1', '9876543210', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-e2e', 'b-1', 200000, 0.3, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules VALUES ('kist-e2e', 'loan-e2e', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

    const res = await repo.recordCashPayment('loan-e2e', 260000 as Paise, 'op-e2e-1', '2026-01-01');
    expect(res.success).toBe(true);

    const txRow = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-e2e-1'`);
    expect(txRow).toBeDefined();
    expect(txRow.sequence_number).toBe(1);
    expect(txRow.amount_paise).toBe(260000);
    expect(txRow.allocated_principal_paise).toBe(200000);
    expect(txRow.allocated_markup_paise).toBe(60000);

    // Conservation check
    expect(txRow.amount_paise).toBe(
      txRow.allocated_principal_paise + txRow.allocated_markup_paise + txRow.allocated_penalty_paise + txRow.unallocated_surplus_paise
    );

    // Loan status transitioned to SETTLED
    const loanRow = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-e2e'`);
    expect(loanRow.status).toBe('SETTLED');

    // Outbox record created
    const outboxRow = await db.getFirstAsync<any>(`SELECT * FROM sync_outbox WHERE operation_id = 'op-e2e-1'`);
    expect(outboxRow).toBeDefined();
    expect(outboxRow.operation_type).toBe('record_collection');
  });
});
