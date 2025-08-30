// src/features/staff/components/EnhancedAnalytics.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSharedPeriod } from '../hooks/useSharedPeriod';
import { useWashHistory, useDashboardAnalytics, useActiveWashes, useBusinessAnalytics } from '../hooks';
import type { TopService } from '../hooks/useBusinessAnalytics';
import './EnhancedAnalytics.css';
import { StaffIcon } from './StaffIcon';

interface AnalyticsData {
  revenue: {
    today: number;
    week: number;
    month: number;
    growth: number;
  };
  washes: {
    completed: number;
    active: number;
    total: number;
    avgDuration: number;
  };
  customers: {
    total: number;
    returning: number;
    new: number;
    satisfaction: number;
  };
  performance: {
    efficiency: number;
    utilization: number;
    errorRate: number;
    avgWaitTime: number;
  };
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
    revenue: { today: 0, week: 0, month: 0, growth: 0 },
    washes: { completed: 0, active: 0, total: 0, avgDuration: 0 },
    customers: { total: 0, returning: 0, new: 0, satisfaction: 0 },
    performance: { efficiency: 0, utilization: 0, errorRate: 0, avgWaitTime: 0 }
  });
  const [revenueChartData, setRevenueChartData] = useState<ChartData | null>(null);
  const [washVolumeData, setWashVolumeData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get current period dates
  const periodDates = useMemo(() => {
    const period = filterPeriods.find(p => p.value === selectedPeriod);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (period?.days || 7));
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }, [selectedPeriod]);

  // Historical wash data still used for certain derived metrics & fallback
  const { data: washHistoryData } = useWashHistory({
    startDate: periodDates.startDate,
    endDate: periodDates.endDate
  });
  // Real backend analytics
  const { data: backendAnalytics, isLoading: backendLoading } = useDashboardAnalytics({
    startDate: periodDates.startDate,
    endDate: periodDates.endDate
  });
  // Phase 1 & 2 consolidated metrics
  const { data: businessAnalytics } = useBusinessAnalytics({ rangeDays: 30, recentDays: 7 });
  // Active washes for current status (not included in analytics payload)
  const { data: activeWashesData = [] } = useActiveWashes();

  const calculateAnalytics = useCallback(() => {
    // Prefer backend analytics; fallback to washHistory mock if unavailable
    const periodDays = (new Date(periodDates.endDate).getTime() - new Date(periodDates.startDate).getTime()) / 86400000 + 1;
  if (backendAnalytics) {
      const total = backendAnalytics.total_washes;
      const completed = backendAnalytics.completed_washes;
      const revenue = backendAnalytics.revenue; // already in Rands
  // avgPricePerWash could be used for future per-wash pricing insights (not displayed yet)
      // Derive daily revenue distribution proportional to washes per day
  const totalChartWashes = backendAnalytics.chart_data.reduce((s: number, d: { date: string; washes: number }) => s + d.washes, 0) || 1;
      // Estimate today's revenue (last date in range)
      const lastDate = backendAnalytics.period.end_date;
  const todaysWashes = backendAnalytics.chart_data.find((d: { date: string; washes: number }) => d.date === lastDate)?.washes || 0;
      const todayRevenue = totalChartWashes > 0 ? (todaysWashes / totalChartWashes) * revenue : 0;
      // Month projection naive (scale by 30/periodDays)
      const monthRevenue = revenue * (30 / periodDays);
      const active = activeWashesData.length; // live active washes now

      // Duration estimation from washHistoryData if available (fallback)
      let avgDuration = 0;
      if (washHistoryData) {
        const completedWashes = washHistoryData.filter(w => w.status === 'ended');
        avgDuration = completedWashes.length > 0 ? Math.round(
          completedWashes.reduce((sum, w) => {
            if (w.ended_at && w.started_at) {
              return sum + (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000;
            }
            return sum;
          }, 0) / completedWashes.length
        ) : 0;
      }

      const efficiency = total > 0 ? (completed / total) * 100 : 0;
      const utilization = Math.min(100, efficiency * 0.9); // heuristic
      const uniqueUsers = backendAnalytics.customer_count; // backend unique users
  setAnalyticsData({
        revenue: {
          today: todayRevenue,
            week: revenue, // treat current selected period aggregate as 'week' field for UI label
          month: monthRevenue,
          growth: 0 // placeholder until comparative period implemented
        },
        washes: {
          completed,
          active,
          total,
          avgDuration
        },
        customers: {
          total: uniqueUsers,
          returning: Math.round(uniqueUsers * 0.6),
          new: uniqueUsers - Math.round(uniqueUsers * 0.6),
          satisfaction: 4.7 // placeholder
        },
        performance: {
          efficiency,
          utilization,
          errorRate: Math.max(0.5, 5 - efficiency / 10),
          avgWaitTime: Math.max(2, Math.round(15 - efficiency / 10))
        }
      });
      setIsLoading(false);
      return;
    }
    // Fallback: if backend not ready but we have history, reuse previous mock path
    if (!washHistoryData) return;
    const completedWashes = washHistoryData.filter(w => w.status === 'ended');
    const activeWashes = washHistoryData.filter(w => w.status === 'started');
    const avgServicePrice = 150;
    const weekRevenue = completedWashes.length * avgServicePrice;
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
    setAnalyticsData({
      revenue: { today: weekRevenue * 0.2, week: weekRevenue, month: weekRevenue * 4.2, growth: 0 },
      washes: { completed: completedWashes.length, active: activeWashes.length, total: totalWashes, avgDuration },
      customers: { total: uniqueUsers, returning: Math.round(uniqueUsers * 0.6), new: Math.round(uniqueUsers * 0.4), satisfaction: 4.7 },
      performance: { efficiency, utilization: Math.min(100, efficiency * 0.9), errorRate: Math.max(0.5, 5 - efficiency / 10), avgWaitTime: Math.max(2, Math.round(15 - efficiency / 10)) }
    });
    setIsLoading(false);
  }, [backendAnalytics, washHistoryData, activeWashesData, periodDates.endDate, periodDates.startDate]);

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
    // Trigger recalculation when either backend analytics or fallback history changes
    if (backendAnalytics || washHistoryData) {
      calculateAnalytics();
      generateChartData();
    }
  }, [backendAnalytics, washHistoryData, selectedPeriod, calculateAnalytics, generateChartData]);

  const formatCurrency = (amount: number) => `R${amount.toFixed(2)}`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatDelta = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined) return <span className="delta neutral">—</span>;
    const sign = pct > 0 ? '+' : '';
    const cls = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '▶';
    return <span className={`delta ${cls}`}>{arrow} {sign}{pct}%</span>;
  };

  return (
    <div className="enhanced-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-content">
          <h2>Business Analytics</h2>
          <p>Real-time insights and performance metrics</p>
        </div>
        <div className="period-selector">
          {filterPeriods.map((period) => (
            <button
              key={period.value}
              className={`period-btn ${selectedPeriod === period.value ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

  {isLoading || backendLoading ? (
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="metrics-grid">
            {/* Revenue Metrics */}
            <div className="metric-card revenue">
              <div className="metric-header">
                <h3>💰 Revenue</h3>
                <div className="metric-trend positive">
                  ↗️ +{formatPercentage(analyticsData.revenue.growth)}
                </div>
              </div>
              <div className="metric-values">
                <div className="primary-value">{formatCurrency(analyticsData.revenue.week)}</div>
                <div className="metric-breakdown">
                  <span>Today: {formatCurrency(analyticsData.revenue.today)}</span>
                  <span>Month: {formatCurrency(analyticsData.revenue.month)}</span>
                </div>
              </div>
            </div>

            {/* Wash Metrics */}
            <div className="metric-card washes">
              <div className="metric-header">
                <h3><StaffIcon name="car" /> Washes</h3>
                <div className="metric-trend neutral">
                  {analyticsData.washes.active} active
                </div>
              </div>
              <div className="metric-values">
                <div className="primary-value">{analyticsData.washes.completed}</div>
                <div className="metric-breakdown">
                  <span>Total: {analyticsData.washes.total}</span>
                  <span>Avg: {analyticsData.washes.avgDuration} min</span>
                </div>
              </div>
            </div>

            {/* Customer Metrics */}
            <div className="metric-card customers">
              <div className="metric-header">
                <h3>👥 Customers</h3>
                <div className="metric-trend positive">
                  ⭐ {analyticsData.customers.satisfaction}/5
                </div>
              </div>
              <div className="metric-values">
                <div className="primary-value">{analyticsData.customers.total}</div>
                <div className="metric-breakdown">
                  <span>Returning: {analyticsData.customers.returning}</span>
                  <span>New: {analyticsData.customers.new}</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="metric-card performance">
              <div className="metric-header">
                <h3><StaffIcon name="analytics" /> Performance</h3>
                <div className="metric-trend positive">
                  <StaffIcon name="completed" /> {formatPercentage(analyticsData.performance.efficiency)}
                </div>
              </div>
              <div className="metric-values">
                <div className="primary-value">{formatPercentage(analyticsData.performance.utilization)}</div>
                <div className="metric-breakdown">
                  <span>Errors: {formatPercentage(analyticsData.performance.errorRate)}</span>
                  <span>Wait: {analyticsData.performance.avgWaitTime} min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 1 & 2 KPI Strip */}
          {businessAnalytics && (
            <div className="metrics-grid" style={{marginTop:'1.5rem'}}>
              <div className="metric-card">
                <div className="metric-header"><h3>Avg Ticket</h3>{formatDelta(businessAnalytics.deltas?.avg_ticket_pct)}</div>
                <div className="metric-values"><div className="primary-value">R{businessAnalytics.avg_ticket.toFixed(2)}</div></div>
              </div>
              <div className="metric-card">
                <div className="metric-header"><h3>Loyalty Share</h3>{formatDelta(businessAnalytics.deltas?.loyalty_share_pct)}</div>
                <div className="metric-values"><div className="primary-value">{(businessAnalytics.loyalty_share*100).toFixed(1)}%</div></div>
              </div>
              <div className="metric-card">
                <div className="metric-header"><h3>Churn Risk</h3></div>
                <div className="metric-values"><div className="primary-value">{businessAnalytics.churn_risk_count}</div></div>
              </div>
              <div className="metric-card">
                <div className="metric-header"><h3>Upsell Rate</h3>{formatDelta(businessAnalytics.deltas?.upsell_rate_pct)}</div>
                <div className="metric-values"><div className="primary-value">{(businessAnalytics.upsell_rate*100).toFixed(1)}%</div></div>
              </div>
              <div className="metric-card">
                <div className="metric-header"><h3>Manual %</h3></div>
                <div className="metric-values"><div className="primary-value">{((businessAnalytics.payment_mix.manual_started / Math.max(1, (businessAnalytics.payment_mix.manual_started + businessAnalytics.payment_mix.paid_started)))*100).toFixed(1)}%</div></div>
              </div>
              <div className="metric-card">
                <div className="metric-header"><h3>Pending &gt;10m</h3></div>
                <div className="metric-values"><div className="primary-value">{businessAnalytics.pending_orders_over_10m}</div></div>
              </div>
              <div className="metric-card">
                <div className="metric-header"><h3>p95 Duration</h3>{formatDelta(businessAnalytics.deltas?.p95_duration_pct)}</div>
                <div className="metric-values"><div className="primary-value">{businessAnalytics.duration_stats?.p95_s ? Math.round(businessAnalytics.duration_stats.p95_s/60) + 'm' : '—'}</div>
                  <div className="metric-breakdown"><span>Slow (&gt;30m): {businessAnalytics.duration_stats?.slow_wash_count ?? '—'}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="charts-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Revenue Trend</h3>
                <div className="chart-summary">
                  {formatCurrency(analyticsData.revenue.week)} this {selectedPeriod}
                </div>
              </div>
              <div className="chart-placeholder">
                <div className="chart-mock">
                  {revenueChartData && (
                    <div className="mock-line-chart">
                      {revenueChartData.datasets[0].data.map((value, index) => (
                        <div 
                          key={index} 
                          className="chart-bar"
                          style={{ 
                            height: `${(value / Math.max(...revenueChartData.datasets[0].data)) * 100}%`,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          }}
                          title={`${revenueChartData.labels[index]}: ${formatCurrency(value)}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Wash Volume</h3>
                <div className="chart-summary">
                  {analyticsData.washes.total} washes this {selectedPeriod}
                </div>
              </div>
              <div className="chart-placeholder">
                <div className="chart-mock">
                  {washVolumeData && (
                    <div className="mock-line-chart">
                      {washVolumeData.datasets[0].data.map((value, index) => (
                        <div 
                          key={index} 
                          className="chart-bar"
                          style={{ 
                            height: `${(value / Math.max(...washVolumeData.datasets[0].data)) * 100}%`,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          }}
                          title={`${washVolumeData.labels[index]}: ${value} washes`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {businessAnalytics && (
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Loyalty vs Non‑Loyalty</h3>
                  <div className="chart-summary">{(businessAnalytics.loyalty_share*100).toFixed(1)}% loyalty</div>
                </div>
                <div className="chart-placeholder">
                  <div className="chart-mock" style={{display:'flex',alignItems:'flex-end',height:'140px',gap:'12px'}}>
                    {(() => {
                      const loyalty = businessAnalytics.loyalty_share || 0;
                      const non = 1 - loyalty;
                      const max = Math.max(loyalty, non) || 1;
                      return [
                        { label: 'Loyalty', value: loyalty, color: 'linear-gradient(135deg,#2563eb,#3b82f6)' },
                        { label: 'Other', value: non, color: 'linear-gradient(135deg,#9ca3af,#6b7280)' }
                      ].map(b => (
                        <div key={b.label} style={{flex:1,textAlign:'center'}}>
                          <div className="chart-bar" style={{height:`${(b.value/max)*100}%`,background:b.color}} title={`${b.label}: ${(b.value*100).toFixed(1)}%`}></div>
                          <div style={{marginTop:4,fontSize:12}}>{b.label}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {businessAnalytics && (
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Top Services</h3>
                  <div className="chart-summary">Top {businessAnalytics.top_services?.length || 0}</div>
                </div>
                <div className="chart-placeholder">
                  <div className="chart-mock" style={{display:'flex', alignItems:'flex-end', height:'140px', gap:'8px'}}>
                    {businessAnalytics.top_services?.map((s: TopService) => {
                      const max = Math.max(...businessAnalytics.top_services.map((x: TopService) => x.count), 1);
                      return (
                        <div key={s.service} style={{flex:1,textAlign:'center'}}>
                          <div className="chart-bar" style={{height:`${(s.count/max)*100}%`,background:'linear-gradient(135deg,#10b981,#059669)'}} title={`${s.service}: ${s.count}`}></div>
                          <div style={{marginTop:4,fontSize:12}}>{s.service}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Analytics */}
          <div className="detailed-analytics">
            <div className="analytics-section">
              <h3>💼 Business Insights</h3>
              <div className="insights-grid">
                <div className="insight-card">
                  <div className="insight-icon"><StaffIcon name="performance" /></div>
                  <div className="insight-content">
                    <h4>Peak Hours</h4>
                    <p>Highest activity between 10 AM - 2 PM</p>
                    <div className="insight-value">+35% volume</div>
                  </div>
                </div>
                <div className="insight-card">
                  <div className="insight-icon">🎯</div>
                  <div className="insight-content">
                    <h4>Service Efficiency</h4>
                    <p>Average wash completion time improved</p>
                    <div className="insight-value">-5 minutes</div>
                  </div>
                </div>
                <div className="insight-card">
                  <div className="insight-icon">💎</div>
                  <div className="insight-content">
                    <h4>Premium Services</h4>
                    <p>45% choose premium wash options</p>
                    <div className="insight-value">+25% revenue</div>
                  </div>
                </div>
                <div className="insight-card">
                  <div className="insight-icon"><StaffIcon name="inProgress" /></div>
                  <div className="insight-content">
                    <h4>Customer Retention</h4>
                    <p>Loyal customers return weekly</p>
                    <div className="insight-value">65% retention</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="analytics-section">
              <h3>🎯 Performance Goals</h3>
              <div className="goals-grid">
                <div className="goal-item">
                  <div className="goal-label">Daily Revenue Target</div>
                  <div className="goal-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(analyticsData.revenue.today / 2000) * 100}%`,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }}
                      />
                    </div>
                    <div className="goal-value">
                      {formatCurrency(analyticsData.revenue.today)} / {formatCurrency(2000)}
                    </div>
                  </div>
                </div>
                <div className="goal-item">
                  <div className="goal-label">Efficiency Target</div>
                  <div className="goal-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${analyticsData.performance.efficiency}%`,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        }}
                      />
                    </div>
                    <div className="goal-value">
                      {formatPercentage(analyticsData.performance.efficiency)} / 95%
                    </div>
                  </div>
                </div>
                <div className="goal-item">
                  <div className="goal-label">Customer Satisfaction</div>
                  <div className="goal-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(analyticsData.customers.satisfaction / 5) * 100}%`,
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        }}
                      />
                    </div>
                    <div className="goal-value">
                      {analyticsData.customers.satisfaction}/5 ⭐
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EnhancedAnalytics;
