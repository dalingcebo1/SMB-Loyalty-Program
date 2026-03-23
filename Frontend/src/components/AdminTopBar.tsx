import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiMenuAlt2, HiBell, HiSearch } from 'react-icons/hi';
import { useAuth } from '../auth/AuthProvider';
import { allAdminNavItems } from '../features/admin/nav/adminNavConfig';

interface AdminTopBarProps {
  onSidebarOpen: () => void;
}

const AdminTopBar: React.FC<AdminTopBarProps> = ({ onSidebarOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Find current page title
  const currentItem = allAdminNavItems.find(item => 
    item.path === location.pathname || 
    (item.path !== '/admin' && location.pathname.startsWith(item.path + '/'))
  );

  const pageTitle = currentItem?.label || 'Admin';

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onSidebarOpen}
          aria-label="Open sidebar"
        >
          <HiMenuAlt2 className="w-6 h-6" />
        </button>
        
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search - Hidden on small mobile */}
        <div className="hidden md:flex items-center relative">
          <HiSearch className="absolute left-3 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all w-64"
          />
        </div>

        <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>

        {/* Notifications */}
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors">
          <HiBell className="w-6 h-6" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        {/* User Profile Dropdown Trigger */}
        <div className="relative group">
          <button className="flex items-center gap-3 p-1.5 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {user?.firstName?.[0] || 'A'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-700 leading-none">{user?.firstName || 'Admin'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Administrator</p>
            </div>
          </button>
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
            <div className="px-4 py-2 border-b border-gray-50 md:hidden">
              <p className="text-sm font-medium text-gray-900">{user?.firstName || 'Admin'}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Your Profile</Link>
            <Link to="/admin/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</Link>
            <div className="border-t border-gray-50 my-1"></div>
            <button 
              onClick={() => logout()}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;
