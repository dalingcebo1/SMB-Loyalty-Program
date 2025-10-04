import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCents } from '../format';

// Using en-ZA locale ZAR; we only assert numeric portion to avoid brittle locale symbol spacing differences.
const strip = (s: string) => s.replace(/[^0-9.,-]/g, '');

describe('currency formatting helpers', () => {
  it('formatCurrency handles null/undefined', () => {
    expect(strip(formatCurrency(null as unknown as number))).toBe(strip(formatCurrency(0)));
    expect(strip(formatCurrency(undefined as unknown as number))).toBe(strip(formatCurrency(0)));
  });

  it('formatCurrency formats rands with 2 decimals', () => {
  const out = strip(formatCurrency(1234.5)).replace(/\s/g,'');
  // Accept optional thousands separator and ensure two decimal places remain "50"
  expect(out).toMatch(/^1234[.,]50$|^1[.,]?234[.,]50$/);
  });

  it('formatCents converts integer cents to rands', () => {
    expect(strip(formatCents(0))).toBe(strip(formatCurrency(0)));
    expect(strip(formatCents(250))).toBe(strip(formatCurrency(2.5)));
    expect(strip(formatCents(123456))).toBe(strip(formatCurrency(1234.56)));
  });

  it('formatCents tolerates bad input', () => {
    expect(strip(formatCents(undefined as unknown as number))).toBe(strip(formatCurrency(0)));
  });
});
