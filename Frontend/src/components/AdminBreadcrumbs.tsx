// src/components/AdminBreadcrumbs.tsx
import React from 'react';
import { Link, useMatch } from 'react-router-dom';
import { humanizeMetric } from '../utils/metrics';

/**
 * Renders breadcrumbs and subheader for admin analytics drill-down pages.
 */
const AdminBreadcrumbs: React.FC = () => {
  const match = useMatch('/admin/analytics/:metric');
  const metric = match?.params.metric;
  if (!metric) return null;
  const name = humanizeMetric(metric);
  return (
    <div className="mb-6">
      <nav className="text-sm text-gray-500 mb-2">
        <Link to="/admin/analytics" className="hover:underline">
          Analytics
        </Link>
        <span className="px-2">/</span>
        <span>{name}</span>
      </nav>
      <h3 className="text-lg font-semibold">{name}</h3>
    </div>
  );
};

export default AdminBreadcrumbs;
