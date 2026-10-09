import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
import { ScheduledKist } from './models';

export type ScheduleOptions = {
  principal: Paise;
  markupFactor: number;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31
  productType: 'instalment' | 'bullet';
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function calculateNextDueDate(startDateStr: string, monthsToAdd: number, targetDueDay: number): string {
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

export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
  const { principal, markupFactor, termMonths, startDate, dueDay, productType } = options;
  
  const totalMarkup = multiplyPaise(principal, markupFactor);
  const totalRepayment = addPaise(principal, totalMarkup);
  
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
