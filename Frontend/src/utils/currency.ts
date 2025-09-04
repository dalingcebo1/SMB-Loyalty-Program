export function formatCurrency(cents: number, currency: string = 'ZAR', locale?: string) {
  try {
    const l = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-ZA');
    return new Intl.NumberFormat(l, { style: 'currency', currency, minimumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `R${(cents/100).toFixed(0)}`; // fallback simple format
  }
}
