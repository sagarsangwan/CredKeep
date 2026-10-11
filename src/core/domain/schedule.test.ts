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
});
