import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { VisitsMetricsData } from '../../types/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { SUMMARY_LABELS } from '../../utils/metrics';
import MetricTable from '../../components/ui/MetricTable';

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
          <MetricTable data={flat} labels={SUMMARY_LABELS} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
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
