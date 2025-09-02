// src/features/staff/components/DashboardOverview.tsx
import React, { useMemo } from 'react';
import { FaCar, FaPlay, FaChartBar, FaClock, FaCheckCircle, FaCalendarWeek } from 'react-icons/fa';
import { useActiveWashes } from '../../../api/queries';
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
  const fallback = { todayCount: 0, yesterdayCount: 0, thisWeekCount: 0, completedCount: 0, avgDurationMin: 0, dailyTrend: 0, weeklyAvg: 0, completionRate: 0 };
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
        return {
          todayCount,
          yesterdayCount,
          thisWeekCount: last7Total,
          completedCount: completed,
          avgDurationMin,
          dailyTrend,
          weeklyAvg: Math.round(last7Total/7),
          completionRate,
          activeCount: activeWashes.length
        };
      }
      return { ...fallback, activeCount: activeWashes.length };
    });
  }, [dashboardAnalytics, businessAnalytics, activeWashes.length, history, endStr, startStr]);

  const isLoading = loadingDashboard || loadingBusiness || loadingActive;

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
            <h2 className="text-lg font-semibold text-gray-900">Dashboard Overview</h2>
            <p className="text-sm text-gray-500">Real-time car wash operation metrics</p>
          </div>
        </div>
      </div>

      <div className="p-6">
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
