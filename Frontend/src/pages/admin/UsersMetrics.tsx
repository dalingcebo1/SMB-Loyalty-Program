import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';

const UsersMetrics: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // default dates: last 7 days
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const startParam = searchParams.get('start_date');
  const endParam = searchParams.get('end_date');
  const [startDate, setStartDate] = useState<string>(startParam || weekAgoStr);
  const [endDate, setEndDate] = useState<string>(endParam || todayStr);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  // full label mapping for user metrics
  const labelMap: Record<string, string> = {
    dau: 'Daily Active Users',
    wau: 'Weekly Active Users',
    mau: 'Monthly Active Users',
    retention_rate: 'Retention Rate',
    churn_rate: 'Churn Rate',
  };

  // helper to format keys with fallback
  const formatKey = (key: string) => {
    const lower = key.toLowerCase();
    if (labelMap[lower]) return labelMap[lower];
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase());
  };

  // spinner component
  const Spinner: React.FC = () => (
    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );

  // ensure URL contains date params for initial fetch
  useEffect(() => {
    if (!startParam || !endParam) {
      setSearchParams({ start_date: startDate, end_date: endDate });
    }
  }, []);

  // fetch data when dates change
  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    api.get(`/analytics/users/details?start_date=${startDate}&end_date=${endDate}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const handleRefresh = () => {
    setSearchParams({ start_date: startDate, end_date: endDate });
  };

  return (
    <div className="p-4">
      {/* date filter and back */}
      <div className="flex items-center mb-4 space-x-2">
        <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1 rounded" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1 rounded" />
        <button onClick={handleRefresh} className="px-3 py-1 bg-blue-600 text-white rounded">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <h2 className="text-2xl font-semibold mb-4">User Metrics</h2>
      <div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !data ? (
          <p className="text-center text-gray-500 py-8">No user metrics available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(data).map(([key, value]) => (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{formatKey(key)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersMetrics;
