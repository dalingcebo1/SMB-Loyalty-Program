// src/features/staff/components/EnhancedAnalytics.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatCents } from '../../../utils/format';
import { useSharedPeriod } from '../hooks/useSharedPeriod';
import { useWashHistory, useDashboardAnalytics, useActiveWashes, useBusinessAnalytics } from '../hooks';
import { StaffIcon } from './StaffIcon';

interface AnalyticsData {
  // Store monetary values as integer cents for precision
  revenue: { today_cents: number; period_cents: number; mtd_cents: number; growth_pct: number };
  washes: { completed: number; active: number; total: number; avgDuration: number };
  customers: { total: number; returning: number; new: number };
  performance: { efficiency: number; utilization: number; errorRate: number; avgWaitTime: number };
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill?: boolean;
  }[];
}

interface FilterPeriod {
  label: string;
  value: string;
  days: number;
}

const filterPeriods: FilterPeriod[] = [
  { label: 'Today', value: 'today', days: 1 },
  { label: 'Week', value: 'week', days: 7 },
  { label: 'Month', value: 'month', days: 30 },
  { label: 'Quarter', value: 'quarter', days: 90 }
];

const EnhancedAnalytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useSharedPeriod('week');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    revenue: { today_cents: 0, period_cents: 0, mtd_cents: 0, growth_pct: 0 },
    washes: { completed: 0, active: 0, total: 0, avgDuration: 0 },
    customers: { total: 0, returning: 0, new: 0 },
    performance: { efficiency: 0, utilization: 0, errorRate: 0, avgWaitTime: 0 }
  });
  const [revenueChartData, setRevenueChartData] = useState<ChartData | null>(null);
  const [washVolumeData, setWashVolumeData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get current period dates
  const periodInfo = useMemo(() => {
    const def = filterPeriods.find(p => p.value === selectedPeriod) || filterPeriods[1];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (def.days - 1));
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    return { startDate: startStr, endDate: endStr, days: def.days };
  }, [selectedPeriod]);

  // Historical wash data still used for certain derived metrics & fallback
  const { data: washHistoryData } = useWashHistory({
    startDate: periodInfo.startDate,
    endDate: periodInfo.endDate
  });
  // Real backend analytics
  const { data: backendAnalytics, isLoading: backendLoading } = useDashboardAnalytics({
    startDate: periodInfo.startDate,
    endDate: periodInfo.endDate
  });
  // Phase 1 & 2 consolidated metrics
  // Align recent_days with selected period; keep rangeDays at least 30 for stable trend calcs.
  const { data: businessAnalytics, isLoading: businessLoading } = useBusinessAnalytics({
    rangeDays: Math.max(30, periodInfo.days),
    recentDays: periodInfo.days
  });
  // Active washes for current status (not included in analytics payload)
  const { data: activeWashesData = [] } = useActiveWashes();

  const calculateAnalytics = useCallback(() => {
    // Primary path: combine dashboard analytics + business analytics for richer, real metrics.
    if (backendAnalytics) {
  const total = backendAnalytics.total_washes;
      const completed = backendAnalytics.completed_washes;
      const revenueCents = backendAnalytics.revenue_breakdown?.period_revenue_cents != null
        ? backendAnalytics.revenue_breakdown.period_revenue_cents
        : Math.round(backendAnalytics.revenue * 100); // fallback legacy rands->cents
      const periodSpanDays = periodInfo.days; // derived period window length
      const totalChartWashes = backendAnalytics.chart_data.reduce((s: number, d: { date: string; washes: number }) => s + d.washes, 0) || 1;
      const lastDate = backendAnalytics.period.end_date;
      const todaysWashes = backendAnalytics.chart_data.find((d: { date: string; washes: number }) => d.date === lastDate)?.washes || 0;
      const todayRevenueCents = backendAnalytics.revenue_breakdown
        ? backendAnalytics.revenue_breakdown.today_revenue_cents
        : Math.round((totalChartWashes > 0 ? (todaysWashes / totalChartWashes) * (revenueCents/100) : 0) * 100);
      const mtdRevenueCents = backendAnalytics.revenue_breakdown
        ? backendAnalytics.revenue_breakdown.month_to_date_revenue_cents
        : Math.round(((revenueCents/100) * (30 / periodSpanDays)) * 100); // projection fallback in cents
      const active = activeWashesData.length;
      // Prefer server duration stats if provided
      const avgDuration = backendAnalytics.wash_duration_seconds?.average != null
        ? Math.round((backendAnalytics.wash_duration_seconds.average / 60))
        : 0;
      const efficiency = total > 0 ? (completed / total) * 100 : 0;
      const utilization = Math.min(100, efficiency * 0.9);
  const uniqueUsers = backendAnalytics.customer_count;
      // Real customer split from business analytics if available
      // Returning/New logic: only trust businessAnalytics split if its recent_days matches current period length.
  const currentWindowDays = periodInfo.days;
  const canUseBA = businessAnalytics && businessAnalytics.recent_days === currentWindowDays;
      let returningCount = canUseBA ? (businessAnalytics!.first_vs_returning.returning) : Math.round(uniqueUsers * 0.6);
      let newCount = canUseBA ? (businessAnalytics!.first_vs_returning.new) : (uniqueUsers - returningCount);
      // Clamp to avoid inconsistencies (e.g. total 0 but new 1)
      if (returningCount + newCount > uniqueUsers) {
        const scale = uniqueUsers / Math.max(1, (returningCount + newCount));
        returningCount = Math.floor(returningCount * scale);
        newCount = uniqueUsers - returningCount;
      }
      if (uniqueUsers === 0) { returningCount = 0; newCount = 0; }
      // Revenue growth delta from business analytics if available
  const revenueGrowthPct = backendAnalytics.revenue_breakdown?.period_vs_prev_pct
        ?? businessAnalytics?.deltas?.revenue_pct
        ?? 0;
      // Map performance errorRate & wait time heuristically based on p95 duration if available
      const p95Secs = businessAnalytics?.duration_stats?.p95_s;
      const errorRate = p95Secs ? Math.min(15, Math.max(0.5, (p95Secs / 60) / 2)) : Math.max(0.5, 5 - efficiency / 10);
      const avgWaitTime = p95Secs ? Math.round(Math.min(30, (p95Secs / 60) * 0.4)) : Math.max(2, Math.round(15 - efficiency / 10));
      setAnalyticsData({
        revenue: {
          today_cents: todayRevenueCents,
          period_cents: revenueCents,
          mtd_cents: mtdRevenueCents,
          growth_pct: revenueGrowthPct || 0
        },
        washes: {
          completed,
          active,
          total,
          avgDuration
        },
        customers: {
          total: uniqueUsers,
          returning: returningCount,
          new: newCount
        },
        performance: {
          efficiency,
          utilization,
          errorRate,
          avgWaitTime
        }
      });
      setIsLoading(false);
      return;
    }
    // Fallback path: minimal derivation using wash history if backend not ready
    if (!washHistoryData) return;
    const completedWashes = washHistoryData.filter(w => w.status === 'ended');
    const activeWashes = washHistoryData.filter(w => w.status === 'started');
    const avgServicePrice = 150; // heuristic only used in fallback
    const totalWashes = washHistoryData.length;
    const avgDuration = completedWashes.length > 0 ? Math.round(
      completedWashes.reduce((sum, wash) => {
        if (wash.ended_at && wash.started_at) {
          return sum + (new Date(wash.ended_at).getTime() - new Date(wash.started_at).getTime()) / 60000;
        }
        return sum;
      }, 0) / completedWashes.length
    ) : 0;
    const efficiency = totalWashes > 0 ? (completedWashes.length / totalWashes) * 100 : 0;
    const uniqueUsers = new Set(washHistoryData.map(w => w.order_id)).size;
    const weekRevenueCents = completedWashes.length * avgServicePrice * 100; // heuristic
    const dailyRevenueCents = periodInfo.days ? Math.round(weekRevenueCents / periodInfo.days) : weekRevenueCents;
    setAnalyticsData({
      revenue: { today_cents: dailyRevenueCents, period_cents: weekRevenueCents, mtd_cents: dailyRevenueCents * 30, growth_pct: 0 },
      washes: { completed: completedWashes.length, active: activeWashes.length, total: totalWashes, avgDuration },
      customers: { total: uniqueUsers, returning: Math.round(uniqueUsers * 0.6), new: Math.round(uniqueUsers * 0.4) },
      performance: { efficiency, utilization: Math.min(100, efficiency * 0.9), errorRate: Math.max(0.5, 5 - efficiency / 10), avgWaitTime: Math.max(2, Math.round(15 - efficiency / 10)) }
    });
    setIsLoading(false);
  }, [backendAnalytics, businessAnalytics, washHistoryData, activeWashesData, periodInfo.days]);

  const generateChartData = useCallback(() => {
    // If backend analytics available, build charts from its chart_data (washes); synthesize revenue
    if (backendAnalytics) {
  const labels = backendAnalytics.chart_data.map((d: { date: string; washes: number }) => {
        const dt = new Date(d.date + 'T00:00:00Z');
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
  const washCounts = backendAnalytics.chart_data.map((d: { date: string; washes: number }) => d.washes);
  const totalWashCounts = washCounts.reduce((s: number, v: number) => s + v, 0) || 1;
      const revenuePerUnit = backendAnalytics.revenue / totalWashCounts;
  const revenueSeries = washCounts.map((c: number) => c * revenuePerUnit);
      setRevenueChartData({
        labels,
        datasets: [{
          label: 'Revenue',
          data: revenueSeries,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true
        }]
      });
      setWashVolumeData({
        labels,
        datasets: [{
          label: 'Wash Volume',
          data: washCounts,
          borderColor: '#764ba2',
          backgroundColor: 'rgba(118, 75, 162, 0.1)',
          fill: true
        }]
      });
      return;
    }
    // Fallback to local history-derived mock
    if (!washHistoryData) return;
    const period = filterPeriods.find(p => p.value === selectedPeriod);
    const days = period?.days || 7;
    const labels: string[] = [];
    const revenueData: number[] = [];
    const washVolume: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const dayWashes = washHistoryData.filter(w => w.started_at && w.started_at.startsWith(dateStr));
      const count = dayWashes.length;
      washVolume.push(count);
      revenueData.push(count * 150);
    }
    setRevenueChartData({
      labels,
      datasets: [{ label: 'Revenue', data: revenueData, borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)', fill: true }]
    });
    setWashVolumeData({
      labels,
      datasets: [{ label: 'Wash Volume', data: washVolume, borderColor: '#764ba2', backgroundColor: 'rgba(118,75,162,0.1)', fill: true }]
    });
  }, [backendAnalytics, washHistoryData, selectedPeriod]);

  useEffect(() => {
    if (backendAnalytics || washHistoryData) {
      calculateAnalytics();
      generateChartData();
    }
  }, [backendAnalytics, washHistoryData, selectedPeriod, calculateAnalytics, generateChartData]);

  const formatDelta = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined) return <span className="delta neutral">—</span>;
    const sign = pct > 0 ? '+' : '';
    const cls = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '▶';
    return <span className={`delta ${cls}`}>{arrow} {sign}{pct}%</span>;
  };

  // ---------------- Tailwind Modernized UI ----------------
  const loadingAny = isLoading || backendLoading || businessLoading;

  interface LineSeries { label: string; values: number[]; color: string; area?: boolean; currency?: boolean; rightAxis?: boolean; }
  const AnalyticsLineChart: React.FC<{ labels: string[]; series: LineSeries[]; options: { cumulative: boolean; log: boolean; dualAxis: boolean } }> = ({ labels, series, options }) => {
    // Fine‑grained paddings to avoid overlaps with controls & labels
    const W = 440; const H = 170; const PT = 16; const PB = 30; const PL = 46; const PR = options.dualAxis ? 50 : 24;
    const [hover, setHover] = useState<number|null>(null);
    if (!series.length || !series[0].values.length) {
      return <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data</div>;
    }
    // Transform values (cumulative)
    const transformed = series.map(s => {
      let vals = [...s.values];
      if (options.cumulative) {
        let run = 0; vals = vals.map(v => (run += v));
      }
      return { ...s, tvals: vals };
    });
    // Separate axes
    const leftSeries = transformed.filter(s => !s.rightAxis);
    const rightSeries = transformed.filter(s => s.rightAxis);
    function scaleSet(set: typeof transformed) {
      const all = set.flatMap(s => s.tvals);
      let min = Math.min(...all);
      let max = Math.max(...all);
      if (options.log) {
        // shift if zeros
        const shift = 1 - Math.min(...all, 0) + 0.0001;
        const lvals = all.map(v => Math.log10(v + shift));
        min = Math.min(...lvals); max = Math.max(...lvals);
        return { min, max, shift, log:true };
      }
      if (min === max) { max = min + 1; }
      return { min, max, shift:0, log:false };
    }
    const L = scaleSet(leftSeries);
    const R = options.dualAxis && rightSeries.length ? scaleSet(rightSeries) : null;
    const chartHeight = H - PT - PB;
    const chartWidth = W - PL - PR;
    const xFor = (i:number) => PL + (i/(labels.length-1))*chartWidth;
    const yFor = (v:number, axis:'L'|'R') => {
      const S = axis==='L'?L:R!;
      if (S.log) {
        const lv = Math.log10(v + S.shift);
        return H - PB - ((lv - S.min)/(S.max-S.min))*chartHeight;
      }
      return H - PB - ((v - S.min)/(S.max-S.min))*chartHeight;
    };
  function buildPath(vals:number[], axis:'L'|'R') {
      return vals.map((v,i)=>{
        const x = xFor(i); const y = yFor(v, axis); return {x,y,v};
      });
    }
  const paths = transformed.map(s => ({ s, pts: buildPath(s.tvals, s.rightAxis?'R':'L') }));
    const onMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
      const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
      const rel = (e.clientX - rect.left - PL)/chartWidth; if (rel < 0 || rel >1) { setHover(null); return; }
      const idx = Math.round(rel*(labels.length-1)); setHover(idx);
    };
    const onLeave = () => setHover(null);
    // ticks left
    const leftTicks = 4;
    // Create 'nice' ticks (left axis) for readability
    function niceStep(range:number) {
      const rough = range / (leftTicks - 1);
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const norm = rough / mag;
      let step = mag;
      if (norm >= 5) step = 5*mag; else if (norm >= 2) step = 2*mag; else step = mag;
      return step;
    }
    const leftRange = L.max - L.min;
    const step = niceStep(leftRange || 1);
    const tickStart = Math.floor(L.min / step) * step;
    const leftTickVals: number[] = [];
    for (let v = tickStart; v <= L.max + 0.0001 && leftTickVals.length < 6; v += step) leftTickVals.push(v);
    const rightTickVals = R ? leftTickVals.map(()=>0).map((_,i)=> R.min + (i/(leftTicks-1))*(R.max-R.min)) : [];
    return (
      <div className="absolute inset-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" onMouseMove={onMove} onMouseLeave={onLeave}>
          <defs>
            {paths.map(p=> p.s.area && <linearGradient key={p.s.label+"grad"} id={`grad-${p.s.label}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={p.s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={p.s.color} stopOpacity="0.05" />
            </linearGradient>)}
          </defs>
          {/* Grid */}
          {leftTickVals.map(tv=> {
            const y = yFor(options.log? (Math.pow(10, tv)-L.shift): tv, 'L');
            return <line key={'g'+tv} x1={PL} x2={W-PR} y1={y} y2={y} stroke="#eef2f7" strokeDasharray="3 4" />;
          })}
          {/* Axes */}
          <line x1={PL} x2={PL} y1={PT} y2={H-PB} stroke="#d1d5db" />
          <line x1={W-PR} x2={W-PR} y1={PT} y2={H-PB} stroke={R?"#d1d5db":"transparent"} />
          <line x1={PL} x2={W-PR} y1={H-PB} y2={H-PB} stroke="#d1d5db" />
          {/* X labels sparse */}
          {labels.length>0 && [0, Math.floor(labels.length/2), labels.length-1].map(i=> <text key={'xl'+i} x={xFor(i)} y={H- PB + 18} textAnchor="middle" fontSize="10" fill="#6b7280">{labels[i]}</text>)}
          {/* Y labels */}
          {leftTickVals.map(tv=> {
            const y = yFor(options.log? (Math.pow(10, tv)-L.shift): tv, 'L');
            const showCurrency = series.some(s=> s.currency && !s.rightAxis);
            const label = showCurrency ? formatCents(Math.round(tv*100)) : Math.round(tv).toString();
            return <text key={'yl'+tv} x={PL-8} y={y+4} fontSize="10" textAnchor="end" fill="#64748b">{label}</text>;
          })}
          {R && rightTickVals.map((tv,i)=> {
            const y = yFor(options.log? (Math.pow(10, tv)-R.shift): tv, 'R');
            return <text key={'yr'+i} x={W-PR+6} y={y+4} fontSize="10" textAnchor="start" fill="#64748b">{Math.round(tv)}</text>;
          })}
          {/* Series */}
          {paths.map(p=>{
            const d = p.pts.reduce((a,pt,i,arr)=>{
              if(i===0) return `M ${pt.x} ${pt.y}`;
              const prev = arr[i-1]; const dx=(pt.x-prev.x)/2; const c1x=prev.x+dx; const c1y=prev.y; const c2x=pt.x-dx; const c2y=pt.y; return a+` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${pt.x} ${pt.y}`;
            },'');
            const fillD = `${d} L ${p.pts[p.pts.length-1].x} ${H-PB} L ${p.pts[0].x} ${H-PB} Z`;
            return <g key={p.s.label}>
              {p.s.area && <path d={fillD} fill={`url(#grad-${p.s.label})`} />}
              <path d={d} fill="none" stroke={p.s.color} strokeWidth={2} />
              {p.pts.map((pt,i)=> <circle key={i} cx={pt.x} cy={pt.y} r={ (hover===i)?4:2.5 } fill={p.s.color} />)}
            </g>;
          })}
          {/* Hover crosshair */}
          {hover!=null && (
            <g>
              <line x1={xFor(hover)} x2={xFor(hover)} y1={PT} y2={H-PB} stroke="#94a3b8" strokeDasharray="4 4" />
            </g>
          )}
        </svg>
        {hover!=null && (
          <div className="pointer-events-none absolute text-[11px] bg-white/95 backdrop-blur border border-gray-200 shadow-sm rounded-md px-2 py-1 flex flex-col gap-0.5" style={{
            left:`${Math.min(95, Math.max(5,(hover/(labels.length-1))*100))}%`,
            top:2,
            transform:'translateX(-50%)'
          }}>
            <div className="font-medium text-gray-700">{labels[hover]}</div>
            {paths.map(p=> <div key={p.s.label} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{background:p.s.color}}></span>
              <span className="text-gray-600">{p.s.label}:</span>
              <span className="font-mono text-gray-800">{p.s.currency ? formatCents(Math.round(p.pts[hover].v*100)) : Math.round(p.pts[hover].v)}</span>
            </div>)}
          </div>
        )}
      </div>
    );
  };

  // Chart option state (shared)
  const [chartCumulative, setChartCumulative] = useState(false);
  const [chartLogScale, setChartLogScale] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const Card: React.FC<{ title: React.ReactNode; value?: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; loading?: boolean; children?: React.ReactNode; className?: string; }>
    = ({ title, value, subtitle, right, loading, children, className }) => (
    <div className={`bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition ${className||''}`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-500 tracking-wide uppercase">{title}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
        {right && <div className="text-xs font-medium">{right}</div>}
      </div>
      {loading ? (
        <div className="animate-pulse h-6 bg-gray-200 rounded w-1/2" />
      ) : (
        value && <div className="text-2xl font-bold text-gray-900">{value}</div>
      )}
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Business Analytics</h2>
              <p className="mt-1 text-indigo-100">Real-time insights and performance metrics</p>
              <p className="mt-2 text-xs text-indigo-200 font-mono">{periodInfo.startDate} → {periodInfo.endDate} • {periodInfo.days} day range</p>
            </div>
            <div className="flex flex-wrap gap-2 bg-white/10 p-1 rounded-xl">
              {filterPeriods.map(p => (
                <button
                  key={p.value}
                  onClick={() => setSelectedPeriod(p.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedPeriod===p.value ? 'bg-white text-indigo-700 shadow' : 'text-white/80 hover:bg-white/20'}`}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>

        {/* Primary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card
            title={<span className="flex items-center gap-2"><span role="img" aria-label="rev">💰</span> Revenue</span>}
            value={formatCents(analyticsData.revenue.period_cents)}
            right={<span className={`px-2 py-0.5 rounded-full text-xs ${analyticsData.revenue.growth_pct>=0 ? 'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{analyticsData.revenue.growth_pct.toFixed(1)}%</span>}
            loading={loadingAny}
            subtitle={`Today: ${formatCents(analyticsData.revenue.today_cents)} • MTD: ${formatCents(analyticsData.revenue.mtd_cents)}`}
          />
          <Card
            title={<span className="flex items-center gap-2"><StaffIcon name="car" /> Washes</span>}
            value={analyticsData.washes.completed}
            right={<span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{analyticsData.washes.active} Active</span>}
            loading={loadingAny}
            subtitle={`Total ${analyticsData.washes.total} • Avg ${analyticsData.washes.avgDuration}m`}
          />
            <Card
              title={<span className="flex items-center gap-2"><StaffIcon name="user" /> Customers</span>}
              value={analyticsData.customers.total}
              loading={loadingAny}
              subtitle={`Returning ${analyticsData.customers.returning} • New ${analyticsData.customers.new}`}
            />
          <Card
            title={<span className="flex items-center gap-2"><StaffIcon name="analytics" /> Performance</span>}
            value={`${analyticsData.performance.utilization.toFixed(1)}%`}
            loading={loadingAny}
            subtitle={`Errors ${analyticsData.performance.errorRate.toFixed(1)}% • Wait ${analyticsData.performance.avgWaitTime}m`}
            right={<span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">{analyticsData.performance.efficiency.toFixed(1)}%</span>}
          />
        </div>

        {/* Secondary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
          <Card title="Avg ticket" value={businessAnalytics ? `R${businessAnalytics.avg_ticket.toFixed(2)}`:undefined} loading={businessLoading} right={formatDelta(businessAnalytics?.deltas?.avg_ticket_pct)} />
          <Card title="Loyalty share" value={businessAnalytics ? `${(businessAnalytics.loyalty_share*100).toFixed(1)}%`:undefined} loading={businessLoading} right={formatDelta(businessAnalytics?.deltas?.loyalty_share_pct)} />
          <Card title="Churn risk" value={businessAnalytics ? businessAnalytics.churn_risk_count:undefined} loading={businessLoading} />
          <Card title="Upsell rate" value={businessAnalytics ? `${(businessAnalytics.upsell_rate*100).toFixed(1)}%`:undefined} loading={businessLoading} right={formatDelta(businessAnalytics?.deltas?.upsell_rate_pct)} />
          <Card title="Manual %" value={businessAnalytics ? `${((businessAnalytics.payment_mix.manual_started / Math.max(1, (businessAnalytics.payment_mix.manual_started + businessAnalytics.payment_mix.paid_started)))*100).toFixed(1)}%`:undefined} loading={businessLoading} />
          <Card title=">10m pending" value={businessAnalytics ? businessAnalytics.pending_orders_over_10m:undefined} loading={businessLoading} />
          <Card title="p95 duration" value={businessAnalytics ? (businessAnalytics.duration_stats?.p95_s ? Math.round(businessAnalytics.duration_stats.p95_s/60)+'m':'—'):undefined} loading={businessLoading} right={formatDelta(businessAnalytics?.deltas?.p95_duration_pct)}>
            {businessAnalytics && <div className="text-xs text-gray-500">Slow (&gt;30m): {businessAnalytics.duration_stats?.slow_wash_count ?? '—'}</div>}
          </Card>
        </div>

        {/* Charts */}
        <div className={`grid gap-8 ${showOverlay ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
          <div className={`bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm relative ${showOverlay ? 'lg:col-span-2' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue trend</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                  <button onClick={()=>setChartCumulative(v=>!v)} className={`px-2 py-0.5 rounded border ${chartCumulative?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{chartCumulative?'Cumulative':'Linear'}</button>
                  <button onClick={()=>setChartLogScale(v=>!v)} className={`px-2 py-0.5 rounded border ${chartLogScale?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{chartLogScale?'Log':'Linear y'}</button>
                  <button onClick={()=>setShowOverlay(v=>!v)} className={`px-2 py-0.5 rounded border ${showOverlay?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{showOverlay?'Overlay on':'Overlay off'}</button>
                </div>
              </div>
              <span className="text-xs text-gray-500 mt-1">{selectedPeriod}</span>
            </div>
            <div className="h-40">
              {revenueChartData && (
                <AnalyticsLineChart
                  labels={revenueChartData.labels}
                  series={[
                    { label: 'Revenue', values: revenueChartData.datasets[0].data, color: '#4f46e5', area: true, currency: true },
                    ...(showOverlay && washVolumeData ? [{ label: 'Washes', values: washVolumeData.datasets[0].data, color: '#10b981', rightAxis: true }] : [])
                  ]}
                  options={{ cumulative: chartCumulative, log: chartLogScale, dualAxis: showOverlay }}
                />
              )}
              {!revenueChartData && <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data</div>}
            </div>
          </div>
          {!showOverlay && (
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Wash volume</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    <button onClick={()=>setChartCumulative(v=>!v)} className={`px-2 py-0.5 rounded border ${chartCumulative?'bg-emerald-600 text-white border-emerald-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{chartCumulative?'Cumulative':'Daily'}</button>
                    <button onClick={()=>setChartLogScale(v=>!v)} className={`px-2 py-0.5 rounded border ${chartLogScale?'bg-emerald-600 text-white border-emerald-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{chartLogScale?'Log':'Linear y'}</button>
                  </div>
                </div>
                <span className="text-xs text-gray-500 mt-1">{analyticsData.washes.total} washes</span>
              </div>
              <div className="h-40">
                {washVolumeData && (
                  <AnalyticsLineChart
                    labels={washVolumeData.labels}
                    series={[{ label: 'Washes', values: washVolumeData.datasets[0].data, color: '#059669', area: true }]}
                    options={{ cumulative: chartCumulative, log: chartLogScale, dualAxis: false }}
                  />
                )}
                {!washVolumeData && <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data</div>}
              </div>
            </div>
          )}
          {businessAnalytics && (
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Loyalty vs other</h3>
                <span className="text-xs text-gray-500">{(businessAnalytics.loyalty_share*100).toFixed(1)}% loyalty</span>
              </div>
              <div className="h-40 flex items-end gap-6">
                {(() => {
                  const loyalty = businessAnalytics.loyalty_share||0; const other=1-loyalty; const max=Math.max(loyalty,other)||1;
                  return [
                    {label:'Loyalty', value:loyalty, classes:'from-blue-500 to-indigo-400'},
                    {label:'Other', value:other, classes:'from-gray-400 to-gray-300'}
                  ].map(b=> <div key={b.label} className="flex-1 text-center">
                    <div className={`w-full rounded bg-gradient-to-t ${b.classes}`} style={{height:`${(b.value/max)*100}%`}} title={`${b.label}: ${(b.value*100).toFixed(1)}%`}></div>
                    <div className="mt-2 text-xs text-gray-600">{b.label}</div>
                  </div>);
                })()}
              </div>
            </div>
          )}
          {businessAnalytics && (
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Top services</h3>
                <span className="text-xs text-gray-500">Top {businessAnalytics.top_services?.length||0}</span>
              </div>
              <div className="h-40 flex items-end gap-4">
                {businessAnalytics.top_services?.map(s=>{
                  const max = Math.max(...businessAnalytics.top_services.map(x=>x.count),1);
                  return <div key={s.service} className="flex-1 text-center">
                    <div className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded" style={{height:`${(s.count/max)*100}%`}} title={`${s.service}: ${s.count}`}></div>
                    <div className="mt-2 text-xs text-gray-600 truncate">{s.service}</div>
                  </div>;
                })}
                {businessAnalytics.top_services?.length===0 && <div className="w-full flex items-center justify-center text-gray-400 text-sm">No data</div>}
              </div>
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 tracking-wide">Daily revenue target</h3>
            <div className="space-y-3">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{width:`${Math.min(100, ( (analyticsData.revenue.today_cents/100) / 2000)*100)}%`}} />
              </div>
              <div className="text-xs text-gray-600 font-mono">{formatCents(analyticsData.revenue.today_cents)} / R2000.00</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 tracking-wide">Efficiency target</h3>
            <div className="space-y-3">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{width:`${Math.min(100, analyticsData.performance.efficiency)}%`}} />
              </div>
              <div className="text-xs text-gray-600 font-mono">{analyticsData.performance.efficiency.toFixed(1)}% / 95%</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 tracking-wide">Queue wait (est)</h3>
            <div className="space-y-3">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{width:`${Math.min(100,(analyticsData.performance.avgWaitTime/30)*100)}%`}} />
              </div>
              <div className="text-xs text-gray-600 font-mono">{analyticsData.performance.avgWaitTime}m / 30m cap</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAnalytics;
