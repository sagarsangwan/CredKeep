import { SQLiteDatabase } from 'expo-sqlite';
import { ApiClient } from '../core/api/client';
import { AuthService } from '../core/auth/authService';
import { AuthStore } from '../core/auth/authStore';
import { BorrowerRepository } from '../core/database/borrowerRepository';
import { LoanRepository } from '../core/database/loanRepository';
import { TransactionRepository } from '../core/database/transactionRepository';
import { SyncService } from '../core/sync/syncService';
import { toPaise } from '../core/domain/money';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
// @ts-ignore
const http = require('node:http');
// @ts-ignore
const { randomUUID } = require('node:crypto');
// @ts-ignore
const nodeBuffer = (globalThis as any).Buffer || require('node:buffer').Buffer;

jest.setTimeout(30000);

function nodeFetch(url: string, init?: RequestInit): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = init?.body
      ? typeof init.body === 'string'
        ? init.body
        : JSON.stringify(init.body)
      : undefined;

    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (bodyStr !== undefined) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(nodeBuffer.byteLength(bodyStr, 'utf-8'));
    }

    const options: any = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: init?.method || 'GET',
      headers,
    };

    const req = http.request(options, (res: any) => {
      const chunks: any[] = [];
      res.on('data', (c: any) => chunks.push(c));
      res.on('end', () => {
        const bodyText = nodeBuffer.concat(chunks).toString('utf-8');
        const responseObj: any = {
          ok: res.statusCode! >= 200 && res.statusCode! < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: {
            get: (name: string) => (res.headers[name.toLowerCase()] as string) || null,
          },
          text: async () => bodyText,
          json: async () => {
            try {
              return JSON.parse(bodyText);
            } catch {
              return bodyText;
            }
          },
        };
        resolve(responseObj);
      });
    });

    req.on('error', reject);
    if (bodyStr !== undefined) {
      req.write(bodyStr);
    }
    req.end();
  });
}

// In-memory SecureStore simulation
const secureStoreState: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => secureStoreState[key] || null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    secureStoreState[key] = val;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete secureStoreState[key];
  }),
}));

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
      collateral TEXT,
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
      const bound = params.map((p) => (p === undefined ? null : p));
      const stmt = sqlite.prepare(sql);
      stmt.run(...bound);
    },
    async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
      const bound = params.map((p) => (p === undefined ? null : p));
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...bound) as T | undefined;
      return row ?? null;
    },
    async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
      const bound = params.map((p) => (p === undefined ? null : p));
      const stmt = sqlite.prepare(sql);
      return stmt.all(...bound) as T[];
    },
    async prepareAsync(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        async executeAsync(params: any[] = []) {
          const bound = params.map((p) => (p === undefined ? null : p));
          stmt.run(...bound);
        },
        async finalizeAsync() {},
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
    },
  };

  return adapter as unknown as SQLiteDatabase;
}

