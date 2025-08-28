// src/features/staff/components/StaffLayout.tsx
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './StaffLayout.css';

interface NavigationItem {
  path: string;
  label: string;
  icon: string;
  description: string;
}

const navigationItems: NavigationItem[] = [
  {
    path: '/staff/dashboard',
    label: 'Dashboard',
    icon: '📊',
    description: 'Overview & Active Washes'
  },
  {
    path: '/staff/vehicle-manager',
    label: 'Vehicles',
    icon: '🚗',
    description: 'Vehicle Management'
  },
  {
    path: '/staff/wash-history',
    label: 'History',
    icon: '📋',
    description: 'Wash History & Analytics'
  },
  {
    path: '/staff/payment',
    label: 'Payments',
    icon: '💳',
    description: 'Payment Verification'
  },
  {
    path: '/staff/manual-visit',
    label: 'Manual Log',
    icon: '📝',
    description: 'Manual Visit Logger'
  }
];

const StaffLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="staff-layout">
      {/* Header */}
      <header className="staff-header">
        <div className="staff-header-content">
          <div className="staff-header-title">
            <h1>Staff Dashboard</h1>
            <p>Car Wash Management System</p>
          </div>
          <div className="staff-header-actions">
            <Link to="/" className="home-link">
              <span className="icon">🏠</span>
              Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="staff-navigation">
        <div className="nav-container">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <div className="nav-content">
                <span className="nav-label">{item.label}</span>
                <span className="nav-description">{item.description}</span>
              </div>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="staff-main">
        <div className="staff-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StaffLayout;
