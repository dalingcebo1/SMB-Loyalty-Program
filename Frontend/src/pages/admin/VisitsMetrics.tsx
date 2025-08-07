import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { VisitsMetricsData } from '../../types/metrics';

const VisitsMetrics: React.FC = () => (
  <AdminMetricsPage<VisitsMetricsData>
    title="Visit Metrics"
    fetcher={(start, end) =>
      api
        .get(`/analytics/visits/details?start_date=${start}&end_date=${end}`)
        .then(res => res.data)
    }
    render={data => (
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    )}
  />
);

export default VisitsMetrics;
