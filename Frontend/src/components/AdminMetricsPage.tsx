import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../hooks/useDateRange';
import Container from './ui/Container';

interface AdminMetricsPageProps<T> {
  title: string;
  /** Base query key segments (e.g., ['analytics','transactions','details']) */
  queryKeyBase?: string[];
  fetcher: (start: string, end: string) => Promise<T>;
  render: (data: T) => React.ReactNode;
}

import Alert from './Alert';
export function AdminMetricsPage<T>({ title, queryKeyBase, fetcher, render }: AdminMetricsPageProps<T>) {
  const { start, end } = useDateRange();
  // Determine query key: use provided base or fallback to ['adminMetrics', title]
  const baseKey = queryKeyBase && queryKeyBase.length > 0 ? queryKeyBase : ['adminMetrics', title];
  // React Query for metrics data
  const { data, error, isLoading, refetch } = useQuery<T, Error>({
    queryKey: [...baseKey, start, end],
    queryFn: async () => {
      try {
        return await fetcher(start, end);
      } catch (e: any) {
        // repackage axios error for richer message
        if (e?.response) {
          const status = e.response.status;
            const detail = typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : e.response.data;
          throw new Error(`HTTP ${status}: ${detail || e.message}`);
        }
        throw e;
      }
    },
  });

  return (
    <Container>
  <h1 className="text-3xl font-bold mb-6">{title}</h1>
      {error && (
        <Alert
          type="error"
          message={(error as Error).message || 'Failed to load metrics'}
          actionLabel="Retry"
          onAction={() => refetch()}
          onClose={() => {}}
        />
      )}
      <div className="bg-white rounded shadow-sm">
        {isLoading ? (
            <div className="grid grid-cols-1 gap-4 p-6">
              {/* Skeleton placeholders matching card layout */}
              <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
              <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
        ) : data ? (
          <>{render(data as T)}</>
        ) : (
          <p className="text-center text-gray-500 py-8">No {title.toLowerCase()} available.</p>
        )}
      </div>
    </Container>
  );
}
