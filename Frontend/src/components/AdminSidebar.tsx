import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCapabilities } from '../features/admin/hooks/useCapabilities';
import { adminNavGroups, allAdminNavItems } from '../features/admin/nav/adminNavConfig';

const STORAGE_KEY = 'admin_nav_collapsed_v1';

interface CollapsedState { [group: string]: boolean }

const AdminSidebar: React.FC = () => {
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
    <aside className="w-72 bg-white shadow-xl border-r border-gray-200 p-6 sticky top-0 h-full overflow-y-auto flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Admin Panel</h2>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"></div>
      </div>
      <nav className="flex-1 space-y-4">
        {adminNavGroups.map(group => {
          const groupItems = group.items.filter(i => !i.cap || has(i.cap));
          if (!groupItems.length) return null;
          const isCollapsed = collapsed[group.key] ?? group.defaultCollapsed ?? false;
          return (
            <div key={group.key} className="pb-2">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                className="w-full flex justify-between items-center text-left text-xs tracking-wider font-bold uppercase text-gray-500 hover:text-gray-700 py-2 px-1 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                <span>{group.title}</span>
                <span className={`text-xs transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}>▶</span>
              </button>
              {!isCollapsed && (
                <ul className="mt-2 space-y-1">
                  {groupItems.map(item => (
                    <li key={item.key}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) => {
                          const active = isActive || pathname.startsWith(item.path);
                          return `block px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            active
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-[1.02]'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:scale-[1.01]'
                          }`;
                        }}
                      >
                        <span className="flex items-center">
                          {item.label}
                          {(pathname.startsWith(item.path)) && (
                            <span className="ml-auto w-2 h-2 bg-white rounded-full"></span>
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
      <div className="pt-6 border-t border-gray-200 mt-auto">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 hover:scale-[1.02]"
        >
          <span className="flex items-center justify-center">
            <span>Logout</span>
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
