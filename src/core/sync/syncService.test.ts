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
        if (sql.includes('FROM sync_outbox')) {
          const limit = params && typeof params[0] === 'number' ? params[0] : undefined;
          const filtered = outboxRows.filter((r) => r.status === 'PENDING' || r.status === 'FAILED');
          return limit !== undefined ? filtered.slice(0, limit) : filtered;
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

    it('reconciles allocation deltas via append-only adjustment transaction', async () => {
      // Mock existing transaction with optimistic allocations
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          if (params[0] === 'op-optimistic-tx') {
            return {
              id: 'tx-local-1',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              allocated_principal_paise: 20000,
              allocated_markup_paise: 15000,
              allocated_penalty_paise: 5000,
              unallocated_surplus_paise: 10000,
            };
          }
          if (params[0] === 'reconcile-op-optimistic-tx') return null;
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 22,
        has_more: false,
        changes: [
          {
            id: 'change-tx-recon',
            record_type: 'TRANSACTION',
            operation_type: 'INSERT',
            payload: {
              id: 'tx-server-1',
              operation_id: 'op-optimistic-tx',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              amount_paise: 50000,
              allocated_principal_paise: 30000, // +10000
              allocated_markup_paise: 15000,    // 0
              allocated_penalty_paise: 5000,    // 0
              unallocated_surplus_paise: 0,     // -10000
              effective_date: '2026-01-05',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);
      expect(pullRes.pulled).toBe(1);
      // Verify append-only adjustment transaction inserted
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining([expect.stringMatching(/^reconcile-op-optimistic-tx/), 'REVERSAL', 10000, 0, 0, -10000])
      );
    });

    it('deduplicates penalty assessments matching (loan_id, effective_date)', async () => {
      // Mock existing penalty assessment matching date
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = \'PENALTY_ASSESSMENT\' AND effective_date = ?)')) {
          return { id: 'local-penalty-1', transaction_type: 'PENALTY_ASSESSMENT' };
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 23,
        has_more: false,
        changes: [
          {
            id: 'change-pen',
            record_type: 'TRANSACTION',
            operation_type: 'INSERT',
            payload: {
              id: 'server-penalty-uuid',
              operation_id: 'server-pen-op-id',
              loan_id: 'loan-1',
              transaction_type: 'PENALTY_ASSESSMENT',
              amount_paise: 10000,
              effective_date: '2026-01-02',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);
      expect(pullRes.pulled).toBe(1);
      // No duplicate insert for existing penalty on that date
      const hasDuplicatePen = (mockDb.runAsync as jest.Mock).mock.calls.some(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO transactions') && call[1]?.includes('server-pen-op-id')
      );
      expect(hasDuplicatePen).toBe(false);
    });

    it('replicates incoming COLLECTION transactions without dropping them when a penalty exists on the same date', async () => {
      // Mock existing penalty assessment on same date
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          // New collection operation_id does not exist locally
          return null;
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 24,
        has_more: false,
        changes: [
          {
            id: 'change-coll',
            record_type: 'TRANSACTION',
            operation_type: 'INSERT',
            payload: {
              id: 'server-coll-uuid',
              operation_id: 'server-coll-op-id',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              amount_paise: 50000,
              allocated_principal_paise: 30000,
              allocated_markup_paise: 20000,
              allocated_penalty_paise: 0,
              unallocated_surplus_paise: 0,
              effective_date: '2026-01-02', // Same date as penalty
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);
      expect(pullRes.pulled).toBe(1);
      // Collection must be inserted, not dropped!
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining(['server-coll-uuid', 'server-coll-op-id', 'loan-1', 'COLLECTION'])
      );
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

    it('reports failure, halts pull, and protects local state when push has failed operations', async () => {
      const pushSpy = jest.spyOn(SyncService, 'pushPending').mockResolvedValueOnce({ pushed: 1, failed: 1 });
      const pullSpy = jest.spyOn(SyncService, 'pullChanges').mockResolvedValueOnce({ pulled: 5 });

      try {
        const res = await SyncService.syncAll(mockDb);
        expect(res.success).toBe(false);
        expect(res.pulledCount).toBe(0);
        expect(pullSpy).not.toHaveBeenCalled();
        expect(res.errors).toBeDefined();
        expect(res.errors![0]).toContain('failed to push to server; pull halted to protect local state');
      } finally {
        pushSpy.mockRestore();
        pullSpy.mockRestore();
      }
    });

    it('reports conflict review required when outbox has NEEDS_REVIEW operations', async () => {
      const pushSpy = jest.spyOn(SyncService, 'pushPending').mockResolvedValueOnce({ pushed: 1, failed: 0 });
      const pullSpy = jest.spyOn(SyncService, 'pullChanges').mockResolvedValueOnce({ pulled: 2 });
      const reviewSpy = jest.spyOn(OutboxManager, 'getNeedsReview').mockResolvedValueOnce([
        {
          id: 'outbox-conflict-1',
          operation_id: 'op-conflict-1',
          operation_type: 'record_collection',
          payload: '{}',
          status: 'NEEDS_REVIEW',
          error_message: 'Loan was settled on another device',
          created_at: new Date().toISOString()
        }
      ]);

      try {
        const res = await SyncService.syncAll(mockDb);
        expect(res.success).toBe(false);
        expect(res.needsReviewCount).toBe(1);
        expect(res.errors![0]).toContain('require review due to server conflicts');
      } finally {
        pushSpy.mockRestore();
        pullSpy.mockRestore();
        reviewSpy.mockRestore();
      }
    });

    it('resolves NEEDS_REVIEW operations via OutboxManager.resolveNeedsReview', async () => {
      await OutboxManager.resolveNeedsReview(mockDb, 'op-conflict-1', 'DISCARD');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sync_outbox SET status = ?"),
        ['REJECTED', 'Resolved: discarded by user', 'op-conflict-1']
      );

      await OutboxManager.resolveNeedsReview(mockDb, 'op-conflict-1', 'RETRY_PENDING');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sync_outbox SET status = 'PENDING'"),
        ['op-conflict-1']
      );
    });

    it('pushes pending outbox queues exceeding 50 items in successive batches', async () => {
      // Create 65 outbox items
      for (let i = 0; i < 65; i++) {
        outboxRows.push({
          id: `outbox-${i}`,
          operation_id: `op-${i}`,
          operation_type: 'record_collection',
          payload: JSON.stringify({ loan_id: 'loan-1', amount_paise: 1000 }),
          status: 'PENDING',
          created_at: new Date().toISOString()
        });
      }

      (ApiClient.post as jest.Mock)
        .mockResolvedValueOnce({
          results: Array.from({ length: 50 }, (_, i) => ({
            operation_id: `op-${i}`,
            status: 'ACCEPTED'
          }))
        })
        .mockResolvedValueOnce({
          results: Array.from({ length: 15 }, (_, i) => ({
            operation_id: `op-${50 + i}`,
            status: 'ACCEPTED'
          }))
        });

      const pushRes = await SyncService.pushPending(mockDb);
      expect(pushRes.pushed).toBe(65);
      expect(pushRes.failed).toBe(0);
      expect(ApiClient.post).toHaveBeenCalledTimes(2);
    });

    it('preserves local pending collections when server pulls schedule updates', async () => {
      // Local pending collection exists in outbox
      outboxRows.push({
        id: 'outbox-pen-1',
        operation_id: 'op-local-coll',
        operation_type: 'record_collection',
        payload: JSON.stringify({
          loan_id: 'loan-1',
          amount_paise: 110000,
          effective_date: '2026-01-05'
        }),
        status: 'PENDING',
        created_at: new Date().toISOString()
      });

      // Server sends a stale snapshot (0 paid)
      mockDb.getAllAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('sync_outbox')) {
          return outboxRows.filter(r => r.status === 'PENDING');
        }
        if (sql.includes('repayment_schedules WHERE loan_id = ?')) {
          return [{
            id: 'kist-1',
            loan_id: 'loan-1',
            installment_number: 1,
            effective_due_date: '2026-01-01',
            total_due_paise: 110000,
            principal_component_paise: 100000,
            markup_component_paise: 10000,
            principal_paid_paise: 0,
            markup_paid_paise: 0,
            status: 'PENDING'
          }];
        }
        return [];
      });

      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('repayment_schedules WHERE id = ?')) {
          return { id: 'kist-1' };
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        changes: [{
          record_type: 'KIST',
          operation_type: 'UPDATE',
          payload: {
            id: 'kist-1',
            loan_id: 'loan-1',
            installment_number: 1,
            principal_paid_paise: 0,
            markup_paid_paise: 0,
            status: 'PENDING'
          }
        }],
        next_cursor: 1,
        has_more: false
      });

      await SyncService.pullChanges(mockDb);

      // Verification: local pending collection was reapplied on top of server snapshot!
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE repayment_schedules SET'),
        expect.arrayContaining([100000, 10000, 'PAID', 'loan-1', 1])
      );
    });

    it('compensates and reverts rejected payment allocations on server push rejection', async () => {
      outboxRows.push({
        id: 'outbox-rej-1',
        operation_id: 'op-rejected',
        operation_type: 'record_collection',
        payload: JSON.stringify({
          loan_id: 'loan-1',
          amount_paise: 110000,
          effective_date: '2026-01-05'
        }),
        status: 'PENDING',
        created_at: new Date().toISOString()
      });

      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM transactions WHERE operation_id = ?')) {
          if (params[0] === 'op-rejected') {
            return {
              id: 'tx-rej',
              operation_id: 'op-rejected',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              amount_paise: 110000,
              allocated_principal_paise: 100000,
              allocated_markup_paise: 10000,
              allocated_penalty_paise: 0,
              unallocated_surplus_paise: 0
            };
          }
          if (params[0] === 'reversal-op-rejected') {
            return null;
          }
        }
        if (sql.includes('SELECT * FROM loans WHERE id = ?')) {
          return { id: 'loan-1', principal_paise: 100000, product_type: 'instalment', status: 'SETTLED' };
        }
        if (sql.includes('SUM(amount_paise)')) {
          return {
            netAmount: 110000,
            netPrincipal: 100000,
            netMarkup: 10000,
            netPenalty: 0,
            netSurplus: 0,
          };
        }
        return null;
      });

      mockDb.getAllAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('sync_outbox')) {
          return outboxRows.filter(r => r.status === 'PENDING');
        }
        if (sql.includes('SELECT t.* FROM transactions t')) {
          return [];
        }
        if (sql.includes('SELECT * FROM repayment_schedules WHERE loan_id = ?')) {
          return [{
            id: 'kist-1',
            loan_id: 'loan-1',
            installment_number: 1,
            principal_component_paise: 100000,
            markup_component_paise: 10000,
            total_due_paise: 110000,
            principal_paid_paise: 0,
            markup_paid_paise: 0,
            status: 'PENDING'
          }];
        }
        return [];
      });

      (ApiClient.post as jest.Mock).mockResolvedValueOnce({
        results: [{
          operation_id: 'op-rejected',
          status: 'REJECTED',
          error: 'Borrower credit limit exceeded'
        }]
      });

      const pushRes = await SyncService.pushPending(mockDb);
      expect(pushRes.failed).toBe(1);

      // Verify compensating REVERSAL transaction was inserted
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining(['reversal-op-rejected', 'loan-1', 'REVERSAL', -100000, -10000])
      );

      // Verify schedule was reset and loan status updated back to ACTIVE
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        `UPDATE loans SET status = ? WHERE id = ?`,
        ['ACTIVE', 'loan-1']
      );
    });
  });
});
