import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import Container from '../../components/ui/Container';
import { humanizeMetric } from '../../utils/metrics';

const LoyaltyMetrics: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/loyalty/details`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Container>Loading loyalty metrics...</Container>;
  if (!data) return <Container>No loyalty metrics to display.</Container>;

  return (
    <Container>
      <div className="flex items-center mb-4">
        <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Back</button>
      </div>
      <h2 className="text-2xl font-semibold mb-4">Loyalty Metrics</h2>
      <div className="overflow-x-auto p-6 bg-white rounded shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">Metric</th>
              <th className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">Value</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{humanizeMetric(key)}</td>
                <td className="px-6 py-4 text-gray-700 tabular-nums">{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  );
};

export default LoyaltyMetrics;
