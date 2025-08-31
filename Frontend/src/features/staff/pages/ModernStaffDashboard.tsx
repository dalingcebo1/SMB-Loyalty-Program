// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';
import './ModernStaffDashboard.css';

const ModernStaffDashboard: React.FC = () => {
  return (
    <div className="modern-staff-dashboard">
      {/* Header removed (duplicated with StaffLayout). Keep status indicator inline with overview if needed. */}
      <div className="dashboard-content">
        <div className="dashboard-section" style={{padding: '1rem 1.5rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'1rem'}}>
            <div>
              <h2 style={{margin:'0 0 .25rem'}}>Dashboard Overview</h2>
              <p style={{margin:0,fontSize:'.9rem',color:'#4a5568'}}>Monitor and manage car wash operations in real-time</p>
            </div>
            <div className="status-indicator online" style={{marginLeft:'auto'}}>
              <span className="status-dot"></span>
              <span className="status-text">System Online</span>
            </div>
          </div>
        </div>
        <DashboardOverview />
        <ActiveWashesManager />
        
        {/* Quick Analytics Preview */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>📈 Quick Analytics</h2>
            <p>Today's performance at a glance</p>
          </div>
          <EnhancedAnalyticsLazy />
        </div>
      </div>
    </div>
  );
};

export default ModernStaffDashboard;
