// src/components/AdminLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import RequireAdmin from './RequireAdmin';
import AdminSidebar from './AdminSidebar';
import StatusBanner from './StatusBanner';

const AdminLayout: React.FC = () => (
  <RequireAdmin>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      <footer className="mt-auto">
        <StatusBanner />
      </footer>
    </div>
  </RequireAdmin>
);

export default AdminLayout;
