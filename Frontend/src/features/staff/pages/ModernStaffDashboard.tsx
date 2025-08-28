// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedWashHistory from '../components/EnhancedWashHistory';
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
      </div>
    </div>
  );
};

export default ModernStaffDashboard;
