import { withDbTransaction } from '../core/database/transaction';
import { initDatabase } from '../core/database/db';

jest.mock('expo-asset', () => ({ Asset: {} }), { virtual: true });
const mockOpenDatabaseAsync = jest.fn();
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: any[]) => mockOpenDatabaseAsync(...args),
}));

describe('V2 Runtime Stability & Transaction Invariants', () => {
  it('withDbTransaction executes transaction on existing connection and commits', async () => {
    const executed: string[] = [];
    const mockDb: any = {
      nativeDatabase: {}, // Real native instance simulation
      execAsync: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
      }),
      withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
        executed.push('BEGIN');
        await cb();
        executed.push('COMMIT');
      }),
    };

    const result = await withDbTransaction(mockDb, async (tx) => {
      await tx.execAsync('INSERT INTO test VALUES (1);');
      return 'success';
    });

    expect(result).toBe('success');
    expect(executed).toEqual(['BEGIN', 'INSERT INTO test VALUES (1);', 'COMMIT']);
  });

  it('withDbTransaction rolls back safely when action throws', async () => {
    const executed: string[] = [];
    const mockDb: any = {
      nativeDatabase: {},
      execAsync: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
      }),
      withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
        executed.push('BEGIN');
        try {
          await cb();
          executed.push('COMMIT');
        } catch (e) {
          executed.push('ROLLBACK');
          throw e;
        }
      }),
    };

    await expect(
      withDbTransaction(mockDb, async () => {
        throw new Error('Mutation failed');
      })
    ).rejects.toThrow('Mutation failed');

    expect(executed).toContain('ROLLBACK');
  });

  it('withDbTransaction falls back to BEGIN IMMEDIATE / COMMIT if withTransactionAsync is missing', async () => {
    const executed: string[] = [];
    const mockDb: any = {
      nativeDatabase: {},
      execAsync: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
      }),
    };

    const res = await withDbTransaction(mockDb, async (tx) => {
      await tx.execAsync('UPDATE test SET val = 2;');
      return 42;
    });

    expect(res).toBe(42);
    expect(executed[0]).toBe('BEGIN IMMEDIATE;');
    expect(executed[1]).toBe('UPDATE test SET val = 2;');
    expect(executed[2]).toBe('COMMIT;');
  });

  it('withDbTransaction rolls back with ROLLBACK on direct execAsync failure', async () => {
    const executed: string[] = [];
    const mockDb: any = {
      nativeDatabase: {},
      execAsync: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
      }),
    };

    await expect(
      withDbTransaction(mockDb, async () => {
        throw new Error('Database write error');
      })
    ).rejects.toThrow('Database write error');

    expect(executed[0]).toBe('BEGIN IMMEDIATE;');
    expect(executed[1]).toBe('ROLLBACK;');
  });

  it('initDatabase attempts standard passphrase pragma before legacy raw hex', async () => {
    const mockDbInstance: any = {
      nativeDatabase: {},
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ '1': 1 }),
      closeAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockOpenDatabaseAsync.mockResolvedValue(mockDbInstance);

    const db = await initDatabase('test-tenant-priority');
    expect(db).toBe(mockDbInstance);
    // First execAsync call must be candidate 1: PRAGMA key = '<key>';
    const firstExecCall = mockDbInstance.execAsync.mock.calls[0][0];
    expect(firstExecCall).toMatch(/^PRAGMA key = '[a-f0-9]+';$/);
  });
});

