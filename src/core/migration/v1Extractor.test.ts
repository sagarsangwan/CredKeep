import { V1DataExtractor } from './v1Extractor';
import { SyncService } from '../sync/syncService';
import { OutboxManager } from '../sync/outbox';

const mockMeta: Record<string, string> = {};
const mockOutbox = new Map<string, string>();

jest.mock('../api/client', () => ({
  ApiClient: {
    get: jest.fn(async (url: string) => {
      if (url === '/sync/portfolio/') {
        return {
          active_loans_count: 1,
          settled_loans_count: 0,
          written_off_loans_count: 0,
          total_loans_count: 1,
          total_principal_paise: 2400000,
          total_collections_paise: 260000,
          total_collections_count: 1,
          total_waivers_paise: 0,
          total_outstanding_balance_paise: 2860000,
          loans: [],
        };
      }
      return {};
    }),
    post: jest.fn(),
  },
}));

jest.mock('../sync/syncService', () => ({
  SyncService: {
    pushPending: jest.fn(async () => {
      let count = 0;
      for (const [id, st] of mockOutbox.entries()) {
        if (st === 'PENDING') {
          mockOutbox.set(id, 'SYNCED');
          count++;
        }
      }
      return { pushed: count, failed: 0 };
    }),
    pullChanges: jest.fn(async () => ({ pulled: 0 })),
  },
}));


jest.mock('../sync/outbox', () => {
  return {
    OutboxManager: {
      enqueue: jest.fn(async (_db, params) => {
        if (!mockOutbox.has(params.operationId)) {
          mockOutbox.set(params.operationId, 'PENDING');
        }
      }),
      setMeta: jest.fn(async (_db, k, v) => {
        mockMeta[k] = v;
      }),
      getMeta: jest.fn(async (_db, k) => mockMeta[k] || null),
    },
  };
});

