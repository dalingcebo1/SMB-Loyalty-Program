import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../../hooks/useDateRange';
import api from '../../api/api';
import Alert from '../../components/Alert';
import Container from '../../components/ui/Container';
import { formatCurrency, humanizeHour, humanizeDay } from '../../utils/metrics';
import { TransactionMetrics } from '../../types/metrics';

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

  // Destructure metrics from fetched data
  const {
    average_value,
    per_user,
    conversion_rate,
    peak_hours = [],
    peak_days = []
  } = data || {} as TransactionMetrics;

  return (
    <Container>
      <h2 className="text-2xl font-semibold mb-4">Transaction Metrics</h2>
      <table className="w-full table-auto border-collapse">
        <tbody>
          <tr>
            <td className="py-2 font-medium">Average Transaction Value</td>
            <td className="py-2">{formatCurrency(average_value)}</td>
          </tr>
          <tr>
            <td className="py-2 font-medium">Transactions per User</td>
            <td className="py-2">{per_user}</td>
          </tr>
          <tr>
            <td className="py-2 font-medium">Conversion Rate</td>
            <td className="py-2">{(conversion_rate * 100).toFixed(1)}% </td>
          </tr>
          <tr>
            <td className="py-2 font-medium align-top">Peak Hours</td>
            <td className="py-2">
              <ul className="list-disc pl-5">
                {peak_hours.map(({ hour, count }: any) => (
                  <li key={hour}>
                    {humanizeHour(hour)} – {count} transaction{count !== 1 ? 's' : ''}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
          <tr>
            <td className="py-2 font-medium align-top">Peak Days</td>
            <td className="py-2">
              <ul className="list-disc pl-5">
                {peak_days.map(({ day, count }: any) => (
                  <li key={day}>
                    {humanizeDay(day)} – {count} transaction{count !== 1 ? 's' : ''}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </Container>
  );
};

export default TransactionsMetrics;
