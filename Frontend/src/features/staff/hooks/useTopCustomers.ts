import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface TopCustomerItem {
  user_id: number;
  name: string;
  total_washes: number;
  completed_washes: number;
  revenue_cents: number;
  avg_spend_cents: number;
  last_visit?: string;
  loyalty_wash_count: number;
  loyalty_share: number;
  points_redeemed: number;
  points_outstanding: number;
}
export interface TopCustomersResponse { items: TopCustomerItem[]; total: number; }

export function useTopCustomers(params: { startDate?: string; endDate?: string; sort?: 'revenue'|'washes'|'loyalty_share'; limit?: number; offset?: number }) {
  return useQuery<TopCustomersResponse, Error>({
    queryKey: ['analytics','top-customers', params],
    queryFn: async () => {
      const { data } = await api.get('/analytics/customers/top', { params: {
        start_date: params.startDate,
        end_date: params.endDate,
        sort: params.sort,
        limit: params.limit,
        offset: params.offset
      }});
      return data;
    },
    staleTime: 60_000
  });
}
