import React from 'react';
import { useCapabilities } from '../hooks/useCapabilities';
import { Link } from 'react-router-dom';

// Minimal placeholder admin nav; expand as routes added.
export const AdminNav: React.FC = () => {
  const { has } = useCapabilities();
  return (
    <nav className="flex gap-4 text-sm">
      {has('tenant.edit') && <Link to="/admin/tenant">Tenant</Link>}
      {has('users.invite') && <Link to="/admin/users">Users</Link>}
      {has('analytics.advanced') && <Link to="/admin/analytics">Analytics</Link>}
      {has('audit.view') && <Link to="/admin/audit">Audit</Link>}
      {has('jobs.view') && <Link to="/admin/jobs">Jobs</Link>}
      {has('rate_limit.edit') && <Link to="/admin/rate-limits">Rate Limits</Link>}
    </nav>
  );
};
