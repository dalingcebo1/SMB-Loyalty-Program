// Removed ts-nocheck; TypeScript issues have been addressed
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';
import { HiUsers, HiUserAdd, HiCog } from 'react-icons/hi';
import api, { buildQuery } from '../../api/api';
import { toast } from 'react-toastify';
import { SUMMARY_LABELS } from '../../utils';
import { formatCurrency } from '../../utils/metrics';
import { SUMMARY_TOOLTIPS } from '../../utils/metrics';
import MetricCard from '../../components/ui/MetricCard';
import ActionCard from '../../components/ui/ActionCard';
import { useDateRange } from '../../hooks/useDateRange';
import { useSearchParams } from 'react-router-dom';

// Phase 1: Define primary and secondary metric groupings
const PRIMARY_ORDER = [
  'user_count',
  'transaction_count',
  'revenue',
  'conversion_rate',
  'average_transaction_value',
  'monthly_active_users',
].filter(Boolean);

const GROUPS = [
  {
    title: 'Loyalty',
    keys: ['points_issued', 'points_redeemed', 'redemptions_count']
  },
  {
    title: 'Engagement',
    keys: ['visits_total']
  },
  {
    title: 'Retention',
    keys: ['retention_rate', 'churn_rate']
  }
];
const AdminWelcome: React.FC = () => {
  const { user } = useAuth();
  const name = user?.firstName || 'Admin';
  const { start, end, setStart, setEnd, period, setPeriod } = useDateRange(7);
  // URL-synced segmentation filters
  const [searchParams, setSearchParams] = useSearchParams();
  const [tier, setTier] = useState<string>(searchParams.get('tier') || '');
  const [campaign, setCampaign] = useState<string>(searchParams.get('campaign') || '');
  const [device, setDevice] = useState<string>(searchParams.get('device') || '');
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // collapse state per group, persisted
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
  const params: Record<string, string> = { start_date: start, end_date: end };
      if (tier) params.tier = tier;
      if (campaign) params.campaign = campaign;
      if (device) params.device = device;
      const res = await api.get(`/analytics/summary${buildQuery(params)}`);
      setSummary(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [start, end, tier, campaign, device]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  // sync URL when filters change
  useEffect(() => {
    setSearchParams({
      start_date: start,
      end_date: end,
      period,
      ...(tier && { tier }),
      ...(campaign && { campaign }),
      ...(device && { device }),
    });
  }, [start, end, period, tier, campaign, device]);
  // load collapse state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('adminWelcomeCollapsed');
      if (stored) setCollapsed(JSON.parse(stored));
    } catch {}
  }, []);


  // handle period change applying preset
  const applyPreset = (code: '7D' | '30D' | 'YTD') => {
    const preset = presets[code];
    setStart(preset.start);
    setEnd(preset.end);
    setPeriod(code);
    setTimeout(() => fetchSummary(), 0);
  };
  // Export visible metrics to CSV
  const handleExportCSV = () => {
    if (!summary) return;
    const rows: string[][] = [['Metric', 'Value']];
    Object.entries(summary).forEach(([key, val]) => {
      if (key in SUMMARY_LABELS) {
        rows.push([SUMMARY_LABELS[key], String(val)]);
      }
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'metrics.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  // Copy current link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => toast.info('Link copied'));
  };

  // Phase 1: Build display lists
  const existingPrimary = PRIMARY_ORDER.filter(k => summary?.[k] !== undefined);
  // Phase 2: Prepare sparkline series for metrics
  const miniSeries: Record<string, Array<{ date: string; value: number }>> = {
    user_count: summary?.user_growth
      ? summary.user_growth.map((d: { date: string; count: number }) => ({ date: d.date, value: d.count }))
      : [],
    transaction_count: summary?.transaction_volume
      ? summary.transaction_volume.map((d: { date: string; value: number }) => ({ date: d.date, value: d.value }))
      : [],
    visits_total: summary?.visits_over_time
      ? summary.visits_over_time.map((d: { date: string; count: number }) => ({ date: d.date, value: d.count }))
      : [],
  };
  const sparkColors: Record<string, string> = {
    user_count: '#A8DADC',           // pastel blue
    transaction_count: '#A8E6CF',    // pastel green
    visits_total: '#FFD6A5',         // pastel orange
    points_issued: '#E0BBE4',        // pastel purple
    points_redeemed: '#FFB7B2',      // pastel pink
  };
  // add dual-series data for Points Activity
  const pointsIssuedSeries = summary?.points_issued_over_time
    ? summary.points_issued_over_time.map((d: { date: string; value: number }) => ({ date: d.date, value: d.value }))
    : [];
  const pointsRedeemedSeries = summary?.points_redeemed_over_time
    ? summary.points_redeemed_over_time.map((d: { date: string; value: number }) => ({ date: d.date, value: d.value }))
    : [];
  const activitySeries: Array<{ date: string; issued: number; redeemed: number }> = pointsIssuedSeries.map(
    (d: { date: string; value: number }, i: number) => ({
      date: d.date,
      issued: d.value,
      redeemed: pointsRedeemedSeries[i]?.value ?? 0,
    })
  );

  const remainingKeys = Object.keys(SUMMARY_LABELS).filter(k => !existingPrimary.includes(k));
  const routeFor = (key: string) => {
    if (key.startsWith('points_')) return 'points';
    if (key === 'redemptions_count') return 'redemptions';
    if (key === 'visits_total') return 'visits';
    if (key.endsWith('_count')) return key.replace(/_count$/, 's');
    return key;
  };
  const renderMetricCard = (key: string) => (
  <MetricCard
      key={key}
      label={SUMMARY_LABELS[key] || key}
      tooltip={SUMMARY_TOOLTIPS?.[key]}
  value={summary?.[key]}
      loading={loading}
  to={`/admin/analytics/${routeFor(key)}`}
  sparkline={miniSeries[key]}
  sparklineColor={sparkColors[key]}
      formatValue={
        key === 'revenue'
          ? formatCurrency
          : key.endsWith('_rate')
          ? (v: number) => `${(v * 100).toFixed(1)}%`
          : undefined
      }
    />
  );

  // render function for Points Activity card
  const renderPointsActivityCard = () => (
    <Link to="/admin/analytics/points" key="points_activity" className="block hover:border-blue-400">
      <div className="bg-white border border-gray-200 rounded p-5 flex flex-col items-center justify-center space-y-2 transition-colors">
        <div className="text-sm font-medium text-gray-600 tracking-wide">Points Activity</div>
        <div className="text-2xl font-semibold tabular-nums text-gray-800">
          {`${summary?.points_issued ?? 0} / ${summary?.points_redeemed ?? 0}`}
        </div>
        <div className="w-full mt-1 h-5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activitySeries} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Tooltip formatter={(val: any) => val} labelFormatter={() => ''} />
              <Line type="monotone" dataKey="issued" stroke={sparkColors['points_issued']} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="redeemed" stroke={sparkColors['points_redeemed']} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col items-center p-4">
      {/* Filters + Heading */}
  <div className="sticky top-0 bg-white z-50 w-full max-w-6xl mb-6 border-b shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-600">Hello {name}. Overview of key performance indicators.</p>
            <p className="text-[11px] text-gray-500 mt-1">
              {start} → {end}{lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={start}
                onChange={e=>setStart(e.target.value)}
                className="border border-gray-300 text-xs rounded px-2 py-1"
              />
              <span className="text-gray-500 text-xs">to</span>
              <input
                type="date"
                value={end}
                onChange={e=>setEnd(e.target.value)}
                className="border border-gray-300 text-xs rounded px-2 py-1"
              />
            </div>
            <div className="flex gap-1">
              {(['7D','30D','YTD'] as const).map(code=>(
                <button
                  key={code}
                  onClick={()=>applyPreset(code)}
                  className={`px-2.5 py-1 text-xs rounded border font-medium tabular-nums ${
                    period===code
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  aria-pressed={period===code}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {loading ? '…' : 'Refresh'}
            </button>
            {/* Segmentation filters */}
            <select
              value={tier}
              onChange={e => { setTier(e.target.value); fetchSummary(); }}
              className="border text-xs rounded px-2 py-1"
            >
              <option value="">All Tiers</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>
            <select
              value={campaign}
              onChange={e => { setCampaign(e.target.value); fetchSummary(); }}
              className="border text-xs rounded px-2 py-1"
            >
              <option value="">All Campaigns</option>
              <option value="summer-sale">Summer Sale</option>
              <option value="referral">Referral</option>
              <option value="ads">Ads</option>
            </select>
            <select
              value={device}
              onChange={e => { setDevice(e.target.value); fetchSummary(); }}
              className="border text-xs rounded px-2 py-1"
            >
              <option value="">All Devices</option>
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
            </select>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >Export CSV</button>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >Copy Link</button>
          </div>
        </div>
      </div>

      {/* Quick Actions: Brought up before metrics */}
      <section className="w-full max-w-6xl mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-8">
          <ActionCard
            to="/admin/users"
            icon={<HiUsers className="w-7 h-7" />}
            title="Manage Users"
            description="View & manage user accounts"
          />
          <ActionCard
            to="/admin/register-staff"
            icon={<HiUserAdd className="w-7 h-7" />}
            title="Register Staff"
            description="Invite staff & assign roles"
          />
          <ActionCard
            to="/admin/modules"
            icon={<HiCog className="w-7 h-7" />}
            title="Modules & Settings"
            description="Enable features & configure options"
          />
          <ActionCard
            to="/admin/analytics"
            icon={<HiCog className="w-7 h-7" />}
            title="Analytics"
            description="View detailed analytics dashboard"
          />
        </div>
      </section>
      {/* Primary KPI Row */}
      <div className="w-full max-w-6xl mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Primary KPIs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {existingPrimary.map(renderMetricCard)}
        </div>
      </div>

      {/* Secondary Groups */}
      <div className="w-full max-w-6xl flex flex-col gap-8">
        {GROUPS.map(group => {
          const groupKeys = group.keys.filter(k => remainingKeys.includes(k) && summary?.[k] !== undefined);
          if (!groupKeys.length) return null;
          const isCollapsed = !!collapsed[group.title];
          const toggle = () => {
            const next = { ...collapsed, [group.title]: !isCollapsed };
            setCollapsed(next);
            localStorage.setItem('adminWelcomeCollapsed', JSON.stringify(next));
          };
          return (
            <section key={group.title}>
              <header className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{group.title}</h3>
                <button onClick={toggle} className="text-xs text-blue-600 hover:underline">
                  {isCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </header>
              {!isCollapsed && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {group.title === 'Loyalty'
                    ? [
                        renderPointsActivityCard(),
                        ...groupKeys.filter(k => k !== 'points_issued' && k !== 'points_redeemed').map(renderMetricCard),
                      ]
                    : groupKeys.map(renderMetricCard)}
                </div>
              )}
            </section>
          );
        })}

        {/* Actions moved below metrics for hierarchy */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <ActionCard
              to="/admin/users"
              icon={<HiUsers className="w-7 h-7" />}
              title="Manage Users"
              description="View & manage user accounts"
            />
            <ActionCard
              to="/admin/register-staff"
              icon={<HiUserAdd className="w-7 h-7" />}
              title="Register Staff"
              description="Invite staff & assign roles"
            />
            <ActionCard
              to="/admin/modules"
              icon={<HiCog className="w-7 h-7" />}
              title="Modules & Settings"
              description="Enable features & configure options"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminWelcome;
