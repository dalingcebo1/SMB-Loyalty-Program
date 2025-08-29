// src/features/staff/hooks/useDashboardAnalytics.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface DashboardAnalyticsResponse {
  total_washes: number;
  completed_washes: number;
  revenue: number; // already in rands (backend divides by 100)
  customer_count: number;
  chart_data: { date: string; washes: number }[];
  period: { start_date: string; end_date: string };
}

export function useDashboardAnalytics(params: { startDate: string; endDate: string }) {
  return useQuery<DashboardAnalyticsResponse>({
    queryKey: ['dashboard-analytics', params],
    queryFn: async () => {
      const { data } = await api.get('/payments/dashboard-analytics', {
        params: { start_date: params.startDate, end_date: params.endDate },
      });
      return data as DashboardAnalyticsResponse;
    },
  });
}
