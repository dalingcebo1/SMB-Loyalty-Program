// src/components/AdminLayout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import StatusBanner from './StatusBanner';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">Admin Panel</h1>
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Toggle admin navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <div className="relative flex flex-1 overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 lg:flex-shrink-0 lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:transform-none`}
        >
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close admin navigation overlay"
          />
        )}

        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="mt-auto">
        <StatusBanner />
      </footer>
    </div>
  );
};

export default AdminLayout;
