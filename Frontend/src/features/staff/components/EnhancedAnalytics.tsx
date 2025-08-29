// src/features/staff/components/EnhancedAnalytics.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWashHistory } from '../hooks';
import './EnhancedAnalytics.css';

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
  const [selectedPeriod, setSelectedPeriod] = useState('week');
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

  const { data: washHistoryData } = useWashHistory({
    startDate: periodDates.startDate,
    endDate: periodDates.endDate
  });

  const calculateAnalytics = useCallback(() => {
    if (!washHistoryData) return;

    setIsLoading(true);

    // Mock analytics calculation - in real implementation, this would come from backend
    const completedWashes = washHistoryData.filter(w => w.status === 'ended');
    const activeWashes = washHistoryData.filter(w => w.status === 'started');
    
    // Calculate revenue (mock prices)
    const avgServicePrice = 150;
    const todayRevenue = completedWashes.length * avgServicePrice * 0.3; // Mock today portion
    const weekRevenue = completedWashes.length * avgServicePrice;
    const monthRevenue = weekRevenue * 4.2; // Mock month projection

    // Calculate wash metrics
    const totalWashes = washHistoryData.length;
    const avgDuration = completedWashes.length > 0 
      ? completedWashes.reduce((sum, wash) => {
          if (wash.ended_at && wash.started_at) {
            const duration = new Date(wash.ended_at).getTime() - new Date(wash.started_at).getTime();
            return sum + (duration / 60000); // Convert to minutes
          }
          return sum;
        }, 0) / completedWashes.length
      : 0;

    // Mock customer data - assuming each wash has a user
    const uniqueUsers = new Set(washHistoryData.map(w => w.order_id)).size; // Use order_id as proxy for unique users
    
    // Mock performance data
    const efficiency = Math.min(95, (completedWashes.length / totalWashes) * 100);
    const utilization = Math.min(85, totalWashes * 2.5); // Mock utilization
    
    setAnalyticsData({
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        growth: 12.5 // Mock growth percentage
      },
      washes: {
        completed: completedWashes.length,
        active: activeWashes.length,
        total: totalWashes,
        avgDuration: Math.round(avgDuration)
      },
      customers: {
        total: uniqueUsers,
        returning: Math.round(uniqueUsers * 0.65), // Mock returning customers
        new: Math.round(uniqueUsers * 0.35), // Mock new customers
        satisfaction: 4.7 // Mock satisfaction score
      },
      performance: {
        efficiency,
        utilization,
        errorRate: Math.max(0.5, 5 - efficiency/10), // Mock error rate
        avgWaitTime: Math.round(15 - (efficiency/10)) // Mock wait time
      }
    });

    setIsLoading(false);
  }, [washHistoryData]);

  const generateChartData = useCallback(() => {
    if (!washHistoryData) return;

    const period = filterPeriods.find(p => p.value === selectedPeriod);
    const days = period?.days || 7;
    
    // Generate labels for the chart
    const labels = [];
    const revenueData = [];
    const washVolumeData = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = selectedPeriod === 'today' 
        ? date.getHours() + ':00'
        : date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
      
      labels.push(dayLabel);
      
      // Mock data generation based on wash history
      const dayWashes = washHistoryData.filter(w => 
        w.started_at && w.started_at.startsWith(dateStr)
      );
      
      const avgServicePrice = 150;
      const dayRevenue = dayWashes.length * avgServicePrice;
      const washCount = dayWashes.length;
      
      revenueData.push(dayRevenue);
      washVolumeData.push(washCount);
    }

    setRevenueChartData({
      labels,
      datasets: [{
        label: 'Revenue',
        data: revenueData,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true
      }]
    });

    setWashVolumeData({
      labels,
      datasets: [{
        label: 'Wash Volume',
        data: washVolumeData,
        borderColor: '#764ba2',
        backgroundColor: 'rgba(118, 75, 162, 0.1)',
        fill: true
      }]
    });
  }, [washHistoryData, selectedPeriod]);

  useEffect(() => {
    if (washHistoryData) {
      calculateAnalytics();
      generateChartData();
    }
  }, [washHistoryData, selectedPeriod, calculateAnalytics, generateChartData]);

  const formatCurrency = (amount: number) => `R${amount.toFixed(2)}`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

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

      {isLoading ? (
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
                <h3>🚗 Washes</h3>
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
                <h3>📊 Performance</h3>
                <div className="metric-trend positive">
                  ✅ {formatPercentage(analyticsData.performance.efficiency)}
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
          </div>

          {/* Detailed Analytics */}
          <div className="detailed-analytics">
            <div className="analytics-section">
              <h3>💼 Business Insights</h3>
              <div className="insights-grid">
                <div className="insight-card">
                  <div className="insight-icon">📈</div>
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
                  <div className="insight-icon">🔄</div>
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
