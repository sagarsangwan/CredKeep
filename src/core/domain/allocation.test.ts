import { allocatePayment } from './allocation';
import { toPaise } from './money';

describe('Payment Allocation Engine (INSTALMENT_FIRST)', () => {
  it('allocates fully to oldest unpaid instalment', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), amountPaid: toPaise(0) },
      { kistNumber: 2, amountDue: toPaise(2600), amountPaid: toPaise(0) }
    ];
    
    const result = allocatePayment({
      paymentAmount: toPaise(2600),
      kists,
      outstandingPenalty: toPaise(0)
    });

    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].allocatedToKist).toBe(1);
    expect(result.allocations[0].amount).toBe(toPaise(2600));
    expect(result.updatedKists[0].amountPaid).toBe(toPaise(2600));
    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.remainingPenalty).toBe(0);
  });

  it('allocates to instalment first, then penalty', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), amountPaid: toPaise(0) }
    ];
    
    // ₹2,600 instalment + ₹500 penalty. Pay ₹3,100.
    const result = allocatePayment({
      paymentAmount: toPaise(3100),
      kists,
      outstandingPenalty: toPaise(500)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.remainingPenalty).toBe(0);
    const penaltyAllocation = result.allocations.find(a => a.allocatedToPenalty > 0);
    expect(penaltyAllocation?.allocatedToPenalty).toBe(toPaise(500));
  });

  it('marks instalment PAID and keeps penalty outstanding if payment exactly covers instalment', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), amountPaid: toPaise(0) }
    ];
    
    // ₹2,600 instalment + ₹500 penalty. Pay ₹2,600.
    const result = allocatePayment({
      paymentAmount: toPaise(2600),
      kists,
      outstandingPenalty: toPaise(500)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.updatedKists[0].amountPaid).toBe(toPaise(2600));
    expect(result.remainingPenalty).toBe(toPaise(500));
    // penalty accrual stop is a logic in penalty engine, not allocation directly
  });

  it('allocates excess to next unpaid instalment (pre-payment)', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), amountPaid: toPaise(0) },
      { kistNumber: 2, amountDue: toPaise(2600), amountPaid: toPaise(0) }
    ];
    
    // Pay ₹2,700 with 0 penalty
    const result = allocatePayment({
      paymentAmount: toPaise(2700),
      kists,
      outstandingPenalty: toPaise(0)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.updatedKists[1].amountPaid).toBe(toPaise(100));
    expect(result.updatedKists[1].status).toBe('PARTIALLY_PAID');
    
    const secondAllocation = result.allocations.find(a => a.allocatedToKist === 2);
    expect(secondAllocation?.amount).toBe(toPaise(100));
  });

  it('cascades a large payment across multiple kists and penalties', () => {
    // Pay ₹6000. Penalty ₹500.
    // 1. Kist 1: ₹2,600 (remaining ₹3400)
    // 2. Penalty: ₹500 (remaining ₹2900)
    
    const kistsWithDueStatus = [
      { kistNumber: 1, amountDue: toPaise(2600), amountPaid: toPaise(0), isDue: true },
      { kistNumber: 2, amountDue: toPaise(2600), amountPaid: toPaise(0), isDue: true },
      { kistNumber: 3, amountDue: toPaise(2600), amountPaid: toPaise(0), isDue: false }
    ];

    const result = allocatePayment({
      paymentAmount: toPaise(6000),
      kists: kistsWithDueStatus,
      outstandingPenalty: toPaise(500)
    });

    // Pay K1 (2600) -> Pay K2 (2600) -> Pay Penalty (500) -> Pay K3 (300)
    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.updatedKists[1].status).toBe('PAID');
    expect(result.remainingPenalty).toBe(0);
    expect(result.updatedKists[2].amountPaid).toBe(toPaise(300));
  });
});
