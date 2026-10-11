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
  });
});
