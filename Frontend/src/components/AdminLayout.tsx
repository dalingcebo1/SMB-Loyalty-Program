// src/components/AdminLayout.tsx
import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { HiHome } from 'react-icons/hi';
import AdminSidebar from './AdminSidebar';
import StatusBanner from './StatusBanner';
import FloatingHomeButton from './FloatingHomeButton';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-50 flex flex-col">
      {/* Compact Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Link
            to="/admin"
            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            aria-label="Go to admin home"
          >
            <HiHome className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-semibold text-gray-800">Admin Panel</h1>
        </div>
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
          <div className="min-h-full px-4 py-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Home Button */}
      <FloatingHomeButton />

      <footer className="mt-auto">
        <StatusBanner />
      </footer>
    </div>
  );
};

export default AdminLayout;
