import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { VisitsMetricsData } from '../../types/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';

const VisitsMetrics: React.FC = () => (
  <AdminMetricsPage<VisitsMetricsData>
    title="Visit Metrics"
    fetcher={(start, end) =>
      api
        .get(`/analytics/visits/details?start_date=${start}&end_date=${end}`)
        .then(res => res.data)
    }
    render={data => {
      const flat: Record<string, any> = { ...data };
      delete flat.peak_visit_hours;
      delete flat.peak_visit_days;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TimeSeriesChart
              title="Peak Visit Hours"
              series={[{ name: 'Visits', data: (data.peak_visit_hours ?? []).map(h => ({ date: String(h.hour), value: h.count })), type: 'area', color: '#6366f1', dataKey: 'value' }]}
              yLabel="Count"
            />
            <TimeSeriesChart
              title="Peak Visit Days"
              series={[{ name: 'Visits', data: (data.peak_visit_days ?? []).map(d => ({ date: String(d.day), value: d.count })), type: 'area', color: '#10b981', dataKey: 'value' }]}
              yLabel="Count"
            />
          </div>
        </div>
      );
    }}
  />
);

export default VisitsMetrics;
