import React, { useEffect, useState } from 'react';
import api from '../../api/api';

const EngagementMetrics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/engagement/details`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading engagement metrics...</p>;
  if (!data) return <p>No engagement metrics to display.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Engagement Metrics</h2>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default EngagementMetrics;
