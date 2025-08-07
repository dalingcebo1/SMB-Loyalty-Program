import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // fetch wrapper to handle loading and errors
  const fetchData = React.useCallback(() => {
    setError(null);
    setLoading(true);
    fetcher(start, end)
      .then(setData)
      .catch(err => {
        console.error(err);
        setError(err.message || 'Failed to load metrics');
      })
      .finally(() => setLoading(false));
  }, [fetcher, start, end]);

  React.useEffect(() => {
    if (!start || !end) return;
    fetchData();
  }, [start, end, fetchData]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center mb-4 space-x-2">
        <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded">Back</button>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border p-1 rounded" />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border p-1 rounded" />
        <button
          onClick={() => {
            setError(null);
            fetchData();
            refresh();
          }}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {error && (
        <Alert
          type="error"
          message={error}
          actionLabel="Retry"
          onAction={fetchData}
          onClose={() => setError(null)}
        />
      )}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : data ? (
        <>{render(data)}</>
      ) : (
        <p className="text-center text-gray-500">No {title.toLowerCase()} available.</p>
      )}
    </div>
  );
}
