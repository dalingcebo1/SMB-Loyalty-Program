import React from 'react';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import api, { buildQuery } from '../../api/api';
import DataTable, { Column } from '../../components/ui/DataTable';
import { TopClientByValue, TopClientsData } from '../../types/metrics';

const TopClientsMetrics: React.FC = () => {
  // Define table columns for top clients by spend and visits
  const columns: Column<{ name: string; spend: number; visits: number }>[] = [
    { header: 'Client', accessor: row => row.name },
    { header: 'Spend', accessor: row => String(row.spend) },
    { header: 'Visits', accessor: row => String(row.visits) },
  ];
  return (
    <AdminMetricsPage<TopClientsData>
      title="Top Clients"
      queryKeyBase={['analytics','top-clients']}
      fetcher={(start, end) =>
        api
          .get<TopClientsData>(
            `/analytics/top-clients${buildQuery({ limit: '5', start_date: start, end_date: end })}`
          )
          .then(res => res.data)
      }
      render={data => {
        // Merge top clients value and visits into rows
        const rows = data.by_transaction_value.map((c: TopClientByValue) => ({
          name: c.name,
          spend: c.value,
          visits: data.by_visits.find(v => v.user_id === c.user_id)?.visits || 0,
        }));
        return <DataTable columns={columns} data={rows} />;
      }}
    />
  );
};

export default TopClientsMetrics;
