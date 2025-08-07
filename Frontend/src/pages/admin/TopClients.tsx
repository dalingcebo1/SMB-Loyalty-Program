import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';

const TopClientsMetrics: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const limit = searchParams.get('limit') || '5';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/top-clients?limit=${limit}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) return <p>Loading top clients metrics...</p>;
  if (!data) return <p>No top clients metrics to display.</p>;

  return (
    <div className="p-4">
      <div className="mb-4">
        <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded">Back</button>
      </div>
      <h2 className="text-xl font-semibold mb-2">Top Clients</h2>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default TopClientsMetrics;
