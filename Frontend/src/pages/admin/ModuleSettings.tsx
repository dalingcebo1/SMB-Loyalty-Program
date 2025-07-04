// src/pages/admin/ModuleSettings.tsx
import React, { useState, useEffect } from 'react';
import { ModuleFlags, getModuleFlags, setModuleFlags } from '../../config/modules';
import { useAuth } from '../../auth/AuthProvider';
import { Navigate } from 'react-router-dom';

const moduleGroups: Array<{ title: string; flag: keyof ModuleFlags; subs: Array<{ key: keyof ModuleFlags; label: string }> }> = [
  { title: 'Catalog', flag: 'enableCatalog', subs: [
    { key: 'catalogServices', label: 'Services' },
    { key: 'catalogExtras', label: 'Extras' },
  ]},
  { title: 'Loyalty', flag: 'enableLoyalty', subs: [
    { key: 'loyaltyView', label: 'View' },
    { key: 'loyaltyRedeem', label: 'Redeem' },
  ]},
  { title: 'Orders', flag: 'enableOrders', subs: [
    { key: 'ordersCreate', label: 'Create' },
    { key: 'ordersHistory', label: 'History' },
  ]},
  { title: 'Payments', flag: 'enablePayments', subs: [
    { key: 'paymentsVerify', label: 'Verify' },
  ]},
  { title: 'Users', flag: 'enableUsers', subs: [
    { key: 'usersAccount', label: 'Account' },
    { key: 'usersAdmin', label: 'Admin' },
  ]},
];

const ModuleSettings: React.FC = () => {
  const { user, loading } = useAuth();
  const [flags, setFlagsState] = useState<ModuleFlags>(getModuleFlags());

  useEffect(() => {
    setFlagsState(getModuleFlags());
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const handleChange = (key: keyof ModuleFlags) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...flags, [key]: e.target.checked };
    setFlagsState(updated);
    setModuleFlags({ [key]: e.target.checked });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Module Settings</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {moduleGroups.map(({ title, flag, subs }) => (
          <div key={title} className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={flags[flag]}
                onChange={handleChange(flag)}
              />
              <span className="font-semibold text-lg">{title}</span>
            </label>
            <div className="ml-6 space-y-2">
              {subs.map(({ key, label }) => (
                <label key={key} className={`flex items-center ${!flags[flag] ? 'opacity-50' : ''}`}> 
                  <input
                    type="checkbox"
                    className="h-4 w-4 mr-2"
                    checked={flags[key]}
                    onChange={handleChange(key)}
                    disabled={!flags[flag]}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModuleSettings;
