import { OutboxManager } from './outbox';
import { SyncService } from './syncService';
import { ApiClient } from '../api/client';

jest.mock('../auth/authStore', () => ({
  AuthStore: {
    getToken: jest.fn(async () => 'fake-jwt-token'),
    getDeviceId: jest.fn(async () => 'device-uuid-999'),
  },
}));

jest.mock('../api/client', () => ({
  ApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('SyncService & OutboxManager', () => {
  let mockDb: any;
  let outboxRows: any[] = [];
  let metaRows: Record<string, string> = {};

  beforeEach(() => {
    outboxRows = [];
    metaRows = {};
    jest.clearAllMocks();

    mockDb = {
      runAsync: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO sync_outbox')) {
          outboxRows.push({
            id: params[0],
            operation_id: params[1],
            operation_type: params[2],
            payload: params[3],
            status: 'PENDING',
            error_message: null,
            created_at: params[4],
          });
        } else if (sql.includes('UPDATE sync_outbox SET status = ?')) {
          const opId = params[2];
          const row = outboxRows.find((r) => r.operation_id === opId);
          if (row) {
            row.status = params[0];
            row.error_message = params[1];
          }
        } else if (sql.includes('UPDATE sync_outbox SET status = \'SYNCED\'')) {
          const opIds = params;
          for (const opId of opIds) {
            const row = outboxRows.find((r) => r.operation_id === opId);
            if (row) row.status = 'SYNCED';
          }
        } else if (sql.includes('INSERT INTO sync_meta')) {
          metaRows[params[0]] = params[1];
        }
        return { changes: 1 };
      }),

      getAllAsync: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM sync_outbox WHERE status = \'PENDING\'')) {
          return outboxRows.filter((r) => r.status === 'PENDING');
        }
        return [];
      }),

      getFirstAsync: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM sync_meta WHERE key = ?')) {
          const val = metaRows[params[0]];
          return val ? { value: val } : null;
        }
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          return null;
        }
        return null;
      }),

      withExclusiveTransactionAsync: jest.fn(async (callback: any) => {
        return await callback(mockDb);
      }),
    };
  });

  describe('OutboxManager', () => {
    it('enqueues a mutation operation and retrieves pending', async () => {
      const rec = await OutboxManager.enqueue(mockDb, {
        operationId: 'op-1',
        operationType: 'create_borrower',
        payload: { name: 'Ramesh', phone: '9988776655' },
      });

      expect(rec.operation_id).toBe('op-1');
      expect(rec.status).toBe('PENDING');

      const pending = await OutboxManager.getPending(mockDb);
      expect(pending.length).toBe(1);
      expect(pending[0].operation_id).toBe('op-1');
    });

    it('marks operation as synced', async () => {
      await OutboxManager.enqueue(mockDb, {
        operationId: 'op-2',
        operationType: 'record_collection',
        payload: { amount_paise: 50000 },
      });

      await OutboxManager.markSynced(mockDb, ['op-2']);
      const pending = await OutboxManager.getPending(mockDb);
      expect(pending.length).toBe(0);
    });

    it('manages sync_meta key value store', async () => {
      expect(await OutboxManager.getMeta(mockDb, 'last_pull_cursor')).toBeNull();

      await OutboxManager.setMeta(mockDb, 'last_pull_cursor', '42');
      expect(await OutboxManager.getMeta(mockDb, 'last_pull_cursor')).toBe('42');
    });
  });

  describe('SyncService Push', () => {
    it('pushes pending outbox records to /sync/push/ and updates status', async () => {
      await OutboxManager.enqueue(mockDb, {
        operationId: 'op-accepted',
        operationType: 'create_borrower',
        payload: { name: 'Kavita', phone: '9123456789' },
      });

      await OutboxManager.enqueue(mockDb, {
        operationId: 'op-rejected',
        operationType: 'create_loan',
        payload: { invalid: true },
      });

      (ApiClient.post as jest.Mock).mockResolvedValueOnce({
        results: [
          { operation_id: 'op-accepted', status: 'ACCEPTED' },
          { operation_id: 'op-rejected', status: 'REJECTED', error: 'Invalid parameters' },
        ],
      });

      const res = await SyncService.pushPending(mockDb);

      expect(res.pushed).toBe(1);
      expect(res.failed).toBe(1);
      expect(ApiClient.post).toHaveBeenCalledWith('/sync/push/', expect.objectContaining({
        device_id: 'device-uuid-999',
        operations: expect.any(Array),
      }));

      const rowAccepted = outboxRows.find((r) => r.operation_id === 'op-accepted');
      expect(rowAccepted?.status).toBe('SYNCED');

      const rowRejected = outboxRows.find((r) => r.operation_id === 'op-rejected');
      expect(rowRejected?.status).toBe('REJECTED');
      expect(rowRejected?.error_message).toBe('Invalid parameters');
    });
  });

  describe('SyncService Pull', () => {
    it('pulls authoritative changes from /sync/pull/ and applies them to local db', async () => {
      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 15,
        has_more: false,
        changes: [
          {
            id: 'change-1',
            record_type: 'BORROWER',
            operation_type: 'INSERT',
            payload: {
              id: 'b-1',
              name: 'Sunita Devi',
              phone: '9876543210',
            },
          },
          {
            id: 'change-2',
            record_type: 'LOAN',
            operation_type: 'UPDATE',
            payload: {
              id: 'loan-1',
              status: 'SETTLED',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);

      expect(pullRes.pulled).toBe(2);
      expect(ApiClient.get).toHaveBeenCalledWith('/sync/pull/?cursor=0&limit=100');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO borrowers'),
        expect.arrayContaining(['b-1', 'Sunita Devi', '9876543210'])
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE loans SET status = ? WHERE id = ?'),
        ['SETTLED', 'loan-1']
      );

      expect(metaRows['last_pull_cursor']).toBe('15');
      expect(metaRows['last_synced_at']).toBeDefined();
    });

    it('respects append-only ledger trigger: does not execute UPDATE on existing transactions', async () => {
      // Mock existing transaction check to return an existing id
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          if (params[0] === 'op-existing-tx') return { id: 'tx-local-1' };
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 20,
        has_more: false,
        changes: [
          {
            id: 'change-tx',
            record_type: 'TRANSACTION',
            operation_type: 'INSERT',
            payload: {
              id: 'tx-server-1',
              operation_id: 'op-existing-tx',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              is_cash: false,
              payment_method: 'UPI',
              amount_paise: 50000,
              allocated_principal_paise: 30000,
              allocated_markup_paise: 15000,
              allocated_penalty_paise: 5000,
              unallocated_surplus_paise: 0,
              forgiven_penalty_paise: 0,
              effective_date: '2026-01-05',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);
      expect(pullRes.pulled).toBe(1);
      // Invariant: MUST NOT execute UPDATE on transactions table
      const hasUpdateTx = (mockDb.runAsync as jest.Mock).mock.calls.some(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE transactions')
      );
      expect(hasUpdateTx).toBe(false);
    });

    it('deduplicates KIST installments matching (loan_id, installment_number) without duplicating rows', async () => {
      // Mock existing kist check to match by installment_number
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)')) {
          if (params[1] === 'loan-1' && params[2] === 1) return { id: 'local-kist-uuid-1' };
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 25,
        has_more: false,
        changes: [
          {
            id: 'change-kist',
            record_type: 'KIST',
            operation_type: 'INSERT',
            payload: {
              id: 'server-kist-uuid-different',
              loan_id: 'loan-1',
              installment_number: 1,
              original_due_date: '2026-01-01',
              effective_due_date: '2026-01-01',
              principal_component_paise: 100000,
              markup_component_paise: 10000,
              total_due_paise: 110000,
              principal_paid_paise: 50000,
              markup_paid_paise: 5000,
              status: 'PARTIAL',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);
      expect(pullRes.pulled).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE repayment_schedules SET'),
        expect.arrayContaining(['local-kist-uuid-1'])
      );
    });

    it('reports failure and error messages when push has failed operations', async () => {
      jest.spyOn(SyncService, 'pushPending').mockResolvedValueOnce({ pushed: 1, failed: 1 });
      jest.spyOn(SyncService, 'pullChanges').mockResolvedValueOnce({ pulled: 5 });

      const res = await SyncService.syncAll(mockDb);
      expect(res.success).toBe(false);
      expect(res.errors).toBeDefined();
      expect(res.errors![0]).toContain('1 operations failed to push');
    });
  });
});
