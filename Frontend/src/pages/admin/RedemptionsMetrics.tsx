import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { RedemptionsMetricsData } from '../../types/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';

const RedemptionsMetrics: React.FC = () => (
  <AdminMetricsPage<RedemptionsMetricsData>
    title="Redemptions Metrics"
    fetcher={(start, end) =>
      api
        .get(`/analytics/redemptions/details?start_date=${start}&end_date=${end}`)
        .then(res => res.data)
    }
    render={data => (
      <div className="space-y-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wider">Metric</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(data).map(([key, value]) => (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{key}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TimeSeriesChart
          title="Redemption Rate (Derived)"
          series={[{ name: 'Rate', data: [{ date: 'Current', value: data.reward_conversion_rate }], type: 'area', color: '#f59e0b' }]}
          yLabel="Rate"
        />
      </div>
    )}
  />
);

export default RedemptionsMetrics;