describe('Live End-to-End Vertical Slice against Real Django + PostgreSQL Backend', () => {
  const SERVER_URL = 'http://127.0.0.1:8000/api/v2';
  const timestamp = Date.now();
  const usernameA = `slice_lender_a_${timestamp}`;
  const usernameB = `slice_lender_b_${timestamp}`;
  const phoneA = `91${String(timestamp).slice(-8)}`;

  let tokenA: string;
  let tenantIdA: string;
  let tokenB: string;
  let tenantIdB: string;

  let dbDeviceA: SQLiteDatabase;
  let dbDeviceB: SQLiteDatabase;
  let dbDeviceC: SQLiteDatabase;

  let createdBorrowerId: string;
  let monthlyLoanId: string;
  let bulletLoanId: string;

  beforeAll(async () => {
    jest.setTimeout(30000);
    (globalThis as any).fetch = nodeFetch as any;
    ApiClient.setBaseUrl(SERVER_URL);
    // Clear in-memory mock store
    for (const k of Object.keys(secureStoreState)) {
      delete secureStoreState[k];
    }
  });

  it('Step 3.1 & 3.2: Registers and logs in Lender A against live Django backend', async () => {
    const session = await AuthService.register({
      username: usernameA,
      password: 'StrongPassword123!',
      workspaceName: 'Lender A Enterprise',
      email: `${usernameA}@example.com`,
    });

    expect(session.token).toBeDefined();
    expect(session.tenant?.id).toBeDefined();
    tokenA = session.token;
    tenantIdA = session.tenant!.id;

    // Verify AuthStore holds token
    const storedToken = await AuthStore.getToken();
    expect(storedToken).toBe(tokenA);
  });

  it('Step 3.3: Registers Device A for Lender A', async () => {
    await AuthStore.setAuth({
      token: tokenA,
      user: { id: 1, username: usernameA },
      tenant: { id: tenantIdA, name: 'Lender A Enterprise' },
    });
    secureStoreState['credkeep_device_id'] = randomUUID();

    await expect(AuthService.registerDevice('push-token-dev-a')).resolves.not.toThrow();
  });

  const opBorrower = randomUUID();
  const opMonthlyLoan = randomUUID();
  const opPayment = randomUUID();
  const opBulletLoan = randomUUID();

  it('Step 3.4 - 3.6: Device A creates borrower, Monthly Kist loan, records ₹2,600 payment, and Bullet loan locally', async () => {
    dbDeviceA = createRealSqliteDb();

    // 1. Create borrower
    const borrowerRepo = new BorrowerRepository(dbDeviceA);
    const borrower = await borrowerRepo.create('Farmer Suresh', phoneA, opBorrower);
    createdBorrowerId = borrower.id;
    expect(createdBorrowerId).toBeDefined();

    // 2. Create Monthly Kist Loan (₹24,000, 30% markup, 12 months, kist ₹2,600)
    const loanRepo = new LoanRepository(dbDeviceA);
    const monthlyLoan = await loanRepo.createLoanWithSchedule(
      createdBorrowerId,
      {
        principal: toPaise(24000),
        markupFactor: 0.3,
        termMonths: 12,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment',
      },
      opMonthlyLoan
    );
    monthlyLoanId = monthlyLoan.id;
    expect(monthlyLoanId).toBeDefined();

    // Verify 12 schedules created
    const schedules = await dbDeviceA.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [monthlyLoanId]
    );
    expect(schedules.length).toBe(12);
    expect(schedules[0].total_due_paise).toBe(toPaise(2600));

    // 3. Record ₹2,600 collection on 2026-02-01
    const txRepo = new TransactionRepository(dbDeviceA);
    const paymentResult = await txRepo.recordCashPayment(
      monthlyLoanId,
      toPaise(2600),
      opPayment,
      '2026-02-01'
    );
    expect(paymentResult.success).toBe(true);

    // Verify local allocation: ₹2,000 principal, ₹600 markup, 0 penalty
    const localTx = await dbDeviceA.getFirstAsync<any>(
      `SELECT * FROM transactions WHERE operation_id = ?`,
      [opPayment]
    );
    expect(localTx.allocated_principal_paise).toBe(toPaise(2000));
    expect(localTx.allocated_markup_paise).toBe(toPaise(600));
    expect(localTx.allocated_penalty_paise).toBe(0);

    // 4. Create Interest Only (Bullet) Loan (₹50,000, 10% markup, 1 month)
    const bulletLoan = await loanRepo.createLoanWithSchedule(
      createdBorrowerId,
      {
        principal: toPaise(50000),
        markupFactor: 0.1,
        termMonths: 1,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'bullet',
      },
      opBulletLoan
    );
    bulletLoanId = bulletLoan.id;
    expect(bulletLoanId).toBeDefined();

    // Verify pending outbox count is 4
    const pendingOps = await dbDeviceA.getAllAsync<any>(
      `SELECT * FROM sync_outbox WHERE status = 'PENDING'`
    );
    expect(pendingOps.length).toBe(4);
  });

  it('Step 3.7 & 3.8: Pushes operations to live Django/PostgreSQL and verifies server confirmation & outbox transition', async () => {
    // Execute real sync client push
    const pushResult = await SyncService.pushPending(dbDeviceA);
    expect(pushResult.pushed).toBe(4);
    expect(pushResult.failed).toBe(0);

    // Verify all local outbox entries transitioned to SYNCED
    const remainingPending = await dbDeviceA.getAllAsync<any>(
      `SELECT * FROM sync_outbox WHERE status != 'SYNCED'`
    );
    expect(remainingPending.length).toBe(0);

    // Query backend authoritative portfolio summary to verify PostgreSQL storage
    const portfolio = await ApiClient.get('/sync/portfolio/');
    expect(portfolio.active_loans_count).toBe(2);
    expect(portfolio.total_principal_paise).toBe(toPaise(24000) + toPaise(50000));
    expect(portfolio.total_collections_count).toBe(1);
    expect(portfolio.total_collections_paise).toBe(toPaise(2600));

    // Verify per-loan portfolio details reconcile with portfolio total outstanding balance
    const sumOfLoans = portfolio.loans.reduce(
      (acc: number, l: any) => acc + l.outstanding_balance_paise,
      0
    );
    expect(portfolio.total_outstanding_balance_paise).toBe(sumOfLoans);

    // Verify Interest Only (bullet) loan includes remaining principal (₹50,000) + markup (₹5,000)
    const bulletLoanDetail = portfolio.loans.find((l: any) => l.id === bulletLoanId);
    expect(bulletLoanDetail).toBeDefined();
    expect(bulletLoanDetail.outstanding_balance_paise).toBeGreaterThanOrEqual(toPaise(55000));
  }, 30000);

  it('Step 3.9: Re-pushing the same operations is idempotent and produces zero duplicate transactions', async () => {
    // Read the 4 synced outbox items
    const syncedOps = await dbDeviceA.getAllAsync<any>(
      `SELECT operation_id, operation_type, payload FROM sync_outbox ORDER BY created_at ASC`
    );
    const operations = syncedOps.map((op: any) => ({
      operation_id: op.operation_id,
      type: op.operation_type,
      operation_type: op.operation_type,
      payload: JSON.parse(op.payload),
    }));

    // Post exact same push payload directly
    const deviceId = await AuthStore.getDeviceId();
    const retryResponse = await ApiClient.post('/sync/push/', { device_id: deviceId, operations });
    expect(retryResponse.results.length).toBe(4);
    for (const res of retryResponse.results) {
      expect(['ACCEPTED', 'CONFIRMED', 'ALREADY_EXISTS']).toContain(res.status);
    }

    // Verify portfolio collection count is STILL 1
    const portfolioAfter = await ApiClient.get('/sync/portfolio/');
    expect(portfolioAfter.total_collections_count).toBe(1);
    expect(portfolioAfter.total_collections_paise).toBe(toPaise(2600));
  }, 30000);

  it('Step 3.10 & 3.11: Registers Device B for Lender A, executes real PULL, and verifies complete multi-device replication', async () => {
    // Setup Device B context under same Lender A tenant
    secureStoreState['credkeep_device_id'] = randomUUID();
    await AuthService.registerDevice('push-token-dev-b');

    // Create fresh empty database for Device B
    dbDeviceB = createRealSqliteDb();

    // Pull from backend
    const pullResult = await SyncService.pullChanges(dbDeviceB);
    expect(pullResult.pulled).toBeGreaterThanOrEqual(4);

    // Verify Device B local state
    // 1. Borrower replicated
    const bRep = await dbDeviceB.getFirstAsync<any>(`SELECT * FROM borrowers WHERE id = ?`, [createdBorrowerId]);
    expect(bRep).toBeDefined();
    expect(bRep.name).toBe('Farmer Suresh');
    expect(bRep.phone).toBe(phoneA);

    // 2. Both loans replicated
    const lMonthly = await dbDeviceB.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [monthlyLoanId]);
    const lBullet = await dbDeviceB.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [bulletLoanId]);
    expect(lMonthly).toBeDefined();
    expect(lMonthly.status).toBe('ACTIVE');
    expect(lBullet).toBeDefined();
    expect(lBullet.status).toBe('ACTIVE');

    // 3. Monthly loan repayment schedule 1 replicated with server confirmation
    const sched1 = await dbDeviceB.getFirstAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? AND installment_number = 1`,
      [monthlyLoanId]
    );
    expect(sched1.server_principal_paid_paise).toBe(toPaise(2000));
    expect(sched1.server_markup_paid_paise).toBe(toPaise(600));
    expect(sched1.server_status).toBe('PAID');

    // 4. Collection transaction replicated into transactions table
    const txRep = await dbDeviceB.getFirstAsync<any>(
      `SELECT * FROM transactions WHERE operation_id = ?`,
      [opPayment]
    );
    expect(txRep).toBeDefined();
    expect(txRep.amount_paise).toBe(toPaise(2600));
    expect(txRep.allocated_principal_paise).toBe(toPaise(2000));
    expect(txRep.allocated_markup_paise).toBe(toPaise(600));
  }, 30000);

  it('Step 3.12: Registers Lender B as separate account and verifies strict multi-tenant isolation', async () => {
    // Register Lender B
    const sessionB = await AuthService.register({
      username: usernameB,
      password: 'StrongPassword123!',
      workspaceName: 'Lender B Enterprise',
      email: `${usernameB}@example.com`,
    });
    tokenB = sessionB.token;
    expect(tokenB).toBeDefined();
    tenantIdB = sessionB.tenant!.id;
    expect(tenantIdB).not.toBe(tenantIdA);

    // Set Device C under Lender B
    secureStoreState['credkeep_device_id'] = randomUUID();
    await AuthService.registerDevice('push-token-dev-c');

    // Query portfolio as Lender B
    const portfolioB = await ApiClient.get('/sync/portfolio/');
    expect(portfolioB.total_loans_count).toBe(0);
    expect(portfolioB.total_collections_count).toBe(0);
    expect(portfolioB.total_principal_paise).toBe(0);
    expect(portfolioB.total_outstanding_balance_paise).toBe(0);

    // Pull changes as Lender B into fresh DB
    dbDeviceC = createRealSqliteDb();
    const pullB = await SyncService.pullChanges(dbDeviceC);
    expect(pullB.pulled).toBe(0);

    // Verify Lender B database has zero borrowers, loans, or transactions from Lender A
    const bCount = await dbDeviceC.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM borrowers`);
    const lCount = await dbDeviceC.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM loans`);
    const txCount = await dbDeviceC.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM transactions`);
    expect(bCount?.count).toBe(0);
    expect(lCount?.count).toBe(0);
    expect(txCount?.count).toBe(0);

    // Attempt cross-tenant mutation: Lender B attempts to push a collection against Lender A's loan
    const attackOp = {
      operation_id: randomUUID(),
      operation_type: 'record_collection',
      payload: {
        loan_id: monthlyLoanId,
        amount_paise: toPaise(1000),
        effective_date: '2026-02-15',
        payment_method: 'CASH',
        is_cash: true,
      },
    };
    const deviceIdC = await AuthStore.getDeviceId();
    const attackPush = await ApiClient.post('/sync/push/', { device_id: deviceIdC, operations: [attackOp] });
    expect(attackPush.results[0].status).toBe('REJECTED');
    expect(attackPush.results[0].error).toMatch(/LoanAccount matching query does not exist|not found|permission/i);
  }, 30000);
});
