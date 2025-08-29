// src/features/staff/components/DashboardOverview.tsx
import React, { useMemo } from 'react';
import { timeDerivation } from '../perf/counters';
import { useWashHistory } from '../hooks';
import { Wash } from '../../../types';
import './DashboardOverview.css';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
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
            {trend.isPositive ? '📈' : '📉'}
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
  const { data: history = [], isLoading } = useWashHistory({});

  // Calculate metrics
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10);

  // Aggregate metrics in a single pass (memoized)
  const metrics = useMemo(() => timeDerivation(
    'dashboardOverviewMetricPasses',
    'dashboardOverviewDerivationMs',
    () => {
    let todayCount = 0;
    let yesterdayCount = 0;
    let thisWeekCount = 0;
    let completedCount = 0;
    let activeCount = 0;
    let durationSum = 0;

    for (const w of history as Wash[]) {
      const dateStr = w.started_at?.slice(0, 10);
      if (dateStr === todayStr) todayCount++;
      if (dateStr === yesterdayStr) yesterdayCount++;
      if (dateStr && dateStr >= thisWeekStartStr) thisWeekCount++;
      if (w.status === 'ended' && w.ended_at) {
        completedCount++;
        const end = new Date(w.ended_at).getTime();
        const start = new Date(w.started_at).getTime();
        durationSum += (end - start);
      } else if (w.status === 'started') {
        activeCount++;
      }
    }

    const avgDurationMin = completedCount > 0 ? Math.round((durationSum / completedCount) / 60000) : 0;
    const dailyTrend = yesterdayCount > 0
      ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
      : todayCount > 0 ? 100 : 0;
    const weeklyAvg = Math.round(thisWeekCount / 7);
    const completionRate = history.length > 0 ? Math.round((completedCount / history.length) * 100) : 0;

    return {
      todayCount,
      yesterdayCount,
      thisWeekCount,
      completedCount,
      activeCount,
      avgDurationMin,
      dailyTrend,
      weeklyAvg,
      completionRate
    };
  }), [history, todayStr, yesterdayStr, thisWeekStartStr]);

  if (isLoading) {
    return (
      <div className="dashboard-overview loading">
        <div className="loading-placeholder">
          <div className="loading-spinner">⏳</div>
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
          icon="🚗"
          trend={{
            value: metrics.dailyTrend,
            isPositive: metrics.dailyTrend >= 0
          }}
          description="Washes started today"
        />

        <MetricCard
          title="Active Washes"
          value={metrics.activeCount}
          icon="🧽"
          description="Currently in progress"
        />

        <MetricCard
          title="Weekly Total"
          value={metrics.thisWeekCount}
          icon="📊"
          description={`Daily average: ${metrics.weeklyAvg}`}
        />

        <MetricCard
          title="Avg Duration"
          value={`${metrics.avgDurationMin}m`}
          icon="⏱️"
          description="Average completion time"
        />

        <MetricCard
          title="Completion Rate"
          value={`${metrics.completionRate}%`}
          icon="✅"
          description="Successfully completed"
        />

        <MetricCard
          title="Total Completed"
          value={metrics.completedCount}
          icon="🎯"
          description="All time completions"
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
              View Reports
            </button>
            <button className="action-btn secondary">
              <span className="btn-icon">🚗</span>
              Manage Vehicles
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
