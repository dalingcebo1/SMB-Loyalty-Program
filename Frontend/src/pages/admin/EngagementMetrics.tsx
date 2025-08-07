import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

const EngagementMetrics: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/engagement/details`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // explicit full label mapping for metrics
  const labelMap: Record<string, string> = {
    dau: 'Daily Active Users',
    wau: 'Weekly Active Users',
    mau: 'Monthly Active Users',
    retention_rate: 'Retention Rate',
    churn_rate: 'Churn Rate',
  };

  // helper to format camelCase or snake_case keys into Title Case labels
  const formatKey = (key: string) => {
    // case-insensitive lookup
    const lowerKey = key.toLowerCase();
    if (labelMap[lowerKey]) return labelMap[lowerKey];
    // fallback to auto formatting
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase());
  };

  // simple spinner component
  const Spinner: React.FC = () => (
    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );

  return (
    <div className="p-4">
      {/* Panel container */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center mb-4 space-x-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
        <h2 className="text-2xl font-semibold mb-4">Engagement Metrics</h2>
        <div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : !data ? (
            <p className="text-center text-gray-500 py-8">No engagement metrics available.</p>
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
    </div>
  );
};

export default EngagementMetrics;
