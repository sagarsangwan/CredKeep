import { Paise, toPaise, fromPaise, addPaise, subtractPaise, multiplyPaise, dividePaise, formatINR } from './money';

describe('Money', () => {
  describe('toPaise', () => {
    it('converts exact rupees to paise without floating-point drift', () => {
      expect(toPaise(100.05)).toBe(10005);
      expect(toPaise(20000.30)).toBe(2000030);
      // Floating point drift example: 0.1 + 0.2 = 0.30000000000000004
      expect(toPaise(0.1 + 0.2)).toBe(30);
    });

    it('rejects values with more than 2 decimal places', () => {
      expect(() => toPaise(10.123)).toThrow('Invalid rupees: more than 2 decimal places');
    });

    it('rejects values outside safe integer bounds', () => {
      expect(() => toPaise(Number.MAX_SAFE_INTEGER)).toThrow('Money overflow');
    });
  });

  describe('fromPaise', () => {
    it('converts paise to exact rupees', () => {
      expect(fromPaise(10005 as Paise)).toBe(100.05);
      expect(fromPaise(2000030 as Paise)).toBe(20000.30);
    });
  });

  describe('arithmetic', () => {
    it('adds two paise amounts', () => {
      const a = toPaise(10.50);
      const b = toPaise(20.25);
      expect(addPaise(a, b)).toBe(3075);
    });

    it('subtracts two paise amounts', () => {
      const a = toPaise(20.25);
      const b = toPaise(10.50);
      expect(subtractPaise(a, b)).toBe(975);
    });

    it('multiplies paise by a factor', () => {
      const a = toPaise(20000);
      // 20000 + 30% = 26000
      expect(multiplyPaise(a, 1.3)).toBe(2600000);
    });

    it('performs exact decimal round-half-up matching backend Python Decimal arithmetic (cross-engine parity)', () => {
      // 100050 * 0.29 in IEEE-754 floats drifts to 29014.499999999996 which naive Math.round rounds to 29014.
      // With exact decimal round-half-up, 100050 * 0.29 = 29014.50 which rounds up to 29015.
      expect(multiplyPaise(100050 as Paise, 0.29)).toBe(29015);
    });

    it('allocates rounding remainders exactly when dividing', () => {
      // 26000 / 3 = 8666.666...
      // Should give [866667, 866667, 866666] in paise
      const total = toPaise(26000);
      const parts = dividePaise(total, 3);
      expect(parts).toEqual([866667, 866667, 866666]);
      expect(parts.reduce((sum, p) => sum + p, 0)).toBe(total);
    });

    it('throws on overflow during arithmetic', () => {
      const max = Number.MAX_SAFE_INTEGER as Paise;
      expect(() => addPaise(max, 1 as Paise)).toThrow('Money overflow');
      expect(() => multiplyPaise(max, 2)).toThrow('Money overflow');
    });
  });

  describe('formatINR', () => {
    it('formats to en-IN locale string', () => {
      expect(formatINR(toPaise(20000))).toBe('₹20,000.00');
      expect(formatINR(toPaise(26000))).toBe('₹26,000.00');
      expect(formatINR(toPaise(100.05))).toBe('₹100.05');
    });
  });
});
