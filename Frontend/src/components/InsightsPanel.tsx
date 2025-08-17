import React from 'react';
import { useDateRange } from '../hooks/useDateRange';
import api, { buildQuery } from '../api/api';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

const InsightsPanel: React.FC = () => {
  const { start, end } = useDateRange();
  const [searchParams] = useSearchParams();
  const tier = searchParams.get('tier') || '';
  const campaign = searchParams.get('campaign') || '';
  const device = searchParams.get('device') || '';
  // Fetch AI-generated insights via backend
  const { data: insights, isLoading, isError, error } = useQuery<string[], Error>({
    queryKey: ['analyticsInsights', start, end, tier, campaign, device],
    queryFn: () => {
      const params: Record<string, string> = { start_date: start, end_date: end };
      if (tier) params.tier = tier;
      if (campaign) params.campaign = campaign;
      if (device) params.device = device;
      return api
        .get<string[]>(`/analytics/insights${buildQuery(params)}`)
        .then(r => r.data);
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="bg-white rounded shadow-sm p-4 mb-6">
      <h3 className="text-lg font-semibold mb-2">Insights</h3>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading insights...</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load insights: {error.message}</p>
      ) : insights && insights.length > 0 ? (
        <ul className="list-disc list-inside text-sm text-gray-700">
          {insights.map((text, idx) => (
            <li key={idx}>{text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No significant changes.</p>
      )}
    </div>
  );
};

export default InsightsPanel;
