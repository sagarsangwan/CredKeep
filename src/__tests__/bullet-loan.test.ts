import { LoanRepository } from '../core/database/loanRepository';
import { TransactionRepository } from '../core/database/transactionRepository';
import { toPaise } from '../core/domain/money';

describe('Bullet Loan Settlement', () => {
  let mockDb: any;
  let loanRepo: LoanRepository;
  let txRepo: TransactionRepository;
  let executionLog: any[] = [];
  let txs: any[] = [];
  let loanStatus = 'ACTIVE';

  beforeEach(() => {
    executionLog = [];
    txs = [];
    loanStatus = 'ACTIVE';
    
    mockDb = {
      withExclusiveTransactionAsync: jest.fn(async (cb) => {
        const tx = { ...mockDb };
        await cb(tx);
      }),
      runAsync: jest.fn(async (query, params) => {
        executionLog.push({ query, params });
        if (query.includes('INSERT INTO transactions')) {
          txs.push(params);
        }
        if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
          loanStatus = 'SETTLED';
        }
      }),
      prepareAsync: jest.fn(async (query) => {
        return {
          executeAsync: jest.fn(async (params) => {
            executionLog.push({ query, params });
          }),
          finalizeAsync: jest.fn(async () => {})
        };
      }),
      getFirstAsync: jest.fn(async (query, params) => {
        if (query.includes('loans WHERE id = ?')) {
          return { 
            id: params[0], 
            product_type: 'bullet', 
            status: loanStatus,
            principal_paise: 1000000, // 10000 rupees
            start_date: '2026-01-01',
            due_day: 1,
            markup_factor: 0.05,
            term_months: 1
          };
        }
        if (query.includes('SUM(amount_paise)')) { return { total: 0 }; }
        if (query.includes('SUM(allocated_penalty_paise)')) { return { total: 0 }; }
        
        // Mock to get total principal paid
        if (query.includes('SUM(allocated_principal_paise)')) { 
          // we sum up txs manually for the mock
          // index 7 is allocated_principal_paise
          const sum = txs.reduce((acc, t) => acc + t[7], 0); 
          return { total: sum };
        }
        
        return null;
      }),
      getAllAsync: jest.fn(async (query, params) => {
        if (query.includes('repayment_schedules')) {
          return [
            {
              installment_number: 1,
              total_due_paise: 50000,
              principal_component_paise: 0,
              markup_component_paise: 50000,
              principal_paid_paise: 0,
              markup_paid_paise: 0,
              effective_due_date: '2026-01-01', // This causes penalty! Let's change it to 2026-02-01 so it's not overdue
              status: 'PENDING',
              amountPaid: 0
            }
          ];
        }
        if (query.includes('PENALTY_ASSESSMENT')) { return []; }
        return [];
      })
    };
    
    loanRepo = new LoanRepository(mockDb);
    txRepo = new TransactionRepository(mockDb);
  });

  it('settles bullet loan when principal is fully repaid', async () => {
    const loanId = 'loan-bullet';
    const amount = toPaise(10500); // 500 markup + 10000 principal
    
    await txRepo.recordCashPayment(loanId, amount, 'op-1', '2026-02-01');
    
    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
    const txInsert = txs.find(t => t[3] === 'COLLECTION');
    
    expect(updateLoanStatusQuery).toBeDefined();
    
    // Check tx insert values
    // INSERT INTO transactions (..., amount_paise, allocated_principal_paise, allocated_markup_paise, ...)
    // 0: id, 1: op_id, 2: loan_id, 3: tx_type, 4: is_cash, 5: pm, 6: amount, 7: prin, 8: markup, 9: pen, 10: unalloc, 11: eff_date, 12: created
    expect(txInsert[7]).toBe(toPaise(10000)); // allocated principal
    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
    expect(txInsert[10]).toBe(toPaise(0)); // unallocated
  });

  it('partially repays principal of bullet loan without settling', async () => {
    const loanId = 'loan-bullet';
    const amount = toPaise(5500); // 500 markup + 5000 principal
    
    await txRepo.recordCashPayment(loanId, amount, 'op-2', '2026-02-01');
    
    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
    expect(updateLoanStatusQuery).toBeUndefined(); // Should NOT be settled

    const txInsert = txs.find(t => t[3] === 'COLLECTION');
    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
    expect(txInsert[7]).toBe(toPaise(5000)); // allocated principal
    expect(txInsert[10]).toBe(toPaise(0)); // unallocated
  });
  
  it('handles excess payment as unallocated surplus when principal is overpaid', async () => {
    const loanId = 'loan-bullet';
    const amount = toPaise(12500); // 500 markup + 10000 principal + 2000 unallocated
    
    await txRepo.recordCashPayment(loanId, amount, 'op-3', '2026-02-01');
    
    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
    expect(updateLoanStatusQuery).toBeDefined();

    const txInsert = txs.find(t => t[3] === 'COLLECTION');
    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
    expect(txInsert[7]).toBe(toPaise(10000)); // Capped at principal due
    expect(txInsert[10]).toBe(toPaise(2000)); // The excess
  });
});
