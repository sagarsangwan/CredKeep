import { calculateNewPenalties, LoanPenaltyState } from './penalty';
import { toPaise } from './money';

describe('Penalty Engine', () => {
  it('calculates penalty for a single kist 5 days overdue', () => {
    const state: LoanPenaltyState = {
      loanId: '1',
      rule: { dailyRatePaise: toPaise(100) },
      kists: [
        { kistNumber: 1, dueDate: '2026-10-01', amountDue: toPaise(2600), amountPaid: toPaise(0), isFullyPaid: false }
      ],
      assessedDates: new Set()
    };

    // 5 days overdue (Oct 2, 3, 4, 5, 6)
    const result = calculateNewPenalties(state, '2026-10-06');
    expect(result.newPenaltyAmount).toBe(toPaise(500));
    expect(result.newAssessedDates.length).toBe(5);
    expect(result.newAssessedDates).toContain('2026-10-02');
    expect(result.newAssessedDates).toContain('2026-10-06');
  });

  it('does not duplicate penalty if multiple kists are overdue', () => {
    const state: LoanPenaltyState = {
      loanId: '1',
      rule: { dailyRatePaise: toPaise(100) },
      kists: [
        { kistNumber: 1, dueDate: '2026-09-01', amountDue: toPaise(2600), amountPaid: toPaise(0), isFullyPaid: false },
        { kistNumber: 2, dueDate: '2026-10-01', amountDue: toPaise(2600), amountPaid: toPaise(0), isFullyPaid: false }
      ],
      assessedDates: new Set()
    };

    // Check penalty on Oct 6.
    // If it was already assessed up to Oct 1, then from Oct 2 to 6 is 5 days.
    const dates = new Set<string>();
    for (let d = 2; d <= 30; d++) {
      dates.add(`2026-09-${String(d).padStart(2, '0')}`);
    }
    dates.add('2026-10-01');
    state.assessedDates = dates;
    
    const result = calculateNewPenalties(state, '2026-10-06');
    expect(result.newPenaltyAmount).toBe(toPaise(500));
    expect(result.newAssessedDates.length).toBe(5);
  });

  it('stops penalty when kists are fully paid', () => {
    const state: LoanPenaltyState = {
      loanId: '1',
      rule: { dailyRatePaise: toPaise(100) },
      kists: [
        { kistNumber: 1, dueDate: '2026-10-01', amountDue: toPaise(2600), amountPaid: toPaise(2600), isFullyPaid: true }
      ],
      assessedDates: new Set()
    };

    const result = calculateNewPenalties(state, '2026-10-06');
    expect(result.newPenaltyAmount).toBe(0);
    expect(result.newAssessedDates.length).toBe(0);
  });

  it('does not assess penalty on zero-value installments even if marked not fully paid', () => {
    const state: LoanPenaltyState = {
      loanId: '1',
      rule: { dailyRatePaise: toPaise(100) },
      kists: [
        { kistNumber: 1, dueDate: '2026-10-01', amountDue: toPaise(0), amountPaid: toPaise(0), isFullyPaid: false }
      ],
      assessedDates: new Set()
    };

    const result = calculateNewPenalties(state, '2026-10-06');
    expect(result.newPenaltyAmount).toBe(0);
    expect(result.newAssessedDates.length).toBe(0);
  });
});
