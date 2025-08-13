import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { FinancialMetricsData } from '../../types/metrics';

const FinancialMetrics: React.FC = () => (
  <AdminMetricsPage<FinancialMetricsData>
    title="Financial Metrics"
    fetcher={(start, end) =>
      api
        .get(`/analytics/financial/details?start_date=${start}&end_date=${end}`)
        .then(res => res.data)
    }
    render={data => (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{key}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  />
);

export default FinancialMetrics;
