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
    <div className="min-h-screen p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Page Header */}
      <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl mb-8 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
                <StaffIcon name="analytics" />
              </div>
              Customer & Loyalty Analytics
            </h2>
            <p className="text-gray-600">Deep dive into customer value, loyalty penetration & churn risk.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl">
              <label className="text-sm font-medium text-gray-700 uppercase tracking-wide">Range</label>
              <select
                value={range}
                onChange={e => setRange(Number(e.target.value))}
                className="bg-transparent border-none text-sm font-medium text-gray-900 focus:outline-none cursor-pointer"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {refreshing && <span className="animate-spin">⟳</span>}
              {refreshing ? 'Refreshing' : 'Refresh Snapshot'}
            </button>
            
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 font-medium">
                {dates.startDate} → {dates.endDate}
              </div>
              {showRefreshed && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="text-emerald-500">✔</span>
                  Updated
                </span>
              )}
            </div>
          </div>
        </div>
        {/* KPI Snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {snapshot.isLoading ? (
            Array.from({ length: 4 }).map((_,i) => (
              <div key={i} className="h-20 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 animate-pulse" />
            ))
          ) : snapshot.error ? (
            <div className="col-span-4 text-sm text-red-600">Failed to load snapshot.</div>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                <span className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Penetration</span>
                <strong className="text-xl font-bold text-gray-900">{(snapshot.penetration*100).toFixed(1)}%</strong>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                <span className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Pts Redeemed</span>
                <strong className="text-xl font-bold text-gray-900">{snapshot.ptsRedeemed.toLocaleString()}</strong>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                <span className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Outstanding</span>
                <strong className="text-xl font-bold text-gray-900">{snapshot.outstanding.toLocaleString()}</strong>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                <span className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Top 5 Revenue</span>
                <strong className="text-xl font-bold text-gray-900">{formatCurrency((snapshot.topRevenueCents||0)/100)}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white text-sm">
                <StaffIcon name="analytics" />
              </div>
              Top Customers
            </h3>
            <p className="text-sm text-gray-600">Ranked by revenue (change range for window)</p>
          </div>
          <div className="p-6">
            <TopCustomersPanel startDate={dates.startDate} endDate={dates.endDate} />
          </div>
        </div>
        
        <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg text-white text-sm">
                <StaffIcon name="performance" />
              </div>
              Loyalty Overview
            </h3>
            <p className="text-sm text-gray-600">Penetration, points & churn candidates</p>
          </div>
          <div className="p-6">
            <LoyaltyOverviewPanel startDate={dates.startDate} endDate={dates.endDate} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAnalytics;
