export type Paise = number & { readonly __brand: unique symbol };

function ensureSafeInteger(value: number): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new Error('Money overflow');
  }
}

export function toPaise(rupees: number): Paise {
  // Avoid floating point drift by rounding, but first check if it had more than 2 decimal places
  // (ignoring tiny floating point inaccuracies)
  const asPaise = Math.round(rupees * 100);
  
  if (Math.abs(rupees * 100 - asPaise) > 1e-9) {
    throw new Error('Invalid rupees: more than 2 decimal places');
  }
  
  ensureSafeInteger(asPaise);
  return asPaise as Paise;
}

export function fromPaise(paise: Paise): number {
  ensureSafeInteger(paise);
  return paise / 100;
}

export function addPaise(a: Paise, b: Paise): Paise {
  const result = a + b;
  ensureSafeInteger(result);
  return result as Paise;
}

export function subtractPaise(a: Paise, b: Paise): Paise {
  const result = a - b;
  ensureSafeInteger(result);
  return result as Paise;
}

export function multiplyPaise(a: Paise, factor: number): Paise {
  const result = Math.round(a * factor);
  ensureSafeInteger(result);
  return result as Paise;
}

export function dividePaise(total: Paise, parts: number): Paise[] {
  if (parts <= 0 || !Number.isInteger(parts)) {
    throw new Error('Parts must be a positive integer');
  }
  
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  
  const result = new Array(parts).fill(base);
  for (let i = 0; i < remainder; i++) {
    result[i] += 1;
  }
  
  return result as Paise[];
}

export function formatINR(paise: Paise): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(paise / 100);
}
