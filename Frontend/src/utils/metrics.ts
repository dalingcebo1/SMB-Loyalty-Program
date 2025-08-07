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
