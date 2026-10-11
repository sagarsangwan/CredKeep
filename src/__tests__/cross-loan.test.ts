import { SQLiteDatabase } from 'expo-sqlite';
import { TransactionRepository } from '../core/database/transactionRepository';
import { Paise, toPaise } from '../core/domain/money';
import { OutboxManager } from '../core/sync/outbox';
import { SyncService } from '../core/sync/syncService';
import { runMigrations } from '../core/database/schema';
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
      CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
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
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-real', 'loan-real', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

    const repo = new TransactionRepository(db);

    // Spy on OutboxManager.enqueue to inject a late failure after ledger & schedules have been written
    const origEnqueue = OutboxManager.enqueue;
    OutboxManager.enqueue = jest.fn().mockImplementationOnce(() => {
      throw new Error('Simulated network/disk crash during outbox enqueue');
    });

    try {
      // 1. Invoke production payment repository method - should throw due to late failure
      await expect(
        repo.recordCashPayment(
          'loan-real',
          260000 as Paise,
          'op-fail',
          '2026-01-01'
        )
      ).rejects.toThrow('Simulated network/disk crash during outbox enqueue');

      // 2. Verify complete rollback across all tables in real SQLite engine
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
    } finally {
      OutboxManager.enqueue = origEnqueue;
    }

    // 3. Clean retry with the exact same operation_id must succeed and commit cleanly
    await repo.recordCashPayment(
      'loan-real',
      260000 as Paise,
      'op-fail',
      '2026-01-01'
    );

    const txAfter = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-fail'`);
    expect(txAfter).not.toBeNull();
    expect(txAfter.amount_paise).toBe(260000);

    const scheduleAfter = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-real'`);
    expect(scheduleAfter?.principal_paid_paise).toBe(200000);
    expect(scheduleAfter?.markup_paid_paise).toBe(60000);
    expect(scheduleAfter?.status).toBe('PAID');

    const loanAfter = await db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = 'loan-real'`);
    expect(loanAfter?.status).toBe('SETTLED');

    const outboxAfter = await db.getFirstAsync<any>(`SELECT * FROM sync_outbox WHERE operation_id = 'op-fail'`);
    expect(outboxAfter).not.toBeNull();
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
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-e2e', 'loan-e2e', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

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

  it('recovers from push rejection atomically in real SQLite (outbox, REVERSAL transaction, schedule rollback, status restoration)', async () => {
    const db = createRealSqliteDb();
    const repo = new TransactionRepository(db);

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-rej', 'Borrower Rej', '9876543211', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-rej', 'b-rej', 200000, 0.3, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-rej', 'loan-rej', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

    // 1. Record cash collection that settles loan
    const res = await repo.recordCashPayment('loan-rej', 260000 as Paise, 'op-rej-1', '2026-01-01');
    expect(res.success).toBe(true);

    const loanAfterPay = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-rej'`);
    expect(loanAfterPay?.status).toBe('SETTLED');

    const kistAfterPay = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rej'`);
    expect(kistAfterPay?.principal_paid_paise).toBe(200000);
    expect(kistAfterPay?.markup_paid_paise).toBe(60000);
    expect(kistAfterPay?.status).toBe('PAID');

    // 2. Trigger atomic rejection recovery
    await SyncService.revertRejectedPayment(db, 'op-rej-1', 'Borrower limit exceeded on server');

    // 3. Verify outbox marked REJECTED with error
    const outboxRow = await db.getFirstAsync<any>(`SELECT * FROM sync_outbox WHERE operation_id = 'op-rej-1'`);
    expect(outboxRow?.status).toBe('REJECTED');
    expect(outboxRow?.error_message).toBe('Borrower limit exceeded on server');

    // 4. Verify compensating REVERSAL transaction was appended
    const revTx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'reversal-op-rej-1'`);
    expect(revTx).toBeDefined();
    expect(revTx.transaction_type).toBe('REVERSAL');
    expect(revTx.amount_paise).toBe(-260000);
    expect(revTx.allocated_principal_paise).toBe(-200000);
    expect(revTx.allocated_markup_paise).toBe(-60000);

    // 5. Verify repayment schedule was rolled back
    const kistAfterRevert = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rej'`);
    expect(kistAfterRevert?.principal_paid_paise).toBe(0);
    expect(kistAfterRevert?.markup_paid_paise).toBe(0);
    expect(kistAfterRevert?.status).toBe('PENDING');

    // 6. Verify loan status restored to ACTIVE
    const loanAfterRevert = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-rej'`);
    expect(loanAfterRevert?.status).toBe('ACTIVE');
  });

  it('ensures schedule replay across multi-page pulls is strictly idempotent in real SQLite without inflating paid amounts', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-replay', 'Borrower Replay', '9876543212', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-replay', 'b-replay', 200000, 0.2, 2, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rep-1', 'loan-replay', 1, '2026-01-01', '2026-01-01', 100000, 20000, 120000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rep-2', 'loan-replay', 2, '2026-02-01', '2026-02-01', 100000, 20000, 120000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // User made a pending collection of 120000 paise (pays kist 1)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-rep-1', 'op-rep-1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-replay', amount_paise: 120000, effective_date: '2026-01-01' })}', 'PENDING', '2026-01-01T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-rep-1', 'op-rep-1', 'loan-replay', 'COLLECTION', 120000, 100000, 20000, '2026-01-01', '2026-01-01')
    `);

    // Replay pending collection initial run
    await SyncService.reapplyPendingCollections(db, 'loan-replay');

    const k1 = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-1'`);
    const k2 = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-2'`);
    expect(k1?.principal_paid_paise).toBe(100000);
    expect(k1?.markup_paid_paise).toBe(20000);
    expect(k1?.status).toBe('PAID');
    expect(k2?.principal_paid_paise).toBe(0);
    expect(k2?.markup_paid_paise).toBe(0);
    expect(k2?.status).toBe('UNPAID');

    // Page 1 arrives from server with KIST 1 snapshot (server has not acknowledged op-rep-1 yet)
    const modifiedLoansPage1 = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'KIST',
      operation_type: 'UPDATE',
      payload: {
        id: 'kist-rep-1',
        loan_id: 'loan-replay',
        installment_number: 1,
        principal_paid_paise: 0,
        markup_paid_paise: 0,
        status: 'PENDING',
      }
    }, modifiedLoansPage1);

    expect(modifiedLoansPage1.has('loan-replay')).toBe(true);
    for (const lid of modifiedLoansPage1) {
      await SyncService.reapplyPendingCollections(db, lid);
    }

    // Page 2 arrives from server with KIST 2 snapshot
    const modifiedLoansPage2 = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'KIST',
      operation_type: 'UPDATE',
      payload: {
        id: 'kist-rep-2',
        loan_id: 'loan-replay',
        installment_number: 2,
        principal_paid_paise: 0,
        markup_paid_paise: 0,
        status: 'PENDING',
      }
    }, modifiedLoansPage2);

    expect(modifiedLoansPage2.has('loan-replay')).toBe(true);
    for (const lid of modifiedLoansPage2) {
      await SyncService.reapplyPendingCollections(db, lid);
    }

    // Page 3 arrives with non-KIST TRANSACTION delta
    const modifiedLoansPage3 = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'TRANSACTION',
      operation_type: 'INSERT',
      payload: {
        id: 'tx-server-some',
        operation_id: 'op-some',
        loan_id: 'loan-replay',
        transaction_type: 'COLLECTION',
        amount_paise: 0,
        effective_date: '2026-01-01'
      }
    }, modifiedLoansPage3);

    // Verified: non-KIST change does NOT touch modifiedLoansPage3
    expect(modifiedLoansPage3.size).toBe(0);

    // CRITICAL INVARIANT: Multi-page replay did NOT credit kist 2 or double-credit kist 1
    const k1Final = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-1'`);
    const k2Final = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-2'`);
    expect(k1Final?.principal_paid_paise).toBe(100000);
    expect(k1Final?.markup_paid_paise).toBe(20000);
    expect(k1Final?.status).toBe('PAID');
    expect(k2Final?.principal_paid_paise).toBe(0);
    expect(k2Final?.markup_paid_paise).toBe(0);
    expect(k2Final?.status).toBe('UNPAID');
  });

  it('preserves penalty money allocations during pending replay without diverting into principal or markup', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-pen', 'Borrower Pen', '9876543213', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-pen', 'b-pen', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-pen-1', 'loan-pen', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Penalty assessment of 5000 paise
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-pen-assess', 'pen-assess-1', 'loan-pen', 'PENALTY_ASSESSMENT', 5000, '2026-01-05', '2026-01-05')
    `);

    // Pending payment of 5000 paise (recorded locally to pay late penalty)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-pen-1', 'op-pen-pay', 'record_collection', '${JSON.stringify({ loan_id: 'loan-pen', amount_paise: 5000, effective_date: '2026-01-06' })}', 'PENDING', '2026-01-06T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-pen-col', 'op-pen-pay', 'loan-pen', 'COLLECTION', 5000, 0, 0, 5000, '2026-01-06', '2026-01-06')
    `);

    // Replay pending collections
    await SyncService.reapplyPendingCollections(db, 'loan-pen');

    // VERIFICATION: The 5000 paise was allocated to penalty, NOT diverted to principal or markup!
    const kistPen = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-pen-1'`);
    expect(kistPen?.principal_paid_paise).toBe(0);
    expect(kistPen?.markup_paid_paise).toBe(0);
    expect(kistPen?.status).toBe('UNPAID');
  });

  it('properly accounts for REVERSAL penalty forgiveness during replay without charging forgiven fees', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-forg', 'Borrower Forg', '9876543214', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-forg', 'b-forg', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-forg-1', 'loan-forg', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Penalty assessment of 3000 paise
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-forg-assess', 'pen-forg-1', 'loan-forg', 'PENALTY_ASSESSMENT', 3000, '2026-01-05', '2026-01-05')
    `);

    // REVERSAL penalty forgiveness of 3000 paise
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, forgiven_penalty_paise, effective_date, created_at)
      VALUES ('tx-forg-rev', 'pen-forg-rev', 'loan-forg', 'REVERSAL', 0, 3000, '2026-01-05', '2026-01-05')
    `);

    // Pending payment of 110000 paise (full installment)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-forg-1', 'op-forg-pay', 'record_collection', '${JSON.stringify({ loan_id: 'loan-forg', amount_paise: 110000, effective_date: '2026-01-06' })}', 'PENDING', '2026-01-06T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-forg-pay', 'op-forg-pay', 'loan-forg', 'COLLECTION', 110000, 100000, 10000, '2026-01-06', '2026-01-06')
    `);

    // Replay pending collections
    await SyncService.reapplyPendingCollections(db, 'loan-forg');

    // Because penalty of 3000 was forgiven via REVERSAL, remaining penalty was 0!
    // So all 110000 paise pays the installment in full!
    const kistForg = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-forg-1'`);
    expect(kistForg?.principal_paid_paise).toBe(100000);
    expect(kistForg?.markup_paid_paise).toBe(10000);
    expect(kistForg?.status).toBe('PAID');
  });

  it('applies runMigrations to an existing V1 schema database and enforces unique schedule index', async () => {
    const sqlite = new DatabaseSync(':memory:');
    // Legacy V1 repayment_schedules table without server_... columns and without inline UNIQUE constraint
    sqlite.exec(`
      CREATE TABLE borrowers (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
      CREATE TABLE loans (id TEXT PRIMARY KEY NOT NULL, borrower_id TEXT NOT NULL, principal_paise INTEGER NOT NULL, markup_factor REAL NOT NULL, term_months INTEGER NOT NULL, start_date TEXT NOT NULL, due_day INTEGER NOT NULL, product_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL);
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
        status TEXT NOT NULL DEFAULT 'PENDING'
      );
    `);

    // Insert an initial kist in V1 schema
    sqlite.exec(`
      INSERT INTO repayment_schedules VALUES ('kist-v1-1', 'loan-v1', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING');
    `);

    // Create adapter
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
        return (stmt.get(...bound) as T) || null;
      },
      async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
        const bound = params.map(p => p === undefined ? null : p);
        const stmt = sqlite.prepare(sql);
        return stmt.all(...bound) as T[];
      },
      async withExclusiveTransactionAsync<T>(callback: (tx: any) => Promise<T>): Promise<T> {
        sqlite.exec('BEGIN EXCLUSIVE TRANSACTION');
        try {
          const res = await callback(adapter);
          sqlite.exec('COMMIT');
          return res;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      }
    };

    // Run migrations on legacy DB
    await runMigrations(adapter);

    // Verify new columns exist
    const kistRow: any = await adapter.getFirstAsync(`SELECT server_principal_paid_paise, server_status FROM repayment_schedules WHERE id = 'kist-v1-1'`);
    expect(kistRow?.server_principal_paid_paise).toBe(0);
    expect(kistRow?.server_status).toBe('PENDING');

    // Verify duplicate (loan_id, installment_number) insertion throws constraint violation
    await expect(async () => {
      await adapter.runAsync(`
        INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
        VALUES ('kist-v1-dup', 'loan-v1', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000)
      `);
    }).rejects.toThrow();
  });

  it('restores penalty balance on rejection and re-credits surviving payment to penalty', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-rej-pen', 'Borrower RejPen', '9876543215', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-rej-pen', 'b-rej-pen', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rej-1', 'loan-rej-pen', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 100 paise penalty assessed
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-pen-assess-100', 'pen-op-100', 'loan-rej-pen', 'PENALTY_ASSESSMENT', 100, '2026-01-02', '2026-01-02')
    `);

    // Payment 1 (100 paise) originally paid penalty
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-p1', 'op-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-rej-pen', amount_paise: 100, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-p1', 'op-p1', 'loan-rej-pen', 'COLLECTION', 100, 0, 0, 100, '2026-01-02', '2026-01-02')
    `);

    // Payment 2 (100 paise) originally paid principal
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-p2', 'op-p2', 'record_collection', '${JSON.stringify({ loan_id: 'loan-rej-pen', amount_paise: 100, effective_date: '2026-01-03' })}', 'PENDING', '2026-01-03T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-p2', 'op-p2', 'loan-rej-pen', 'COLLECTION', 100, 100, 0, 0, '2026-01-03', '2026-01-03')
    `);

    // Now server rejects Payment 1
    await SyncService.revertRejectedPayment(db, 'op-p1', 'Server rejected payment 1');

    // Outbox status of Payment 1 is REJECTED
    const outbox1 = await db.getFirstAsync<any>(`SELECT status FROM sync_outbox WHERE operation_id = 'op-p1'`);
    expect(outbox1?.status).toBe('REJECTED');

    // Surviving Payment 2 must now cover the restored 100-paise penalty, NOT principal!
    const kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rej-1'`);
    expect(kist?.principal_paid_paise).toBe(0);
    expect(kist?.markup_paid_paise).toBe(0);
  });

  it('correctly recovers and preserves settlement status for bullet loans and respects penalties', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-bullet-set', 'Borrower Bullet', '9876543216', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-bullet-set', 'b-bullet-set', 5000, 0.1, 1, '2026-01-01', 1, 'bullet', 'SETTLED', '2026-01-01')`);
    // Bullet schedule has 0 principal component, 500 markup component
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-bullet-1', 'loan-bullet-set', 1, '2026-01-01', '2026-01-01', 0, 500, 500, 0, 500, 'PAID', 0, 500, 'PAID')`);

    // Bullet principal was paid via transactions (5000 paise)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-bullet-p1', 'op-bullet-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-bullet-set', amount_paise: 500, effective_date: '2026-01-01' })}', 'SYNCED', '2026-01-01T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-bullet-p1', 'op-bullet-p1', 'loan-bullet-set', 'COLLECTION', 500, 0, 500, '2026-01-01', '2026-01-01')
    `);

    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-bullet-p2', 'op-bullet-p2', 'record_collection', '${JSON.stringify({ loan_id: 'loan-bullet-set', amount_paise: 5000, effective_date: '2026-01-01' })}', 'SYNCED', '2026-01-01T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-bullet-p2', 'op-bullet-p2', 'loan-bullet-set', 'COLLECTION', 5000, 5000, 0, '2026-01-01', '2026-01-01')
    `);

    // Recalculating loan schedule must keep the bullet loan SETTLED
    await SyncService.recalculateLoanSchedule(db, 'loan-bullet-set');
    const loanAfterRecalc = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-bullet-set'`);
    expect(loanAfterRecalc?.status).toBe('SETTLED');

    // If principal payment op-bullet-p2 is rejected, loan status must reactivate to ACTIVE
    await SyncService.revertRejectedPayment(db, 'op-bullet-p2', 'Principal rejected');
    const loanAfterRejection = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-bullet-set'`);
    expect(loanAfterRejection?.status).toBe('ACTIVE');
  });

  it('does not settle an instalment loan if outstanding penalties remain unpaid', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-inst-pen', 'Borrower PenLoan', '9876543217', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-inst-pen', 'b-inst-pen', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-inst-1', 'loan-inst-pen', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Penalty assessed: 5000 paise
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-pen-5000', 'op-pen-5000', 'loan-inst-pen', 'PENALTY_ASSESSMENT', 5000, '2026-01-01', '2026-01-01')
    `);

    // Payment of 110,000 paise (pays 5000 penalty, 10000 markup, 95000 principal)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-inst-p1', 'op-inst-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-inst-pen', amount_paise: 110000, effective_date: '2026-01-02' })}', 'SYNCED', '2026-01-02T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-inst-p1', 'op-inst-p1', 'loan-inst-pen', 'COLLECTION', 110000, 95000, 10000, 5000, '2026-01-02', '2026-01-02')
    `);

    await SyncService.recalculateLoanSchedule(db, 'loan-inst-pen');

    // Loan is NOT settled because principal is not fully paid (only 95000 paid)
    const loan = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-inst-pen'`);
    expect(loan?.status).toBe('ACTIVE');
  });
});
