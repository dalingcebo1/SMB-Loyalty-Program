import React from 'react';
import { useTopCustomers } from '../hooks/useTopCustomers';
import { StaffIcon } from './StaffIcon';
import { formatCurrency, formatRelativeTime, formatDateTime } from '../../../utils/format';

interface Props { startDate?: string; endDate?: string; }

export const TopCustomersPanel: React.FC<Props> = ({ startDate, endDate }) => {
  const { data, isLoading, error } = useTopCustomers({ startDate, endDate, sort: 'revenue', limit: 10, offset: 0 });
  
  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
      <StaffIcon name="loading" />
      Loading top customers...
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center gap-2 py-8 text-red-500 text-sm">
      <span>⚠️</span>
      Error: {error.message}
    </div>
  );
  
  if (!data || data.items.length === 0) return (
    <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
      No customer data available for this period.
    </div>
  );

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-50/50 border-b-2 border-indigo-100">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wide">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wide">Washes</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wide">Loyalty %</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wide">Revenue</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wide">Avg spend</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wide">Last visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map(c => {
              const revenue = formatCurrency(c.revenue_cents / 100);
              const avg = formatCurrency(c.avg_spend_cents / 100);
              const rel = c.last_visit ? formatRelativeTime(c.last_visit) : '—';
              const exact = c.last_visit ? formatDateTime(c.last_visit) : undefined;
              return (
                <tr key={c.user_id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-medium text-gray-900">{c.name}</td>
                  <td className="py-3 px-4 text-gray-700">{c.total_washes.toLocaleString()}</td>
                  <td className="py-3 px-4 font-medium text-indigo-600">{(c.loyalty_share*100).toFixed(0)}%</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600">{revenue}</td>
                  <td className="py-3 px-4 text-gray-700">{avg}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs" title={exact}>{rel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopCustomersPanel;
