import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/api';

const TransactionsMetrics: React.FC = () => {
  const [searchParams] = useSearchParams();
  const start = searchParams.get('start_date');
  const end = searchParams.get('end_date');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!start || !end) return;
    setLoading(true);
    api.get(`/analytics/transactions/details?start_date=${start}&end_date=${end}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [start, end]);

  if (loading) return <p>Loading transaction metrics...</p>;
  if (!data) return <p>No transaction metrics to display.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Transaction Metrics</h2>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default TransactionsMetrics;
