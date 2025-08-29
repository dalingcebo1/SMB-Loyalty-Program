// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedAnalytics from '../components/EnhancedAnalytics';
import './ModernStaffDashboard.css';

const ModernStaffDashboard: React.FC = () => {
  return (
    <div className="modern-staff-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Staff Dashboard</h1>
          <p>Monitor and manage car wash operations in real-time</p>
        </div>
        <div className="header-actions">
          <div className="status-indicator online">
            <span className="status-dot"></span>
            <span className="status-text">System Online</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <DashboardOverview />
        <ActiveWashesManager />
        
        {/* Quick Analytics Preview */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📈 Quick Analytics</h2>
            <p>Today's performance at a glance</p>
          </div>
          <EnhancedAnalytics />
        </div>
      </div>
    </div>
  );
};

export default ModernStaffDashboard;
