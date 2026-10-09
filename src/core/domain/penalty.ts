import { Paise, toPaise, addPaise } from './money';

export type PenaltyRule = {
  dailyRatePaise: Paise;
};

export type OverdueKist = {
  kistNumber: number;
  dueDate: string; // YYYY-MM-DD
  amountDue: Paise;
  amountPaid: Paise;
  isFullyPaid: boolean;
};

export type LoanPenaltyState = {
  loanId: string;
  rule: PenaltyRule;
  kists: OverdueKist[];
  assessedDates: Set<string>; // Dates that have already been penalized
};

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startDate);
  const end = new Date(endDate);
  
  // Exclude start date (due date itself is not a late day)
  curr.setDate(curr.getDate() + 1);

  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  
  return dates;
}

export function calculateNewPenalties(
  state: LoanPenaltyState, 
  currentDate: string // YYYY-MM-DD
): { newPenaltyAmount: Paise; newAssessedDates: string[] } {
  let earliestUnpaidDueDate = null;

  for (const kist of state.kists) {
    if (!kist.isFullyPaid && (earliestUnpaidDueDate === null || kist.dueDate < earliestUnpaidDueDate)) {
      earliestUnpaidDueDate = kist.dueDate;
    }
  }

  if (!earliestUnpaidDueDate) {
    return { newPenaltyAmount: 0 as Paise, newAssessedDates: [] };
  }

  // If earliest unpaid due date is in the future or today, no penalty
  if (earliestUnpaidDueDate >= currentDate) {
    return { newPenaltyAmount: 0 as Paise, newAssessedDates: [] };
  }

  const potentialDates = getDatesBetween(earliestUnpaidDueDate, currentDate);
  const newAssessedDates: string[] = [];
  let newPenaltyAmount = 0 as Paise;

  for (const date of potentialDates) {
    // Only assess if not already assessed and not today (or today if we want to charge for today? 
    // "per calendar day for an overdue loan". Let's assume we charge for each past calendar day it was overdue).
    // Usually, you run this on a date and charge up to that date.
    if (!state.assessedDates.has(date)) {
      newAssessedDates.push(date);
      newPenaltyAmount = addPaise(newPenaltyAmount, state.rule.dailyRatePaise);
    }
  }

  return { newPenaltyAmount, newAssessedDates };
}
