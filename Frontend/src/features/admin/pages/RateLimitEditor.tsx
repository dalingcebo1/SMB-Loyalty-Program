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
    setLoading(true);
    setError(null);
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

  if (!has('rate_limit.edit')) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Access Denied</div>
          <div className="text-sm text-red-500 mt-1">Missing capability: rate_limit.edit</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight">Rate Limit Configuration</h1>
            <p className="mt-1 text-purple-100">Manage rate limiting overrides and IP bans</p>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create Override</h2>
              <p className="text-sm text-gray-600">Set custom rate limits for specific scopes</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scope Identifier</label>
              <input 
                required 
                value={form.scope} 
                onChange={e=>setForm(f=>({...f, scope:e.target.value}))} 
                className="w-full border border-gray-300 px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                placeholder="e.g., user_tenant_123" 
              />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Request Capacity</label>
                <input 
                  required 
                  value={form.capacity} 
                  onChange={e=>setForm(f=>({...f, capacity:e.target.value}))} 
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                  placeholder="60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Window (seconds)</label>
                <input 
                  required 
                  value={form.per} 
                  onChange={e=>setForm(f=>({...f, per:e.target.value}))} 
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                  placeholder="60"
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Save Override
            </button>
          </form>
        </div>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
              <span className="text-sm font-medium">Loading configuration…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-red-600 font-medium text-sm">{error}</div>
          </div>
        )}

        {state && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Active Overrides</h3>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {Object.keys(state.overrides).length} active
                  </span>
                </div>
              </div>
              
              {Object.keys(state.overrides).length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <div className="font-medium text-gray-700">No active overrides</div>
                  <div className="text-sm text-gray-500 mt-1">Create an override using the form above</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(state.overrides).map(([k,v]) => (
                    <div key={k} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{k}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {v.capacity} requests per {v.per_seconds} seconds
                        </div>
                      </div>
                      <button 
                        onClick={()=>del(k)} 
                        className="ml-3 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">IP Bans</h3>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {state.bans.length} banned
                  </span>
                </div>
              </div>
              
              {state.bans.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="font-medium text-gray-700">No banned IPs</div>
                  <div className="text-sm text-gray-500 mt-1">System is secure with no active bans</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {state.bans.map(ip => (
                    <div key={ip} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="font-mono text-sm text-gray-900">{ip}</div>
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

export default RateLimitEditor;
