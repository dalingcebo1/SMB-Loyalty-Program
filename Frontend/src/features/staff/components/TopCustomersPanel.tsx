import React from 'react';
import { useTopCustomers } from '../hooks/useTopCustomers';
import { StaffIcon } from './StaffIcon';
import { formatCurrency, formatRelativeTime, formatDateTime } from '../../../utils/format';
import './TopCustomersPanel.css';

interface Props { startDate?: string; endDate?: string; }

export const TopCustomersPanel: React.FC<Props> = ({ startDate, endDate }) => {
  const { data, isLoading, error } = useTopCustomers({ startDate, endDate, sort: 'revenue', limit: 10, offset: 0 });
  
  if (isLoading) return (
    <div className="panel loading">
      <StaffIcon name="loading" /> 
      Loading top customers...
    </div>
  );
  
  if (error) return (
    <div className="panel error">
      Error: {error.message}
    </div>
  );
  
  if (!data || data.items.length === 0) return (
    <div className="panel empty">
      No customer data available for this period.
    </div>
  );

  return (
    <div className="panel">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Washes</th>
            <th>Loyalty %</th>
            <th>Revenue</th>
            <th>Avg Spend</th>
            <th>Last Visit</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map(c => {
            const revenue = formatCurrency(c.revenue_cents / 100);
            const avg = formatCurrency(c.avg_spend_cents / 100);
            const rel = c.last_visit ? formatRelativeTime(c.last_visit) : '—';
            const exact = c.last_visit ? formatDateTime(c.last_visit) : undefined;
            return (
              <tr key={c.user_id}>
                <td>{c.name}</td>
                <td>{c.total_washes.toLocaleString()}</td>
                <td>{(c.loyalty_share*100).toFixed(0)}%</td>
                <td>{revenue}</td>
                <td>{avg}</td>
                <td title={exact}>{rel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TopCustomersPanel;
