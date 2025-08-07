import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { Spinner } from '../../components';
import { ENGAGEMENT_LABELS, humanizeMetric } from '../../utils';

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
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {humanizeMetric(key, ENGAGEMENT_LABELS)}
                    </td>
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
