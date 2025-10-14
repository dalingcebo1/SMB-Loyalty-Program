// src/features/staff/components/DashboardOverview.tsx
import React, { useMemo } from 'react';
import { FaCar, FaPlay, FaChartBar, FaClock, FaCheckCircle, FaCalendarWeek } from 'react-icons/fa';
import { formatCents } from '../../../utils/format';
import { useActiveWashes } from '../hooks/useActiveWashes';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { useBusinessAnalytics } from '../hooks/useBusinessAnalytics';
import { useWashHistory } from '../hooks'; // retained as fallback / for derived metrics if backend incomplete
import { timeDerivation } from '../perf/counters';
import { Wash } from '../../../types';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'pink';
}

const MetricCardComponent: React.FC<MetricCardProps> = ({ title, value, icon, trend, description, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
    pink: 'bg-pink-50 text-pink-600 border-pink-200'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
            trend.isPositive 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            <span>{trend.isPositive ? '↗' : '↘'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mt-2">{description}</p>
    </div>
  );
};

// Prevent unnecessary rerenders when props unchanged
const MetricCard = React.memo(MetricCardComponent);

const DashboardOverview: React.FC = () => {
  // Date range for dashboard analytics (last 7d window)
  const { startStr, endStr } = useMemo(() => {
    const endDate = new Date();
    const start = new Date();
    start.setDate(endDate.getDate() - 6);
    return { startStr: start.toISOString().slice(0,10), endStr: endDate.toISOString().slice(0,10) };
  }, []);

  const { data: dashboardAnalytics, isLoading: loadingDashboard } = useDashboardAnalytics({ startDate: startStr, endDate: endStr });
  const { data: businessAnalytics, isLoading: loadingBusiness } = useBusinessAnalytics({ rangeDays: 30, recentDays: 7 });
  const { data: activeWashes = [], isLoading: loadingActive } = useActiveWashes();
  const { data: history = [] } = useWashHistory({}); // fallback/history length for some derived metrics

  // Derive unified metrics preferring backend analytics; fallback to client derivation
  const metrics = useMemo(() => {
    return timeDerivation('dashboardOverviewMetricPasses','dashboardOverviewDerivationMs', () => {
      // Fallback local derivation if dashboardAnalytics absent
      const fallback = {
        todayCount: 0,
        yesterdayCount: 0,
        thisWeekCount: 0,
        completedCount: 0,
        avgDurationMin: 0,
        dailyTrend: 0,
        weeklyAvg: 0,
        completionRate: 0,
        activeCount: 0,
        periodRevenueCents: 0,
        todayRevenueCents: 0,
        mtdRevenueCents: 0,
        revenueGrowthPct: 0,
        customerCount: 0
      };
      const today = endStr;
  const endDate = new Date(endStr + 'T00:00:00');
  const yesterday = new Date(endDate); yesterday.setDate(endDate.getDate()-1); const yesterdayStr = yesterday.toISOString().slice(0,10);
      const weekStart = startStr;
      if (!dashboardAnalytics) {
  let durationSum = 0;
        for (const w of history as Wash[]) {
          const dateStr = w.started_at?.slice(0,10);
          if (dateStr === today) fallback.todayCount++;
            if (dateStr === yesterdayStr) fallback.yesterdayCount++;
            if (dateStr && dateStr >= weekStart) fallback.thisWeekCount++;
          if (w.status === 'ended' && w.ended_at) {
            fallback.completedCount++;
            durationSum += (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime());
          }
        }
        fallback.avgDurationMin = fallback.completedCount>0 ? Math.round((durationSum / fallback.completedCount)/60000):0;
        fallback.dailyTrend = fallback.yesterdayCount>0 ? Math.round(((fallback.todayCount - fallback.yesterdayCount)/fallback.yesterdayCount)*100) : (fallback.todayCount>0?100:0);
        fallback.weeklyAvg = Math.round(fallback.thisWeekCount/7);
        fallback.completionRate = history.length>0 ? Math.round((fallback.completedCount/history.length)*100):0;
        fallback.activeCount = activeWashes.length;
        fallback.periodRevenueCents = fallback.completedCount * 15000; // rough heuristic
        fallback.todayRevenueCents = fallback.todayCount * 15000;
        fallback.mtdRevenueCents = fallback.thisWeekCount * (15000/7) * 30;
  fallback.customerCount = new Set((history as Wash[]).map(w => w.user?.id ?? w.order_id)).size;
      }
      // If backend available, map it
      if (dashboardAnalytics) {
        const chart = dashboardAnalytics.chart_data;
        const todayEntry = chart.find(d => d.date === endStr);
  const yesterdayEntry = chart.find(d => d.date === new Date(new Date(endStr).getTime()-86400000).toISOString().slice(0,10));
        const last7Total = chart.reduce((s,c)=>s + (c.washes||0),0);
        const todayCount = todayEntry?.washes || 0;
        const yesterdayCount = yesterdayEntry?.washes || 0;
        const dailyTrend = yesterdayCount>0 ? Math.round(((todayCount - yesterdayCount)/yesterdayCount)*100) : (todayCount>0?100:0);
        const completed = dashboardAnalytics.completed_washes;
        // Duration from business analytics if present
        const avgDurationMin = businessAnalytics?.duration_stats.average_s != null ? Math.round((businessAnalytics.duration_stats.average_s || 0)/60) : fallback.avgDurationMin;
        const completionRate = dashboardAnalytics.total_washes>0 ? Math.round((completed / dashboardAnalytics.total_washes)*100) : 0;
        const revenueBreakdown = dashboardAnalytics.revenue_breakdown;
        const revenueCents = revenueBreakdown?.period_revenue_cents ?? Math.round((dashboardAnalytics.revenue || 0) * 100);
        const todayRevenueCents = revenueBreakdown?.today_revenue_cents ?? fallback.todayRevenueCents;
        const mtdRevenueCents = revenueBreakdown?.month_to_date_revenue_cents ?? fallback.mtdRevenueCents;
        const revenueGrowthPct = revenueBreakdown?.period_vs_prev_pct ?? fallback.revenueGrowthPct;
        return {
          todayCount,
          yesterdayCount,
          thisWeekCount: last7Total,
          completedCount: completed,
          avgDurationMin,
          dailyTrend,
          weeklyAvg: Math.round(last7Total/7),
          completionRate,
          activeCount: activeWashes.length,
          periodRevenueCents: revenueCents,
          todayRevenueCents,
          mtdRevenueCents,
          revenueGrowthPct,
          customerCount: dashboardAnalytics.customer_count
        };
      }
      return { ...fallback, activeCount: activeWashes.length };
    });
  }, [dashboardAnalytics, businessAnalytics, activeWashes.length, history, endStr, startStr]);

  const isLoading = loadingDashboard || loadingBusiness || loadingActive;

  const highlightCards = [
    {
      key: 'revenue',
      title: 'Revenue (period)',
      value: formatCents(metrics.periodRevenueCents || 0),
      delta: metrics.revenueGrowthPct,
      deltaLabel: 'vs prev period',
      accent: 'from-blue-500 via-blue-500 to-indigo-500'
    },
    {
      key: 'today',
      title: "Today's washes",
      value: metrics.todayCount,
      delta: metrics.dailyTrend,
      deltaLabel: 'vs yesterday',
      accent: 'from-purple-500 via-purple-500 to-violet-500'
    },
    {
      key: 'active',
      title: 'Active washes',
      value: metrics.activeCount,
      delta: null,
      deltaLabel: null,
      accent: 'from-emerald-500 via-emerald-500 to-teal-500'
    },
    {
      key: 'customers',
      title: `${startStr} to ${endStr}`,
      subtitle: 'Unique customers in range',
      value: metrics.customerCount,
      delta: null,
      deltaLabel: null,
      accent: 'from-amber-500 via-amber-500 to-orange-500'
    }
  ];

  const renderDeltaBadge = (delta: number | null | undefined, label?: string | null) => {
    if (delta === null || delta === undefined) return null;
    if (!Number.isFinite(delta)) return null;
    const rounded = Math.round(delta * 10) / 10;
    const positive = rounded >= 0;
  const arrow = positive ? '+' : '-';
    const tone = positive ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-rose-600 bg-rose-50 border border-rose-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${tone}`}>
        <span>{arrow}</span>
        <span>{Math.abs(rounded)}%</span>
        {label ? <span className="text-[10px] font-medium text-gray-500 tracking-wide">{label}</span> : null}
      </span>
    );
  };

  const renderHighlightValue = (value: string | number) => {
    return typeof value === 'number' ? value.toLocaleString() : value;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="flex items-center justify-center space-x-3">
          <LoadingSpinner size="lg" />
          <span className="text-gray-500">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FaChartBar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
              <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Dashboard overview</h2>
              <p className="text-sm text-gray-500 sm:text-base">Real-time car wash operation metrics</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {highlightCards.map(card => (
            <div key={card.key} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm min-w-0">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-20`} aria-hidden="true" />
              <div className="relative p-5 flex flex-col gap-3 min-w-0">
                <div className="text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap">
                  {card.title}
                </div>
                {card.subtitle ? (
                  <div className="text-[11px] text-gray-400 tracking-wide">{card.subtitle}</div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-2xl font-bold text-gray-900">
                    {renderHighlightValue(card.value)}
                  </span>
                  {renderDeltaBadge(card.delta, card.deltaLabel)}
                </div>
                {card.key === 'revenue' ? (
                  <div className="text-xs text-gray-500">
                    Today: <span className="font-semibold text-gray-700">{formatCents(metrics.todayRevenueCents || 0)}</span>
                  </div>
                ) : null}
                {card.key === 'active' ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                    System Online
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            title="Today's Washes"
            value={metrics.todayCount}
            icon={<FaCar className="w-5 h-5" />}
            trend={{
              value: metrics.dailyTrend,
              isPositive: metrics.dailyTrend >= 0
            }}
            description="Washes started today"
            color="blue"
          />

          <MetricCard
            title="Active Washes"
            value={metrics.activeCount}
            icon={<FaPlay className="w-5 h-5" />}
            description="Currently in progress"
            color="green"
          />

          <MetricCard
            title="7d Washes"
            value={metrics.thisWeekCount}
            icon={<FaCalendarWeek className="w-5 h-5" />}
            description={`Daily avg: ${metrics.weeklyAvg}`}
            color="purple"
          />

          <MetricCard
            title="Avg Duration"
            value={`${metrics.avgDurationMin}m`}
            icon={<FaClock className="w-5 h-5" />}
            description="Average completion time"
            color="orange"
          />

          <MetricCard
            title="Completion Rate"
            value={`${metrics.completionRate}%`}
            icon={<FaCheckCircle className="w-5 h-5" />}
            description="Successfully completed"
            color="teal"
          />

          <MetricCard
            title="Completed (7d)"
            value={metrics.completedCount}
            icon={<FaCheckCircle className="w-5 h-5" />}
            description="Completed in range"
            color="pink"
          />
        </div>

        {metrics.activeCount > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <FaPlay className="w-4 h-4 mr-2" />
                View Active ({metrics.activeCount})
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <FaChartBar className="w-4 h-4 mr-2" />
                View Analytics
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
