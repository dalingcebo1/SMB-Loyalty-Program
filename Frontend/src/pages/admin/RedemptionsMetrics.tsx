import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { RedemptionsMetricsData } from '../../types/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { SUMMARY_LABELS } from '../../utils/metrics';
import MetricTable from '../../components/ui/MetricTable';

const RedemptionsMetrics: React.FC = () => (
  <AdminMetricsPage<RedemptionsMetricsData>
    title="Redemptions Metrics"
    queryKeyBase={['analytics','redemptions','details']}
    fetcher={(start, end) => api.get(`/analytics/redemptions/details?start_date=${start}&end_date=${end}`).then(res => res.data)}
    render={data => (
      <div className="space-y-8">
        <MetricTable data={data} labels={SUMMARY_LABELS} />
        <div className="p-6">
          <TimeSeriesChart
            title="Redemption Rate (Derived)"
            series={[{ name: 'Rate', data: [{ date: 'Current', value: data.reward_conversion_rate }], type: 'area', color: '#f59e0b' }]}
            yLabel="Rate"
          />
        </div>
      </div>
    )}
  />
);

export default RedemptionsMetrics;
