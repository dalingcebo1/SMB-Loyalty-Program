// src/utils/format.ts
// Shared lightweight formatting helpers for staff dashboard components.
// Avoid heavy date-fns dependency for now; implement minimal logic.

const currencyFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return currencyFormatter.format(0);
  return currencyFormatter.format(amount);
}

// Convenience helper: accept integer cents and format as currency in rands.
// Safe for undefined/null; treats invalid as 0.
export function formatCents(amountCents?: number | null): string {
  if (amountCents == null || isNaN(amountCents)) return formatCurrency(0);
  return formatCurrency(amountCents / 100);
}

export function formatTimeHM(timestamp: string | number | Date): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(timestamp: string | number | Date): string {
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// Returns e.g. "5m ago", "2h ago", "Yesterday", or date for older.
export function formatRelativeTime(timestamp: string | number | Date): string {
  const now = Date.now();
  const t = new Date(timestamp).getTime();
  const diffMs = now - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  // Fallback to date string for older entries
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
