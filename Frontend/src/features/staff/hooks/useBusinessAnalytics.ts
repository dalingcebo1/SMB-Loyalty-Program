import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface TopService {
  service: string;
  count: number;
}

export interface BusinessAnalyticsResponse {
  range_days: number;
  recent_days: number;
  wash_volume_trend: { day: string; started: number; completed: number }[];
  revenue_trend: { day: string; revenue: number }[];
  avg_ticket: number;
  duration_stats: { average_s: number | null; median_s: number | null; p95_s: number | null; slow_wash_count: number | null };
  first_vs_returning: { new: number; returning: number };
  loyalty_share: number;
  active_customers: number;
  top_services: TopService[];
  payment_mix: { manual_started: number; paid_started: number };
  pending_orders_over_10m: number;
  churn_risk_count: number;
  upsell_rate: number;
  deltas?: {
    revenue_pct?: number | null;
    avg_ticket_pct?: number | null;
    loyalty_share_pct?: number | null;
    p95_duration_pct?: number | null;
    upsell_rate_pct?: number | null;
  };
  meta: { generated_at: string };
}

export function useBusinessAnalytics(params: { rangeDays: number; recentDays: number }) {
  return useQuery<BusinessAnalyticsResponse, Error>({
    queryKey: ['business-analytics', params],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get('/payments/business-analytics', {
        params: { range_days: params.rangeDays, recent_days: params.recentDays },
      });
      return data as BusinessAnalyticsResponse;
    }
  });
}
