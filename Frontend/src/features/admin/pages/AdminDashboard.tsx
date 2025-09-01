import React from 'react';
import { AdminNav } from '../components/AdminNav';
import { useCapabilities } from '../hooks/useCapabilities';

export const AdminDashboard: React.FC = () => {
  const { role } = useCapabilities();
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <p className="text-sm text-gray-600">Role: {role || 'unknown'}</p>
      <AdminNav />
      <div className="mt-6 text-sm text-gray-500">Select a section from the navigation above. This is a placeholder scaffold.</div>
    </div>
  );
};
