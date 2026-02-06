import React from 'react';
import { useCapabilities } from '../hooks/useCapabilities';
import { AdminPageContainer } from '../components/AdminGrid';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../../api/api';

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

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<AuditResponse>({
    queryKey: ['admin-audit-logs'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) {
        params.set('before_id', pageParam.toString());
      }
      const res = await api.get(`/admin/audit?${params.toString()}`);
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_before_id ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: has('audit.view'),
    staleTime: 60000, // 1 minute
  });

  const events = data?.pages.flatMap(page => page.events) ?? [];
  const loading = isFetching && !isFetchingNextPage;

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const formatDetails = (details: Record<string, unknown>) => {
    if (!details || Object.keys(details).length === 0) return '';
    return JSON.stringify(details, null, 2);
  };

  if (!has('audit.view')) {
    return (
      <AdminPageContainer title="Access Denied" description="">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Access Denied</div>
          <div className="text-sm text-red-500 mt-1">Missing capability: audit.view</div>
        </div>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer
      title="Audit Logs"
      description="Administrative actions and security events"
      actions={
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      }
    >

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-red-600 font-medium text-sm">{error instanceof Error ? error.message : 'Failed to load audit logs'}</div>
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

          {hasNextPage && (
            <div className="px-6 py-4 border-t bg-gray-50/50">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full px-4 py-3 text-sm bg-white hover:bg-gray-50 disabled:opacity-50 rounded-lg border border-gray-200 font-medium transition-colors"
              >
                {isFetchingNextPage ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                    Loading...
                  </span>
                ) : (
                  'Load More Events'
                )}
              </button>
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-white/80 rounded-full text-xs text-gray-600 border border-gray-200">
              Showing {events.length} events{hasNextPage ? ' (more available)' : ''}
            </div>
          </div>
        )}
    </AdminPageContainer>
  );
};

export default AuditLogs;
