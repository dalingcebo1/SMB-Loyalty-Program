import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { buildQuery } from '../../api/api';
import { useDateRange } from '../../hooks/useDateRange';
import { AdminMetricsPage } from '../../components/AdminMetricsPage';
import { UserMetrics, TopClientsData } from '../../types/metrics';
import DataTable, { Column } from '../../components/ui/DataTable';
import { ENGAGEMENT_LABELS, humanizeMetric, formatCurrency } from '../../utils/metrics';

const UsersMetrics: React.FC = () => {
  // Columns for DataTable
  const columns: Column<{ metric: string; value: number }>[] = [
    { header: 'Metric', accessor: row => row.metric },
    { header: 'Value', accessor: row => String(row.value) },
  ];
  const { start, end } = useDateRange();
  // Fetch top clients data for current date range
  const { data: topClients, isLoading: topLoading } = useQuery<TopClientsData, Error>({
    queryKey: ['analytics', 'top-clients', start, end],
    queryFn: () =>
      api
        .get<TopClientsData>(
          `/analytics/top-clients${buildQuery({ limit: '5', start_date: start, end_date: end })}`
        )
        .then(res => res.data),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <AdminMetricsPage<UserMetrics>
      title="User Metrics"
      fetcher={(start, end) =>
        api.get<UserMetrics>(
          `/analytics/users/details${buildQuery({ start_date: start, end_date: end })}`
        ).then(res => res.data)
      }
      render={data => {
        const rows = Object.entries(data).map(([key, value]) => ({
          metric: humanizeMetric(key, ENGAGEMENT_LABELS),
          value,
        }));
        // Merge top clients spend and visit counts
        const clientRows = topClients?.by_transaction_value.map(c => ({
          name: c.name,
          spend: c.value,
          visits: topClients.by_visits.find(v => v.user_id === c.user_id)?.visits || 0,
        })) || [];
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Metrics Table Card */}
            <div className="bg-white rounded shadow-sm p-4 overflow-x-auto">
              <h3 className="text-lg font-medium mb-3">Metrics</h3>
              <DataTable columns={columns} data={rows} />
            </div>
            {/* Top Clients Card */}
            <div className="bg-white rounded shadow-sm p-4 overflow-x-auto">
              <h3 className="text-lg font-medium mb-3">Top Clients</h3>
              {topLoading ? (
                <p>Loading clients…</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left font-medium text-gray-600 uppercase">Client</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 uppercase">Spend</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 uppercase">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientRows.map(({ name, spend, visits }, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{name}</td>
                        <td className="px-4 py-2 tabular-nums">{formatCurrency(spend)}</td>
                        <td className="px-4 py-2 tabular-nums">{visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      }}
    />
  );
};

export default UsersMetrics;
