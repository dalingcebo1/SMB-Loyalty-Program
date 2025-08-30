// src/features/staff/components/StaffLayout.tsx
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import './StaffLayout.css';
import { filterStaffNav } from '../config/navigation';
import { StaffSectionProvider } from '../context/StaffSectionContext';


const StaffLayout: React.FC = () => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const itemsToRender = filterStaffNav(user?.role, location.pathname);

  return (
    <StaffSectionProvider>
    <div className="staff-layout">
      {/* Header */}
      <header className="staff-header">
        <div className="staff-header-content">
          <div className="staff-header-title">
            <h1>Staff Dashboard</h1>
            <p>Car Wash Management System</p>
          </div>
          <div className="staff-header-actions">
            <button
              type="button"
              onClick={logout}
              className="home-link"
              aria-label="Log out"
            >
              <span className="icon">🔒</span>
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="staff-navigation">
        <div className="nav-container">
          {itemsToRender.map((item) => (
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
  </StaffSectionProvider>
  );
};

export default StaffLayout;
