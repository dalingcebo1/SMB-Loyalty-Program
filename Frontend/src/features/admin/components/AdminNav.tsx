import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { adminNavGroups } from '../nav/adminNavConfig';
import { useCapabilities } from '../hooks/useCapabilities';
import { useVerticalFeatures } from '../../../contexts/VerticalContext';
import { TenantConfigContext } from '../../../config/TenantConfigProvider';
import { getModuleFlags } from '../../../config/modules';

// Compact horizontal nav for dashboard-style embeds; mirrors sidebar config.
export const AdminNav: React.FC = () => {
  const { has } = useCapabilities();
  const { hasFeature, features } = useVerticalFeatures();
  const tenantConfig = useContext(TenantConfigContext);
  const moduleFlags = tenantConfig?.moduleFlags || getModuleFlags();
  
  const items = adminNavGroups
    .flatMap(group => group.items)
    .filter(item => {
      // Capability check
      if (item.cap && !has(item.cap)) return false;
      // Feature flag check
      if (item.feature && !moduleFlags[item.feature]) return false;
      // Vertical feature check
      if (item.requiredVerticalFeature && !hasFeature(item.requiredVerticalFeature)) return false;
      // Allowed verticals check
      if (item.allowedVerticals && item.allowedVerticals.length > 0) {
        const verticalKey = (features as any).verticalKey || tenantConfig?.vertical || 'carwash';
        if (!item.allowedVerticals.includes(verticalKey)) return false;
      }
      return true;
    });

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
