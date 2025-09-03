import React, { useState, useEffect, useCallback } from 'react';
import { useCapabilities } from '../hooks/useCapabilities';

interface AuditEvent {
  id: number;
  tenant_id?: string;
  user_id?: number;
  action: string;
  created_at: string;
  details: Record<string, unknown>;
}

interface AuditResponse {
  events: AuditEvent[];
  next_before_id?: number;
}

const AuditLogs: React.FC = () => {
  const { has } = useCapabilities();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [beforeId, setBeforeId] = useState<number | null>(null);

  const fetchAuditLogs = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const url = new URL('/api/admin/audit', window.location.origin);
      url.searchParams.set('limit', '50');
      if (!reset && beforeId) {
        url.searchParams.set('before_id', beforeId.toString());
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.status}`);
      }
      
      const data: AuditResponse = await response.json();
      
      if (reset) {
        setEvents(data.events);
      } else {
        setEvents(prev => [...prev, ...data.events]);
      }
      
      setHasMore(!!data.next_before_id);
      setBeforeId(data.next_before_id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [loading, beforeId]);

  useEffect(() => {
    if (has('audit.view')) {
      fetchAuditLogs(true);
    }
  }, [has, fetchAuditLogs]);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const formatDetails = (details: Record<string, unknown>) => {
    if (!details || Object.keys(details).length === 0) return '';
    return JSON.stringify(details, null, 2);
  };

  if (!has('audit.view')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-red-600 font-medium">Access Denied</div>
            <div className="text-sm text-red-500 mt-1">Missing capability: audit.view</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-red-700 to-rose-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
              <p className="mt-1 text-red-100">Administrative actions and security events</p>
            </div>
            <button
              onClick={() => fetchAuditLogs(true)}
              disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg font-medium transition-colors backdrop-blur-sm"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-red-600 font-medium text-sm">{error}</div>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Action</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">User ID</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Tenant</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Time</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700">No audit events found</div>
                          <div className="text-sm text-gray-500 mt-1">Events will appear here as they occur</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">{event.id}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {event.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {event.user_id || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {event.tenant_id || '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {formatDateTime(event.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {formatDetails(event.details) && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                              View details
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto border">
                              {formatDetails(event.details)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-6 py-4 border-t bg-gray-50/50">
              <button
                onClick={() => fetchAuditLogs(false)}
                disabled={loading}
                className="w-full px-4 py-3 text-sm bg-white hover:bg-gray-50 disabled:opacity-50 rounded-lg border border-gray-200 font-medium transition-colors"
              >
                {loading ? 'Loading...' : 'Load More Events'}
              </button>
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-white/80 rounded-full text-xs text-gray-600 border border-gray-200">
              Showing {events.length} events{hasMore ? ' (more available)' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
