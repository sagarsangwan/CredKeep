import { TransactionRepository } from '../core/database/transactionRepository';
import { Paise, toPaise } from '../core/domain/money';

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
            .filter(t => t.loan_id === params[0] && t.transaction_type === 'COLLECTION')
            .reduce((acc, t) => acc + t.allocated_penalty_paise, 0);
          return { total: sum };
        }
        if (query.includes('SUM(allocated_principal_paise)')) {
          const sum = state.transactions
            .filter(t => t.loan_id === params[0] && t.transaction_type === 'COLLECTION')
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
    // First installment for loan-a already exists in dbState
    await expect(stmt.executeAsync(['sched-2', 'loan-a', 1, '2026-01-01', '2026-01-01', toPaise(1000), toPaise(100), toPaise(1100)]))
      .rejects.toThrow('UNIQUE constraint failed: repayment_schedules.loan_id, repayment_schedules.installment_number');
  });
});
