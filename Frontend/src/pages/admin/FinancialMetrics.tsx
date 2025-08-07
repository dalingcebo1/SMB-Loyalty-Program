import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { SummaryMetrics } from '../../types/metrics';

const FinancialMetrics: React.FC = () => (
  <AdminMetricsPage<SummaryMetrics>
    title="Financial Metrics"
    fetcher={(start, end) =>
      api
        .get(
          `/analytics/financial/details?start_date=${start}&end_date=${end}`
        )
        .then(res => res.data)
    }
    render={data => (
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    )}
  />
);

export default FinancialMetrics;
