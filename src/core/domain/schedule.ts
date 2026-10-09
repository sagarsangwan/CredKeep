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
  
  const totalRepayment = multiplyPaise(principal, markupFactor);
  const totalMarkup = subtractPaise(totalRepayment, principal);
  
  const schedule: ScheduledKist[] = [];
  
  if (productType === 'instalment') {
    const kistAmounts = dividePaise(totalRepayment, termMonths);
    
    for (let i = 0; i < termMonths; i++) {
      schedule.push({
        kistNumber: i + 1,
        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
        amountDue: kistAmounts[i]
      });
    }
  } else if (productType === 'bullet') {
    const markupInstalments = dividePaise(totalMarkup, termMonths);
    
    for (let i = 0; i < termMonths; i++) {
      let amountDue = markupInstalments[i];
      if (i === termMonths - 1) {
        amountDue = addPaise(amountDue, principal);
      }
      
      schedule.push({
        kistNumber: i + 1,
        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
        amountDue
      });
    }
  }
  
  return schedule;
}
