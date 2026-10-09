import { Paise, subtractPaise, addPaise } from './money';
import { PaymentAllocation } from './models';

export type KistAllocationState = {
  kistNumber: number;
  amountDue: Paise;
  principalDue: Paise;
  markupDue: Paise;
  amountPaid: Paise;
  principalPaid: Paise;
  markupPaid: Paise;
  isDue?: boolean;
  status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
};

function allocateWithinKist(
  amount: Paise,
  kist: KistAllocationState
): { p: Paise; m: Paise } {
  const unpaidPrincipal = subtractPaise(kist.principalDue, kist.principalPaid);
  const unpaidMarkup = subtractPaise(kist.markupDue, kist.markupPaid);

  if (amount >= addPaise(unpaidPrincipal, unpaidMarkup)) {
    return { p: unpaidPrincipal, m: unpaidMarkup };
  }

  // Allocate to markup first, then principal
  let m = amount;
  if (m > unpaidMarkup) {
    m = unpaidMarkup;
  }
  
  const p = subtractPaise(amount, m);
  
  return { p, m };
}

export type AllocationInput = {
  paymentAmount: Paise;
  kists: KistAllocationState[];
  outstandingPenalty: Paise;
};

export type AllocationResult = {
  updatedKists: KistAllocationState[];
  allocations: PaymentAllocation[];
  remainingPenalty: Paise;
  unallocatedFunds: Paise;
};

export function allocatePayment(input: AllocationInput): AllocationResult {
  let remainingFunds = input.paymentAmount;
  let remainingPenalty = input.outstandingPenalty;
  
  const updatedKists = input.kists.map(k => {
    let resolvedStatus = k.status;
    if (!resolvedStatus || (resolvedStatus as string) === 'PENDING' || resolvedStatus === 'UNPAID' || resolvedStatus === 'PARTIALLY_PAID') {
      resolvedStatus = k.amountPaid >= k.amountDue ? 'PAID' : (k.amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    }
    // Also auto-fix if amountPaid somehow >= amountDue but status isn't PAID
    if (k.amountPaid >= k.amountDue && resolvedStatus !== 'PAID') {
      resolvedStatus = 'PAID';
    }
    return { ...k, status: resolvedStatus };
  });
  
  const allocations: PaymentAllocation[] = [];
  
  // Phase 1: Due instalments (oldest first)
  for (const kist of updatedKists) {
    if (kist.isDue !== false && kist.status !== 'PAID' && remainingFunds > 0) {
      const remainingDue = subtractPaise(kist.amountDue, kist.amountPaid);
      const allocatedToKist = Math.min(remainingFunds, remainingDue) as Paise;
      
      kist.amountPaid = addPaise(kist.amountPaid, allocatedToKist);
      remainingFunds = subtractPaise(remainingFunds, allocatedToKist);
      
      if (kist.amountPaid >= kist.amountDue) {
        kist.status = 'PAID';
      } else {
        kist.status = 'PARTIALLY_PAID';
      }
      
      if (allocatedToKist > 0) {
        const { p, m } = allocateWithinKist(allocatedToKist, kist);
        kist.principalPaid = addPaise(kist.principalPaid, p);
        kist.markupPaid = addPaise(kist.markupPaid, m);

        allocations.push({
          amount: allocatedToKist,
          allocatedToKist: kist.kistNumber,
          allocatedToPrincipal: p,
          allocatedToMarkup: m,
          allocatedToPenalty: 0 as Paise
        });
      }
    }
  }
  
  // Phase 2: Outstanding penalties
  if (remainingFunds > 0 && remainingPenalty > 0) {
    const allocatedToPenalty = Math.min(remainingFunds, remainingPenalty) as Paise;
    remainingPenalty = subtractPaise(remainingPenalty, allocatedToPenalty);
    remainingFunds = subtractPaise(remainingFunds, allocatedToPenalty);
    
    allocations.push({
      amount: allocatedToPenalty,
      allocatedToKist: 0, // 0 indicates loan-level penalty
      allocatedToPrincipal: 0 as Paise,
      allocatedToMarkup: 0 as Paise,
      allocatedToPenalty: allocatedToPenalty
    });
  }
  
  // Phase 3: Future non-due instalments (pre-payments)
  for (const kist of updatedKists) {
    if (kist.isDue === false && kist.status !== 'PAID' && remainingFunds > 0) {
      const remainingDue = subtractPaise(kist.amountDue, kist.amountPaid);
      const allocatedToKist = Math.min(remainingFunds, remainingDue) as Paise;
      
      kist.amountPaid = addPaise(kist.amountPaid, allocatedToKist);
      remainingFunds = subtractPaise(remainingFunds, allocatedToKist);
      
      if (kist.amountPaid >= kist.amountDue) {
        kist.status = 'PAID';
      } else {
        kist.status = 'PARTIALLY_PAID';
      }
      
      if (allocatedToKist > 0) {
        const { p, m } = allocateWithinKist(allocatedToKist, kist);
        kist.principalPaid = addPaise(kist.principalPaid, p);
        kist.markupPaid = addPaise(kist.markupPaid, m);

        allocations.push({
          amount: allocatedToKist,
          allocatedToKist: kist.kistNumber,
          allocatedToPrincipal: p,
          allocatedToMarkup: m,
          allocatedToPenalty: 0 as Paise
        });
      }
    }
  }

  return {
    updatedKists,
    allocations,
    remainingPenalty,
    unallocatedFunds: remainingFunds
  };
}
