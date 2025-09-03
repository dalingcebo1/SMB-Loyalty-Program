import React, { useEffect, useState, useCallback } from 'react';
import { useCapabilities } from '../hooks/useCapabilities';
import api from '../../../api/api';

interface JobRecord { id: string; name: string; status?: string; payload?: unknown; attempts?: number }
interface JobsSnapshot { queue: Record<string, unknown>; recent: JobRecord[]; dead: JobRecord[] }

const JobsMonitor: React.FC = () => {
  const { has } = useCapabilities();
  const [data, setData] = useState<JobsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const canRetry = has('jobs.retry');

  const load = useCallback(() => {
    if (!has('jobs.view')) return;
    setLoading(true);
    setError(null);
    let mounted = true;
    api.get('/admin/jobs')
      .then(res => { if (mounted) { setData(res.data); setLoading(false); } })
      .catch(err => { if (mounted) { setError(err?.response?.data?.detail || 'Failed to load jobs'); setLoading(false); } });
    return () => { mounted = false; };
  }, [has]);

  useEffect(() => { load(); }, [load]);

  const retry = async (id: string) => {
  try { await api.post(`/admin/jobs/${id}/retry`); const refreshed = await api.get('/admin/jobs'); setData(refreshed.data); }
    catch { setError('Retry failed'); }
  };

  if (!has('jobs.view')) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Access Denied</div>
          <div className="text-sm text-red-500 mt-1">Missing capability: jobs.view</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-orange-700 to-amber-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Jobs Monitor</h1>
              <p className="mt-1 text-orange-100">Track background job queue health and retry failures</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg font-medium transition-colors backdrop-blur-sm"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-red-600 font-medium text-sm">{error}</div>
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
              <span className="text-sm font-medium">Loading jobs…</span>
            </div>
          </div>
        )}

        {data && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Queue Statistics</h2>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <pre className="text-xs text-gray-700 overflow-x-auto font-mono leading-relaxed">
                  {JSON.stringify(data.queue, null, 2)}
                </pre>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Failed Jobs</h2>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {data.dead.length} failed
                  </span>
                </div>
              </div>
              
              {data.dead.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="font-medium text-gray-700">All jobs healthy</div>
                  <div className="text-sm text-gray-500 mt-1">No failed jobs in the dead letter queue</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {data.dead.slice(0, 20).map((j) => (
                    <div key={j.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{j.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{j.id}</div>
                      </div>
                      {canRetry && (
                        <button 
                          onClick={() => retry(j.id)} 
                          className="ml-3 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsMonitor;
