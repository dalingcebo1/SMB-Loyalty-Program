// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import { FaTachometerAlt, FaChartLine } from 'react-icons/fa';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';

const ModernStaffDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FaTachometerAlt className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Staff Dashboard</h1>
              <p className="text-sm text-gray-500">Monitor and manage car wash operations in real-time</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700">System Online</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Dashboard Overview */}
        <DashboardOverview />
        
        {/* Active Washes */}
        <ActiveWashesManager />
        
        {/* Quick Analytics */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-50 rounded-lg">
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
