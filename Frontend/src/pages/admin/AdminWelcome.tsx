// Removed ts-nocheck; TypeScript issues have been addressed
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { HiUsers, HiUserAdd, HiCog } from 'react-icons/hi';
import api from '../../api/api';
import { SUMMARY_LABELS } from '../../utils';

const AdminWelcome: React.FC = () => {
  const { user } = useAuth();
  const name = user?.firstName || 'Admin';
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  // default dates: last 7 days
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(weekAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/analytics/summary?start_date=${startDate}&end_date=${endDate}`
      );
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // spinner for individual metric cards
  const CardSpinner: React.FC = () => (
    <svg className="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Header card */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-6 text-center mb-8">
        <h1 className="text-2xl font-semibold mb-2">Welcome, {name}!</h1>
        <p className="text-gray-600">Use the links below to manage users, staff, and modules.</p>
      </div>
      {/* Action grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <Link
          to="/admin/users"
          className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition-shadow"
        >
          <HiUsers className="w-12 h-12 text-blue-500 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Manage Users</h2>
          <p className="text-gray-500 text-sm">View, edit, and assign roles to users</p>
        </Link>

        <Link
          to="/admin/register-staff"
          className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition-shadow"
        >
          <HiUserAdd className="w-12 h-12 text-green-500 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Register Staff</h2>
          <p className="text-gray-500 text-sm">Invite new staff to use the app</p>
        </Link>

        <Link
          to="/admin/modules"
          className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition-shadow"
        >
          <HiCog className="w-12 h-12 text-purple-500 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Modules & Settings</h2>
          <p className="text-gray-500 text-sm">Enable features and configure settings</p>
        </Link>
      </div>
      {/* Analytics summary */}
      <div className="w-full max-w-4xl mt-6">
        {/* Date range picker */}
        <div className="flex items-center space-x-2 mb-4">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border p-1 rounded"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border p-1 rounded"
          />
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <h2 className="text-xl font-semibold mb-4">Quick Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Object.entries(SUMMARY_LABELS).map(([key, label]) => (
            <Link key={key} to={`/admin/analytics/${key.replace(/_count$/, 's').replace(/_/g, '/')}?start_date=${startDate}&end_date=${endDate}`}>  
              <div className="bg-white p-4 rounded shadow flex flex-col items-center justify-center text-center h-24 space-y-1 hover:shadow-lg transition">
                <div className="text-sm text-gray-500">{label}</div>
                <div className="text-2xl font-semibold">
                  {loading ? <CardSpinner /> : (summary?.[key] ?? 0)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminWelcome;
