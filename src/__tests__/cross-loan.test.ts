import { SQLiteDatabase } from 'expo-sqlite';
import { TransactionRepository } from '../core/database/transactionRepository';
import { Paise, toPaise } from '../core/domain/money';
import { OutboxManager } from '../core/sync/outbox';
import { SyncService } from '../core/sync/syncService';
import { V1DataExtractor } from '../core/migration/v1Extractor';
import { runMigrations } from '../core/database/schema';
import { getDatabaseName } from '../core/database/dbName';
import { AuthStore } from '../core/auth/authStore';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] || null),
    setItemAsync: jest.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

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
        if (query.includes('FROM sync_outbox WHERE operation_id = ?') || query.includes('sync_outbox WHERE operation_id = ?')) {
          return state.outbox.find(o => o.operation_id === params[0]) || null;
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

  it('Payment idempotency: skips execution if operation_id exists and matches attributes, rejects conflicting parameters', async () => {
    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
    const txCount = dbState.transactions.length;
    
    // 1. Identical repeat succeeds idempotently
    const retryRes = await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
    expect(retryRes.success).toBe(true);
    expect(dbState.transactions.length).toBe(txCount);

    // 2. Conflicting loan ID rejected
    await expect(txRepo.recordCashPayment('loan-a', toPaise(2600), 'existing-op', '2026-01-02'))
      .rejects.toThrow(/Idempotency conflict/);

    // 3. Conflicting payment amount rejected
    await expect(txRepo.recordCashPayment('loan-b', toPaise(3000), 'existing-op', '2026-01-02'))
      .rejects.toThrow(/Idempotency conflict/);

    // 4. Conflicting effective date rejected
    await expect(txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-05'))
      .rejects.toThrow(/Idempotency conflict/);

    // No phantom transactions inserted on rejected conflicts
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

    // Create transaction connection and database handle
    const txn: any = {
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
    };

    const adapter: any = {
      sqlite,
      async execAsync() {
        throw new Error('Database queries outside transaction context are prohibited during migration');
      },
      async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
        return txn.getFirstAsync(sql, params);
      },
      async runAsync(sql: string, params: any[] = []) {
        return txn.runAsync(sql, params);
      },
      async withExclusiveTransactionAsync<T>(callback: (tx: any) => Promise<T>): Promise<T> {
        sqlite.exec('BEGIN EXCLUSIVE TRANSACTION');
        try {
          const res = await callback(txn);
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

    // Compensating REVERSAL transaction was recorded in ledger
    const reallocTx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-p2%'`);
    expect(reallocTx).not.toBeNull();
    expect(reallocTx?.allocated_penalty_paise).toBe(100);
    expect(reallocTx?.allocated_principal_paise).toBe(-100);

    // Journal totals in transactions reflect exact new allocations
    const journal = await db.getFirstAsync<any>(`
      SELECT
        SUM(allocated_principal_paise) as principal,
        SUM(allocated_penalty_paise) as penalty
      FROM transactions
      WHERE transaction_type IN ('COLLECTION', 'REVERSAL')
        AND NOT EXISTS (
          SELECT 1 FROM sync_outbox so
          WHERE so.status = 'REJECTED'
            AND (
              transactions.operation_id = so.operation_id
              OR transactions.operation_id = 'reversal-' || so.operation_id
              OR transactions.operation_id LIKE 'realloc-' || so.operation_id || '%'
            )
        )
    `);
    expect(journal?.principal).toBe(0);
    expect(journal?.penalty).toBe(100);

    // Subsequent payment P3 of 100 paise pays kist (markup), NOT the penalty again!
    const txRepo = new TransactionRepository(db);
    const resP3 = await txRepo.recordCashPayment('loan-rej-pen', 100 as Paise, 'op-p3', '2026-02-01');
    expect(resP3.success).toBe(true);
    const p3Tx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-p3'`);
    expect(p3Tx?.allocated_penalty_paise).toBe(0);
    expect(p3Tx?.allocated_markup_paise).toBe(100);
  });

  it('handles sequential rejection with two payments without phantom allocations', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-seq-2', 'Borrower Seq2', '9876543211', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-seq-2', 'b-seq-2', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-seq2-1', 'loan-seq-2', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 100 paise penalty assessed
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-pen-seq2', 'pen-op-seq2', 'loan-seq-2', 'PENALTY_ASSESSMENT', 100, '2026-01-02', '2026-01-02')
    `);

    // Payment 1 (100 paise) pays penalty
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-seq2-p1', 'op-seq2-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-seq-2', amount_paise: 100, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-seq2-p1', 'op-seq2-p1', 'loan-seq-2', 'COLLECTION', 100, 0, 0, 100, '2026-01-02', '2026-01-02')
    `);

    // Payment 2 (100 paise) pays principal
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-seq2-p2', 'op-seq2-p2', 'record_collection', '${JSON.stringify({ loan_id: 'loan-seq-2', amount_paise: 100, effective_date: '2026-01-03' })}', 'PENDING', '2026-01-03T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-seq2-p2', 'op-seq2-p2', 'loan-seq-2', 'COLLECTION', 100, 100, 0, 0, '2026-01-03', '2026-01-03')
    `);

    // 1. First rejection: server rejects Payment 1
    await SyncService.revertRejectedPayment(db, 'op-seq2-p1', 'Server rejected payment 1');
    const p2Realloc = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-seq2-p2%'`);
    expect(p2Realloc?.allocated_penalty_paise).toBe(100);
    expect(p2Realloc?.allocated_principal_paise).toBe(-100);

    // 2. Second rejection: server ALSO rejects Payment 2 (sequential rejection)
    await SyncService.revertRejectedPayment(db, 'op-seq2-p2', 'Server rejected payment 2');

    // Both outbox records are marked REJECTED
    const ob1 = await db.getFirstAsync<any>(`SELECT status FROM sync_outbox WHERE operation_id = 'op-seq2-p1'`);
    const ob2 = await db.getFirstAsync<any>(`SELECT status FROM sync_outbox WHERE operation_id = 'op-seq2-p2'`);
    expect(ob1?.status).toBe('REJECTED');
    expect(ob2?.status).toBe('REJECTED');

    // Schedule has 0 paid
    const kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-seq2-1'`);
    expect(kist?.principal_paid_paise).toBe(0);
    expect(kist?.markup_paid_paise).toBe(0);

    // Ledger sum across all non-rejected collections is 0
    const nonRejJournal = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as principal,
        COALESCE(SUM(allocated_penalty_paise), 0) as penalty
      FROM transactions
      WHERE transaction_type IN ('COLLECTION', 'REVERSAL')
        AND NOT EXISTS (
          SELECT 1 FROM sync_outbox so
          WHERE so.status = 'REJECTED'
            AND (
              transactions.operation_id = so.operation_id
              OR transactions.operation_id = 'reversal-' || so.operation_id
              OR transactions.operation_id LIKE 'realloc-' || so.operation_id || '%'
            )
        )
    `);
    expect(nonRejJournal?.principal).toBe(0);
    expect(nonRejJournal?.penalty).toBe(0);

    // Raw ledger sum for Payment 2 (original + realloc + reversal) is EXACTLY 0 (NO phantom allocations!)
    const p2Total = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as principal,
        COALESCE(SUM(allocated_penalty_paise), 0) as penalty
      FROM transactions
      WHERE operation_id = 'op-seq2-p2'
         OR operation_id = 'reversal-op-seq2-p2'
         OR operation_id LIKE 'realloc-op-seq2-p2%'
    `);
    expect(p2Total?.principal).toBe(0);
    expect(p2Total?.penalty).toBe(0);

    // Subsequent payment P3 pays the 100 paise penalty because no phantom penalty credit survived!
    const txRepo = new TransactionRepository(db);
    const resP3 = await txRepo.recordCashPayment('loan-seq-2', 100 as Paise, 'op-seq2-p3', '2026-01-15');
    expect(resP3.success).toBe(true);
    const p3Tx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-seq2-p3'`);
    expect(p3Tx?.allocated_penalty_paise).toBe(100);
    expect(p3Tx?.allocated_principal_paise).toBe(0);
  });

  it('handles sequential rejection with three payments reallocating remaining payments cleanly', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-seq-3', 'Borrower Seq3', '9876543212', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-seq-3', 'b-seq-3', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    // Total due 100,100 (100 markup, 100000 principal)
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-seq3-1', 'loan-seq-3', 1, '2026-02-01', '2026-02-01', 100000, 100, 100100, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 100 paise penalty assessed
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-pen-seq3', 'pen-op-seq3', 'loan-seq-3', 'PENALTY_ASSESSMENT', 100, '2026-01-02', '2026-01-02')
    `);

    // P1 (100 paise) pays penalty
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('ob-seq3-p1', 'op-seq3-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-seq-3', amount_paise: 100, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-seq3-p1', 'op-seq3-p1', 'loan-seq-3', 'COLLECTION', 100, 0, 0, 100, '2026-01-02', '2026-01-02')
    `);

    // P2 (100 paise) pays markup
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('ob-seq3-p2', 'op-seq3-p2', 'record_collection', '${JSON.stringify({ loan_id: 'loan-seq-3', amount_paise: 100, effective_date: '2026-01-03' })}', 'PENDING', '2026-01-03T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-seq3-p2', 'op-seq3-p2', 'loan-seq-3', 'COLLECTION', 100, 0, 100, 0, '2026-01-03', '2026-01-03')
    `);

    // P3 (100 paise) pays principal
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('ob-seq3-p3', 'op-seq3-p3', 'record_collection', '${JSON.stringify({ loan_id: 'loan-seq-3', amount_paise: 100, effective_date: '2026-01-04' })}', 'PENDING', '2026-01-04T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-seq3-p3', 'op-seq3-p3', 'loan-seq-3', 'COLLECTION', 100, 100, 0, 0, '2026-01-04', '2026-01-04')
    `);

    // Reject P1: P2 now reallocates to penalty (100 paise), P3 reallocates to markup (100 paise)
    await SyncService.revertRejectedPayment(db, 'op-seq3-p1', 'Reject 1');
    const p2Realloc = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-seq3-p2%' ORDER BY sequence_number DESC LIMIT 1`);
    expect(p2Realloc?.allocated_penalty_paise).toBe(100);
    expect(p2Realloc?.allocated_markup_paise).toBe(-100);

    // Reject P2: P3 now reallocates to penalty (100 paise)!
    await SyncService.revertRejectedPayment(db, 'op-seq3-p2', 'Reject 2');
    const p3Realloc = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-seq3-p3%' ORDER BY sequence_number DESC LIMIT 1`);
    expect(p3Realloc?.allocated_penalty_paise).toBe(100);
    expect(p3Realloc?.allocated_markup_paise).toBe(-100);

    // P3 net in ledger before Reject 3 is exactly 100 penalty
    const p3NetBeforeRej3 = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as principal,
        COALESCE(SUM(allocated_markup_paise), 0) as markup,
        COALESCE(SUM(allocated_penalty_paise), 0) as penalty
      FROM transactions
      WHERE operation_id = 'op-seq3-p3' OR operation_id LIKE 'realloc-op-seq3-p3%'
    `);
    expect(p3NetBeforeRej3?.penalty).toBe(100);
    expect(p3NetBeforeRej3?.markup).toBe(0);
    expect(p3NetBeforeRej3?.principal).toBe(0);

    // P2 has 0 net in ledger
    const p2Net = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_markup_paise), 0) as markup,
        COALESCE(SUM(allocated_penalty_paise), 0) as penalty
      FROM transactions
      WHERE operation_id = 'op-seq3-p2' OR operation_id = 'reversal-op-seq3-p2' OR operation_id LIKE 'realloc-op-seq3-p2%'
    `);
    expect(p2Net?.markup).toBe(0);
    expect(p2Net?.penalty).toBe(0);

    // Reject P3: All 3 payments are now rejected
    await SyncService.revertRejectedPayment(db, 'op-seq3-p3', 'Reject 3');

    // P3 has 0 net in ledger
    const p3Net = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as principal,
        COALESCE(SUM(allocated_penalty_paise), 0) as penalty
      FROM transactions
      WHERE operation_id = 'op-seq3-p3' OR operation_id = 'reversal-op-seq3-p3' OR operation_id LIKE 'realloc-op-seq3-p3%'
    `);
    expect(p3Net?.principal).toBe(0);
    expect(p3Net?.penalty).toBe(0);

    // Schedule has 0 paid
    const kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-seq3-1'`);
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

  it('updates local SETTLED loan to server ACTIVE state upon pulling authoritative server changes', async () => {
    const db = createRealSqliteDb();
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-sync-active', 'Borrower Active', '9876543218', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-sync-active', 'b-sync-active', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'SETTLED', '2026-01-01')`);

    // Server sends authoritative LOAN update indicating status is ACTIVE (e.g. server-assessed penalties)
    await SyncService.applyServerChange(db, {
      record_type: 'LOAN',
      operation_type: 'UPDATE',
      payload: { id: 'loan-sync-active', status: 'ACTIVE' }
    });

    const loan = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-sync-active'`);
    expect(loan?.status).toBe('ACTIVE');
  });

  it('isolates database filenames by tenant ID ensuring multi-tenant data separation', async () => {
    const nameA = await getDatabaseName('tenant-111');
    const nameB = await getDatabaseName('tenant-222');
    const nameDefault = await getDatabaseName(null);

    expect(nameA).toBe('credkeep_tenant-111.db');
    expect(nameB).toBe('credkeep_tenant-222.db');
    expect(nameDefault).toBe('credkeep.db');
    expect(nameA).not.toBe(nameB);
  });

  it('correctly reconciles authoritative server confirmation following local reallocation without double-crediting', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-rec-confirm', 'Borrower Rec Confirm', '9876543219', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-rec-confirm', 'b-rec-confirm', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rec-1', 'loan-rec-confirm', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 100 paise penalty assessed
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
      VALUES ('tx-rec-pen', 'op-rec-pen', 'loan-rec-confirm', 'PENALTY_ASSESSMENT', 100, '2026-01-02', '2026-01-02')
    `);

    // P1 (100 paise) originally allocated to penalty (100 paise)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-rec-p1', 'op-rec-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-rec-confirm', amount_paise: 100, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-rec-p1', 'op-rec-p1', 'loan-rec-confirm', 'COLLECTION', 100, 0, 0, 100, '2026-01-02', '2026-01-02')
    `);

    // P2 (100 paise) originally allocated to principal (100 paise)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-rec-p2', 'op-rec-p2', 'record_collection', '${JSON.stringify({ loan_id: 'loan-rec-confirm', amount_paise: 100, effective_date: '2026-01-03' })}', 'PENDING', '2026-01-03T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-rec-p2', 'op-rec-p2', 'loan-rec-confirm', 'COLLECTION', 100, 100, 0, 0, '2026-01-03', '2026-01-03')
    `);

    // Revert P1 locally: P2 reallocates locally to penalty (100 penalty, 0 principal) via append-only realloc delta
    await SyncService.revertRejectedPayment(db, 'op-rec-p1', 'Payment 1 Rejected');

    // Confirm that locally P2 has an append-only realloc delta (+100 penalty, -100 principal)
    const reallocTx = await db.getFirstAsync<any>(`
      SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-rec-p2-%'
    `);
    expect(reallocTx).not.toBeNull();
    expect(reallocTx?.allocated_penalty_paise).toBe(100);
    expect(reallocTx?.allocated_principal_paise).toBe(-100);

    // Now server sends authoritative confirmation for P2 where server allocated 100 to penalty and 0 to markup
    await SyncService.applyServerChange(db, {
      record_type: 'TRANSACTION',
      operation_type: 'INSERT',
      payload: {
        id: 'tx-server-p2',
        operation_id: 'op-rec-p2',
        loan_id: 'loan-rec-confirm',
        transaction_type: 'COLLECTION',
        amount_paise: 100,
        allocated_principal_paise: 0,
        allocated_markup_paise: 0,
        allocated_penalty_paise: 100,
        unallocated_surplus_paise: 0,
        forgiven_penalty_paise: 0,
        effective_date: '2026-01-02',
        created_at: '2026-01-02T10:05:00Z'
      }
    });

    // Check complete net allocation for P2 across the ledger
    const p2Net = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(amount_paise), 0) as netAmount,
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty
      FROM transactions
      WHERE loan_id = 'loan-rec-confirm'
        AND (
          operation_id = 'op-rec-p2'
          OR operation_id LIKE 'realloc-op-rec-p2-%'
          OR operation_id LIKE 'reconcile-op-rec-p2-%'
        )
    `);

    expect(p2Net?.netAmount).toBe(100);
    expect(p2Net?.netPrincipal).toBe(0);
    expect(p2Net?.netMarkup).toBe(0);
    expect(p2Net?.netPenalty).toBe(100);
  });

  it('strictly isolates cross-loan operations with prefix-colliding IDs op-1 and op-10', async () => {
    const db = createRealSqliteDb();

    // Loan A
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-iso-a', 'Borrower Iso A', '9876543220', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-iso-a', 'b-iso-a', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-iso-a1', 'loan-iso-a', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 500, 'PENDING', 0, 0, 'PENDING')`);

    // Loan B
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-iso-b', 'Borrower Iso B', '9876543221', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-iso-b', 'b-iso-b', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-iso-b1', 'loan-iso-b', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 1000, 'PENDING', 0, 0, 'PENDING')`);

    // Loan A has collection op-1
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-iso-1', 'op-1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-iso-a', amount_paise: 500, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-iso-1', 'op-1', 'loan-iso-a', 'COLLECTION', 500, 0, 500, '2026-01-02', '2026-01-02')
    `);

    // Loan B has collection op-10 and a realloc row realloc-op-10-abc
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-iso-10', 'op-10', 'record_collection', '${JSON.stringify({ loan_id: 'loan-iso-b', amount_paise: 1000, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T10:05:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-iso-10', 'op-10', 'loan-iso-b', 'COLLECTION', 1000, 0, 1000, '2026-01-02', '2026-01-02')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-iso-realloc-10', 'realloc-op-10-abc', 'loan-iso-b', 'REVERSAL', 0, 500, -500, '2026-01-02', '2026-01-02')
    `);

    // Now revert op-1 on Loan A
    await SyncService.revertRejectedPayment(db, 'op-1', 'Rejected op-1');

    // Loan A reversal should be exactly -500 markup (reversing op-1)
    const revA = await db.getFirstAsync<any>(`
      SELECT * FROM transactions WHERE operation_id = 'reversal-op-1'
    `);
    expect(revA).not.toBeNull();
    expect(revA?.amount_paise).toBe(-500);
    expect(revA?.allocated_markup_paise).toBe(-500);
    expect(revA?.allocated_principal_paise).toBe(0);

    // Loan B's op-10 transactions and reallocations must be 100% untouched!
    const loanBTxs = await db.getAllAsync<any>(`
      SELECT * FROM transactions WHERE loan_id = 'loan-iso-b' ORDER BY created_at ASC
    `);
    expect(loanBTxs.length).toBe(2);
    expect(loanBTxs.some((t) => t.operation_id === 'reversal-op-1')).toBe(false);

    // Verify Loan B's net allocations remain strictly untouched
    const loanBNet = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(amount_paise), 0) as amount,
        COALESCE(SUM(allocated_principal_paise), 0) as principal,
        COALESCE(SUM(allocated_markup_paise), 0) as markup,
        COALESCE(SUM(allocated_penalty_paise), 0) as penalty
      FROM transactions
      WHERE loan_id = 'loan-iso-b'
    `);
    expect(loanBNet?.amount).toBe(1000);
    expect(loanBNet?.principal).toBe(500);
    expect(loanBNet?.markup).toBe(500);
    expect(loanBNet?.penalty).toBe(0);

    // Verify Loan B's repayment schedule is untouched
    const loanBKist = await db.getFirstAsync<any>(`
      SELECT * FROM repayment_schedules WHERE id = 'kist-iso-b1'
    `);
    expect(loanBKist?.markup_paid_paise).toBe(1000);
    expect(loanBKist?.principal_paid_paise).toBe(0);

    // Verify Loan B's status is untouched
    const loanB = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-iso-b'`);
    expect(loanB?.status).toBe('ACTIVE');
  });

  it('appends compensating allocation deltas during pending replay to guarantee strict ledger and schedule agreement', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-replay-agree', 'Borrower Replay Agree', '9876543222', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-replay-agree', 'b-replay-agree', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    // Initially kist is future due on 2026-02-01
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-agree-1', 'loan-replay-agree', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Offline payment P1 (1000 paise) made on 2026-01-15: because kist was not due, it originally allocated to principal (1000) and markup (0)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-agree-p1', 'op-agree-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-replay-agree', amount_paise: 1000, effective_date: '2026-01-15' })}', 'PENDING', '2026-01-15T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-agree-p1', 'op-agree-p1', 'loan-replay-agree', 'COLLECTION', 1000, 1000, 0, 0, '2026-01-15', '2026-01-15')
    `);

    // Now authoritative server update modifies schedule: kist effective_due_date is revised to 2026-01-10 (due now!)
    await db.runAsync(`
      UPDATE repayment_schedules SET
        effective_due_date = '2026-01-10',
        server_principal_paid_paise = 0,
        server_markup_paid_paise = 0,
        server_status = 'PENDING'
      WHERE id = 'kist-agree-1'
    `);

    // Reapply pending collections against the new server schedule
    await SyncService.reapplyPendingCollections(db, 'loan-replay-agree');

    // Compensating realloc delta MUST be appended in transactions ledger
    const reallocTx = await db.getFirstAsync<any>(`
      SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-agree-p1-%'
    `);
    expect(reallocTx).not.toBeNull();
    // Reallocation shifted 1000 paise from principal to markup!
    expect(reallocTx?.allocated_principal_paise).toBe(-1000);
    expect(reallocTx?.allocated_markup_paise).toBe(1000);

    // Verify net ledger totals match repayment schedule paid amounts exactly!
    const netLedger = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup
      FROM transactions
      WHERE loan_id = 'loan-replay-agree'
        AND (operation_id = 'op-agree-p1' OR operation_id LIKE 'realloc-op-agree-p1-%')
    `);
    const schedule = await db.getFirstAsync<any>(`
      SELECT principal_paid_paise, markup_paid_paise FROM repayment_schedules WHERE id = 'kist-agree-1'
    `);

    expect(netLedger?.netPrincipal).toBe(schedule?.principal_paid_paise);
    expect(netLedger?.netMarkup).toBe(schedule?.markup_paid_paise);
    expect(netLedger?.netPrincipal).toBe(0);
    expect(netLedger?.netMarkup).toBe(1000);

    // Repeated replays MUST produce zero additional adjustments and keep schedules unchanged
    await SyncService.reapplyPendingCollections(db, 'loan-replay-agree');
    await SyncService.reapplyPendingCollections(db, 'loan-replay-agree');

    const totalAdjCount = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM transactions WHERE operation_id LIKE 'realloc-op-agree-p1-%'
    `);
    expect(totalAdjCount?.count).toBe(1);
  });

  it('repeated pending replay with overdue penalties preserves invariant ledger totals, schedules, settlement status, and adjustment count', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-pen-repeat', 'Borrower Pen Repeat', '9876543111', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-pen-repeat', 'b-pen-repeat', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    // Due on 2026-01-01
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-pen-1', 'loan-pen-repeat', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 200 paise of overdue penalties assessed on the loan
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-pen-assess-1', 'op-pen-assess-1', 'loan-pen-repeat', 'PENALTY_ASSESSMENT', 200, 0, 0, 0, '2026-01-02', '2026-01-02')
    `);

    // Offline pending payment P1 (1000 paise) made on 2026-01-05
    // Initially allocated before penalty assessment was known locally: 900 principal, 100 markup, 0 penalty
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-pen-p1', 'op-pen-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-pen-repeat', amount_paise: 1000, effective_date: '2026-01-05' })}', 'PENDING', '2026-01-05T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-pen-p1', 'op-pen-p1', 'loan-pen-repeat', 'COLLECTION', 1000, 900, 100, 0, '2026-01-05', '2026-01-05')
    `);

    // 1st Replay: shifts funds into penalty (due kist principal/markup paid, plus 200 penalty)
    await SyncService.reapplyPendingCollections(db, 'loan-pen-repeat');

    // Snapshot state after 1st replay
    const adjCount1 = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM transactions WHERE operation_id LIKE 'realloc-op-pen-p1-%'
    `);
    expect(adjCount1?.count).toBe(1);

    const ledgerTotals1 = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty
      FROM transactions WHERE loan_id = 'loan-pen-repeat'
        AND transaction_type IN ('COLLECTION', 'REVERSAL')
    `);
    const schedule1 = await db.getFirstAsync<any>(`
      SELECT principal_paid_paise, markup_paid_paise, status FROM repayment_schedules WHERE id = 'kist-pen-1'
    `);
    const loan1 = await db.getFirstAsync<any>(`
      SELECT status FROM loans WHERE id = 'loan-pen-repeat'
    `);

    // 2nd Replay: MUST NOT change allocations or create duplicate realloc adjustments!
    await SyncService.reapplyPendingCollections(db, 'loan-pen-repeat');

    // 3rd Replay: MUST NOT change allocations or create duplicate realloc adjustments!
    await SyncService.reapplyPendingCollections(db, 'loan-pen-repeat');

    const adjCountAfter = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM transactions WHERE operation_id LIKE 'realloc-op-pen-p1-%'
    `);
    const ledgerTotalsAfter = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty
      FROM transactions WHERE loan_id = 'loan-pen-repeat'
        AND transaction_type IN ('COLLECTION', 'REVERSAL')
    `);
    const scheduleAfter = await db.getFirstAsync<any>(`
      SELECT principal_paid_paise, markup_paid_paise, status FROM repayment_schedules WHERE id = 'kist-pen-1'
    `);
    const loanAfter = await db.getFirstAsync<any>(`
      SELECT status FROM loans WHERE id = 'loan-pen-repeat'
    `);

    // Strict invariant checks after repeated replays:
    expect(adjCountAfter?.count).toBe(adjCount1?.count);
    expect(adjCountAfter?.count).toBe(1);
    expect(ledgerTotalsAfter?.netPrincipal).toBe(ledgerTotals1?.netPrincipal);
    expect(ledgerTotalsAfter?.netMarkup).toBe(ledgerTotals1?.netMarkup);
    expect(ledgerTotalsAfter?.netPenalty).toBe(ledgerTotals1?.netPenalty);
    expect(scheduleAfter?.principal_paid_paise).toBe(schedule1?.principal_paid_paise);
    expect(scheduleAfter?.markup_paid_paise).toBe(schedule1?.markup_paid_paise);
    expect(scheduleAfter?.status).toBe(schedule1?.status);
    expect(loanAfter?.status).toBe(loan1?.status);
  });

  it('repeated pending replay for bullet loans preserves invariant ledger totals, schedules, settlement status, and adjustment count', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-bullet-repeat', 'Borrower Bullet Repeat', '9876543000', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-bullet-repeat', 'b-bullet-repeat', 500000, 0.1, 1, '2026-01-01', 1, 'bullet', 'ACTIVE', '2026-01-01')`);
    // Bullet loan: 1 kist for markup only (50000 paise)
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-bullet-1', 'loan-bullet-repeat', 1, '2026-01-01', '2026-01-01', 0, 50000, 50000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Offline payment P1 (550000 paise): pays full markup (50000) + full principal (500000)
    // Initially recorded with mismatched allocations (e.g. 550000 surplus, 0 principal) before schedule replay
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-bullet-p1', 'op-bullet-p1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-bullet-repeat', amount_paise: 550000, effective_date: '2026-01-01' })}', 'PENDING', '2026-01-01T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-bullet-p1', 'op-bullet-p1', 'loan-bullet-repeat', 'COLLECTION', 550000, 0, 50000, 0, 500000, '2026-01-01', '2026-01-01')
    `);

    // 1st Replay: shifts 500000 from surplus to bullet principal, settles loan!
    await SyncService.reapplyPendingCollections(db, 'loan-bullet-repeat');

    // Snapshot state after 1st replay
    const adjCount1 = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM transactions WHERE operation_id LIKE 'realloc-op-bullet-p1-%'
    `);
    expect(adjCount1?.count).toBe(1);

    const ledgerTotals1 = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
      FROM transactions WHERE loan_id = 'loan-bullet-repeat'
        AND transaction_type IN ('COLLECTION', 'REVERSAL')
    `);
    const schedule1 = await db.getFirstAsync<any>(`
      SELECT principal_paid_paise, markup_paid_paise, status FROM repayment_schedules WHERE id = 'kist-bullet-1'
    `);
    const loan1 = await db.getFirstAsync<any>(`
      SELECT status FROM loans WHERE id = 'loan-bullet-repeat'
    `);
    expect(loan1?.status).toBe('SETTLED');
    expect(schedule1?.status).toBe('PAID');
    expect(ledgerTotals1?.netPrincipal).toBe(500000);
    expect(ledgerTotals1?.netMarkup).toBe(50000);
    expect(ledgerTotals1?.netSurplus).toBe(0);

    // 2nd Replay: MUST NOT change allocations or create duplicate realloc adjustments!
    await SyncService.reapplyPendingCollections(db, 'loan-bullet-repeat');

    // 3rd Replay: MUST NOT change allocations or create duplicate realloc adjustments!
    await SyncService.reapplyPendingCollections(db, 'loan-bullet-repeat');

    const adjCountAfter = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM transactions WHERE operation_id LIKE 'realloc-op-bullet-p1-%'
    `);
    const ledgerTotalsAfter = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
      FROM transactions WHERE loan_id = 'loan-bullet-repeat'
        AND transaction_type IN ('COLLECTION', 'REVERSAL')
    `);
    const scheduleAfter = await db.getFirstAsync<any>(`
      SELECT principal_paid_paise, markup_paid_paise, status FROM repayment_schedules WHERE id = 'kist-bullet-1'
    `);
    const loanAfter = await db.getFirstAsync<any>(`
      SELECT status FROM loans WHERE id = 'loan-bullet-repeat'
    `);

    // Strict invariant checks after repeated replays:
    expect(adjCountAfter?.count).toBe(1);
    expect(ledgerTotalsAfter?.netPrincipal).toBe(500000);
    expect(ledgerTotalsAfter?.netMarkup).toBe(50000);
    expect(ledgerTotalsAfter?.netSurplus).toBe(0);
    expect(scheduleAfter?.status).toBe('PAID');
    expect(loanAfter?.status).toBe('SETTLED');
  });

  it('real SQLite idempotency conflict rejects reused operation_id for different loan or payment amount', async () => {
    const db = createRealSqliteDb();
    const repo = new TransactionRepository(db);

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-idem-real', 'Idem Borrower', '9876543888', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-idem-a', 'b-idem-real', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-idem-b', 'b-idem-real', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-idem-a', 'loan-idem-a', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-idem-b', 'loan-idem-b', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 1. Record payment on Loan A
    const resA = await repo.recordCashPayment('loan-idem-a', toPaise(5000), 'op-idem-real-1', '2026-01-01');
    expect(resA.success).toBe(true);

    // 2. Identical retry on Loan A succeeds idempotently
    const retryA = await repo.recordCashPayment('loan-idem-a', toPaise(5000), 'op-idem-real-1', '2026-01-01');
    expect(retryA.success).toBe(true);

    // 3. Reusing op-idem-real-1 for Loan B MUST throw and reject
    await expect(repo.recordCashPayment('loan-idem-b', toPaise(5000), 'op-idem-real-1', '2026-01-01'))
      .rejects.toThrow(/Idempotency conflict/);

    // Loan B has zero transactions recorded
    const txB = await db.getAllAsync(`SELECT * FROM transactions WHERE loan_id = 'loan-idem-b'`);
    expect(txB.length).toBe(0);

    // 4. Reusing op-idem-real-1 with different amount on Loan A MUST throw and reject
    await expect(repo.recordCashPayment('loan-idem-a', toPaise(6000), 'op-idem-real-1', '2026-01-01'))
      .rejects.toThrow(/Idempotency conflict/);
  });

  it('pulling a server TRANSACTION delta triggers pending collection replay and delta reconciliation', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-pull-tx', 'Pull TX Borrower', '9876543777', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-pull-tx', 'b-pull-tx', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-pull-tx-1', 'loan-pull-tx', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Offline pending payment P1 (1000 paise) made locally on 2026-01-05 (before due date: allocated to future principal)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-ptx-1', 'op-ptx-1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-pull-tx', amount_paise: 1000, effective_date: '2026-01-05' })}', 'PENDING', '2026-01-05T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-ptx-1', 'op-ptx-1', 'loan-pull-tx', 'COLLECTION', 1000, 1000, 0, 0, '2026-01-05', '2026-01-05')
    `);

    // Server sends a PENALTY_ASSESSMENT TRANSACTION change (200 paise assessed on 2026-01-02)
    const modifiedLoans = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'TRANSACTION',
      operation_type: 'INSERT',
      payload: {
        id: 'tx-serv-pen-1',
        operation_id: 'op-serv-pen-1',
        loan_id: 'loan-pull-tx',
        transaction_type: 'PENALTY_ASSESSMENT',
        amount_paise: 200,
        effective_date: '2026-01-02'
      }
    }, modifiedLoans);

    // Verify modifiedLoans set recorded the loan ID from the TRANSACTION change
    expect(modifiedLoans.has('loan-pull-tx')).toBe(true);

    // Reapply pending collections for modified loan
    for (const loanId of modifiedLoans) {
      await SyncService.reapplyPendingCollections(db, loanId);
    }

    // Pending collection must have reallocated funds to satisfy the 200 penalty
    const reallocTx = await db.getFirstAsync<any>(`
      SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-ptx-1-%'
    `);
    expect(reallocTx).not.toBeNull();
    expect(reallocTx?.allocated_penalty_paise).toBe(200);
  });

  it('switches database filenames and isolates storage across tenant auth changes', async () => {
    // 1. Initial tenant
    await AuthStore.setAuth({
      token: 'tok-1',
      user: { id: 1, username: 'user1' },
      tenant: { id: 'tenant_alpha', name: 'Alpha Workspace' }
    });
    expect(await getDatabaseName()).toBe('credkeep_tenant_alpha.db');

    // 2. Switch tenant on new login
    let notifiedTenant: string | null = null;
    const unsub = AuthStore.onAuthChange((tId: string | null) => {
      notifiedTenant = tId;
    });

    await AuthStore.setAuth({
      token: 'tok-2',
      user: { id: 2, username: 'user2' },
      tenant: { id: 'tenant_beta', name: 'Beta Workspace' }
    });
    expect(notifiedTenant).toBe('tenant_beta');
    expect(await getDatabaseName()).toBe('credkeep_tenant_beta.db');

    // 3. Clear auth on logout
    await AuthStore.clearAuth();
    expect(notifiedTenant).toBeNull();
    expect(await getDatabaseName()).toBe('credkeep.db');

    unsub();
  });

  it('pulling a server REVERSAL penalty waiver delta triggers pending collection replay', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-pull-waiver', 'Pull Waiver Borrower', '9876543666', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-pull-waiver', 'b-pull-waiver', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-pw-1', 'loan-pull-waiver', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Prior penalty assessment: 300 paise assessed
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-pw-pen', 'op-pw-pen', 'loan-pull-waiver', 'PENALTY_ASSESSMENT', 300, 0, 0, 0, '2026-01-02', '2026-01-02')
    `);

    // Offline pending payment P1 (1000 paise) made locally on 2026-01-05 (which initially paid 300 to penalty, 700 to markup)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-pw-1', 'op-pw-1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-pull-waiver', amount_paise: 1000, effective_date: '2026-01-05' })}', 'PENDING', '2026-01-05T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, effective_date, created_at)
      VALUES ('tx-pw-1', 'op-pw-1', 'loan-pull-waiver', 'COLLECTION', 1000, 0, 700, 300, '2026-01-05', '2026-01-05')
    `);

    // Server sends a REVERSAL waiver delta (forgives all 300 paise of penalty)
    const modifiedLoans = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'TRANSACTION',
      operation_type: 'INSERT',
      payload: {
        id: 'tx-serv-waiver-1',
        operation_id: 'op-serv-waiver-1',
        loan_id: 'loan-pull-waiver',
        transaction_type: 'REVERSAL',
        amount_paise: 0,
        forgiven_penalty_paise: 300,
        effective_date: '2026-01-03'
      }
    }, modifiedLoans);

    // Verify modifiedLoans set recorded the loan ID from the REVERSAL waiver change
    expect(modifiedLoans.has('loan-pull-waiver')).toBe(true);

    // Reapply pending collections for modified loan
    for (const loanId of modifiedLoans) {
      await SyncService.reapplyPendingCollections(db, loanId);
    }

    // Pending collection must have reallocated the 300 funds away from penalty to markup
    const reallocTx = await db.getFirstAsync<any>(`
      SELECT * FROM transactions WHERE operation_id LIKE 'realloc-op-pw-1-%'
    `);
    expect(reallocTx).not.toBeNull();
    // Delta should reduce penalty by 300 (-300) and increase markup by 300 (+300)
    expect(reallocTx?.allocated_penalty_paise).toBe(-300);
    expect(reallocTx?.allocated_markup_paise).toBe(300);
    expect(reallocTx?.allocated_principal_paise).toBe(0);
  });

  it('retrying a locally rejected payment with same operation_id throws error and rejects retry', async () => {
    const db = createRealSqliteDb();
    const repo = new TransactionRepository(db);

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-rej-retry', 'Rej Retry Borrower', '9876543555', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-rej-retry', 'b-rej-retry', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rej-1', 'loan-rej-retry', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // 1. Record original cash payment
    const opId = 'op-rejected-payment-1';
    const res = await repo.recordCashPayment('loan-rej-retry', toPaise(5000), opId, '2026-01-01');
    expect(res.success).toBe(true);

    // 2. Server rejects the payment, mobile triggers compensation
    await SyncService.revertRejectedPayment(db, opId, 'Server validation failed: loan settled');

    // Verify outbox status is REJECTED
    const outbox = await db.getFirstAsync<any>(`SELECT status FROM sync_outbox WHERE operation_id = ?`, [opId]);
    expect(outbox?.status).toBe('REJECTED');

    // 3. Client retries recording payment with same operation_id -> MUST throw error!
    await expect(repo.recordCashPayment('loan-rej-retry', toPaise(5000), opId, '2026-01-01'))
      .rejects.toThrow(/Payment operation op-rejected-payment-1 was rejected/);
  });

  it('strictly isolates cross-loan adjustments with hyphen-prefixed operation IDs and prevents improper exclusion', async () => {
    const db = createRealSqliteDb();

    // Loan A
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-hyphen-a', 'Borrower Hyphen A', '9876543111', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-hyphen-a', 'b-hyphen-a', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-ha-1', 'loan-hyphen-a', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Loan B
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-hyphen-b', 'Borrower Hyphen B', '9876543112', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-hyphen-b', 'b-hyphen-b', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-hb-1', 'loan-hyphen-b', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Loan A has rejected collection with operation_id 'op-1'
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-ha-1', 'op-1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-hyphen-a', amount_paise: 500, effective_date: '2026-01-02' })}', 'REJECTED', '2026-01-02T10:00:00Z')
    `);

    // Loan B has a penalty assessment of 500 paise
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-hb-pen', 'pen-b-1', 'loan-hyphen-b', 'PENALTY_ASSESSMENT', 500, 0, 0, 0, 0, '2026-01-01', '2026-01-01')
    `);

    // Loan B has a legitimate adjustment transaction whose operation_id starts with 'realloc-op-1-child-uuid'
    // that satisfied Loan B's 500 paise penalty (conserving total allocations: -500 markup + 500 penalty = 0 amount)
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-hb-child', 'realloc-op-1-child-uuid', 'loan-hyphen-b', 'REVERSAL', 0, 0, -500, 500, 0, '2026-01-01', '2026-01-01')
    `);

    // Record cash payment on Loan B
    const repo = new TransactionRepository(db);
    const resB = await repo.recordCashPayment('loan-hyphen-b', 1000 as Paise, 'op-new-pay-b', '2026-01-02');
    expect(resB.success).toBe(true);

    // Verify exact allocation: because tx-hb-child was NOT excluded by Loan A's rejected op-1,
    // Loan B's penalty remains 0. The 1000 payment allocates 0 to penalty, 1000 to markup, 0 to principal, 0 to surplus.
    const newTx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-new-pay-b'`);
    expect(newTx.allocated_penalty_paise).toBe(0);
    expect(newTx.allocated_markup_paise).toBe(1000);
    expect(newTx.allocated_principal_paise).toBe(0);
    expect(newTx.unallocated_surplus_paise).toBe(0);

    // Also test replay logic: pending collection on Loan B
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-hb-pending', 'op-hb-pending', 'record_collection', '${JSON.stringify({ loan_id: 'loan-hyphen-b', amount_paise: 500, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T11:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-hb-pending', 'op-hb-pending', 'loan-hyphen-b', 'COLLECTION', 500, 0, 500, 0, 0, '2026-01-02', '2026-01-02')
    `);

    await SyncService.reapplyPendingCollections(db, 'loan-hyphen-b');
    const netAllocRow = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(amount_paise), 0) as netAmount,
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
        COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
      FROM transactions
      WHERE loan_id = 'loan-hyphen-b'
        AND (
          operation_id = 'op-hb-pending'
          OR instr(operation_id, 'realloc-op-hb-pending-') = 1
          OR instr(operation_id, 'realloc::op-hb-pending::') = 1
        )
    `);
    expect(netAllocRow.netPenalty).toBe(0);
    expect(netAllocRow.netMarkup).toBe(500);
    expect(netAllocRow.netPrincipal).toBe(0);
    expect(netAllocRow.netSurplus).toBe(0);
    expect(netAllocRow.netAmount).toBe(500);

    const scheduleB = await db.getFirstAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = 'loan-hyphen-b' AND installment_number = 1`
    );
    expect(scheduleB.markup_paid_paise).toBe(1500);
    expect(scheduleB.principal_paid_paise).toBe(0);

    const loanATxCount = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as count FROM transactions WHERE loan_id = 'loan-hyphen-a'`
    );
    expect(loanATxCount.count).toBe(0);
  });

  it('strictly prevents LIKE wildcard characters in outbox operation IDs from colliding across loans', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-wild-a', 'Borrower Wild A', '9876543113', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-wild-a', 'b-wild-a', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-wild-b', 'b-wild-a', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-wa-1', 'loan-wild-a', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-wb-1', 'loan-wild-b', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Loan A has rejected outbox operation with underscore wildcard: 'op_1'
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-wa-1', 'op_1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-wild-a', amount_paise: 300, effective_date: '2026-01-02' })}', 'REJECTED', '2026-01-02T10:00:00Z')
    `);

    // Loan B has a penalty assessment of 300 paise
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-wb-pen', 'pen-wild-b-1', 'loan-wild-b', 'PENALTY_ASSESSMENT', 300, 0, 0, 0, 0, '2026-01-01', '2026-01-01')
    `);

    // Loan B has an existing collection with 'op-1' and a legitimate realloc adjustment 'realloc-op-1-xyz' that satisfied the 300 penalty
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-wb-1', 'op-1', 'loan-wild-b', 'COLLECTION', 1000, 0, 1000, 0, 0, '2026-01-01', '2026-01-01')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-wb-realloc', 'realloc-op-1-xyz', 'loan-wild-b', 'REVERSAL', 0, 0, -300, 300, 0, '2026-01-01', '2026-01-01')
    `);

    // Pending collection in outbox for Loan B
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-wb-pending', 'op-wb-pending', 'record_collection', '${JSON.stringify({ loan_id: 'loan-wild-b', amount_paise: 1000, effective_date: '2026-01-02' })}', 'PENDING', '2026-01-02T11:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at)
      VALUES ('tx-wb-pending', 'op-wb-pending', 'loan-wild-b', 'COLLECTION', 1000, 0, 1000, 0, 0, '2026-01-02', '2026-01-02')
    `);

    // Replay pending collections for Loan B: Loan A's 'op_1' MUST NOT exclude Loan B's 'op-1' or 'realloc-op-1-xyz'
    await SyncService.reapplyPendingCollections(db, 'loan-wild-b');
    const netAllocRowWild = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(amount_paise), 0) as netAmount,
        COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
        COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
        COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
      FROM transactions
      WHERE loan_id = 'loan-wild-b'
        AND (
          operation_id = 'op-wb-pending'
          OR instr(operation_id, 'realloc-op-wb-pending-') = 1
          OR instr(operation_id, 'realloc::op-wb-pending::') = 1
        )
    `);
    expect(netAllocRowWild.netPenalty).toBe(0);
    expect(netAllocRowWild.netMarkup).toBe(1000);
    expect(netAllocRowWild.netPrincipal).toBe(0);
    expect(netAllocRowWild.netSurplus).toBe(0);
    expect(netAllocRowWild.netAmount).toBe(1000);

    const scheduleWildB = await db.getFirstAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = 'loan-wild-b' AND installment_number = 1`
    );
    expect(scheduleWildB.markup_paid_paise).toBe(1000);
    expect(scheduleWildB.principal_paid_paise).toBe(0);

    const loanWildATxCount = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as count FROM transactions WHERE loan_id = 'loan-wild-a'`
    );
    expect(loanWildATxCount.count).toBe(0);

    // Record cash payment on Loan B and verify exact allocations
    const repo = new TransactionRepository(db);
    const res = await repo.recordCashPayment('loan-wild-b', 500 as Paise, 'op-wild-cash-b', '2026-01-02');
    expect(res.success).toBe(true);

    const cashTx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-wild-cash-b'`);
    expect(cashTx.allocated_penalty_paise).toBe(0);
    expect(cashTx.allocated_markup_paise).toBe(500);
    expect(cashTx.allocated_principal_paise).toBe(0);
    expect(cashTx.unallocated_surplus_paise).toBe(0);
  });

  it('pulling changes or replaying pending collections on a WRITTEN_OFF loan preserves authoritative terminal status', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-woff', 'Borrower Written Off', '9876543114', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-woff', 'b-woff', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'WRITTEN_OFF', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-woff-1', 'loan-woff', 1, '2026-01-01', '2026-01-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Server sends a penalty assessment delta
    const modifiedLoans = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'TRANSACTION',
      operation_type: 'INSERT',
      payload: {
        id: 'tx-woff-pen',
        operation_id: 'op-woff-pen',
        loan_id: 'loan-woff',
        transaction_type: 'PENALTY_ASSESSMENT',
        amount_paise: 500,
        effective_date: '2026-01-02'
      }
    }, modifiedLoans);

    // Replay pending collections for modified loan
    for (const lId of modifiedLoans) {
      await SyncService.reapplyPendingCollections(db, lId);
    }

    // Verify loan status remains WRITTEN_OFF and was not reset to ACTIVE or SETTLED
    const loan = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-woff'`);
    expect(loan?.status).toBe('WRITTEN_OFF');
  });

  it('discarding a NEEDS_REVIEW collection atomically reverses the transaction and restores repayment schedules to zero', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-disc', 'Discard Borrower', '9876543115', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-disc', 'b-disc', 1000, 0.0, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-disc-1', 'loan-disc', 1, '2026-01-01', '2026-01-01', 1000, 0, 1000, 0, 0, 'PENDING')`);

    // Record a 500-paise cash payment
    const repo = new TransactionRepository(db);
    const opId = 'op-disc-500';
    await repo.recordCashPayment('loan-disc', 500 as Paise, opId, '2026-01-02');

    // Verify 500 paise is recorded in schedule and transaction
    let kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-disc-1'`);
    expect(kist.principal_paid_paise).toBe(500);

    // Mark enqueued outbox item as NEEDS_REVIEW
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'NEEDS_REVIEW' WHERE operation_id = ?`,
      [opId]
    );

    // User or conflict handler chooses DISCARD
    await OutboxManager.resolveNeedsReview(db, opId, 'DISCARD');

    // 1. Verify outbox status is REJECTED
    const ob = await db.getFirstAsync<any>(`SELECT * FROM sync_outbox WHERE operation_id = ?`, [opId]);
    expect(ob.status).toBe('REJECTED');

    // 2. Verify compensating REVERSAL transaction was created
    const reversalTx = await db.getFirstAsync<any>(
      `SELECT * FROM transactions WHERE operation_id = ?`,
      [`reversal-${opId}`]
    );
    expect(reversalTx).not.toBeNull();
    expect(reversalTx.transaction_type).toBe('REVERSAL');
    expect(reversalTx.amount_paise).toBe(-500);

    // 3. Verify net collection amount on loan is 0
    const netTx = await db.getFirstAsync<any>(
      `SELECT SUM(amount_paise) as totalAmount, SUM(allocated_principal_paise) as totalPrincipal FROM transactions WHERE loan_id = 'loan-disc' AND transaction_type IN ('COLLECTION', 'REVERSAL')`
    );
    expect(netTx.totalAmount).toBe(0);
    expect(netTx.totalPrincipal).toBe(0);

    // 4. Verify schedule paid amounts are restored to 0
    kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-disc-1'`);
    expect(kist.principal_paid_paise).toBe(0);
    expect(kist.status).toBe('PENDING');
  });

  it('pulling changes preserves schedule credit for unresolved NEEDS_REVIEW collections until resolution', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-rev', 'Borrower Review', '9876543118', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans VALUES ('loan-rev', 'b-rev', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`
      INSERT INTO repayment_schedules (
        id, loan_id, installment_number, original_due_date, effective_due_date,
        principal_component_paise, markup_component_paise, total_due_paise,
        principal_paid_paise, markup_paid_paise, status,
        server_principal_paid_paise, server_markup_paid_paise, server_status
      ) VALUES (
        'kist-rev-1', 'loan-rev', 1, '2026-01-01', '2026-01-01',
        100000, 10000, 110000, 0, 0, 'PENDING',
        0, 0, 'PENDING'
      )
    `);

    // Record cash payment of 10000 paise on due date (pays markup in full)
    const repo = new TransactionRepository(db);
    const payRes = await repo.recordCashPayment('loan-rev', 10000 as Paise, 'op-rev-pay-1', '2026-01-01');
    expect(payRes.success).toBe(true);

    // Verify schedule was credited initially
    let kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rev-1'`);
    expect(kist.markup_paid_paise).toBe(10000);

    // Simulate push receiving NEEDS_REVIEW conflict from server
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'NEEDS_REVIEW', error_message = 'Concurrent modification on server' WHERE operation_id = 'op-rev-pay-1'`
    );

    // Now a subsequent sync cycle pulls changes from server (e.g. server sends updated due date or penalty assessment)
    const modifiedLoans = new Set<string>();
    await SyncService.applyServerChange(
      db,
      {
        record_type: 'KIST',
        operation_type: 'UPDATE',
        payload: {
          id: 'kist-rev-1',
          loan_id: 'loan-rev',
          installment_number: 1,
          effective_due_date: '2026-01-15',
          server_principal_paid_paise: 0,
          server_markup_paid_paise: 0,
          server_status: 'PENDING',
        },
      },
      modifiedLoans
    );
    expect(modifiedLoans.has('loan-rev')).toBe(true);

    // Replay pending collections runs as part of pull
    await SyncService.reapplyPendingCollections(db, 'loan-rev');

    // CRITICAL: Schedule credit for the NEEDS_REVIEW collection MUST NOT be lost!
    kist = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rev-1'`);
    expect(kist.markup_paid_paise).toBe(10000);

    // Net ledger allocations across payment and adjustments remain 10000 paise
    const netAlloc = await db.getFirstAsync<any>(`
      SELECT
        COALESCE(SUM(amount_paise), 0) as netAmount,
        COALESCE(SUM(allocated_markup_paise), 0) as netMarkup
      FROM transactions
      WHERE loan_id = 'loan-rev'
        AND (
          operation_id = 'op-rev-pay-1'
          OR instr(operation_id, 'realloc-op-rev-pay-1-') = 1
        )
    `);
    expect(netAlloc.netAmount).toBe(10000);
    expect(netAlloc.netMarkup).toBe(10000);
  });

  it('partial migration retry resumes without duplicate primary key failures or orphaned records', async () => {
    const db = createRealSqliteDb();

    const borrowerId = '11111111-2222-3333-4444-555555555555';
    const loanId = '22222222-3333-4444-5555-666666666666';
    const txId = '33333333-4444-5555-6666-777777777777';
    const txOpId = '44444444-5555-6666-7777-888888888888';

    await db.runAsync(`INSERT INTO borrowers (id, name, phone, created_at) VALUES (?, 'Mig Borrower', '9876543116', '2026-01-01')`, [borrowerId]);
    await db.runAsync(`INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at) VALUES (?, ?, 1000, 0.0, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`, [loanId, borrowerId]);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-mig-1', ?, 1, '2026-01-01', '2026-01-01', 1000, 0, 1000, 0, 0, 'PENDING')`, [loanId]);
    await db.runAsync(`INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at) VALUES (?, ?, ?, 'COLLECTION', 1000, 1000, 0, 0, 0, '2026-01-02', '2026-01-02')`, [txId, txOpId, loanId]);

    // Extract V1 records and verify deterministic operation IDs
    const extracted = await V1DataExtractor.extract(db);
    const ops1 = V1DataExtractor.buildPushPayloads(extracted);
    const ops2 = V1DataExtractor.buildPushPayloads(extracted);
    expect(ops1[0].operation_id).toBe(ops2[0].operation_id);
    expect(ops1[1].operation_id).toBe(ops2[1].operation_id);
    expect(ops1[2].operation_id).toBe(ops2[2].operation_id);

    // Enqueue operations
    for (const op of ops1) {
      await OutboxManager.enqueue(db, {
        operationId: op.operation_id,
        operationType: op.type,
        payload: op.payload,
      });
    }

    // Simulate partial push: borrower and loan succeeded and are marked SYNCED
    await db.runAsync(`UPDATE sync_outbox SET status = 'SYNCED' WHERE operation_id = ?`, [ops1[0].operation_id]);
    await db.runAsync(`UPDATE sync_outbox SET status = 'SYNCED' WHERE operation_id = ?`, [ops1[1].operation_id]);

    // Transaction remains PENDING
    const pendingBefore = await OutboxManager.getPending(db);
    expect(pendingBefore.length).toBe(1);
    expect(pendingBefore[0].operation_id).toBe(ops1[2].operation_id);

    // Re-running retry re-enqueues idempotently without UNIQUE constraint errors
    // and correctly preserves existing SYNCED statuses
    for (const op of ops2) {
      await OutboxManager.enqueue(db, {
        operationId: op.operation_id,
        operationType: op.type,
        payload: op.payload,
      });
    }

    const borrowerOutbox = await db.getFirstAsync<any>(`SELECT status FROM sync_outbox WHERE operation_id = ?`, [ops1[0].operation_id]);
    expect(borrowerOutbox.status).toBe('SYNCED');

    const loanOutbox = await db.getFirstAsync<any>(`SELECT status FROM sync_outbox WHERE operation_id = ?`, [ops1[1].operation_id]);
    expect(loanOutbox.status).toBe('SYNCED');

    // Total outbox records count remains exactly 3 (no duplicate records created)
    const totalOutbox = await db.getFirstAsync<any>(`SELECT COUNT(*) as cnt FROM sync_outbox`);
    expect(totalOutbox.cnt).toBe(3);
  });
});
