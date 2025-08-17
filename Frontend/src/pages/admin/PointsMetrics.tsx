import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { PointsMetricsData } from '../../types/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { SUMMARY_LABELS } from '../../utils/metrics';
import MetricTable from '../../components/ui/MetricTable';

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
          <div className="overflow-x-auto p-6">
            <MetricTable
              data={flat}
              labels={SUMMARY_LABELS}
            />
          </div>
          <div className="p-6">
            <TimeSeriesChart
              title="Points Issued vs Redeemed"
              series={[
                { name: 'Issued', data: data.points_issued_over_time, type: 'line', color: '#2563eb', dataKey: 'value' },
                { name: 'Redeemed', data: data.points_redeemed_over_time, type: 'line', color: '#dc2626', dataKey: 'value' },
              ]}
              yLabel="Points"
            />
          </div>
        </div>
      );
    }}
  />
);

export default PointsMetrics;
