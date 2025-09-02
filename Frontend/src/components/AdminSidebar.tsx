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

  // Redirect legacy embedded staff paths if user navigates directly
  const legacyMatch = useMemo(() => allAdminNavItems.find(i => i.legacyPaths?.some(lp => pathname.startsWith(lp))), [pathname]);
  useEffect(() => {
    if (legacyMatch && pathname !== legacyMatch.path) {
      navigate(legacyMatch.path, { replace: true });
    }
  }, [legacyMatch, pathname, navigate]);

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside className="w-64 bg-white shadow p-4 sticky top-0 h-full overflow-y-auto flex flex-col">
      <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
      <nav className="flex-1 space-y-3">
        {adminNavGroups.map(group => {
          const groupItems = group.items.filter(i => !i.cap || has(i.cap));
            if (!groupItems.length) return null;
            const isCollapsed = collapsed[group.key] ?? group.defaultCollapsed ?? false;
            return (
              <div key={group.key} className="border-b border-gray-100 pb-1 last:border-none">
                <button
                  type="button"
                  onClick={() => toggle(group.key)}
                  className="w-full flex justify-between items-center text-left text-[11px] tracking-wide font-semibold uppercase text-gray-500 hover:text-gray-700"
                >
                  <span>{group.title}</span>
                  <span className="text-xs">{isCollapsed ? '▸' : '▾'}</span>
                </button>
                {!isCollapsed && (
                  <ul className="mt-1 space-y-1">
                    {groupItems.map(item => (
                      <li key={item.key}>
                        <NavLink
                          to={item.path}
                          className={({ isActive }) => `block px-3 py-1 rounded border-l-4 text-sm transition-colors ${ (isActive || pathname.startsWith(item.path))
                              ? 'bg-blue-50 border-blue-600 text-blue-800 font-medium'
                              : 'border-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
        })}
      </nav>
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
