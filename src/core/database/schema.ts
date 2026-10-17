import { SQLiteDatabase } from 'expo-sqlite';
import { withDbTransaction } from './transaction';

export async function runMigrations(db: SQLiteDatabase) {
  const t0 = Date.now();
  await withDbTransaction(db, async (tx) => {
    // 1. Borrowers table
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS borrowers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Loans table
    await tx.execAsync(`
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
        collateral TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
      );
    `);

    const loanColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loans);`);
    const loanColNames = new Set((loanColumns || []).map((c: any) => c.name));
    if (!loanColNames.has('collateral')) {
      await tx.execAsync(`ALTER TABLE loans ADD COLUMN collateral TEXT;`);
    }
    if (!loanColNames.has('annual_rate')) {
      await tx.execAsync(`ALTER TABLE loans ADD COLUMN annual_rate REAL;`);
    }
    if (!loanColNames.has('rate_basis')) {
      await tx.execAsync(`ALTER TABLE loans ADD COLUMN rate_basis TEXT NOT NULL DEFAULT 'LEGACY_FIXED_TERM';`);
    }
    if (!loanColNames.has('interest_paise')) {
      await tx.execAsync(`ALTER TABLE loans ADD COLUMN interest_paise INTEGER;`);
    }
    if (!loanColNames.has('total_paise')) {
      await tx.execAsync(`ALTER TABLE loans ADD COLUMN total_paise INTEGER;`);
    }
    if (!loanColNames.has('maturity_date')) {
      await tx.execAsync(`ALTER TABLE loans ADD COLUMN maturity_date TEXT;`);
    }

    // 3. Repayment Schedules
    await tx.execAsync(`
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

    const columns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(repayment_schedules);`);
    const colNames = new Set((columns || []).map((c: any) => c.name));
    if (!colNames.has('server_principal_paid_paise')) {
      await tx.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_principal_paid_paise INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!colNames.has('server_markup_paid_paise')) {
      await tx.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_markup_paid_paise INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!colNames.has('server_status')) {
      await tx.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_status TEXT NOT NULL DEFAULT 'PENDING';`);
    }
    await tx.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_repayment_schedules_loan_installment ON repayment_schedules (loan_id, installment_number);`);

    // 4. Transactions table (Fixing the duplicate PK defect)
    await tx.execAsync(`
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

    const txColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(transactions);`);
    const txColNames = new Set((txColumns || []).map((c: any) => c.name));
    if (!txColNames.has('reversal_of_id')) {
      await tx.execAsync(`ALTER TABLE transactions ADD COLUMN reversal_of_id TEXT;`);
    }
    if (!txColNames.has('correction_reason')) {
      await tx.execAsync(`ALTER TABLE transactions ADD COLUMN correction_reason TEXT;`);
    }

    // Prevent transactions update/delete
    await tx.execAsync(`
      CREATE TRIGGER IF NOT EXISTS prevent_transactions_update
      BEFORE UPDATE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
      END;
    `);

    await tx.execAsync(`
      CREATE TRIGGER IF NOT EXISTS prevent_transactions_delete
      BEFORE DELETE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
      END;
    `);

    // 5. Schedule Modifications
    await tx.execAsync(`
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

    // 6. Loan Terms (One-Time Repayment terms and historical extensions)
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS loan_terms (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        term_number INTEGER NOT NULL,
        duration_months INTEGER NOT NULL,
        annual_rate REAL NOT NULL,
        interest_paise INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        maturity_date TEXT NOT NULL,
        interest_paid_paise INTEGER NOT NULL DEFAULT 0,
        settled INTEGER NOT NULL DEFAULT 0,
        interest_settled INTEGER NOT NULL DEFAULT 0,
        operation_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_loan_terms_loan ON loan_terms(loan_id, term_number);
    `);

    const termColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loan_terms);`);
    const termColNames = new Set((termColumns || []).map((c: any) => c.name));
    if (!termColNames.has('interest_settled')) {
      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN interest_settled INTEGER NOT NULL DEFAULT 0;`);
      await tx.execAsync(`UPDATE loan_terms SET interest_settled = settled WHERE interest_settled IS NULL OR interest_settled = 0;`);
    }
    if (!termColNames.has('settled')) {
      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN settled INTEGER NOT NULL DEFAULT 0;`);
      await tx.execAsync(`UPDATE loan_terms SET settled = interest_settled WHERE settled IS NULL OR settled = 0;`);
    }
    if (!termColNames.has('operation_id')) {
      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN operation_id TEXT;`);
    }

    // 7. Payment Corrections (Auditable correction history linking reversal and replacement)
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS payment_corrections (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        original_transaction_id TEXT NOT NULL,
        original_operation_id TEXT,
        reversal_transaction_id TEXT NOT NULL,
        replacement_transaction_id TEXT,
        original_amount_paise INTEGER NOT NULL DEFAULT 0,
        previous_amount_paise INTEGER NOT NULL DEFAULT 0,
        corrected_amount_paise INTEGER NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        operation_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_payment_corrections_loan ON payment_corrections(loan_id);
    `);

    const corrColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(payment_corrections);`);
    const corrColNames = new Set((corrColumns || []).map((c: any) => c.name));
    if (!corrColNames.has('previous_amount_paise')) {
      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN previous_amount_paise INTEGER NOT NULL DEFAULT 0;`);
      await tx.execAsync(`UPDATE payment_corrections SET previous_amount_paise = original_amount_paise WHERE previous_amount_paise IS NULL OR previous_amount_paise = 0;`);
    }
    if (!corrColNames.has('original_amount_paise')) {
      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN original_amount_paise INTEGER NOT NULL DEFAULT 0;`);
      await tx.execAsync(`UPDATE payment_corrections SET original_amount_paise = previous_amount_paise WHERE original_amount_paise IS NULL OR original_amount_paise = 0;`);
    }
    if (!corrColNames.has('original_operation_id')) {
      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN original_operation_id TEXT;`);
    }
    if (!corrColNames.has('operation_id')) {
      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN operation_id TEXT;`);
    }

    // 8. Loan Attachments (Security cheques, affidavits, collateral documents)
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS loan_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        document_type TEXT,
        doc_type TEXT,
        file_path TEXT NOT NULL,
        file_name TEXT,
        file_size INTEGER NOT NULL DEFAULT 0,
        mime_type TEXT,
        notes TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
        created_at TEXT NOT NULL,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_loan_attachments_loan ON loan_attachments(loan_id);
    `);

    const attColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loan_attachments);`);
    const attColNames = new Set((attColumns || []).map((c: any) => c.name));
    if (!attColNames.has('doc_type')) {
      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN doc_type TEXT;`);
      await tx.execAsync(`UPDATE loan_attachments SET doc_type = document_type WHERE doc_type IS NULL AND document_type IS NOT NULL;`);
    }
    if (!attColNames.has('document_type')) {
      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN document_type TEXT;`);
      await tx.execAsync(`UPDATE loan_attachments SET document_type = doc_type WHERE document_type IS NULL AND doc_type IS NOT NULL;`);
    }
    if (!attColNames.has('synced')) {
      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN synced INTEGER NOT NULL DEFAULT 0;`);
      await tx.execAsync(`UPDATE loan_attachments SET synced = CASE WHEN sync_status = 'SYNCED' THEN 1 ELSE 0 END WHERE synced IS NULL;`);
    }
    if (!attColNames.has('sync_status')) {
      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY';`);
      await tx.execAsync(`UPDATE loan_attachments SET sync_status = CASE WHEN synced = 1 THEN 'SYNCED' ELSE 'LOCAL_ONLY' END WHERE sync_status IS NULL;`);
    }
    if (!attColNames.has('file_name')) {
      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN file_name TEXT;`);
      await tx.execAsync(`UPDATE loan_attachments SET file_name = file_path WHERE file_name IS NULL AND file_path IS NOT NULL;`);
    }

    // 9. Sync Outbox (Offline-first client mutations queue)
    await tx.execAsync(`
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

    // 10. Sync Meta (Sync state, cursors, timestamps)
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  });
  console.log(`[LIFECYCLE] MIGRATIONS_COMPLETE: all tables and triggers ready in ${Date.now() - t0}ms`);
}
