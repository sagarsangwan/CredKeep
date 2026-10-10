import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  borrowers: null,
  loans: null,
  transactions: null,
  error: null,
  refreshVersion: 0,
  triggerRefresh: () => {},
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
  }, []);

  const [state, setState] = useState<Omit<DatabaseContextType, 'refreshVersion' | 'triggerRefresh'>>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    error: null,
  });

  useEffect(() => {
    async function setup() {
      try {
        const db = await initDatabase();
        await runMigrations(db);
        
        setState({
          db,
          borrowers: new BorrowerRepository(db),
          loans: new LoanRepository(db),
          transactions: new TransactionRepository(db),
          error: null,
        });
      } catch (e: any) {
        setState(prev => ({ ...prev, error: e }));
      }
    }
    setup();
  }, []);

  return (
    <DatabaseContext.Provider value={{ ...state, refreshVersion, triggerRefresh }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
