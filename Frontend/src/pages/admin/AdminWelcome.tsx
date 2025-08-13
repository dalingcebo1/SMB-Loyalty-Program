// Removed ts-nocheck; TypeScript issues have been addressed
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { HiUsers, HiUserAdd, HiCog } from 'react-icons/hi';
import api from '../../api/api';
import { SUMMARY_LABELS } from '../../utils';
import MetricCard from '../../components/ui/MetricCard';
import ActionCard from '../../components/ui/ActionCard';
import { useDateRange } from '../../hooks/useDateRange';

const AdminWelcome: React.FC = () => {
  const { user } = useAuth();
  const name = user?.firstName || 'Admin';
  const { start, end, setStart, setEnd, period, setPeriod, refresh } = useDateRange(7);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // compute quick presets so they always reflect "today"
  const presets = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const yearStart = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    return {
      '7D': { label: '7D', start: daysAgo(6), end: todayStr },
      '30D': { label: '30D', start: daysAgo(29), end: todayStr },
      'YTD': { label: 'YTD', start: yearStart, end: todayStr }
    } as const;
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics/summary?start_date=${start}&end_date=${end}`);
      setSummary(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // handle period change applying preset
  const applyPreset = (code: '7D' | '30D' | 'YTD') => {
    const preset = presets[code];
    setStart(preset.start);
    setEnd(preset.end);
    setPeriod(code);
    // refresh summary after state updates fire
    setTimeout(() => fetchSummary(), 0);
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none opacity-5 bg-[radial-gradient(circle_at_25%_25%,#3b82f6,transparent_60%)]" />
        <div className="relative">
          <h1 className="text-2xl font-semibold mb-1 tracking-tight">Welcome, {name}</h1>
          <p className="text-gray-600 text-sm">Quick actions and a snapshot of recent performance.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-10">
        <ActionCard
          to="/admin/users"
          icon={<HiUsers className="w-7 h-7" />}
          title="Manage Users"
          description="View, search and manage user accounts"
        />
        <ActionCard
          to="/admin/register-staff"
          icon={<HiUserAdd className="w-7 h-7" />}
          title="Register Staff"
          description="Invite staff and assign roles"
        />
        <ActionCard
          to="/admin/modules"
          icon={<HiCog className="w-7 h-7" />}
          title="Modules & Settings"
          description="Enable features & configure options"
        />
      </div>

      {/* Metrics + filters */}
      <div className="w-full max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Quick Metrics</h2>
            <p className="text-xs text-gray-500 mt-0.5">Aggregated between the selected dates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="border border-gray-300 text-sm rounded px-2 py-1"
                aria-label="Start date"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="border border-gray-300 text-sm rounded px-2 py-1"
                aria-label="End date"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['7D','30D','YTD'] as const).map(code => (
                <button
                  key={code}
                  onClick={() => applyPreset(code)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${period === code ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                  aria-pressed={period === code}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              onClick={() => { refresh(); fetchSummary(); }}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-3" aria-live="polite">
          Showing data for <span className="font-medium">{start}</span> to <span className="font-medium">{end}</span>{lastUpdated && <> • Updated {lastUpdated.toLocaleTimeString()}</>}.
        </div>
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 min-w-[640px]">
            {Object.entries(SUMMARY_LABELS).map(([key, label]) => {
              const route = (() => {
                if (key.startsWith('points_')) return 'points';
                if (key === 'redemptions_count') return 'redemptions';
                if (key === 'visits_total') return 'visits';
                if (key.endsWith('_count')) return key.replace(/_count$/, 's');
                return key;
              })();
              return (
                <MetricCard
                  key={key}
                  label={label}
                  value={summary?.[key]}
                  loading={loading}
                  to={`/admin/analytics/${route}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWelcome;
