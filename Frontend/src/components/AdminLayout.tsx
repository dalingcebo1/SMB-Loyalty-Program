// src/components/AdminLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import RequireAdmin from './RequireAdmin';
import AdminSidebar from './AdminSidebar';
import StatusBanner from './StatusBanner';

const AdminLayout: React.FC = () => (
  <RequireAdmin>
  <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden">
    <div className="flex flex-1 overflow-hidden">
  <AdminSidebar />
  <main className="flex-1 overflow-y-auto">
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
