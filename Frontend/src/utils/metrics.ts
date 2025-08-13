// Utility labels and formatting for metrics pages

export const ENGAGEMENT_LABELS: Record<string, string> = {
  dau: 'Daily Active Users',
  wau: 'Weekly Active Users',
  mau: 'Monthly Active Users',
  retention_rate: 'Retention Rate',
  churn_rate: 'Churn Rate',
};

export const SUMMARY_LABELS: Record<string, string> = {
  user_count: 'Users',
  transaction_count: 'Transactions',
  points_issued: 'Points Issued',
  points_redeemed: 'Points Redeemed',
  redemptions_count: 'Redemptions',
  visits_total: 'Total Visits',
};

/**
 * Returns a human-friendly label for a metric key, using provided labels or auto-formatting.
 */
export function humanizeMetric(
  key: string,
  labels: Record<string, string> = {}
): string {
  const lower = key.toLowerCase();
  if (labels[lower]) return labels[lower];
  // fallback: split camelCase or snake_case into words
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase());
}
// Format a number as currency (default USD)
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'ZAR',            // South African Rand
    minimumFractionDigits: 2,
  }).format(value);

// Convert 24h hour (0-23) to human-readable time (e.g., '1:00 PM')
export const humanizeHour = (hour: number | string) => {
  const h = Number(hour);
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:00 ${ampm}`;
}

// Shorten weekday names (expects full English day names or numeric strings)
export const humanizeDay = (d: string) => {
  const map: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
  };
  // if numeric dow (0-6), map to names
  if (/^\d+$/.test(d)) {
    const num = Number(d);
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return names[num] || d;
  }
  return map[d] || d;
};
