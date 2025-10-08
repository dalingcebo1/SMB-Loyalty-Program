import React from 'react';
import { Link } from 'react-router-dom';
import { adminNavGroups } from '../nav/adminNavConfig';
import { useCapabilities } from '../hooks/useCapabilities';

// Compact horizontal nav for dashboard-style embeds; mirrors sidebar config.
export const AdminNav: React.FC = () => {
  const { has } = useCapabilities();
  const items = adminNavGroups
    .flatMap(group => group.items)
    .filter(item => !item.cap || has(item.cap));

  return (
    <nav className="flex flex-wrap gap-3 text-sm">
      {items.map(item => (
        <Link key={item.key} to={item.path} className="text-blue-600 hover:text-blue-800">
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
