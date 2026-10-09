import { Paise } from './money';

export type LoanContract = {
  id: string;
  principal: Paise;
  markupFactor: number;
  totalRepayment: Paise;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31
  productType: 'instalment' | 'bullet';
};

export type ScheduledKist = {
  kistNumber: number;
  dueDate: string; // YYYY-MM-DD
  amountDue: Paise;
};

export type OverduePeriod = {
  kistNumber: number;
  daysOverdue: number;
  penaltyApplied: Paise;
};

export type PaymentAllocation = {
  amount: Paise;
  allocatedToKist: number;
  allocatedToPrincipal: Paise;
  allocatedToMarkup: Paise;
  allocatedToPenalty: Paise;
};

export type TransactionJournalRow = {
  id: string;
  timestamp: string;
  type: 'DISBURSEMENT' | 'PAYMENT' | 'PENALTY' | 'ADJUSTMENT';
  amount: Paise;
  balanceAfter: Paise;
};
