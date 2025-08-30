import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { moduleFlags } from '../config/modules';
import { FaHome, FaCar, FaHistory, FaGift, FaUser, FaClipboardList, FaSignOutAlt } from 'react-icons/fa';
import './BottomNav.css';

const BottomNav: React.FC = () => {
  const { user, logout } = useAuth();
  const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

  const isStaffOnly = user?.role === 'staff';
  const isAdmin = user?.role === 'admin';

  let navOptions: Array<{ to: string; label: string; icon: React.ReactNode }> = [];
  if (isStaffOnly) {
    navOptions = [
      { to: '/staff/dashboard', label: 'Dashboard', icon: <FaCar /> },
    ];
  } else {
    navOptions = [
      ...(enableOrders ? [{ to: '/', label: 'Home', icon: <FaHome /> }] : []),
      ...(enableOrders ? [{ to: '/order', label: 'Book', icon: <FaClipboardList /> }] : []),
      ...(enableLoyalty ? [{ to: '/myloyalty', label: 'Loyalty', icon: <FaGift /> }] : []),
      ...(enableOrders ? [{ to: '/past-orders', label: 'Orders', icon: <FaHistory /> }] : []),
      ...(enableUsers ? [{ to: '/account', label: 'Account', icon: <FaUser /> }] : []),
      ...((isAdmin || isStaffOnly) && enablePayments
        ? [{ to: '/staff/dashboard', label: 'Wash', icon: <FaCar /> }]
        : []),
    ];
  }

  return (
    <nav className="bottom-nav">
      {navOptions.map(opt => (
        <NavLink
          key={opt.to}
          to={opt.to}
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="bottom-nav-icon">{opt.icon}</div>
          <span className="bottom-nav-label">{opt.label}</span>
        </NavLink>
      ))}
      {/* Mobile logout button */}
      <button
        type="button"
        onClick={logout}
        className="bottom-nav-item"
        aria-label="Log out"
      >
        <div className="bottom-nav-icon"><FaSignOutAlt /></div>
        <span className="bottom-nav-label">Logout</span>
      </button>
    </nav>
  );
};

export default BottomNav;
