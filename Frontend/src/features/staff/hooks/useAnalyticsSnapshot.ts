import { useTopCustomers } from './useTopCustomers';
import { useLoyaltyOverview } from './useLoyaltyOverview';

export function useAnalyticsSnapshot(params: { startDate?: string; endDate?: string }) {
  const topCustomers = useTopCustomers({ startDate: params.startDate, endDate: params.endDate, sort: 'revenue', limit: 5, offset: 0 });
  const loyalty = useLoyaltyOverview(params);
  const isLoading = topCustomers.isLoading || loyalty.isLoading;
  const error = topCustomers.error || loyalty.error;
  const penetration = loyalty.data?.overview.loyalty_penetration ?? 0;
  const ptsRedeemed = loyalty.data?.overview.total_points_redeemed ?? 0;
  const outstanding = loyalty.data?.overview.outstanding_points ?? 0;
  const topRevenueCents = (topCustomers.data?.items || []).reduce((sum, c) => sum + (c.revenue_cents || 0), 0);
  return {
    isLoading,
    error,
    penetration,
    ptsRedeemed,
    outstanding,
    topRevenueCents,
    topCustomers: topCustomers.data?.items,
    loyaltyRaw: loyalty.data
  };
}

export default useAnalyticsSnapshot;
