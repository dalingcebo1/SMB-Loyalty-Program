import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { FinancialMetricsData } from '../../types/metrics';
import MetricTable from '../../components/ui/MetricTable';
import { SUMMARY_LABELS } from '../../utils/metrics';

const FinancialMetrics: React.FC = () => (
  <AdminMetricsPage<FinancialMetricsData>
    title="Financial Metrics"
    fetcher={(start, end) =>
      api
        .get(`/analytics/financial/details?start_date=${start}&end_date=${end}`)
        .then(res => res.data)
    }
    render={data => (
      // Generic metric table
      <MetricTable data={data} labels={SUMMARY_LABELS} />
    )}
  />
);

export default FinancialMetrics;
