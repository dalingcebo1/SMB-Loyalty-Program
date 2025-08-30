// src/features/staff/components/DashboardOverview.tsx
import React, { useMemo } from 'react';
import { StaffIcon } from './StaffIcon';
import { useActiveWashes } from '../../../api/queries';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { useBusinessAnalytics } from '../hooks/useBusinessAnalytics';
import { useWashHistory } from '../hooks'; // retained as fallback / for derived metrics if backend incomplete
import { timeDerivation } from '../perf/counters';
import { Wash } from '../../../types';
import './DashboardOverview.css';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description: string;
}

const MetricCardComponent: React.FC<MetricCardProps> = ({ title, value, icon, trend, description }) => (
  <div className="metric-card">
    <div className="metric-header">
      <div className="metric-icon">{icon}</div>
      <div className="metric-info">
        <h3 className="metric-title">{title}</h3>
        <div className="metric-value">{value}</div>
      </div>
    </div>
    <div className="metric-footer">
      <p className="metric-description">{description}</p>
      {trend && (
        <div className={`metric-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          <span className="trend-icon">
            {trend.isPositive ? <StaffIcon name="performance" /> : <StaffIcon name="analytics" />}
          </span>
          <span className="trend-value">
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        </div>
      )}
    </div>
  </div>
);

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
      <div className="dashboard-overview loading">
        <div className="loading-placeholder">
          <div className="loading-spinner">⏳</div>
            <div className="loading-spinner"><StaffIcon name="loading" /></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      <div className="overview-header">
        <h2>Dashboard Overview</h2>
        <p>Real-time car wash operation metrics</p>
      </div>

      <div className="metrics-grid">
        <MetricCard
          title="Today's Washes"
          value={metrics.todayCount}
          icon={<StaffIcon name="car" />}
          trend={{
            value: metrics.dailyTrend,
            isPositive: metrics.dailyTrend >= 0
          }}
          description="Washes started today"
        />

        <MetricCard
          title="Active Washes"
          value={metrics.activeCount}
          icon={<StaffIcon name="wash" />}
          description="Currently in progress"
        />

        <MetricCard
          title="7d Washes"
          value={metrics.thisWeekCount}
          icon={<StaffIcon name="analytics" />}
          description={`Daily avg: ${metrics.weeklyAvg}`}
        />

        <MetricCard
          title="Avg Duration"
          value={`${metrics.avgDurationMin}m`}
          icon={<StaffIcon name="duration" />}
          description="Average completion time"
        />

        <MetricCard
          title="Completion Rate"
          value={`${metrics.completionRate}%`}
          icon={<StaffIcon name="completed" />}
          description="Successfully completed"
        />

        <MetricCard
          title="Completed (7d)"
          value={metrics.completedCount}
          icon={<StaffIcon name="completed" />}
          description="Completed in range"
        />
      </div>

  {metrics.activeCount > 0 && (
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button className="action-btn primary">
              <span className="btn-icon">👀</span>
      View Active ({metrics.activeCount})
            </button>
            <button className="action-btn secondary">
              <span className="btn-icon">📊</span>
      View Active ({metrics.activeCount})
            </button>
            <button className="action-btn secondary">
               <span className="btn-icon"><StaffIcon name="car" /></span>
              Manage Vehicles
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
