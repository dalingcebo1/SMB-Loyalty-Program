// src/components/NavTabs.tsx

import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { moduleFlags } from '../config/modules';
import { FaHome, FaCar, FaHistory, FaGift, FaUser, FaClipboardList, FaSignOutAlt } from 'react-icons/fa';
import './NavTabs.css';

const NavTabs: React.FC = () => {
  const { user, logout } = useAuth();
  const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

  const navOptions: Array<{ to: string; label: string; icon: React.ReactNode }> = [
    ...(enableOrders ? [{ to: '/', label: 'Home', icon: <FaHome /> }] : []),
    ...(enableOrders ? [{ to: '/order', label: 'Book Service', icon: <FaClipboardList /> }] : []),
    ...(enableLoyalty ? [{ to: '/myloyalty', label: 'My Rewards', icon: <FaGift /> }] : []),
    ...(enableOrders ? [{ to: '/past-orders', label: 'Order History', icon: <FaHistory /> }] : []),
    ...(enableUsers ? [{ to: '/account', label: 'Account', icon: <FaUser /> }] : []),
    ...((user?.role === 'staff' || user?.role === 'admin') && enablePayments
      ? [{ to: '/staff/dashboard', label: 'Staff Dashboard', icon: <FaCar /> }]
      : []),
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="nav-header">
      <div className="nav-container">
        {/* Brand Logo/Title */}
        <div className="nav-brand">
          <NavLink
            to="/"
            className="brand-link"
          >
            <span className="brand-text">SMB Loyalty</span>
          </NavLink>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="nav-links">
          {navOptions.map(option => (
            <NavLink
              key={option.to}
              to={option.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <span className="nav-icon">{option.icon}</span>
              <span className="nav-label">{option.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Actions */}
        <div className="nav-actions">
          <div className="user-info">
            <span className="user-greeting">
              Hi, {user?.firstName || 'User'}!
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="logout-button"
            aria-label="Log out"
          >
            <FaSignOutAlt />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default NavTabs;
