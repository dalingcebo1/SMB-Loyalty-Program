import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useDateRange } from '../../hooks/useDateRange';
import { useLocation, useSearchParams, Link, Outlet } from 'react-router-dom';
import AnalyticsOverview from './AnalyticsOverview';
// Phase 3 panels
import GoalsPanel from '../../components/GoalsPanel';
import InsightsPanel from '../../components/InsightsPanel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { buildQuery } from '../../api/api';
import { SUMMARY_LABELS, humanizeMetric } from '../../utils';
import { DailyCount, DailyValue } from '../../types/metrics';
import Alert from '../../components/Alert';
import Container from '../../components/ui/Container';
import MetricCard from '../../components/ui/MetricCard';
import ErrorBoundary from '../../components/ErrorBoundary';
import AdminBreadcrumbs from '../../components/AdminBreadcrumbs';
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';

const AnalyticsLayout: React.FC = () => {
  // Global date & period context
  const { start, end, period: periodParam, setStart, setEnd, setPeriod, refresh } = useDateRange();
  // Segmentation filters: tier, campaign, device
  const [searchParams, setSearchParams] = useSearchParams();
  const [tier, setTier] = useState(searchParams.get('tier') || '');
  const [campaign, setCampaign] = useState(searchParams.get('campaign') || '');
  const [device, setDevice] = useState(searchParams.get('device') || '');
  // mini-chart granularity
  const [granularity, setGranularity] = useState<'daily'|'weekly'|'monthly'>(searchParams.get('granularity') as any || 'daily');
  const queryClient = useQueryClient();
  // Compute active period buttons styling
  const periods = ['1W','4W','1Y','MTD','QTD','YTD','ALL'] as const;
  const computeRange = useCallback((p: string) => {
    const now = new Date();
    let rangeStart: Date;
    switch (p) {
      case '1W':
        rangeStart = new Date(now.getTime() - 7 * 86400000); break;
      case '4W':
        rangeStart = new Date(now.getTime() - 28 * 86400000); break;
      case '1Y':
        rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
      case 'MTD':
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'QTD': {
        const q = Math.floor(now.getMonth() / 3); // 0-3
        rangeStart = new Date(now.getFullYear(), q * 3, 1); break;
      }
      case 'YTD':
        rangeStart = new Date(now.getFullYear(), 0, 1); break;
      case 'ALL':
        rangeStart = new Date(0); break;
      default:
        rangeStart = new Date(now.getTime() - 7 * 86400000);
    }
    return {
      start: rangeStart.toISOString().slice(0,10),
      end: now.toISOString().slice(0,10)
    };
  }, []);

  // Summary metrics query (leverages prefetch from bootstrap)
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const { data: summary, isFetching: loading, isError, error, refetch } = useQuery({
    queryKey: ['analyticsSummary', start, end, tier, campaign, device, granularity],
    queryFn: async () => {
      const res = await api.get(
        `/analytics/summary${buildQuery({ start_date: start, end_date: end, tier, campaign, device, granularity })}`
      );
      const dur = res.headers['x-query-duration-ms'];
      if (dur) setLastFetch(Number(dur));
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const errorMessage = useMemo(() => (isError ? (error as any)?.message || 'Failed to load summary metrics' : null), [isError, error]);
  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const handleExportCSV = useCallback(() => {
    if (!summary) return;
    const rows: string[][] = [['Metric', 'Value']];
    Object.entries(summary).forEach(([key, val]) => {
      if (['user_growth', 'transaction_volume', 'tier_distribution', 'visits_over_time', 'top_rewards'].includes(key)) return;
      rows.push([key, String(val)]);
    });
    const csv = rows
      .map((r: string[]) => r.map((c: string) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'summary.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [summary]);
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => toast.info('Link copied'));
  }, []);
  const handleSelectPeriod = useCallback((p: string) => {
    const { start: newStart, end: newEnd } = computeRange(p);
    setPeriod(p);
    setStart(newStart);
    setEnd(newEnd);
    // update URL params immediately
  setSearchParams({ start_date: newStart, end_date: newEnd, period: p, tier, campaign, device });
    // reload data
    refetch();
  }, [computeRange, setPeriod, setStart, setEnd, setSearchParams, refetch]);
  // Pre-render (prefetch) drill-down datasets so detail pages are instant
  useEffect(() => {
    if (!start || !end) return;
    const keys = [
      ['analytics','users','details', start, end],
      ['analytics','transactions','details', start, end],
      ['analytics','points','details', start, end],
      ['analytics','redemptions','details', start, end],
      ['analytics','visits','details', start, end],
    ] as const;
    keys.forEach(k => {
        queryClient.prefetchQuery({
        queryKey: k,
        queryFn: () => api.get(`/analytics/${k[1]}/details${buildQuery({ start_date: start, end_date: end })}`).then(r => r.data),
        staleTime: 1000 * 60 * 5,
      });
    });
  }, [start, end, queryClient]);
  
  // Idle-time prefetch for most-used detail metrics
  useEffect(() => {
    if (!start || !end) return;
    const prefetchDetails = () => {
      ['users', 'transactions'].forEach(type => {
        queryClient.prefetchQuery({
          queryKey: ['analytics', type, 'details', start, end],
          queryFn: () => api.get(`/analytics/${type}/details${buildQuery({ start_date: start, end_date: end })}`).then(r => r.data),
          staleTime: 1000 * 60 * 5,
        });
      });
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      // @ts-ignore
      window.requestIdleCallback(prefetchDetails);
    } else {
      setTimeout(prefetchDetails, 200);
    }
  }, [start, end, queryClient]);

  // Prepare dual-series data for Points Activity
  const pointsIssuedSeries = summary?.points_issued_over_time
    ? summary.points_issued_over_time.map((p: DailyValue) => ({ date: p.date, value: p.value }))
    : [];
  const pointsRedeemedSeries = summary?.points_redeemed_over_time
    ? summary.points_redeemed_over_time.map((p: DailyValue) => ({ date: p.date, value: p.value }))
    : [];
  const activitySeries: Array<{ date: string; issued: number; redeemed: number }> = pointsIssuedSeries.map(
    (d: { date: string; value: number }, i: number) => ({ date: d.date, issued: d.value, redeemed: pointsRedeemedSeries[i]?.value ?? 0 })
  );
  const sparkColors = { points_issued: '#E0BBE4', points_redeemed: '#FFB7B2' };

  return (
    <Container>
      {/* Top bar: period shortcuts (left) and date filters (right) */}
  {/* Sticky filter bar */}
  <div className="sticky top-0 bg-white z-50 flex justify-between items-center mb-4 gap-4 flex-wrap md:flex-nowrap px-6 py-3 border-b shadow-sm">
        <div role="radiogroup" aria-label="Period shortcuts" className="flex gap-2 flex-wrap items-center select-none">
          {periods.map(p => (
            <button
              key={p}
              role="radio"
              aria-checked={p === periodParam}
              onClick={() => handleSelectPeriod(p)}
              className={`text-xs min-w-[58px] text-center px-3 py-2 rounded border transition font-medium tracking-wide ${p === periodParam ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-gray-100 hover:bg-gray-200 border-gray-300'}`}
            >{p}</button>
          ))}
          <Link to="/admin" className="text-xs px-3 py-2 rounded border border-gray-300 bg-gray-100 hover:bg-gray-200">Back</Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={start} readOnly className="border p-2 rounded text-xs bg-white" />
          <span className="text-xs">to</span>
          <input type="date" value={end} readOnly className="border p-2 rounded text-xs bg-white" />
          {/* Segmentation controls */}
          <select value={tier} onChange={e => { setTier(e.target.value); setSearchParams({ start_date: start, end_date: end, period: periodParam, tier: e.target.value, campaign, device }); refetch(); }} className="border p-2 rounded text-xs bg-white">
            <option value="">All Tiers</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
          <select value={campaign} onChange={e => { setCampaign(e.target.value); setSearchParams({ start_date: start, end_date: end, period: periodParam, tier, campaign: e.target.value, device }); refetch(); }} className="border p-2 rounded text-xs bg-white">
            <option value="">All Campaigns</option>
            <option value="summer-sale">Summer Sale</option>
            <option value="referral">Referral</option>
            <option value="ads">Ads</option>
          </select>
          <select value={device} onChange={e => { const v = e.target.value; setDevice(v); setSearchParams({ start_date: start, end_date: end, period: periodParam, tier, campaign, device: v, granularity }); refetch(); }} className="border p-2 rounded text-xs bg-white">
            <option value="">All Devices</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
          <select value={granularity} onChange={e => { const g = e.target.value as 'daily'|'weekly'|'monthly'; setGranularity(g); setSearchParams({ start_date: start, end_date: end, period: periodParam, tier, campaign, device, granularity: g }); refetch(); }} className="border p-2 rounded text-xs bg-white">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button
            onClick={() => { refresh(); refetch(); }}
            disabled={loading}
            className={`w-28 text-center text-xs font-medium px-4 py-2 rounded transition-colors shadow-sm ${loading ? 'bg-gray-400 text-white cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            aria-live="polite"
          >{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button onClick={handleExportCSV} className="px-3 py-2 text-xs bg-gray-200 rounded hover:bg-gray-300">Export CSV</button>
          <button onClick={handleCopyLink} className="px-3 py-2 text-xs bg-gray-200 rounded hover:bg-gray-300">Copy Link</button>
          {lastFetch != null && <span className="text-xs text-gray-500 ml-2">Last fetch: {lastFetch} ms</span>}
        </div>
      </div>
      {/* Error alert */}
      {errorMessage && (
        <Alert
          type="error"
          message={errorMessage}
          actionLabel="Retry"
          onAction={handleRefresh}
          onClose={() => {/* local dismiss not needed now */}}
        />
      )}
      {/* Summary Metrics */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Summary Metrics</h2>
        <div className="bg-white rounded shadow p-6 mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {Object.keys(SUMMARY_LABELS).map(key => {
              // Render combined Points Activity card once, skip individual points keys
              if (key === 'points_issued') {
                return (
                  <Link to={`/admin/analytics/points?start_date=${start}&end_date=${end}&tier=${tier}&campaign=${campaign}&device=${device}`} key="points_activity" className="block hover:border-blue-400">
                    <div className="bg-white border border-gray-200 rounded p-5 flex flex-col items-center justify-center space-y-2 transition-colors">
                      <div className="text-sm font-medium text-gray-600 tracking-wide">Points Activity</div>
                      <div className="text-2xl font-semibold tabular-nums text-gray-800">
                        {`${summary?.points_issued ?? 0} / ${summary?.points_redeemed ?? 0}`}
                      </div>
                      <div className="w-full mt-1 h-5">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={activitySeries} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                            <Tooltip formatter={(val: any) => val} labelFormatter={() => ''} />
                            <Line type="monotone" dataKey="issued" stroke={sparkColors.points_issued} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="redeemed" stroke={sparkColors.points_redeemed} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Link>
                );
              }
              if (key === 'points_redeemed') {
                return null;
              }
              const route = key.startsWith('points_') ? 'points' :
                key === 'redemptions_count' ? 'redemptions' :
                key === 'visits_total' ? 'visits' :
                key.endsWith('_count') ? key.replace(/_count$/, 's') :
                key;
              // prepare sparkline data for key
              let sparkData: Array<{ date: string; value: number }> | undefined;
              let sparkColor: string | undefined;
              if (summary) {
                if (key === 'user_count') {
                  sparkData = summary.user_growth.map((p: DailyCount) => ({ date: p.date, value: p.count })); sparkColor = '#16a34a';
                } else if (key === 'transaction_count') {
                  sparkData = summary.transaction_volume.map((p: DailyValue) => ({ date: p.date, value: p.value })); sparkColor = '#2563eb';
                } else if (key === 'visits_total') {
                  sparkData = summary.visits_over_time.map((p: DailyCount) => ({ date: p.date, value: p.count })); sparkColor = '#0891b2';
                }
              }
              return (
                <MetricCard
                  key={key}
                  label={humanizeMetric(key, SUMMARY_LABELS)}
                  value={summary?.[key]}
                  loading={loading}
                  to={`/admin/analytics/${route}?start_date=${start}&end_date=${end}&tier=${tier}&campaign=${campaign}&device=${device}`}
                  sparkline={sparkData}
                  sparklineColor={sparkColor}
                />
              );
            })}
          </div>
        </div>
      </div>
    {/* Phase 3 Panels: Goals & Alerts, Insights Feed */}
    <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-10">
      <div className="flex-1">
        <GoalsPanel />
      </div>
      <div className="flex-1">
        <InsightsPanel />
      </div>
    </div>
      {/* Drill-down or overview content */}
      {(() => {
        const loc = useLocation();
        const parts = loc.pathname.split('/').filter(Boolean);
        // path '/admin/analytics' has 2 parts ['admin','analytics']
        const isIndex = parts.length === 2;
        if (isIndex) {
          return <AnalyticsOverview />;
        }
        return (
          <>
            <AdminBreadcrumbs />
            <ErrorBoundary
              fallback={
                <Alert
                  type="error"
                  message="Failed to load details"
                  actionLabel="Retry"
                  onAction={handleRefresh}
                />
              }
            >
              <Outlet />
            </ErrorBoundary>
          </>
        );
      })()}
    </Container>
  );
};

export default AnalyticsLayout;
