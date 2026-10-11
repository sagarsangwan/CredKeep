import { LoanRepository } from './loanRepository';
import { toPaise } from '../domain/money';

describe('LoanRepository Integration', () => {
  let mockDb: any;
  let repo: LoanRepository;
  let queries: any[] = [];
  let statements: any[] = [];

  beforeEach(() => {
    queries = [];
    statements = [];
    mockDb = {
      withExclusiveTransactionAsync: jest.fn(async (cb) => {
        await cb(mockDb);
      }),
      runAsync: jest.fn(async (query, params) => {
        queries.push({ query, params });
      }),
      prepareAsync: jest.fn(async (query) => {
        const stmt = {
          executeAsync: jest.fn(async (params) => {
            statements.push({ query, params });
          }),
          finalizeAsync: jest.fn(async () => {})
        };
        return stmt;
      }),
      getFirstAsync: jest.fn(async (query, params) => {
        return {
          id: params[0],
          principal_paise: queries[0].params[2],
          markup_factor: queries[0].params[3]
        };
      }),
      getAllAsync: jest.fn()
    };
    
    repo = new LoanRepository(mockDb);
  });

  it('Form-to-database loan creation integration test (₹24,000, 30%, 12 months, Upfront Markup)', async () => {
    const loan = await repo.createLoanWithSchedule('test-borrower-id', {
      principal: toPaise(24000),
      markupFactor: 0.3,
      termMonths: 12,
      startDate: '2026-01-01',
      dueDay: 1,
      productType: 'instalment'
    });

    // Check loan creation query
    const loanQuery = queries.find(q => q.query.includes('INSERT INTO loans'));
    expect(loanQuery).toBeDefined();
    expect(loanQuery.params[2]).toBe(toPaise(24000)); // principal
    expect(loanQuery.params[3]).toBe(0.3); // markupFactor

    // Check schedules created
    expect(statements.length).toBe(12); // 12 months

    // Validate the first and last schedule
    const firstSchedule = statements[0].params;
    // index 5 = principal_component, index 6 = markup_component, index 7 = total_due
    expect(firstSchedule[5]).toBe(200000); // ₹2,000 principal per month
    expect(firstSchedule[6]).toBe(60000); // ₹600 markup per month
    expect(firstSchedule[7]).toBe(260000); // ₹2,600 total per month

    const lastSchedule = statements[11].params;
    expect(lastSchedule[5]).toBe(200000); // ₹2,000 principal
    expect(lastSchedule[6]).toBe(60000); // ₹600 markup
    expect(lastSchedule[7]).toBe(260000); // ₹2,600 total
  });
});
