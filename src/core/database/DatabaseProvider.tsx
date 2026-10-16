import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';
import { AuthStore } from '../auth/authStore';
import { SyncCoordinator } from '../sync/syncCoordinator';

export type DatabaseStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  status: DatabaseStatus;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
  switchTenant: (tenantId?: string | null) => Promise<void>;
  closeCurrentDatabase: () => Promise<void>;
  retryInitDatabase: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  borrowers: null,
  loans: null,
  transactions: null,
  status: 'IDLE',
  error: null,
  refreshVersion: 0,
  triggerRefresh: () => {},
  switchTenant: async () => {},
  closeCurrentDatabase: async () => {},
  retryInitDatabase: async () => {},
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const loadGenerationRef = useRef(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion((v) => v + 1);
  }, []);

  const [state, setState] = useState<{
    db: SQLiteDatabase | null;
    borrowers: BorrowerRepository | null;
    loans: LoanRepository | null;
    transactions: TransactionRepository | null;
    status: DatabaseStatus;
    error: Error | null;
  }>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    status: 'IDLE',
    error: null,
  });

  const closeCurrentDatabase = useCallback(async () => {
    loadGenerationRef.current++;
    SyncCoordinator.reset();
    setState((prev) => {
      if (prev.db && typeof (prev.db as any).closeAsync === 'function') {
        (prev.db as any).closeAsync().catch(() => {});
      }
      return {
        db: null,
        borrowers: null,
        loans: null,
        transactions: null,
        status: 'IDLE',
        error: null,
      };
    });
    setRefreshVersion((v) => v + 1);
  }, []);

  const loadDatabase = useCallback(async (tenantId?: string | null) => {
    const generation = ++loadGenerationRef.current;
    
    // Mark status LOADING before resolving tenant
    setState((prev) => ({ ...prev, status: 'LOADING', error: null }));

    const activeTenant = tenantId !== undefined ? tenantId : await AuthStore.getTenantId();

    if (generation !== loadGenerationRef.current) return;

    if (!activeTenant || activeTenant.trim().length === 0) {
      // Unauthenticated state: Do not open any database
      SyncCoordinator.reset();
      setState((prev) => {
        if (prev.db && typeof (prev.db as any).closeAsync === 'function') {
          (prev.db as any).closeAsync().catch(() => {});
        }
        return {
          db: null,
          borrowers: null,
          loans: null,
          transactions: null,
          status: 'IDLE',
          error: null,
        };
      });
      return;
    }

    console.log(`[LIFECYCLE] TENANT_RESOLVED: ${activeTenant}`);

    try {
      const db = await initDatabase(activeTenant);
      if (generation !== loadGenerationRef.current) {
        if (typeof (db as any).closeAsync === 'function') {
          (db as any).closeAsync().catch(() => {});
        }
        return;
      }

      await runMigrations(db);
      if (generation !== loadGenerationRef.current) {
        if (typeof (db as any).closeAsync === 'function') {
          (db as any).closeAsync().catch(() => {});
        }
        return;
      }

      const borrowerRepo = new BorrowerRepository(db);
      const loanRepo = new LoanRepository(db);
      const transactionRepo = new TransactionRepository(db);

      console.log(`[LIFECYCLE] REPOSITORIES_READY: Borrower, Loan, and Transaction repositories initialized`);

      setState((prev) => {
        if (prev.db && prev.db !== db && typeof (prev.db as any).closeAsync === 'function') {
          (prev.db as any).closeAsync().catch(() => {});
        }
        return {
          db,
          borrowers: borrowerRepo,
          loans: loanRepo,
          transactions: transactionRepo,
          status: 'READY',
          error: null,
        };
      });
      setRefreshVersion((v) => v + 1);

      // Initialize automatic sync for this active tenant with data refresh callback
      SyncCoordinator.init(db, () => {
        setRefreshVersion((v) => v + 1);
      });
      console.log(`[LIFECYCLE] SYNC_INITIALIZED: SyncCoordinator bound to database`);
    } catch (e: any) {
      if (generation !== loadGenerationRef.current) return;
      console.error(`[LIFECYCLE] DATABASE_ERROR: ${e?.message || e}`);
      SyncCoordinator.reset();
      setState((prev) => ({
        ...prev,
        db: null,
        borrowers: null,
        loans: null,
        transactions: null,
        status: 'ERROR',
        error: e instanceof Error ? e : new Error(String(e)),
      }));
    }
  }, []);

  const switchTenant = useCallback(async (tenantId?: string | null) => {
    await loadDatabase(tenantId);
  }, [loadDatabase]);

  const retryInitDatabase = useCallback(async () => {
    await loadDatabase();
  }, [loadDatabase]);

  useEffect(() => {
    loadDatabase();

    const unsubscribe = AuthStore.onAuthChange((newTenantId) => {
      if (newTenantId) {
        loadDatabase(newTenantId);
      } else {
        closeCurrentDatabase();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadDatabase, closeCurrentDatabase]);

  return (
    <DatabaseContext.Provider
      value={{
        ...state,
        refreshVersion,
        triggerRefresh,
        switchTenant,
        closeCurrentDatabase,
        retryInitDatabase,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
