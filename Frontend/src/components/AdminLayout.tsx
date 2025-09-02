// src/components/AdminLayout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import RequireAdmin from './RequireAdmin';
import AdminSidebar from './AdminSidebar';
import StatusBanner from './StatusBanner';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <RequireAdmin>
      <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">Admin Panel</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-30 transition-transform duration-300 ease-in-out lg:z-auto`}>
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          </div>

          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content */}
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
};

export default AdminLayout;
