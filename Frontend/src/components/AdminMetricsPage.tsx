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
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded text-sm">Back</button>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border p-2 rounded text-sm" />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border p-2 rounded text-sm" />
        <button
          onClick={() => { refresh(); refetch(); }}
          disabled={isLoading}
          className={`px-5 py-2 rounded text-sm font-medium ${isLoading ? 'bg-gray-400 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >{isLoading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
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
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : data ? (
          <>{render(data as T)}</>
        ) : (
          <p className="text-center text-gray-500 py-8">No {title.toLowerCase()} available.</p>
        )}
      </div>
    </div>
  );
}
