// src/features/staff/components/DashboardOverview.tsx
import React from 'react';
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

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, description }) => (
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

const DashboardOverview: React.FC = () => {
  const { data: history = [], isLoading } = useWashHistory({});

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

  // Calculate metrics
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10);

  // Filter data
  const todayWashes = history.filter((w: Wash) => w.started_at.slice(0, 10) === todayStr);
  const yesterdayWashes = history.filter((w: Wash) => w.started_at.slice(0, 10) === yesterdayStr);
  const thisWeekWashes = history.filter((w: Wash) => w.started_at.slice(0, 10) >= thisWeekStartStr);
  const completedWashes = history.filter((w: Wash) => w.status === 'ended' && w.ended_at);
  const activeWashes = history.filter((w: Wash) => w.status === 'started');

  // Calculate averages
  const avgDurationMs = completedWashes.length > 0
    ? completedWashes.reduce((sum: number, w: Wash) => {
        const duration = new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime();
        return sum + duration;
      }, 0) / completedWashes.length
    : 0;
  const avgDurationMin = Math.round(avgDurationMs / 60000);

  // Calculate trends
  const todayCount = todayWashes.length;
  const yesterdayCount = yesterdayWashes.length;
  const dailyTrend = yesterdayCount > 0 
    ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
    : todayCount > 0 ? 100 : 0;

  const thisWeekCount = thisWeekWashes.length;
  const weeklyAvg = Math.round(thisWeekCount / 7);

  const completionRate = history.length > 0 
    ? Math.round((completedWashes.length / history.length) * 100)
    : 0;

  return (
    <div className="dashboard-overview">
      <div className="overview-header">
        <h2>Dashboard Overview</h2>
        <p>Real-time car wash operation metrics</p>
      </div>

      <div className="metrics-grid">
        <MetricCard
          title="Today's Washes"
          value={todayCount}
          icon="🚗"
          trend={{
            value: dailyTrend,
            isPositive: dailyTrend >= 0
          }}
          description="Washes started today"
        />

        <MetricCard
          title="Active Washes"
          value={activeWashes.length}
          icon="🧽"
          description="Currently in progress"
        />

        <MetricCard
          title="Weekly Total"
          value={thisWeekCount}
          icon="📊"
          description={`Daily average: ${weeklyAvg}`}
        />

        <MetricCard
          title="Avg Duration"
          value={`${avgDurationMin}m`}
          icon="⏱️"
          description="Average completion time"
        />

        <MetricCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon="✅"
          description="Successfully completed"
        />

        <MetricCard
          title="Total Completed"
          value={completedWashes.length}
          icon="🎯"
          description="All time completions"
        />
      </div>

      {activeWashes.length > 0 && (
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button className="action-btn primary">
              <span className="btn-icon">👀</span>
              View Active ({activeWashes.length})
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
