import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { toast } from 'react-toastify';
import TopCustomersPanel from '../components/TopCustomersPanel';
import LoyaltyOverviewPanel from '../components/LoyaltyOverviewPanel';
import { StaffIcon } from '../components/StaffIcon';
import './CustomerAnalytics.css';

const CustomerAnalytics: React.FC = () => {
  const [range, setRange] = useState(30);
  const dates = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (range-1));
    return {
      startDate: start.toISOString().slice(0,10),
      endDate: end.toISOString().slice(0,10)
    };
  }, [range]);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await api.post('/analytics/customers/refresh');
      qc.invalidateQueries({ queryKey: ['analytics','top-customers'] });
      qc.invalidateQueries({ queryKey: ['analytics','loyalty-overview'] });
      toast.success('Customer metrics refreshed');
    } catch (e: unknown) {
      // Type guard for axios-like error structure
      interface HasResponse { response?: { status?: number } }
      const status = (typeof e === 'object' && e && 'response' in e) ? (e as HasResponse).response?.status : undefined;
      if (status === 403) toast.warn('Refresh requires admin privileges');
      else toast.error('Failed to refresh metrics');
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="customer-analytics">
      {/* Page Header */}
      <div className="analytics-header">
        <div className="header-content">
          <h2>
            <StaffIcon name="analytics" />
            Customer & Loyalty Analytics
          </h2>
          <p>Deep dive into customer value, loyalty penetration & churn risk.</p>
        </div>
        <div className="header-actions">
          <div className="range-controls">
            <label>Range</label>
            <select
              value={range}
              onChange={e => setRange(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
          >
            {refreshing && <span className="animate-spin">⟳</span>}
            {refreshing ? 'Refreshing' : 'Refresh Snapshot'}
          </button>
          <div className="date-range">{dates.startDate} → {dates.endDate}</div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="analytics-grid">
        <div className="dashboard-section">
          <div className="section-header">
            <h3>
              <StaffIcon name="analytics" />
              Top Customers
            </h3>
            <p>Ranked by revenue (change range for window)</p>
          </div>
          <div className="section-content">
            <TopCustomersPanel startDate={dates.startDate} endDate={dates.endDate} />
          </div>
        </div>
        
        <div className="dashboard-section">
          <div className="section-header">
            <h3>
              <StaffIcon name="performance" />
              Loyalty Overview
            </h3>
            <p>Penetration, points & churn candidates</p>
          </div>
          <div className="section-content">
            <LoyaltyOverviewPanel startDate={dates.startDate} endDate={dates.endDate} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAnalytics;
