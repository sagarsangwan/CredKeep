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
  if (!Number.isFinite(factor) || factor < 0) {
    throw new Error('Markup factor must be a finite non-negative number');
  }
  // To prevent IEEE 754 floating-point drift (e.g. 100050 * 0.29 producing 29014.499999999996 instead of 29014.5),
  // parse the decimal string to perform exact decimal scaling with round-half-up arithmetic matching backend.
  const str = factor.toString();
  if (!str.includes('.')) {
    const result = Math.round(a * factor);
    ensureSafeInteger(result);
    return result as Paise;
  }
  const [intPart, fracPart] = str.split('.');
  const scale = 10n ** BigInt(fracPart.length);
  const intFactor = BigInt(intPart) * scale + BigInt(fracPart);
  const num = BigInt(a) * intFactor;
  // Exact round-half-up: (2 * num + scale) / (2 * scale)
  const rounded = (2n * num + scale) / (2n * scale);
  const result = Number(rounded);
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
