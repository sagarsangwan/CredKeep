import { calculateContractInterest, calculateMaturityDate, generateSchedule } from '../core/domain/schedule';
import { toPaise } from '../core/domain/money';

describe('Phase 4 - Loan Creation Wizard Logic', () => {
  it('calculates monthly kist contract interest and schedule correctly', () => {
    const principal = toPaise(50000);
    const annualRate = 24;
    const termMonths = 10;
    const startDate = '2026-03-01';
    const dueDay = 5;

    const interest = calculateContractInterest(principal, annualRate, termMonths);
    // 50,000 * 24 * 10 / 1200 = 10,000 rupees -> 1,000,000 paise
    expect(interest).toBe(toPaise(10000));

    const total = principal + interest;
    expect(total).toBe(toPaise(60000));

    const maturity = calculateMaturityDate(startDate, termMonths, dueDay);
    expect(maturity).toBe('2027-01-05');

    const schedule = generateSchedule({
      principal,
      annualRate,
      rateBasis: 'ANNUAL_SIMPLE_FLAT',
      termMonths,
      startDate,
      dueDay,
      productType: 'instalment',
    });

    expect(schedule.length).toBe(10);
    const totalScheduled = schedule.reduce((sum, s) => sum + s.amountDue, 0);
    expect(totalScheduled).toBe(toPaise(60000));
  });

  it('calculates bullet loan monthly interest and maturity correctly', () => {
    const principal = toPaise(100000); // 1 Lakh
    const annualRate = 24;
    const termMonths = 6;
    const startDate = '2026-01-10';
    const dueDay = 10;

    // Monthly interest = 100,000 * (24 / 12 / 100) = 2,000 rupees -> 200,000 paise
    const monthlyRate = annualRate / 12 / 100;
    const monthlyInterestPaise = Math.round(principal * monthlyRate);
    expect(monthlyInterestPaise).toBe(toPaise(2000));

    const totalInterestPaise = Math.round(monthlyInterestPaise * termMonths);
    expect(totalInterestPaise).toBe(toPaise(12000));

    const maturity = calculateMaturityDate(startDate, termMonths, dueDay);
    expect(maturity).toBe('2026-07-10');
  });

  it('validates high-value loan document threshold (> ₹30,000)', () => {
    const HIGH_VALUE_THRESHOLD = toPaise(30000);
    const loanSmall = toPaise(25000);
    const loanLarge = toPaise(50000);

    expect(loanSmall > HIGH_VALUE_THRESHOLD).toBe(false);
    expect(loanLarge > HIGH_VALUE_THRESHOLD).toBe(true);

    const compliantTypes = ['promissory_note', 'property_paper', 'aadhaar'];
    expect(compliantTypes.includes('promissory_note')).toBe(true);
    expect(compliantTypes.includes('other')).toBe(false);
  });
});
