import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { PointsMetricsData } from '../../types/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';

const PointsMetrics: React.FC = () => (
  <AdminMetricsPage<PointsMetricsData>
    title="Points Metrics"
    fetcher={(start, end) =>
      api
        .get(`/analytics/points/details?start_date=${start}&end_date=${end}`)
        .then(res => res.data)
    }
    render={data => {
      const flat: Record<string, any> = { ...data };
      delete flat.points_issued_over_time;
      delete flat.points_redeemed_over_time;
      return (
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
                {Object.entries(flat).map(([key, value]) => (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{key}</td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TimeSeriesChart
            title="Points Issued vs Redeemed"
            series={[
              { name: 'Issued', data: data.points_issued_over_time, type: 'line', color: '#2563eb', dataKey: 'value' },
              { name: 'Redeemed', data: data.points_redeemed_over_time, type: 'line', color: '#dc2626', dataKey: 'value' },
            ]}
            yLabel="Points"
          />
        </div>
      );
    }}
  />
);

export default PointsMetrics;
