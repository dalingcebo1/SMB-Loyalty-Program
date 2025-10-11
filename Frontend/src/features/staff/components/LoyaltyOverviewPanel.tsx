import React from 'react';
import { useLoyaltyOverview } from '../hooks/useLoyaltyOverview';
import { StaffIcon } from './StaffIcon';

interface Props { startDate?: string; endDate?: string; }

export const LoyaltyOverviewPanel: React.FC<Props> = ({ startDate, endDate }) => {
  const { data, isLoading, error } = useLoyaltyOverview({ startDate, endDate });
  
  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
      <StaffIcon name="loading" />
      Loading loyalty overview...
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center gap-2 py-8 text-red-500 text-sm">
      <span>⚠️</span>
      Error: {error.message}
    </div>
  );
  
  if (!data) return null;
  
  const { overview, churn_candidates } = data;
  
  return (
    <div className="w-full space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <span className="block text-xs font-medium text-gray-600 tracking-wide mb-2">Penetration</span>
          <strong className="block text-xl font-bold text-gray-900">{(overview.loyalty_penetration*100).toFixed(1)}%</strong>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <span className="block text-xs font-medium text-gray-600 tracking-wide mb-2">Avg points / wash</span>
          <strong className="block text-xl font-bold text-gray-900">{overview.avg_points_redeemed_per_wash.toFixed(1)}</strong>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <span className="block text-xs font-medium text-gray-600 tracking-wide mb-2">Pts redeemed</span>
          <strong className="block text-xl font-bold text-gray-900">{overview.total_points_redeemed.toLocaleString()}</strong>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <span className="block text-xs font-medium text-gray-600 tracking-wide mb-2">Pts outstanding</span>
          <strong className="block text-xl font-bold text-gray-900">{overview.outstanding_points.toLocaleString()}</strong>
        </div>
      </div>
      
      {/* Churn Candidates */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 tracking-wide mb-4">
          At-risk customers (churn candidates)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-red-50/50 border-b-2 border-red-100">
                <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs tracking-wide">User</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs tracking-wide">Days since</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs tracking-wide">Value percentile</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 text-xs tracking-wide">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {churn_candidates.slice(0,5).map(c => {
                const rel = c.days_since_last <= 60 ? `${c.days_since_last}d` : `${c.days_since_last}d`;
                const isHighRisk = c.churn_risk_flag;
                return (
                  <tr 
                    key={c.user_id} 
                    className={`hover:bg-gray-50 transition-colors duration-150 ${isHighRisk ? 'bg-red-50/30' : ''}`}
                  >
                    <td className={`py-2 px-3 ${isHighRisk ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                      {c.name}
                    </td>
                    <td className={`py-2 px-3 ${isHighRisk ? 'text-red-600' : 'text-gray-700'}`}>
                      {rel}
                    </td>
                    <td className={`py-2 px-3 ${isHighRisk ? 'text-red-600' : 'text-gray-700'}`}>
                      {(c.percentile*100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-3">
                      {c.churn_risk_flag ? <span className="text-red-500">⚠️</span> : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyOverviewPanel;
