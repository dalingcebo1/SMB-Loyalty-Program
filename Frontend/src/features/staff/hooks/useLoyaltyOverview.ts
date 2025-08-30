import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import type { TopCustomerItem } from './useTopCustomers';

export interface LoyaltyOverviewData {
  overview: {
    loyalty_penetration: number;
    avg_points_redeemed_per_wash: number;
    total_points_redeemed: number;
    total_points_earned: number;
    outstanding_points: number;
  };
  top_customers: TopCustomerItem[];
  churn_candidates: Array<{ user_id: number; name: string; days_since_last: number; percentile: number; churn_risk_flag: boolean }>;
}

export function useLoyaltyOverview(params: { startDate?: string; endDate?: string }) {
  return useQuery<LoyaltyOverviewData, Error>({
    queryKey: ['analytics','loyalty-overview', params],
    queryFn: async () => {
      const { data } = await api.get('/analytics/loyalty/overview', { params: { start_date: params.startDate, end_date: params.endDate } });
      return data;
    },
    staleTime: 120_000
  });
}
