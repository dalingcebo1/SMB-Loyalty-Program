// src/features/staff/hooks/useDashboardAnalytics.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface DashboardAnalyticsResponse {
  total_washes: number;
  completed_washes: number;
  revenue: number; // already in rands (backend divides by 100)
  revenue_breakdown?: {
    period_revenue_cents: number;
    previous_period_revenue_cents: number;
    period_vs_prev_pct: number;
    today_revenue_cents: number;
    month_to_date_revenue_cents: number;
  };
  customer_count: number;
  chart_data: { date: string; washes: number }[];
  period: { start_date: string; end_date: string };
  wash_duration_seconds?: {
    average: number | null;
    median: number | null;
    p95: number | null;
    sample_size: number;
  };
}

export function useDashboardAnalytics(params: { startDate: string; endDate: string }) {
  return useQuery<DashboardAnalyticsResponse, Error>({
    queryKey: ['dashboard-analytics', params],
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 60_000, // 1 min – analytics less volatile
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get('/payments/dashboard-analytics', {
        params: { start_date: params.startDate, end_date: params.endDate },
      });
      return data as DashboardAnalyticsResponse;
    },
    select: (raw) => raw, // placeholder for potential future shaping
    meta: { description: 'Dashboard analytics with tuned staleTime (Phase 2)' }
  });
}
