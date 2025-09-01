import React, { useEffect, useState } from 'react';
import { useCapabilities } from '../hooks/useCapabilities';
import api from '../../../api/api';

interface RLState { overrides: Record<string, { capacity: number; per_seconds: number }>; bans: string[] }

const RateLimitEditor: React.FC = () => {
  const { has } = useCapabilities();
  const [state, setState] = useState<RLState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ scope: '', capacity: '60', per: '60' });

  const load = async () => {
    try {
  const res = await api.get('/admin/rate-limits');
  const bans = res.data.bans || [];
      setState({ overrides: res.data.overrides || {}, bans });
    } catch (e) {
      interface ErrLike { response?: { data?: { detail?: string } } }
      const maybe = e as ErrLike;
      setError(maybe.response?.data?.detail || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (has('rate_limit.edit')) load(); }, [has]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
  await api.post('/admin/rate-limits', { scope: form.scope, capacity: Number(form.capacity), per_seconds: Number(form.per) });
      await load();
    } catch { setError('Failed to save override'); }
  };

  const del = async (scope: string) => { await api.delete(`/admin/rate-limits/${scope}`); await load(); };

  if (!has('rate_limit.edit')) return <div className="text-sm text-red-500">Missing capability: rate_limit.edit</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Rate Limit Overrides</h1>
      <p className="text-sm text-gray-500">Grant temporary overrides / bans. Validate changes before committing.</p>
      <form onSubmit={submit} className="p-4 bg-white border rounded shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
          <input required value={form.scope} onChange={e=>setForm(f=>({...f, scope:e.target.value}))} className="w-full border px-2 py-1 rounded text-sm" placeholder="user_tenant" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
            <input required value={form.capacity} onChange={e=>setForm(f=>({...f, capacity:e.target.value}))} className="w-full border px-2 py-1 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Window (s)</label>
            <input required value={form.per} onChange={e=>setForm(f=>({...f, per:e.target.value}))} className="w-full border px-2 py-1 rounded text-sm" />
          </div>
        </div>
        <button type="submit" className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Save / Update</button>
      </form>
      {loading && <div className="text-xs text-gray-500">Loading…</div>}
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}
      {state && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 bg-white border rounded shadow-sm">
            <h2 className="font-medium mb-2">Overrides</h2>
            <ul className="space-y-2 text-xs max-h-72 overflow-y-auto">
              {Object.entries(state.overrides).map(([k,v]) => (
                <li key={k} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                  <span>{k}: {v.capacity}/{v.per_seconds}s</span>
                  <button onClick={()=>del(k)} className="px-2 py-0.5 bg-red-600 text-white rounded">Del</button>
                </li>
              ))}
              {Object.keys(state.overrides).length===0 && <li className="text-gray-500">No overrides</li>}
            </ul>
          </div>
          <div className="p-4 bg-white border rounded shadow-sm">
            <h2 className="font-medium mb-2">Bans</h2>
            <ul className="space-y-2 text-xs max-h-72 overflow-y-auto">
              {state.bans.map(ip => <li key={ip} className="bg-gray-50 p-2 rounded border">{ip}</li>)}
              {state.bans.length===0 && <li className="text-gray-500">No bans</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateLimitEditor;
