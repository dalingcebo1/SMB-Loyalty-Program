import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!has('jobs.view')) return;
    let mounted = true;
  api.get('/admin/jobs')
      .then(res => { if (mounted) { setData(res.data); setLoading(false); } })
      .catch(err => { if (mounted) { setError(err?.response?.data?.detail || 'Failed to load jobs'); setLoading(false); } });
    return () => { mounted = false; };
  }, [has]);

  const retry = async (id: string) => {
  try { await api.post(`/admin/jobs/${id}/retry`); const refreshed = await api.get('/admin/jobs'); setData(refreshed.data); }
    catch { setError('Retry failed'); }
  };

  if (!has('jobs.view')) return <div className="text-sm text-red-500">Missing capability: jobs.view</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Jobs Monitor</h1>
      <p className="text-sm text-gray-500">Track background job queue health and retry failures.</p>
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Loading jobs…</div>}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 bg-white border rounded shadow-sm">
            <h2 className="font-medium mb-2">Queue Stats</h2>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(data.queue, null, 2)}</pre>
          </div>
          <div className="p-4 bg-white border rounded shadow-sm space-y-2">
            <h2 className="font-medium">Dead Letter</h2>
            {data.dead.length === 0 && <div className="text-xs text-gray-500">None</div>}
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {data.dead.slice(0,20).map((j) => (
                <li key={j.id} className="text-xs flex items-center justify-between bg-gray-50 p-2 rounded border">
                  <span className="truncate mr-2">{j.name} ({j.id})</span>
                  {canRetry && <button onClick={() => retry(j.id)} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">Retry</button>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsMonitor;
