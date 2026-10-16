import { generateSchedule } from './schedule';
import { toPaise } from './money';

describe('Schedule Generation', () => {
  describe('Instalment loans', () => {
    it('₹20,000 + 30% = ₹26,000, Ten instalments of ₹2,600', () => {
      const schedule = generateSchedule({
        principal: toPaise(20000),
        markupFactor: 0.3,
        termMonths: 10,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment'
      });
      expect(schedule.length).toBe(10);
      expect(schedule[0].amountDue).toBe(toPaise(2600));
      expect(schedule[0].dueDate).toBe('2026-02-01');
      expect(schedule[9].amountDue).toBe(toPaise(2600));
    });

    it('₹24,000 + 30% = ₹31,200, Twelve instalments of ₹2,600', () => {
      const schedule = generateSchedule({
        principal: toPaise(24000),
        markupFactor: 0.3,
        termMonths: 12,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment'
      });
      expect(schedule.length).toBe(12);
      expect(schedule[0].amountDue).toBe(toPaise(2600));
      expect(schedule[0].markupDue).toBe(toPaise(600));
      expect(schedule[0].principalDue).toBe(toPaise(2000));
      
      const totalAmountDue = schedule.reduce((sum, k) => sum + k.amountDue, 0);
      expect(totalAmountDue).toBe(toPaise(31200));
    });

    it('allocates non-divisible totals exact paise', () => {
      const schedule = generateSchedule({
        principal: toPaise(26000),
        markupFactor: 0.0,
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment'
      });
      expect(schedule.length).toBe(3);
      expect(schedule[0].amountDue).toBe(866667);
      expect(schedule[1].amountDue).toBe(866667);
      expect(schedule[2].amountDue).toBe(866666);
    });
  });

  describe('Bullet loans', () => {
    it('monthly fixed-charge bullet schedules, principal due at maturity', () => {
      // Principal 10,000, markup 20% (1.2), total 12,000
      // Markup is 2,000. Across 3 months, markup is 666.67, 666.67, 666.66.
      // Month 1: 666.67
      // Month 2: 666.67
      // Month 3: 666.66 (principal is paid separately)
      const schedule = generateSchedule({
        principal: toPaise(10000),
        markupFactor: 0.2,
        termMonths: 3,
        startDate: '2026-01-15',
        dueDay: 15,
        productType: 'bullet'
      });
      
      expect(schedule.length).toBe(3);
      expect(schedule[0].amountDue).toBe(66667);
      expect(schedule[1].amountDue).toBe(66667);
      expect(schedule[2].amountDue).toBe(66666);
    });
  });

  describe('Date handling', () => {
    it('due-day 31 correctly handles February and March (month-end clamping)', () => {
      const schedule = generateSchedule({
        principal: toPaise(10000),
        markupFactor: 0.0,
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 31,
        productType: 'instalment'
      });
      
      expect(schedule[0].dueDate).toBe('2026-02-28'); // Non-leap year
      expect(schedule[1].dueDate).toBe('2026-03-31');
      expect(schedule[2].dueDate).toBe('2026-04-30');
    });

    it('leap-year handling for February 29', () => {
      const schedule = generateSchedule({
        principal: toPaise(10000),
        markupFactor: 0.0,
        termMonths: 1,
        startDate: '2024-01-01', // 2024 is leap year
        dueDay: 31,
        productType: 'instalment'
      });
      
      expect(schedule[0].dueDate).toBe('2024-02-29');
    });

    it('cross-engine parity: principal 100,050 paise and markup_factor 0.29 matches backend exact rounding', () => {
      const schedule = generateSchedule({
        principal: 100050 as any,
        markupFactor: 0.29,
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment'
      });
      const totalMarkup = schedule.reduce((sum, k) => sum + k.markupDue, 0);
      expect(totalMarkup).toBe(29015);
    });
  });

  describe('Section 4: Monthly Kist — Correct Financial Engine', () => {
    it('₹50,000 at 24% p.a., 10 months -> ₹10,000 interest, ₹60,000 repayment, 10 x ₹6,000', () => {
      const principal = toPaise(50000);
      const schedule = generateSchedule({
        principal,
        annualRate: 24,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 10,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'instalment'
      });

      expect(schedule.length).toBe(10);
      const totalPrincipal = schedule.reduce((sum, k) => sum + k.principalDue, 0);
      const totalMarkup = schedule.reduce((sum, k) => sum + k.markupDue, 0);
      const totalRepayment = schedule.reduce((sum, k) => sum + k.amountDue, 0);

      expect(totalPrincipal).toBe(toPaise(50000));
      expect(totalMarkup).toBe(toPaise(10000));
      expect(totalRepayment).toBe(toPaise(60000));

      for (let i = 0; i < 10; i++) {
        expect(schedule[i].amountDue).toBe(toPaise(6000));
        expect(schedule[i].principalDue).toBe(toPaise(5000));
        expect(schedule[i].markupDue).toBe(toPaise(1000));
      }
    });

    it('handles various durations: 1, 2, 3, 6, 12, 24 months with exact paise conservation', () => {
      const durations = [1, 2, 3, 6, 12, 24];
      for (const term of durations) {
        const schedule = generateSchedule({
          principal: toPaise(35000),
          annualRate: 20,
          rateBasis: 'ANNUAL_SIMPLE_FLAT',
          termMonths: term,
          startDate: '2026-01-01',
          dueDay: 5,
          productType: 'instalment'
        });

        expect(schedule.length).toBe(term);
        const expectedInterest = Math.round((toPaise(35000) * 20 * term) / 1200);
        const sumMarkup = schedule.reduce((sum, k) => sum + k.markupDue, 0);
        const sumPrincipal = schedule.reduce((sum, k) => sum + k.principalDue, 0);
        const sumTotal = schedule.reduce((sum, k) => sum + k.amountDue, 0);

        expect(sumMarkup).toBe(expectedInterest);
        expect(sumPrincipal).toBe(toPaise(35000));
        expect(sumTotal).toBe(toPaise(35000) + expectedInterest);
      }
    });
  });

  describe('Section 5: One-Time Repayment — Completely Separate Engine', () => {
    it('₹10,000 at 30% p.a., 3 months -> ₹750 interest, ₹10,750 at maturity, NO monthly kists', () => {
      const principal = toPaise(10000);
      const schedule = generateSchedule({
        principal,
        annualRate: 30,
        rateBasis: 'ANNUAL_SIMPLE_FLAT',
        termMonths: 3,
        startDate: '2026-01-01',
        dueDay: 1,
        productType: 'bullet'
      });

      // No monthly kists generated!
      expect(schedule.length).toBe(0);

      // Verify contract interest formula
      const { calculateContractInterest, calculateMaturityDate } = require('./schedule');
      const interest = calculateContractInterest(principal, 30, 3);
      expect(interest).toBe(toPaise(750));
      const maturityDue = principal + interest;
      expect(maturityDue).toBe(toPaise(10750));

      const maturityDate = calculateMaturityDate('2026-01-01', 3, 1);
      expect(maturityDate).toBe('2026-04-01');
    });

    it('Extension: 6 additional months on ₹10,000 at 30% p.a. -> ₹1,500 additional interest', () => {
      const { calculateContractInterest } = require('./schedule');
      const principal = toPaise(10000);
      const term1Interest = calculateContractInterest(principal, 30, 3);
      expect(term1Interest).toBe(toPaise(750));

      const extensionInterest = calculateContractInterest(principal, 30, 6);
      expect(extensionInterest).toBe(toPaise(1500));

      const cumulativeInterest = term1Interest + extensionInterest;
      expect(cumulativeInterest).toBe(toPaise(2250));

      const newMaturityDue = principal + extensionInterest; // Assuming term 1 interest ₹750 was collected
      expect(newMaturityDue).toBe(toPaise(11500));
    });
  });
});
