import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { Paise, toPaise } from '../../../core/domain/money';
import { Borrower } from '../../../core/database/borrowerRepository';
import { AttachmentItem } from '../../../ui/AttachmentGrid';
import { useDatabase } from '../../../core/database/DatabaseProvider';
import {
  generateSchedule,
  calculateContractInterest,
  calculateMaturityDate,
} from '../../../core/domain/schedule';

export interface LoanDraftState {
  borrowerId: string;
  borrower: Borrower | null;
  productType: 'instalment' | 'bullet';
  rateBasis: 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM';
  principalPaise: Paise;
  annualRate: number;
  termMonths: number;
  startDate: string;
  dueDay: number;
  collateral: string;
  attachments: AttachmentItem[];
}

export interface CalculatedLoanSummary {
  totalInterestPaise: Paise;
  totalPayablePaise: Paise;
  monthlyAmountPaise: Paise;
  maturityDate: string;
  schedule: {
    periodNumber: number;
    dueDate: string;
    principalDuePaise: Paise;
    markupDuePaise: Paise;
    totalDuePaise: Paise;
  }[];
}

export interface LoanWizardContextValue {
  draft: LoanDraftState;
  updateDraft: (updates: Partial<LoanDraftState>) => void;
  resetDraft: () => void;
  calculated: CalculatedLoanSummary;
  commitLoan: () => Promise<string>;
  isSubmitting: boolean;
  submitError: string | null;
}

const initialDraft: LoanDraftState = {
  borrowerId: '',
  borrower: null,
  productType: 'instalment',
  rateBasis: 'ANNUAL_SIMPLE_FLAT',
  principalPaise: toPaise(50000),
  annualRate: 24,
  termMonths: 10,
  startDate: new Date().toISOString().split('T')[0],
  dueDay: 5,
  collateral: '',
  attachments: [],
};

const LoanWizardContext = createContext<LoanWizardContextValue | undefined>(undefined);

export const LoanWizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { loans, triggerRefresh } = useDatabase();
  const [draft, setDraft] = useState<LoanDraftState>(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateDraft = (updates: Partial<LoanDraftState>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const resetDraft = () => {
    setDraft(initialDraft);
    setSubmitError(null);
  };

  const calculated = useMemo<CalculatedLoanSummary>(() => {
    const principal = draft.principalPaise;
    const rate = draft.annualRate;
    const months = draft.termMonths;
    const startDate = draft.startDate;
    const dueDay = draft.dueDay;
    const isBullet = draft.productType === 'bullet';

    if (isBullet) {
      // Bullet loan: Monthly interest only, full principal at maturity
      const monthlyRate = rate / 12 / 100;
      const monthlyInterestPaise = Math.round(principal * monthlyRate) as Paise;
      const totalInterestPaise = Math.round(monthlyInterestPaise * months) as Paise;
      const totalPayablePaise = (principal + totalInterestPaise) as Paise;
      const maturityDate = calculateMaturityDate(startDate, months, dueDay);

      return {
        totalInterestPaise,
        totalPayablePaise,
        monthlyAmountPaise: monthlyInterestPaise,
        maturityDate,
        schedule: [],
      };
    } else {
      // Instalment loan: Fixed monthly kists
      const interestPaise = calculateContractInterest(principal, rate, months);
      const totalPaise = (principal + interestPaise) as Paise;
      const maturityDate = calculateMaturityDate(startDate, months, dueDay);

      let scheduleItems: any[] = [];
      try {
        const gen = generateSchedule({
          principal,
          annualRate: rate,
          rateBasis: 'ANNUAL_SIMPLE_FLAT',
          termMonths: months,
          startDate,
          dueDay,
          productType: 'instalment',
        });
        scheduleItems = gen.map((item) => ({
          periodNumber: item.kistNumber,
          dueDate: item.dueDate,
          principalDuePaise: item.principalDue,
          markupDuePaise: item.markupDue,
          totalDuePaise: item.amountDue,
        }));
      } catch {
        // Fallback if dates invalid during typing
      }

      const monthlyKist = months > 0 ? (Math.round(totalPaise / months) as Paise) : (0 as Paise);

      return {
        totalInterestPaise: interestPaise,
        totalPayablePaise: totalPaise,
        monthlyAmountPaise: monthlyKist,
        maturityDate,
        schedule: scheduleItems,
      };
    }
  }, [
    draft.principalPaise,
    draft.annualRate,
    draft.termMonths,
    draft.startDate,
    draft.dueDay,
    draft.productType,
  ]);

  const commitLoan = async (): Promise<string> => {
    if (!loans) throw new Error('Database not initialized');
    if (!draft.borrowerId) throw new Error('Please select a borrower');

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isBullet = draft.productType === 'bullet';

      // Map attachments to repository input
      const attachmentInputs = draft.attachments.map((att) => ({
        file_path: att.filePath,
        doc_type: att.docType,
        notes: att.fileName,
      }));

      const createdLoan = await loans.createLoanWithSchedule(
        draft.borrowerId,
        {
          principal: draft.principalPaise,
          annualRate: draft.annualRate,
          rateBasis: isBullet ? 'ANNUAL_SIMPLE_FLAT' : undefined,
          termMonths: draft.termMonths,
          startDate: draft.startDate,
          dueDay: draft.dueDay,
          productType: draft.productType,
          collateral: draft.collateral || undefined,
          attachments: attachmentInputs,
        }
      );

      triggerRefresh();
      resetDraft();
      return createdLoan.id;
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create loan');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoanWizardContext.Provider
      value={{
        draft,
        updateDraft,
        resetDraft,
        calculated,
        commitLoan,
        isSubmitting,
        submitError,
      }}
    >
      {children}
    </LoanWizardContext.Provider>
  );
};

export const useLoanWizard = () => {
  const context = useContext(LoanWizardContext);
  if (!context) {
    throw new Error('useLoanWizard must be used within a LoanWizardProvider');
  }
  return context;
};
