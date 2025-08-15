// Metric response types

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyValue {
  date: string;
  value: number;
}

export interface TierDistributionItem {
  tier: string;
  count: number;
}

export interface TopRewardItem {
  title: string;
  count: number;
}

// Summary dashboard response
export interface SummaryMetrics {
  user_count: number;
  transaction_count: number;
  points_issued: number;
  points_redeemed: number;
  redemptions_count: number;
  user_growth: DailyCount[];
  transaction_volume: DailyValue[];
  tier_distribution: TierDistributionItem[];
  visits_total: number;
  visits_over_time: DailyCount[];
  top_rewards: TopRewardItem[];
}

// Detailed metrics for drill-down pages
export interface UserMetrics {
  dau: number;
  wau: number;
  mau: number;
  retention_rate: number;
  churn_rate: number;
}

export interface TransactionMetrics {
  average_value: number;
  per_user: number;
  conversion_rate: number;
  peak_hours: { hour: string; count: number }[];
  peak_days: { day: string; count: number }[];
}

export interface PointsMetricsData {
  points_issued_over_time: DailyValue[];
  points_redeemed_over_time: DailyValue[];
  redemption_rate: number;
  avg_points_per_transaction: number;
}

export interface RedemptionsMetricsData {
  total_redemptions: number;
  avg_redemption_cost: number;
  reward_conversion_rate: number;
}

export interface VisitsMetricsData {
  visits_per_user: number;
  peak_visit_hours: { hour: string; count: number }[];
  peak_visit_days: { day: string; count: number }[];
}

export interface LoyaltyMetricsData {
  tier_progression: { tier: string; count: number }[];
  avg_time_in_tier: { tier: string; avg_days: number }[];
}

export interface FinancialMetricsData {
  revenue: number;
  arpu: number;
  ltv: number;
}
// Top clients by spend and visits
export interface TopClientByValue {
  user_id: number;
  name: string;
  value: number;
}
export interface TopClientByVisits {
  user_id: number;
  name: string;
  visits: number;
}
export interface TopClientsData {
  by_transaction_value: TopClientByValue[];
  by_visits: TopClientByVisits[];
}
