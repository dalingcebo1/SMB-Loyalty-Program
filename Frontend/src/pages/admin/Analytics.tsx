import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageLayout from '../../components/PageLayout';
import api from '../../api/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';

// Summary card component
const SummaryCard: React.FC<{ title: string; value: number }> = ({ title, value }) => (
  <div className="bg-white p-4 rounded-lg shadow flex-1 text-center">
    <div className="text-gray-500 text-sm uppercase">{title}</div>
    <div className="text-2xl font-bold mt-2">{value}</div>
  </div>
);

// Helper to format metric keys
const formatKey = (key: string) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
};

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const startParam = searchParams.get('start_date') || weekAgoStr;
  const endParam = searchParams.get('end_date') || todayStr;

  const [startDate, setStartDate] = useState<string>(startParam);
  const [endDate, setEndDate] = useState<string>(endParam);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [userMetrics, setUserMetrics] = useState<any>(null);
  const [transMetrics, setTransMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ensure URL params
    setSearchParams({ start_date: startDate, end_date: endDate });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sumRes, usersRes, transRes] = await Promise.all([
          api.get(`/analytics/summary?start_date=${startDate}&end_date=${endDate}`),
          api.get(`/analytics/users/details?start_date=${startDate}&end_date=${endDate}`),
          api.get(`/analytics/transactions/details?start_date=${startDate}&end_date=${endDate}`),
        ]);
        setSummary(sumRes.data);
        setUserMetrics(usersRes.data);
        setTransMetrics(transRes.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  const handleRefresh = () => {
    setSearchParams({ start_date: startDate, end_date: endDate });
  };

  // prepare chart data
  const prepareChartData = (data: any) => {
    if (!data) return [];
    return Object.entries(data).map(([key, values]: any) => ({
      name: formatKey(key),
      period1: values.period1,
      period2: values.period2,
    }));
  };

  const userChartData = prepareChartData(userMetrics);
  const transChartData = prepareChartData(transMetrics);

  return (
    <PageLayout>
      <div className="w-full max-w-6xl mx-auto p-4">
        {/* Date filter and actions */}
        <div className="flex justify-end items-center mb-6 space-x-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Back</button>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1 rounded" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1 rounded" />
          <button onClick={handleRefresh} className="px-3 py-1 bg-blue-600 text-white rounded">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary and charts container */}
        <div className="bg-gray-100 p-6 rounded-lg">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {!summary
              ? Array(6).fill(0).map((_, i) => <SummaryCard key={i} title="--" value={0} />)
              : [
                  ['Users', summary.total_users],
                  ['Transactions', summary.transaction_count],
                  ['Points Issued', summary.points_issued],
                  ['Points Redeemed', summary.points_redeemed],
                  ['Redemptions', summary.total_redemptions],
                  ['Total Visits', summary.total_visits],
                ].map(([title, val]: any) => <SummaryCard key={title} title={title} value={val} />)
            }
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* User Metrics Chart */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">User Metrics</h2>
              <div className="bg-white rounded-lg shadow-inner p-4">
                {/* @ts-ignore */}
                <ResponsiveContainer width="100%" height={300}>
                  {/* @ts-ignore */}
                  <BarChart data={userChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="period1" name="Period 1" fill="#4299e1" />
                    <Bar dataKey="period2" name="Period 2" fill="#2b6cb0" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transaction Metrics Chart */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Transaction Metrics</h2>
              <div className="bg-white rounded-lg shadow-inner p-4">
                {/* @ts-ignore */}
                <ResponsiveContainer width="100%" height={300}>
                  {/* @ts-ignore */}
                  <LineChart data={transChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="period1" name="Period 1" stroke="#4299e1" strokeWidth={2} />
                    <Line type="monotone" dataKey="period2" name="Period 2" stroke="#2b6cb0" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Analytics;
