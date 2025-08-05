// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { HiUsers, HiUserAdd, HiCog } from 'react-icons/hi';
import api from '../../api/api';

const AdminWelcome: React.FC = () => {
  const { user } = useAuth();
  const name = user?.firstName || 'Admin';
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    // fetch analytics summary for dashboard
    api.get('/analytics/summary').then(res => setSummary(res.data)).catch(() => {});
  }, []);

  // you can add loading state if needed
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
      <div className="w-full max-w-4xl mt-10">
        <h2 className="text-xl font-semibold mb-4">Quick Metrics</h2>
        {!summary ? (
          <p>Loading metrics...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Users</div>
              <div className="text-2xl font-semibold">{summary.user_count}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Transactions</div>
              <div className="text-2xl font-semibold">{summary.transaction_count}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Points Issued</div>
              <div className="text-2xl font-semibold">{summary.points_issued}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Points Redeemed</div>
              <div className="text-2xl font-semibold">{summary.points_redeemed}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Redemptions</div>
              <div className="text-2xl font-semibold">{summary.redemptions_count}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Total Visits</div>
              <div className="text-2xl font-semibold">{summary.visits_total}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWelcome;
