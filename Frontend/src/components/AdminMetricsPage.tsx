import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../hooks/useDateRange';

interface AdminMetricsPageProps<T> {
  title: string;
  fetcher: (start: string, end: string) => Promise<T>;
  render: (data: T) => React.ReactNode;
}

import Spinner from './Spinner';
import Alert from './Alert';
export function AdminMetricsPage<T>({ title, fetcher, render }: AdminMetricsPageProps<T>) {
  const navigate = useNavigate();
  const { start, end, setStart, setEnd, refresh } = useDateRange();
  // React Query for metrics data
  const { data, error, isLoading, refetch } = useQuery<T, Error>({
    queryKey: ['adminMetrics', title, start, end],
    queryFn: () => fetcher(start, end),
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center mb-4 space-x-2">
        <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded">Back</button>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border p-1 rounded" />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border p-1 rounded" />
          <button
            onClick={() => {
              refresh();
              refetch();
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
      </div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {error && (
        <Alert
          type="error"
          message={(error as Error).message || 'Failed to load metrics'}
          actionLabel="Retry"
          onAction={() => refetch()}
          onClose={() => {}}
        />
      )}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : data ? (
        <>{render(data as T)}</>
      ) : (
        <p className="text-center text-gray-500">No {title.toLowerCase()} available.</p>
      )}
    </div>
  );
}
