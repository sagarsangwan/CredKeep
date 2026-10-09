import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { allocatePayment, KistAllocationState } from '../domain/allocation';
import { Paise } from '../domain/money';

export class TransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  async recordCashPayment(
    loanId: string, 
    paymentAmount: Paise, 
    operationId: string,
    effectiveDate: string
  ) {
      let returnResult: any = null;

      await this.db.withExclusiveTransactionAsync(async (tx) => {
        // Idempotency check
        const existing = await this.db.getFirstAsync(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
        if (existing) {
          returnResult = existing;
          return;
        }
        
        // Load current kists
        const dbKists = await this.db.getAllAsync<any>(
          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`, 
          [loanId]
        );
        
        const kists: KistAllocationState[] = dbKists.map(k => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise as Paise,
          principalDue: k.principal_component_paise as Paise,
          markupDue: k.markup_component_paise as Paise,
          amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
          principalPaid: k.principal_paid_paise as Paise,
          markupPaid: k.markup_paid_paise as Paise,
          status: k.status,
          isDue: k.effective_due_date <= effectiveDate
        }));
        
        // TODO: Fetch real penalty from penalty engine. For now, 0.
        const outstandingPenalty = 0 as Paise;
  
        const result = allocatePayment({ paymentAmount, kists, outstandingPenalty });
        
        const transactionId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        
        let allocatedPrincipal = 0;
        let allocatedMarkup = 0;
        let allocatedPenalty = 0;
        
        for (const a of result.allocations) {
          allocatedPrincipal += a.allocatedToPrincipal;
          allocatedMarkup += a.allocatedToMarkup;
          allocatedPenalty += a.allocatedToPenalty;
        }
        
        await this.db.runAsync(`
          INSERT INTO transactions (
            id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
            amount_paise, allocated_principal_paise, allocated_markup_paise, 
            allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          transactionId, operationId, loanId, 'COLLECTION', 1, 'CASH',
          paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
          result.unallocatedFunds, effectiveDate, createdAt
        ]);
        
        // Update repayment schedules
        const updateStmt = await this.db.prepareAsync(`
          UPDATE repayment_schedules
          SET principal_paid_paise = ?, markup_paid_paise = ?, status = ?
          WHERE loan_id = ? AND installment_number = ?
        `);
        
        try {
          for (const k of result.updatedKists) {
            // Only update if changed
            const orig = kists.find(o => o.kistNumber === k.kistNumber)!;
            if (k.amountPaid !== orig.amountPaid || k.status !== orig.status) {
               await updateStmt.executeAsync([
                 k.principalPaid, k.markupPaid, k.status || 'PENDING', loanId, k.kistNumber
               ]);
            }
          }
        } finally {
          await updateStmt.finalizeAsync();
        }
        
        returnResult = { success: true, transactionId, result };
      });
      
      return returnResult;
  }
}
