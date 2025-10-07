import React from 'react';
import { useDateRange } from '../hooks/useDateRange';
import api, { buildQuery } from '../api/api';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

type InsightMeta = {
  icon: string;
  iconClass: string;
  textClass: string;
  badge?: string;
  badgeClass?: string;
};

const resolveInsightMeta = (text: string): InsightMeta => {
  const lower = text.toLowerCase();

  if (lower.includes('increased') || lower.includes('growth') || lower.includes('grew')) {
    return {
      icon: '▲',
      iconClass: 'text-emerald-600',
      textClass: 'text-emerald-700',
    };
  }

  if (lower.includes('declined') || lower.includes('decreased') || lower.includes('fell') || lower.includes('dropped')) {
    return {
      icon: '▼',
      iconClass: 'text-rose-600',
      textClass: 'text-rose-700',
    };
  }

  if (lower.includes('unchanged') || lower.includes('steady') || lower.includes('flat')) {
    return {
      icon: '■',
      iconClass: 'text-slate-500',
      textClass: 'text-slate-600',
    };
  }

  if (lower.includes('reward engagement') || lower.includes('reward')) {
    return {
      icon: '★',
      iconClass: 'text-amber-500',
      textClass: 'text-amber-700',
      badge: 'Rewards',
      badgeClass: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    icon: '•',
    iconClass: 'text-sky-600',
    textClass: 'text-slate-700',
  };
};

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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Insights</h3>
        <span className="text-xs uppercase tracking-wide text-gray-400">Auto-generated</span>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading insights...</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load insights: {error.message}</p>
      ) : insights && insights.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {insights.map((text, idx) => {
            const meta = resolveInsightMeta(text);
            return (
              <li key={idx} className="flex items-start gap-3 py-2">
                <span aria-hidden className={`text-base leading-5 ${meta.iconClass}`}>{meta.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm leading-5 ${meta.textClass}`}>{text}</p>
                  {meta.badge && (
                    <span className={`inline-flex mt-1 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}>
                      {meta.badge}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No significant changes.</p>
      )}
    </div>
  );
};

export default InsightsPanel;
