import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';
import { AuthStore } from '../auth/authStore';
import { SyncCoordinator } from '../sync/syncCoordinator';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
  switchTenant: (tenantId?: string | null) => Promise<void>;
  closeCurrentDatabase: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  borrowers: null,
  loans: null,
  transactions: null,
  error: null,
  refreshVersion: 0,
  triggerRefresh: () => {},
  switchTenant: async () => {},
  closeCurrentDatabase: async () => {},
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion((v) => v + 1);
  }, []);

  const [state, setState] = useState<Omit<DatabaseContextType, 'refreshVersion' | 'triggerRefresh' | 'switchTenant' | 'closeCurrentDatabase'>>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    error: null,
  });

  const closeCurrentDatabase = useCallback(async () => {
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
        error: null,
      };
    });
    setRefreshVersion((v) => v + 1);
  }, []);

  const loadDatabase = useCallback(async (tenantId?: string | null) => {
    const activeTenant = tenantId !== undefined ? tenantId : await AuthStore.getTenantId();

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
          error: null,
        };
      });
      return;
    }

    try {
      const db = await initDatabase(activeTenant);
      await runMigrations(db);

      setState((prev) => {
        if (prev.db && prev.db !== db && typeof (prev.db as any).closeAsync === 'function') {
          (prev.db as any).closeAsync().catch(() => {});
        }
        return {
          db,
          borrowers: new BorrowerRepository(db),
          loans: new LoanRepository(db),
          transactions: new TransactionRepository(db),
          error: null,
        };
      });
      setRefreshVersion((v) => v + 1);

      // Initialize automatic sync for this active tenant
      SyncCoordinator.init(db);
    } catch (e: any) {
      SyncCoordinator.reset();
      setState((prev) => ({
        ...prev,
        db: null,
        borrowers: null,
        loans: null,
        transactions: null,
        error: e,
      }));
    }
  }, []);

  const switchTenant = useCallback(async (tenantId?: string | null) => {
    await loadDatabase(tenantId);
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
    <DatabaseContext.Provider value={{ ...state, refreshVersion, triggerRefresh, switchTenant, closeCurrentDatabase }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
