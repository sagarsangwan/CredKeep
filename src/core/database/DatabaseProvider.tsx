import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';
import { AuthStore } from '../auth/authStore';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
  switchTenant: (tenantId?: string | null) => Promise<void>;
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
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
  }, []);

  const [state, setState] = useState<Omit<DatabaseContextType, 'refreshVersion' | 'triggerRefresh' | 'switchTenant'>>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    error: null,
  });

  const loadDatabase = useCallback(async (tenantId?: string | null) => {
    try {
      const db = await initDatabase(tenantId);
      await runMigrations(db);

      setState(prev => {
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
      setRefreshVersion(v => v + 1);
    } catch (e: any) {
      setState(prev => ({ ...prev, error: e }));
    }
  }, []);

  const switchTenant = useCallback(async (tenantId?: string | null) => {
    await loadDatabase(tenantId);
  }, [loadDatabase]);

  useEffect(() => {
    loadDatabase();

    const unsubscribe = AuthStore.onAuthChange((newTenantId) => {
      loadDatabase(newTenantId);
    });

    return () => {
      unsubscribe();
    };
  }, [loadDatabase]);

  return (
    <DatabaseContext.Provider value={{ ...state, refreshVersion, triggerRefresh, switchTenant }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
