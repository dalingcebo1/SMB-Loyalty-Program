import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';

const RedemptionsMetrics: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const startParam = searchParams.get('start_date');
  const endParam = searchParams.get('end_date');
  const [startDate, setStartDate] = useState<string>(startParam || weekAgoStr);
  const [endDate, setEndDate] = useState<string>(endParam || todayStr);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ensure URL has date params
  useEffect(() => {
    if (!startParam || !endParam) {
      setSearchParams({ start_date: startDate, end_date: endDate });
    }
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    api.get(`/analytics/redemptions/details?start_date=${startDate}&end_date=${endDate}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const handleRefresh = () => setSearchParams({ start_date: startDate, end_date: endDate });

  if (loading) return <p>Loading redemptions metrics...</p>;
  if (!data) return <p>No redemptions metrics to display.</p>;

  return (
    <div className="p-4">
      <div className="flex items-center mb-4 space-x-2">
        <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded">Back</button>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1 rounded" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1 rounded" />
        <button onClick={handleRefresh} className="px-3 py-1 bg-blue-600 text-white rounded">Refresh</button>
      </div>
      <h2 className="text-xl font-semibold mb-2">Redemptions Metrics</h2>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default RedemptionsMetrics;
