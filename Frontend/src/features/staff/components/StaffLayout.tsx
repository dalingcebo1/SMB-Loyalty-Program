// src/features/staff/components/StaffLayout.tsx
import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import './StaffLayout.css';
import './text-wrapping-fixes.css';
import { filterStaffNav } from '../config/navigation';
import { StaffIcon, StaffIconName } from './StaffIcon';
import { StaffSectionProvider } from '../context/StaffSectionContext';


const StaffLayout: React.FC = () => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const itemsToRender = filterStaffNav(user?.role, location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mark that staff layout is mounted to help suppress any transient UI overlap
  useEffect(() => {
    document.body.classList.add('staff-layout-active');
    return () => { document.body.classList.remove('staff-layout-active'); };
  }, []);

  // Close the sidebar automatically on mobile view once navigation changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <StaffSectionProvider>
      <div className="staff-shell">
        {/* Top bar with hamburger trigger */}
        <header className="staff-topbar">
          <div className="staff-topbar-left">
            <button
              type="button"
              className="staff-hamburger"
              aria-label="Toggle staff navigation"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <svg className="staff-hamburger-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <Link to="/staff/dashboard" className="staff-topbar-title" aria-label="Go to staff dashboard home">
              <img src="/logo.svg" alt="SMB Loyalty" className="staff-topbar-logo" />
              <div className="staff-topbar-text">
                <span className="staff-topbar-label">Staff Dashboard</span>
                <span className="staff-topbar-subtitle">Car Wash Management System</span>
              </div>
            </Link>
          </div>
          <div className="staff-topbar-actions">
            <button
              type="button"
              onClick={logout}
              className="logout-button"
              aria-label="Log out"
            >
              <span className="logout-icon" aria-hidden="true">🔒</span>
              Log out
            </button>
          </div>
        </header>

        <div className="staff-shell-body">
          <aside className={`staff-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="staff-sidebar-header">
              <span>Navigation</span>
              <button
                type="button"
                className="staff-sidebar-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close staff navigation"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <nav className="staff-nav-list">
              {itemsToRender.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`staff-nav-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
                        setSidebarOpen(false);
                      }
                    }}
                  >
                    <span className="staff-nav-icon">
                      <StaffIcon name={item.icon as StaffIconName} />
                    </span>
                    <span className="staff-nav-text">
                      <span className="staff-nav-label">{item.label}</span>
                      <span className="staff-nav-description">{item.description}</span>
                    </span>
                    <span className="staff-nav-caret" aria-hidden="true">
                      <svg viewBox="0 0 16 16">
                        <path d="M5.5 3.5l5 4.5-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {sidebarOpen && (
            <button
              type="button"
              className="staff-overlay"
              aria-label="Close staff navigation overlay"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <main className="staff-shell-main">
            <div className="staff-content">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
  </StaffSectionProvider>
  );
};

export default StaffLayout;
