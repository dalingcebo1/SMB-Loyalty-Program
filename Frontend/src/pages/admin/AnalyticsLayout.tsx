import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, Link, useSearchParams, useMatch } from 'react-router-dom';
import api from '../../api/api';
import { SUMMARY_LABELS, humanizeMetric } from '../../utils/metrics';
import Alert from '../../components/Alert';
// Removed chart imports until dependencies are installed

const AnalyticsLayout: React.FC = () => {
  const [searchParams] = useSearchParams();
  const start = searchParams.get('start_date') || new Date(Date.now() - 6 * 86400000).toISOString().slice(0,10);
  const end = searchParams.get('end_date') || new Date().toISOString().slice(0,10);
  const [summary, setSummary] = useState<any|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const fetchSummary = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get(`/analytics/summary?start_date=${start}&end_date=${end}`);
      setSummary(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load summary metrics');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // small spinner for card loading
  const CardSpinner: React.FC = () => (
    <svg className="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
  return (
    <div className="w-full max-w-4xl mt-6 mb-6">
      {/* Date range picker (read-only here) */}
      <div className="flex items-center space-x-2 mb-4">
        <input type="date" value={start} readOnly className="border p-1 rounded" />
        <span>to</span>
        <input type="date" value={end} readOnly className="border p-1 rounded" />
        <button onClick={fetchSummary} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {/* Error alert */}
      {error && (
        <Alert
          type="error"
          message={error}
          actionLabel="Retry"
          onAction={fetchSummary}
          onClose={() => setError(null)}
        />
      )}
      {/* Quick Metrics grid (always render panel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
        {Object.keys(SUMMARY_LABELS).map(key => (
          <Link
            key={key}
            to={`/admin/analytics/${key.replace(/_count$/, 's').replace(/_/g, '/')}?start_date=${start}&end_date=${end}`}
          >
            <div className="bg-white p-4 rounded shadow flex flex-col items-center justify-center text-center h-24 space-y-1 hover:shadow-lg transition">
              <div className="text-sm text-gray-500">{humanizeMetric(key, SUMMARY_LABELS)}</div>
              <div className="text-2xl font-semibold">
                {loading ? <CardSpinner /> : (summary?.[key] ?? 0)}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {/* Drill-down detail component */}
      {/* Sub-header and breadcrumbs for selected metric */}
      {(() => {
        const m = useMatch('/admin/analytics/:metric');
        const metric = m?.params.metric;
        if (metric) {
          const name = humanizeMetric(metric);
          return (
            <div className="mb-6">
              <nav className="text-sm text-gray-500 mb-2">
                <Link to="/admin/analytics" className="hover:underline">
                  Analytics
                </Link>
                <span className="px-2">/</span>
                <span>{name}</span>
              </nav>
              <h3 className="text-lg font-semibold">{name}</h3>
            </div>
          );
        }
        return null;
      })()}
      <Outlet />
    </div>
  );
};

export default AnalyticsLayout;
