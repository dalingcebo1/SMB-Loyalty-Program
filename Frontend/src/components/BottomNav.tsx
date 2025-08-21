import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { moduleFlags } from '../config/modules';
import { FaHome, FaCar, FaHistory, FaGift, FaUser, FaClipboardList } from 'react-icons/fa';

const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

  const navOptions: Array<{ to: string; label: string; icon: React.ReactNode }> = [
    ...(enableOrders ? [{ to: '/', label: 'Home', icon: <FaHome /> }] : []),
    ...(enableOrders ? [{ to: '/order', label: 'Book', icon: <FaClipboardList /> }] : []),
    ...(enableLoyalty ? [{ to: '/myloyalty', label: 'Loyalty', icon: <FaGift /> }] : []),
    ...(enableOrders ? [{ to: '/past-orders', label: 'Orders', icon: <FaHistory /> }] : []),
    ...(enableUsers ? [{ to: '/account', label: 'Account', icon: <FaUser /> }] : []),
    ...((user?.role === 'staff' || user?.role === 'admin') && enablePayments
      ? [{ to: '/staff/dashboard', label: 'Wash', icon: <FaCar /> }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 shadow md:hidden">
      {navOptions.map(opt => (
        <NavLink
          key={opt.to}
          to={opt.to}
          className={({ isActive }) =>
            (isActive ? 'text-blue-600' : 'text-gray-600') + ' flex flex-col items-center text-sm'
          }
        >
          {opt.icon}
          <span className="mt-1">{opt.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
