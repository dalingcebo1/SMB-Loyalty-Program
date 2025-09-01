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
    return <div className="text-sm text-red-500">Missing capability: audit.view</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-gray-500">Administrative actions and security events</p>
        </div>
        <button
          onClick={() => fetchAuditLogs(true)}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-900">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Action</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">User ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Tenant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No audit events found
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{event.id}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {event.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {event.user_id || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {event.tenant_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDateTime(event.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDetails(event.details) && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View details
                          </summary>
                          <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
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
          <div className="px-4 py-3 border-t bg-gray-50">
            <button
              onClick={() => fetchAuditLogs(false)}
              disabled={loading}
              className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {events.length > 0 && (
        <div className="text-xs text-gray-500 text-center">
          Showing {events.length} events{hasMore ? ' (more available)' : ''}
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
