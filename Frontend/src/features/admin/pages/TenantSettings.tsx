import React from 'react';
import { useCapabilities } from '../hooks/useCapabilities';

const TenantSettings: React.FC = () => {
  const { has } = useCapabilities();
  const canEdit = has('tenant.edit');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tenant Settings</h1>
      <p className="text-sm text-gray-500">Configure tenant branding & feature toggles.</p>
      <form className="space-y-4 p-4 bg-white border rounded shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input disabled={!canEdit} className="w-full border px-2 py-1 rounded text-sm" placeholder="Tenant name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
          <input disabled={!canEdit} className="w-full border px-2 py-1 rounded text-sm" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Theme Color</label>
          <input disabled={!canEdit} type="color" className="h-8 w-16 border px-1 py-1 rounded" />
        </div>
        {canEdit ? (
          <button type="submit" className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Save</button>
        ) : (
          <div className="text-xs text-red-500">Read-only (missing tenant.edit)</div>
        )}
      </form>
    </div>
  );
};

export default TenantSettings;
