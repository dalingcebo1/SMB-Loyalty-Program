import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { toast } from 'react-toastify';
import TopCustomersPanel from '../components/TopCustomersPanel';
import LoyaltyOverviewPanel from '../components/LoyaltyOverviewPanel';
import useAnalyticsSnapshot from '../hooks/useAnalyticsSnapshot';
import { formatCurrency } from '../../../utils/format';
import { StaffIcon } from '../components/StaffIcon';

const CustomerAnalytics: React.FC = () => {
  const [range, setRange] = useState(30);
  const dates = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (range-1));
    return {
      startDate: start.toISOString().slice(0,10),
      endDate: end.toISOString().slice(0,10)
    };
  }, [range]);
  const qc = useQueryClient();
  const snapshot = useAnalyticsSnapshot({ startDate: dates.startDate, endDate: dates.endDate });
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshed, setShowRefreshed] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
  await api.post('/analytics/customers/refresh');
  qc.invalidateQueries({ queryKey: ['analytics','top-customers'] });
  qc.invalidateQueries({ queryKey: ['analytics','loyalty-overview'] });
  setShowRefreshed(true);
    } catch (e: unknown) {
      // Type guard for axios-like error structure
      interface HasResponse { response?: { status?: number } }
      const status = (typeof e === 'object' && e && 'response' in e) ? (e as HasResponse).response?.status : undefined;
  if (status === 403) toast.error('Not authorized to refresh metrics');
      else toast.error('Failed to refresh metrics');
    } finally {
      setRefreshing(false);
    }
  };
  // Auto-hide refreshed badge
  useEffect(() => {
    if (showRefreshed) {
      const t = setTimeout(() => setShowRefreshed(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showRefreshed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Customer & Loyalty Analytics</h2>
              <p className="mt-1 text-indigo-100">Deep dive into customer value, loyalty penetration & churn risk</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <label className="text-sm font-medium text-white">Range</label>
                <select
                  value={range}
                  onChange={e => setRange(Number(e.target.value))}
                  className="bg-white/20 border border-white/30 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer px-2 py-1"
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                {refreshing && <span className="animate-spin">⟳</span>}
                {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
              
              {showRefreshed && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                  <span className="text-green-500">✔</span>
                  Updated
                </span>
              )}
            </div>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>

        {/* KPI Snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {snapshot.isLoading ? (
            Array.from({ length: 4 }).map((_,i) => (
              <div key={i} className="h-24 rounded-xl bg-white/80 border border-gray-200 animate-pulse" />
            ))
          ) : snapshot.error ? (
            <div className="col-span-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              Failed to load snapshot
            </div>
          ) : (
            <>
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Penetration</div>
                <div className="text-2xl font-bold text-gray-900">{(snapshot.penetration*100).toFixed(1)}%</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Points redeemed</div>
                <div className="text-2xl font-bold text-gray-900">{snapshot.ptsRedeemed.toLocaleString()}</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Outstanding</div>
                <div className="text-2xl font-bold text-gray-900">{snapshot.outstanding.toLocaleString()}</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Top 5 revenue</div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency((snapshot.topRevenueCents||0)/100)}</div>
              </div>
            </>
          )}
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
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
          
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
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
      </div>
    </div>
  );
};

export default CustomerAnalytics;
