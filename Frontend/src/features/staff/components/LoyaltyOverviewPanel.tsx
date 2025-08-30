import React from 'react';
import { useLoyaltyOverview } from '../hooks/useLoyaltyOverview';
import { StaffIcon } from './StaffIcon';
import './LoyaltyOverviewPanel.css';

interface Props { startDate?: string; endDate?: string; }

export const LoyaltyOverviewPanel: React.FC<Props> = ({ startDate, endDate }) => {
  const { data, isLoading, error } = useLoyaltyOverview({ startDate, endDate });
  
  if (isLoading) return (
    <div className="panel loading">
      <StaffIcon name="loading" /> 
      Loading loyalty overview...
    </div>
  );
  
  if (error) return (
    <div className="panel error">
      Error: {error.message}
    </div>
  );
  
  if (!data) return null;
  
  const { overview, churn_candidates } = data;
  
  return (
    <div className="panel">
      <div className="stats-grid">
        <div className="stat">
          <span>Penetration</span>
          <strong>{(overview.loyalty_penetration*100).toFixed(1)}%</strong>
        </div>
        <div className="stat">
          <span>Avg Points / Wash</span>
          <strong>{overview.avg_points_redeemed_per_wash.toFixed(1)}</strong>
        </div>
        <div className="stat">
          <span>Pts Redeemed</span>
          <strong>{overview.total_points_redeemed.toLocaleString()}</strong>
        </div>
        <div className="stat">
          <span>Pts Outstanding</span>
          <strong>{overview.outstanding_points.toLocaleString()}</strong>
        </div>
      </div>
      
      <div className="churn-section">
        <h4>At-Risk Customers (Churn Candidates)</h4>
        <table className="data-table small">
          <thead>
            <tr>
              <th>User</th>
              <th>Days Since</th>
              <th>Value %tile</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {churn_candidates.slice(0,5).map(c => {
              const rel = c.days_since_last <= 60 ? `${c.days_since_last}d` : `${c.days_since_last}d`; // simple display
              return (
                <tr key={c.user_id} className={c.churn_risk_flag ? 'risk' : ''}>
                  <td>{c.name}</td>
                  <td>{rel}</td>
                  <td>{(c.percentile*100).toFixed(0)}%</td>
                  <td>{c.churn_risk_flag ? '⚠️' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoyaltyOverviewPanel;
