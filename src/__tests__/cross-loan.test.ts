import { LoanRepository } from '../core/database/loanRepository';
import { TransactionRepository } from '../core/database/transactionRepository';
import { toPaise } from '../core/domain/money';

describe('Cross-Loan Isolation', () => {
  let mockDb: any;
  let loanRepo: LoanRepository;
  let txRepo: TransactionRepository;
  let queries: any[] = [];
  let executionLog: any[] = [];
  let runAsyncCallbacks: any[] = [];

  beforeEach(() => {
    queries = [];
    executionLog = [];
    runAsyncCallbacks = [];
    
    mockDb = {
      withExclusiveTransactionAsync: jest.fn(async (cb) => {
        // mock tx is the same as db here for test tracking, but in reality expo passes a tx object
        const tx = { ...mockDb };
        await cb(tx);
      }),
      runAsync: jest.fn(async (query, params) => {
        queries.push({ query, params });
        executionLog.push('runAsync');
      }),
      prepareAsync: jest.fn(async (query) => {
        return {
          executeAsync: jest.fn(async (params) => {
            queries.push({ query, params });
            executionLog.push('executeAsync');
          }),
          finalizeAsync: jest.fn(async () => {})
        };
      }),
      getFirstAsync: jest.fn(async (query, params) => {
        if (query.includes('loans WHERE id = ?')) {
          return { id: params[0], product_type: 'instalment', status: 'ACTIVE' };
        }
        if (query.includes('operation_id = ?')) {
          return null;
        }
        if (query.includes('SUM(amount_paise)')) {
          return { total: 0 };
        }
        if (query.includes('SUM(allocated_penalty_paise)')) {
          return { total: 0 };
        }
        return null;
      }),
      getAllAsync: jest.fn(async (query, params) => {
        if (query.includes('repayment_schedules')) {
          return [
            {
              installment_number: 1,
              total_due_paise: 260000,
              principal_component_paise: 200000,
              markup_component_paise: 60000,
              principal_paid_paise: 0,
              markup_paid_paise: 0,
              effective_due_date: '2026-01-01',
              status: 'PENDING'
            }
          ];
        }
        if (query.includes('PENALTY_ASSESSMENT')) {
          return [];
        }
        return [];
      })
    };
    
    loanRepo = new LoanRepository(mockDb);
    txRepo = new TransactionRepository(mockDb);
  });

  it('Payment against Loan B should only update Loan B', async () => {
    const loanBId = 'loan-b';
    const amount = toPaise(2600); // 1 kist
    
    await txRepo.recordCashPayment(loanBId, amount, 'test-op', '2026-01-02');
    
    // Let's check which queries were run
    const updates = queries.filter(q => q.query.includes('UPDATE repayment_schedules'));
    
    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      const loanIdIndex = update.params.length - 2; // Assuming WHERE loan_id = ? AND installment_number = ?
      expect(update.params[loanIdIndex]).toBe(loanBId);
    }
  });
});
