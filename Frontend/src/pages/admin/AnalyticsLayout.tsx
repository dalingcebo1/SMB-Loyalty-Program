import React, { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, Link, useSearchParams } from 'react-router-dom';
import api from '../../api/api';
import { SUMMARY_LABELS, humanizeMetric } from '../../utils';
import Alert from '../../components/Alert';
import ErrorBoundary from '../../components/ErrorBoundary';
import AdminBreadcrumbs from '../../components/AdminBreadcrumbs';
import Container from '../../components/ui/Container';
// Removed chart imports until dependencies are installed

const AnalyticsLayout: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const end = searchParams.get('end_date') || new Date().toISOString().slice(0,10);
  const start = searchParams.get('start_date') || new Date(Date.now() - 6 * 86400000).toISOString().slice(0,10);
  const periodParam = searchParams.get('period') || '1W';
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
  const { data: summary, isFetching: loading, isError, error, refetch } = useQuery({
    queryKey: ['analyticsSummary', start, end],
    queryFn: () => api.get(`/analytics/summary?start_date=${start}&end_date=${end}`).then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const errorMessage = useMemo(() => (isError ? (error as any)?.message || 'Failed to load summary metrics' : null), [isError, error]);
  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const handleSelectPeriod = useCallback((p: string) => {
    const r = computeRange(p);
    setSearchParams({ start_date: r.start, end_date: r.end, period: p });
  }, [computeRange, setSearchParams]);
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
        queryFn: () => api.get(`/analytics/${k[1]}/details?start_date=${start}&end_date=${end}`).then(r => r.data),
        staleTime: 1000 * 60 * 5,
      });
    });
  }, [start, end, queryClient]);

  return (
    <Container>
      {/* Top bar: period shortcuts (left) and date filters (right) */}
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap md:flex-nowrap">
        <div className="flex gap-2 flex-wrap items-center select-none">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => handleSelectPeriod(p)}
              className={`text-sm min-w-[58px] text-center px-3 py-2 rounded border transition font-medium tracking-wide ${p === periodParam ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-gray-100 hover:bg-gray-200 border-gray-300'}`}
            >{p}</button>
          ))}
          <Link to="/admin" className="text-sm px-3 py-2 rounded border border-gray-300 bg-gray-100 hover:bg-gray-200">Back</Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={start} readOnly className="border p-2 rounded text-sm bg-white" />
          <span className="text-sm">to</span>
          <input type="date" value={end} readOnly className="border p-2 rounded text-sm bg-white" />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`w-28 text-center text-sm font-medium px-4 py-2 rounded transition-colors shadow-sm ${loading ? 'bg-gray-400 text-white cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
      ><span className="inline-block w-full">{loading ? 'Refreshing…' : 'Refresh'}</span></button>
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
      {/* Quick Metrics grid (always render panel) */}
      {/* Quick Metrics grid (prefetched, show placeholders if loading) */}
      <div className="bg-gray-100 rounded mb-10 px-12 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {Object.keys(SUMMARY_LABELS).map(key => {
            const card = (
              <div className={`bg-white p-5 rounded border border-gray-200 flex flex-col items-center justify-center text-center h-28 space-y-2 transition ${!loading ? 'hover:border-blue-400' : ''}`}>
                <div className="text-sm font-medium text-gray-600 tracking-wide uppercase">{humanizeMetric(key, SUMMARY_LABELS)}</div>
                {loading ? (
                  <div className="w-12 h-7 rounded bg-gray-200 animate-pulse" />
                ) : (
                  <div className="text-3xl font-semibold tabular-nums">{summary?.[key] ?? 0}</div>
                )}
              </div>
            );
            return loading ? (
              <div key={key}>{card}</div>
            ) : (
              <Link
                key={key}
                to={`/admin/analytics/${key.replace(/_count$/, 's').replace(/_/g, '/')}?start_date=${start}&end_date=${end}`}
                className="block"
              >{card}</Link>
            );
          })}
        </div>
      </div>
      {/* Drill-down breadcrumbs and detail component */}
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
    </Container>
  );
};

export default AnalyticsLayout;
