import { Outlet, NavLink } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import './DeveloperAdminApp.css';

const navItems = [
  { to: '/dev-admin/tenants', label: 'Tenants' },
  { to: '/dev-admin/create', label: 'Create Tenant' },
  // Add more as needed
];

export default function DeveloperAdminApp() {
  const location = useLocation();
  return (
    <div className="dev-admin-shell">
      <aside className="dev-admin-sidebar">
        <h2>Developer Admin</h2>
        <nav>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({isActive}) => isActive ? 'active' : ''}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="dev-admin-main">
        <header style={{marginBottom: '2rem'}}>
          <h1 style={{fontSize: '1.7rem', margin: 0}}>Developer Portal</h1>
          <p style={{color: '#555', margin: '0.5rem 0 0 0'}}>Onboard, manage, and configure tenants across all verticals. Only visible to developer/superadmin roles.</p>
        </header>
        <Outlet />
        {(location.pathname === '/dev-admin' || location.pathname === '/dev-admin/') && (
          <div style={{marginTop: '2rem', color: '#888', fontSize: '1.1rem'}}>
            <p>Welcome! Use the sidebar to create or manage tenants. More tools coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}
