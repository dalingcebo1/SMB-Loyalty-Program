import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCapabilities } from '../features/admin/hooks/useCapabilities';
import { adminNavGroups, allAdminNavItems } from '../features/admin/nav/adminNavConfig';

const STORAGE_KEY = 'admin_nav_collapsed_v1';

interface CollapsedState { [group: string]: boolean }

interface AdminSidebarProps {
  onClose?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ onClose }) => {
  const { logout } = useAuth();
  const { has } = useCapabilities();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<CollapsedState>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed)); }, [collapsed]);

  // Redirect legacy embedded staff paths if user navigates directly (optional progressive enhancement)
  const legacyMatch = useMemo(() => allAdminNavItems.find(i => i.legacyPaths?.some(lp => pathname.startsWith(lp))), [pathname]);
  useEffect(() => {
    if (legacyMatch && pathname !== legacyMatch.path) {
      navigate(legacyMatch.path, { replace: true });
    }
  }, [legacyMatch, pathname, navigate]);

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside className="w-72 bg-white shadow-xl border-r border-gray-200 sticky top-0 h-screen overflow-y-auto flex flex-col">
      {/* Mobile close button */}
      <div className="lg:hidden p-4 border-b border-gray-100">
        <button
          onClick={() => onClose?.()}
          className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close Menu
        </button>
      </div>

      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
            <p className="text-xs text-gray-500">System Management</p>
          </div>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"></div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {adminNavGroups.map(group => {
          const groupItems = group.items.filter(i => !i.cap || has(i.cap));
          if (!groupItems.length) return null;
          const isCollapsed = collapsed[group.key] ?? group.defaultCollapsed ?? false;
          const groupActive = groupItems.some(i => pathname.startsWith(i.path));
          const groupButtonBase = 'w-full flex justify-between items-center text-left text-xs tracking-wider font-bold uppercase py-3 px-3 rounded-lg transition-all duration-200 group';
          const groupButtonClasses = groupActive
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50';
          return (
            <div key={group.key} className="mb-4">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-current={groupActive ? 'true' : undefined}
                className={`${groupButtonBase} ${groupButtonClasses}`}
              >
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-3 transition-colors ${groupActive ? 'bg-indigo-500 shadow-inner shadow-indigo-300' : 'bg-gray-300 group-hover:bg-gray-400'}`}></span>
                  {group.title}
                </span>
                <span className={`text-xs transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'} ${groupActive ? 'text-indigo-600' : ''}`}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>
              {!isCollapsed && (
                <ul className="mt-1 space-y-1 pl-2">
                  {groupItems.map(item => (
                    <li key={item.key}>
                      <NavLink
                        to={item.path}
                        onClick={() => onClose?.()}
                        className={({ isActive }) => {
                          const active = isActive || pathname.startsWith(item.path);
                          return `group flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            active
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-[1.02]'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:scale-[1.01] hover:shadow-sm'
                          }`;
                        }}
                      >
                        <span className="flex items-center justify-between w-full">
                          <span className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-3 transition-all duration-200 ${
                              pathname.startsWith(item.path) 
                                ? 'bg-white shadow-sm' 
                                : 'bg-gray-300 group-hover:bg-gray-400'
                            }`}></span>
                            {item.label}
                          </span>
                          {pathname.startsWith(item.path) && (
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                          )}
                        </span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Admin User</p>
              <p className="text-xs text-gray-500">System Administrator</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 hover:scale-[1.02] group"
        >
          <svg className="mr-2 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
