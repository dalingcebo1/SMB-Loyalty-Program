import React from 'react';
import api from '../../api/api';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { UserMetrics } from '../../types/metrics';
import DataTable, { Column } from '../../components/ui/DataTable';
import { ENGAGEMENT_LABELS, humanizeMetric } from '../../utils/metrics';

const UsersMetrics: React.FC = () => {
  // Columns for DataTable
  const columns: Column<{ metric: string; value: number }>[] = [
    { header: 'Metric', accessor: row => row.metric },
    { header: 'Value', accessor: row => String(row.value) },
  ];
  return (
    <AdminMetricsPage<UserMetrics>
      title="User Metrics"
      fetcher={(start, end) =>
        api.get<UserMetrics>(
          `/analytics/users/details?start_date=${start}&end_date=${end}`
        ).then(res => res.data)
      }
      render={data => {
        const rows = Object.entries(data).map(([key, value]) => ({
          metric: humanizeMetric(key, ENGAGEMENT_LABELS),
          value,
        }));
        return <DataTable columns={columns} data={rows} />;
      }}
    />
  );
};

export default UsersMetrics;
