import { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    // 1. Borrowers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS borrowers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Loans table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY NOT NULL,
        borrower_id TEXT NOT NULL,
        principal_paise INTEGER NOT NULL,
        markup_factor REAL NOT NULL,
        term_months INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        due_day INTEGER NOT NULL,
        product_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
      );
    `);

    // 3. Repayment Schedules
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS repayment_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        installment_number INTEGER NOT NULL,
        original_due_date TEXT NOT NULL,
        effective_due_date TEXT NOT NULL,
        principal_component_paise INTEGER NOT NULL,
        markup_component_paise INTEGER NOT NULL,
        total_due_paise INTEGER NOT NULL,
        principal_paid_paise INTEGER NOT NULL DEFAULT 0,
        markup_paid_paise INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING',
        server_principal_paid_paise INTEGER NOT NULL DEFAULT 0,
        server_markup_paid_paise INTEGER NOT NULL DEFAULT 0,
        server_status TEXT NOT NULL DEFAULT 'PENDING',
        UNIQUE (loan_id, installment_number),
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
      );
    `);

    try {
      await db.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_principal_paid_paise INTEGER NOT NULL DEFAULT 0;`);
    } catch {}
    try {
      await db.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_markup_paid_paise INTEGER NOT NULL DEFAULT 0;`);
    } catch {}
    try {
      await db.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_status TEXT NOT NULL DEFAULT 'PENDING';`);
    } catch {}
    try {
      await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_repayment_schedules_loan_installment ON repayment_schedules (loan_id, installment_number);`);
    } catch {}

    // 4. Transactions table (Fixing the duplicate PK defect)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT UNIQUE NOT NULL,
        operation_id TEXT UNIQUE NOT NULL,
        loan_id TEXT NOT NULL,
        sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL,
        is_cash INTEGER NOT NULL DEFAULT 1,
        payment_method TEXT NOT NULL DEFAULT 'CASH',
        amount_paise INTEGER NOT NULL DEFAULT 0,
        allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
        allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
        allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
        unallocated_surplus_paise INTEGER NOT NULL DEFAULT 0,
        forgiven_principal_paise INTEGER NOT NULL DEFAULT 0,
        forgiven_markup_paise INTEGER NOT NULL DEFAULT 0,
        forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
        effective_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
      );
    `);

    // Prevent transactions update/delete
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS prevent_transactions_update
      BEFORE UPDATE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
      END;
    `);

    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS prevent_transactions_delete
      BEFORE DELETE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
      END;
    `);

    // 5. Schedule Modifications
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS schedule_modifications (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        kist_id TEXT NOT NULL,
        original_due_date TEXT NOT NULL,
        prior_effective_due_date TEXT NOT NULL,
        revised_effective_due_date TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        reason TEXT,
        accrued_penalty_action TEXT NOT NULL,
        waived_penalty_paise INTEGER NOT NULL DEFAULT 0,
        operation_id TEXT NOT NULL UNIQUE,
        FOREIGN KEY (kist_id) REFERENCES repayment_schedules(id) ON DELETE RESTRICT
      );
    `);

    // 6. Sync Outbox (Offline-first client mutations queue)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        operation_id TEXT UNIQUE NOT NULL,
        operation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 7. Sync Meta (Sync state, cursors, timestamps)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  });
}
