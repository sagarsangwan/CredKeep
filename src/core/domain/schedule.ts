import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
import { ScheduledKist } from './models';

export type RateBasis = 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM';

export type ScheduleOptions = {
  principal: Paise;
  annualRate?: number;
  rateBasis?: RateBasis;
  markupFactor?: number;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31
  productType: 'instalment' | 'bullet';
  collateral?: string | null;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function calculateNextDueDate(startDateStr: string, monthsToAdd: number, targetDueDay: number): string {
  const [yearStr, monthStr] = startDateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  
  month += monthsToAdd;
  
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  
  const daysInMonth = getDaysInMonth(year, month);
  const finalDay = Math.min(targetDueDay, daysInMonth);
  
  const yyyy = year.toString();
  const mm = month.toString().padStart(2, '0');
  const dd = finalDay.toString().padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

export function calculateMaturityDate(startDateStr: string, termMonths: number, targetDueDay: number): string {
  return calculateNextDueDate(startDateStr, termMonths, targetDueDay);
}

export function calculateContractInterest(
  principal: Paise,
  annualRate: number,
  termMonths: number
): Paise {
  if (annualRate < 0 || termMonths <= 0) {
    throw new Error('annualRate and termMonths must be non-negative');
  }
  // Formula: Interest = Principal × AnnualRate × DurationMonths / 1200
  return Math.round((principal * annualRate * termMonths) / 1200) as Paise;
}

export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
  const {
    principal,
    annualRate,
    rateBasis = (annualRate !== undefined ? 'ANNUAL_SIMPLE_FLAT' : 'LEGACY_FIXED_TERM'),
    markupFactor = 0,
    termMonths,
    startDate,
    dueDay,
    productType
  } = options;

  if (termMonths <= 0) {
    throw new Error('termMonths must be a positive integer');
  }

  // ONE-TIME REPAYMENT (Bullet): NO monthly kists are generated.
  if (productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
    return [];
  }

  let totalMarkup: Paise;
  if (rateBasis === 'ANNUAL_SIMPLE_FLAT' && annualRate !== undefined) {
    totalMarkup = calculateContractInterest(principal, annualRate, termMonths);
  } else {
    if (!Number.isFinite(markupFactor) || markupFactor < 0) {
      throw new Error('markupFactor must be a finite non-negative number');
    }
    totalMarkup = multiplyPaise(principal, markupFactor);
  }

  const schedule: ScheduledKist[] = [];

  if (productType === 'instalment') {
    const principalInstalments = dividePaise(principal, termMonths);
    const markupInstalments = dividePaise(totalMarkup, termMonths);

    for (let i = 0; i < termMonths; i++) {
      schedule.push({
        kistNumber: i + 1,
        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
        amountDue: addPaise(principalInstalments[i], markupInstalments[i]),
        principalDue: principalInstalments[i],
        markupDue: markupInstalments[i]
      });
    }
  } else if (productType === 'bullet') {
    // Legacy fixed-term markup bullet
    const markupInstalments = dividePaise(totalMarkup, termMonths);

    for (let i = 0; i < termMonths; i++) {
      const principalDue = 0 as Paise;
      const markupDue = markupInstalments[i];
      const amountDue = addPaise(principalDue, markupDue);

      schedule.push({
        kistNumber: i + 1,
        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
        amountDue,
        principalDue,
        markupDue
      });
    }
  }

  return schedule;
}
