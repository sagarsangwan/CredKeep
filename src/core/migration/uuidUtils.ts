import CryptoJS from 'crypto-js';

export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function deterministicUuid(seed: string): string {
  const hash = CryptoJS.MD5(seed).toString();
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function getMigratedTransactionOpId(tx: {
  id?: string;
  operation_id?: string;
  loan_id?: string;
  effective_date?: string;
  amount_paise?: number;
  transaction_type?: string;
}): string {
  if (tx.operation_id && isUuid(tx.operation_id)) {
    return tx.operation_id;
  }
  const prefix = tx.transaction_type === 'WAIVER' ? 'mig-waiver' : 'mig-tx';
  return deterministicUuid(`${prefix}-${tx.id || tx.operation_id || `${tx.loan_id}-${tx.effective_date}-${tx.amount_paise}`}`);
}

