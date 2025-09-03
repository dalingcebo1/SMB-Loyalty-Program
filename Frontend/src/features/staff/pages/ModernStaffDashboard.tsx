// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import { FaChartLine } from 'react-icons/fa';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';

const ModernStaffDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Staff Dashboard</h1>
              <p className="mt-1 text-blue-100">Monitor and manage car wash operations in real-time</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">System Online</span>
            </div>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>
        {/* Dashboard Overview */}
        <DashboardOverview />
        
        {/* Active Washes */}
        <ActiveWashesManager />
        
        {/* Quick Analytics */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <FaChartLine className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quick Analytics</h2>
                <p className="text-sm text-gray-500">Today's performance at a glance</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <EnhancedAnalyticsLazy />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernStaffDashboard;
