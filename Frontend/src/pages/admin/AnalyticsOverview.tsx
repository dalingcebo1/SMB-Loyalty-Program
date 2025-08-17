import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../../hooks/useDateRange';
import { useSearchParams } from 'react-router-dom';
import api, { buildQuery } from '../../api/api';
import FunnelChart, { FunnelDataPoint } from '../../components/charts/FunnelChart';
import TimeSeriesChart, { SeriesPoint } from '../../components/charts/TimeSeriesChart';
import Container from '../../components/ui/Container';
import { SummaryMetrics } from '../../types/metrics';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const AnalyticsOverview: React.FC = () => {
  const { start, end } = useDateRange();
  const [searchParams] = useSearchParams();
  const tier = searchParams.get('tier') || '';
  const campaign = searchParams.get('campaign') || '';
  const device = searchParams.get('device') || '';
  const granularity = searchParams.get('granularity') || 'daily';
  const { data: summary } = useQuery<SummaryMetrics, Error>({
    queryKey: ['analyticsSummary', start, end, tier, campaign, device, granularity],
    queryFn: () => api
      .get(`/analytics/summary${buildQuery({ start_date: start, end_date: end, tier, campaign, device, granularity })}`)
      .then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });
  // Visits details for peak hours/days
  const { data: visitDetails } = useQuery<any, Error>({
    queryKey: ['visitsDetails', start, end],
    queryFn: () => api.get(`/analytics/visits/details${buildQuery({ start_date: start, end_date: end })}`).then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Container>
      {/* Conversion Funnel */}
      <section className="mt-12">
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 tracking-tight">Conversion Funnel</h2>
          {summary ? (
            <FunnelChart
              data={[
                { name: 'Visits', value: summary.visits_total } as FunnelDataPoint,
                { name: 'Transactions', value: summary.transaction_count } as FunnelDataPoint,
                { name: 'Redemptions', value: summary.redemptions_count } as FunnelDataPoint,
              ]}
              height={250}
            />
          ) : (
            <p>Loading funnel…</p>
          )}
        </div>
      </section>

      {/* Breakdowns */}
  <section className="mt-12 grid md:grid-cols-3 gap-6">
        {/* Top Rewards Redeemed */}
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-xl font-semibold mb-4 tracking-tight">Top Rewards Redeemed</h3>
          {summary?.top_rewards ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.top_rewards} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <XAxis dataKey="title" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>Loading top rewards…</p>
          )}
        </div>
        {/* Visits by Peak Hours */}
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-xl font-semibold mb-4 tracking-tight">Visits by Peak Hours</h3>
          {visitDetails?.peak_visit_hours ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={visitDetails.peak_visit_hours} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <XAxis dataKey="hour" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>Loading visit details…</p>
          )}
        </div>
        {/* Tier Distribution */}
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-xl font-semibold mb-4 tracking-tight">Tier Distribution</h3>
          {summary?.tier_distribution ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={summary.tier_distribution} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={100} label>
                  {summary.tier_distribution.map((_, idx) => (
                    <Cell key={idx} fill={[ '#6366f1', '#f43f5e', '#3b82f6' ][idx % 3]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p>Loading tier distribution…</p>
          )}
        </div>
      </section>

      {/* Trends */}
      <section className="mt-12">
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 tracking-tight">Trends</h2>
          {summary ? (
            <div className="grid md:grid-cols-3 gap-6">
              {/* New Users Trend */}
              <div className="bg-gray-50 rounded p-4">
                <TimeSeriesChart
                  title="New Users"
                  series={[{ name: 'Users', data: summary.user_growth as SeriesPoint[], color: '#16a34a', type: 'line', dataKey: 'count' }]}
                  height={200}
                />
              </div>
              {/* Transactions Trend */}
              <div className="bg-gray-50 rounded p-4">
                <TimeSeriesChart
                  title="Transactions Over Time"
                  series={[{ name: 'Transactions', data: summary.transaction_volume as SeriesPoint[], color: '#2563eb', type: 'area' }]}
                  height={200}
                />
              </div>
              {/* Visits Trend */}
              <div className="bg-gray-50 rounded p-4">
                <TimeSeriesChart
                  title="Visits Over Time"
                  series={[{ name: 'Visits', data: summary.visits_over_time as SeriesPoint[], color: '#0891b2', type: 'line', dataKey: 'count' }]}
                  height={200}
                />
              </div>
            </div>
          ) : (
            <p>Loading trends…</p>
          )}
        </div>
      </section>
    </Container>
  );
};

export default AnalyticsOverview;
