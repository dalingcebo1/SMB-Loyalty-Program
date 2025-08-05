import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/api';

const LoyaltyMetrics: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/loyalty/details`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading loyalty metrics...</p>;
  if (!data) return <p>No loyalty metrics to display.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Loyalty Metrics</h2>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default LoyaltyMetrics;