describe('V1DataExtractor', () => {
  let mockDb: any;

  beforeEach(() => {
    for (const key of Object.keys(mockMeta)) {
      delete mockMeta[key];
    }
    mockOutbox.clear();
    jest.clearAllMocks();
    mockDb = {
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM borrowers')) {
          return [
            { id: 'b-1', name: 'Ramesh', phone: '9988776655', created_at: '2026-01-01' },
          ];
        }
        if (sql.includes('FROM loans')) {
          return [
            {
              id: 'l-1',
              borrower_id: 'b-1',
              principal_paise: 2400000,
              markup_factor: 0.3,
              term_months: 12,
              start_date: '2026-01-01',
              due_day: 1,
              product_type: 'instalment',
              status: 'ACTIVE',
              created_at: '2026-01-01',
            },
          ];
        }
        if (sql.includes('FROM transactions')) {
          return [
            {
              id: 'tx-1',
              operation_id: 'op-col-1',
              loan_id: 'l-1',
              transaction_type: 'COLLECTION',
              amount_paise: 260000,
              payment_method: 'CASH',
              is_cash: 1,
              effective_date: '2026-02-01',
              created_at: '2026-02-01',
            },
          ];
        }
        if (sql.includes('FROM sync_outbox')) {
          const synced: any[] = [];
          for (const [id, st] of mockOutbox.entries()) {
            if (st === 'SYNCED') {
              synced.push({ operation_id: id, status: 'SYNCED' });
            }
          }
          return synced;
        }
        return [];
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM transactions')) {
          return { count: 1, total: 260000 };
        }
        return null;
      }),
    };
  });


  it('extracts records from all three portfolio tables', async () => {
    const data = await V1DataExtractor.extract(mockDb);

    expect(data.borrowers.length).toBe(1);
    expect(data.borrowers[0].name).toBe('Ramesh');

    expect(data.loans.length).toBe(1);
    expect(data.loans[0].principal_paise).toBe(2400000);

    expect(data.transactions.length).toBe(1);
    expect(data.transactions[0].amount_paise).toBe(260000);
  });

  it('builds structured push operations in dependency order', () => {
    const extracted = {
      borrowers: [{ id: 'b-1', name: 'Ramesh', phone: '9988776655', created_at: '2026-01-01' }],
      loans: [
        {
          id: 'l-1',
          borrower_id: 'b-1',
          principal_paise: 2400000,
          markup_factor: 0.3,
          term_months: 12,
          start_date: '2026-01-01',
          due_day: 1,
          product_type: 'instalment',
          status: 'ACTIVE',
          created_at: '2026-01-01',
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          operation_id: 'op-col-1',
          loan_id: 'l-1',
          transaction_type: 'COLLECTION',
          amount_paise: 260000,
          payment_method: 'CASH',
          is_cash: 1,
          effective_date: '2026-02-01',
          created_at: '2026-02-01',
        },
      ],
    };

    const operations = V1DataExtractor.buildPushPayloads(extracted);

    expect(operations.length).toBe(3);
    expect(operations[0].type).toBe('create_borrower');
    expect(operations[0].payload.name).toBe('Ramesh');

    expect(operations[1].type).toBe('create_loan');
    expect(operations[1].payload.principal_paise).toBe(2400000);

    expect(operations[2].type).toBe('record_collection');
    expect(operations[2].payload.amount_paise).toBe(260000);

    // Verify deterministic operation IDs across multiple runs
    const operationsSecondRun = V1DataExtractor.buildPushPayloads(extracted);
    expect(operationsSecondRun[0].operation_id).toBe(operations[0].operation_id);
    expect(operationsSecondRun[1].operation_id).toBe(operations[1].operation_id);
    expect(operationsSecondRun[2].operation_id).toBe(operations[2].operation_id);
  });

  it('resumes partial migration when previous attempt synced some operations', async () => {
    const extracted = await V1DataExtractor.extract(mockDb);
    const operations = V1DataExtractor.buildPushPayloads(extracted);

    // Simulate first attempt: borrower (op 0) and loan (op 1) synced, transaction (op 2) remains PENDING
    mockOutbox.set(operations[0].operation_id, 'SYNCED');
    mockOutbox.set(operations[1].operation_id, 'SYNCED');
    mockOutbox.set(operations[2].operation_id, 'PENDING');

    // On resume attempt, pushPending only pushes the remaining 1 pending operation
    (SyncService.pushPending as jest.Mock).mockImplementationOnce(async () => {
      mockOutbox.set(operations[2].operation_id, 'SYNCED');
      return { pushed: 1, failed: 0 };
    });

    const summary = await V1DataExtractor.migrateToCloud(mockDb);
    expect(summary.success).toBe(true);
    expect(await V1DataExtractor.isMigrationCompleted(mockDb)).toBe(true);
  });

  it('executes full migration to cloud and marks metadata', async () => {
    const summary = await V1DataExtractor.migrateToCloud(mockDb);

    expect(summary.success).toBe(true);
    expect(summary.borrowersCount).toBe(1);
    expect(summary.loansCount).toBe(1);
    expect(summary.transactionsCount).toBe(1);

    expect(OutboxManager.enqueue).toHaveBeenCalledTimes(3);
    expect(SyncService.pushPending).toHaveBeenCalled();
    expect(OutboxManager.setMeta).toHaveBeenCalledWith(mockDb, 'v1_migration_completed', 'true');
  });

  it('does not mark migration completed if cloud push reports failures', async () => {
    (SyncService.pushPending as jest.Mock).mockResolvedValueOnce({ pushed: 1, failed: 2 });

    const summary = await V1DataExtractor.migrateToCloud(mockDb);
    expect(summary.success).toBe(false);
    expect(summary.pushedCount).toBe(1);
    expect(await V1DataExtractor.isMigrationCompleted(mockDb)).toBe(false);
    expect(OutboxManager.setMeta).not.toHaveBeenCalledWith(mockDb, 'v1_migration_completed', 'true');
  });

  it('does not mark migration completed if push is skipped due to lack of authentication', async () => {
    (SyncService.pushPending as jest.Mock).mockResolvedValueOnce({ pushed: 0, failed: 0 });

    const summary = await V1DataExtractor.migrateToCloud(mockDb);
    expect(summary.success).toBe(false);
    expect(summary.pushedCount).toBe(0);
    expect(await V1DataExtractor.isMigrationCompleted(mockDb)).toBe(false);
    expect(OutboxManager.setMeta).not.toHaveBeenCalledWith(mockDb, 'v1_migration_completed', 'true');
  });

  it('checks migration completion status', async () => {
    expect(await V1DataExtractor.isMigrationCompleted(mockDb)).toBe(false);

    await OutboxManager.setMeta(mockDb, 'v1_migration_completed', 'true');
    expect(await V1DataExtractor.isMigrationCompleted(mockDb)).toBe(true);
  });
});
