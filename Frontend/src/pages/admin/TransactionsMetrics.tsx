import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../../hooks/useDateRange';
import api from '../../api/api';
import Alert from '../../components/Alert';
import Container from '../../components/ui/Container';
import { formatCurrency, humanizeHour, humanizeDay } from '../../utils/metrics';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { SummaryMetrics, TransactionMetrics } from '../../types/metrics';

const TransactionsMetrics: React.FC = () => {
  const { start, end } = useDateRange();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<TransactionMetrics, Error>({
    queryKey: ['analytics', 'transactions', 'details', start, end],
    queryFn: () =>
      api
        .get<TransactionMetrics>(
          `/analytics/transactions/details?start_date=${start}&end_date=${end}`
        )
        .then(res => res.data)
  });
  // Prefetch summary for sparkline under average value
  const { data: summary } = useQuery<SummaryMetrics, Error>({
    queryKey: ['analyticsSummary', start, end],
    queryFn: () =>
      api
        .get<SummaryMetrics>(`/analytics/summary?start_date=${start}&end_date=${end}`)
        .then(res => res.data),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <Container>Loading transaction metrics…</Container>;
  if (isError)
    return (
      <Container>
        <Alert
          type="error"
          message={`Error loading transactions details: ${(error as any).message}`}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </Container>
    );

  const {
    average_value,
    per_user,
    conversion_rate,
    peak_hours = [],
    peak_days = []
  } = data || {} as TransactionMetrics;

  return (
    <Container>
      <h2 className="text-2xl font-semibold mb-6">Transaction Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Average Transaction Value */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Average Transaction Value</h3>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(average_value)}</p>
          {summary?.transaction_volume && (
            <div className="mt-4">
              <TimeSeriesChart
                series={[
                  {
                    name: 'Volume',
                    // convert cents to rands
                    data: summary.transaction_volume.map(v => ({ date: v.date, value: v.value / 100 })),
                    type: 'area'
                  }
                ]}
                height={80}
                yLabel=""
                tooltipFormatter={formatCurrency}
              />
            </div>
          )}
        </div>
        {/* Transactions per User */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Transactions per User</h3>
          <p className="mt-2 text-3xl font-bold">{per_user}</p>
        </div>
        {/* Conversion Rate */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Conversion Rate</h3>
          <p className="mt-2 text-3xl font-bold">{(conversion_rate * 100).toFixed(1)}%</p>
        </div>
        {/* Peak Hours */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Peak Hours</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            {peak_hours.map(({ hour, count }: any) => (
              <li key={hour}>{humanizeHour(hour)} – {count}</li>
            ))}
          </ul>
        </div>
        {/* Peak Days */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Peak Days</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            {peak_days.map(({ day, count }: any) => (
              <li key={day}>{humanizeDay(day)} – {count}</li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
};

export default TransactionsMetrics;
