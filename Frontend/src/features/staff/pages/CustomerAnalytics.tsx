import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { toast } from 'react-toastify';
import TopCustomersPanel from '../components/TopCustomersPanel';
import LoyaltyOverviewPanel from '../components/LoyaltyOverviewPanel';
import useAnalyticsSnapshot from '../hooks/useAnalyticsSnapshot';
import { formatCurrency } from '../../../utils/format';
import { StaffIcon } from '../components/StaffIcon';
import StaffPageContainer from '../components/StaffPageContainer';

interface ApiErrorLike {
  response?: {
    status?: number;
  };
}

const CustomerAnalytics: React.FC = () => {
  const [range, setRange] = useState(30);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshed, setShowRefreshed] = useState(false);

  const dates = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (range - 1));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    };
  }, [range]);

  const snapshot = useAnalyticsSnapshot({ startDate: dates.startDate, endDate: dates.endDate });

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await api.post('/analytics/customers/refresh');
      qc.invalidateQueries({ queryKey: ['analytics', 'top-customers'] });
      qc.invalidateQueries({ queryKey: ['analytics', 'loyalty-overview'] });
      setShowRefreshed(true);
    } catch (error: unknown) {
      const status = (error as ApiErrorLike).response?.status;
      if (status === 403) {
        toast.error('Not authorized to refresh metrics');
      } else {
        toast.error('Failed to refresh metrics');
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (showRefreshed) {
      const timer = setTimeout(() => setShowRefreshed(false), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showRefreshed]);

  return (
    <div className="customer-analytics space-y-8">
      <StaffPageContainer
        as="div"
        surface="glass"
        width="xl"
        padding="relaxed"
        className="relative overflow-hidden text-white shadow-lg"
      >
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-balance text-[clamp(2rem,3vw+1rem,2.5rem)] font-bold leading-tight tracking-tight">Customer &amp; Loyalty Analytics</h2>
            <p className="text-[clamp(1rem,1.6vw+0.75rem,1.125rem)] text-indigo-100">Deep dive into customer value, loyalty penetration &amp; churn risk</p>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-2 backdrop-blur-sm">
              <label className="text-sm font-medium text-white">Range</label>
              <select
                value={range}
                onChange={event => setRange(Number(event.target.value))}
                className="cursor-pointer rounded-md border border-white/30 bg-white/20 px-2 py-1 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value={7} className="text-gray-900">Last 7 days</option>
                <option value={30} className="text-gray-900">Last 30 days</option>
                <option value={90} className="text-gray-900">Last 90 days</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing && <span className="animate-spin">⟳</span>}
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            {showRefreshed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                <span className="text-green-500">✔</span>
                Updated
              </span>
            )}
          </div>
        </div>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
      </StaffPageContainer>

      <StaffPageContainer as="div" surface="plain" width="xl" padding="default" className="space-y-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {snapshot.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white/80" />
            ))
          ) : snapshot.error ? (
            <div className="col-span-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              Failed to load snapshot
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-1 text-sm font-medium text-gray-600">Penetration</div>
                <div className="text-2xl font-bold text-gray-900">{(snapshot.penetration * 100).toFixed(1)}%</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-1 text-sm font-medium text-gray-600">Points redeemed</div>
                <div className="text-2xl font-bold text-gray-900">{snapshot.ptsRedeemed.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-1 text-sm font-medium text-gray-600">Outstanding</div>
                <div className="text-2xl font-bold text-gray-900">{snapshot.outstanding.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-1 text-sm font-medium text-gray-600">Top 5 revenue</div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency((snapshot.topRevenueCents || 0) / 100)}</div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100">
                  <StaffIcon name="analytics" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
                  <p className="text-sm text-gray-600">Ranked by revenue in selected period</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <TopCustomersPanel startDate={dates.startDate} endDate={dates.endDate} />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100">
                  <StaffIcon name="performance" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Loyalty Overview</h3>
                  <p className="text-sm text-gray-600">Penetration, points & churn candidates</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <LoyaltyOverviewPanel startDate={dates.startDate} endDate={dates.endDate} />
            </div>
          </div>
        </div>
      </StaffPageContainer>
    </div>
  );
};

export default CustomerAnalytics;
