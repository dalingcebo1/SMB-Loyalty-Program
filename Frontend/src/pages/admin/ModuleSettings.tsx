// src/pages/admin/ModuleSettings.tsx
import React, { useState, useEffect } from 'react';
import { ModuleFlags, getModuleFlags, setModuleFlags } from '../../config/modules';
import { useAuth } from '../../auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import PageLayout from '../../components/PageLayout';
import { HiCog } from 'react-icons/hi';

const moduleGroups: Array<{ 
  title: string; 
  flag: keyof ModuleFlags; 
  description: string;
  subs: Array<{ key: keyof ModuleFlags; label: string; description: string }> 
}> = [
  { 
    title: 'Catalog', 
    flag: 'enableCatalog', 
    description: 'Product and service catalog management',
    subs: [
      { key: 'catalogServices', label: 'Services', description: 'Manage available services' },
      { key: 'catalogExtras', label: 'Extras', description: 'Add-on services and products' },
    ]
  },
  { 
    title: 'Loyalty', 
    flag: 'enableLoyalty', 
    description: 'Customer loyalty and rewards program',
    subs: [
      { key: 'loyaltyView', label: 'View', description: 'Customer loyalty dashboard' },
      { key: 'loyaltyRedeem', label: 'Redeem', description: 'Reward redemption system' },
    ]
  },
  { 
    title: 'Orders', 
    flag: 'enableOrders', 
    description: 'Order management and tracking',
    subs: [
      { key: 'ordersCreate', label: 'Create', description: 'New order creation' },
      { key: 'ordersHistory', label: 'History', description: 'Order history and tracking' },
    ]
  },
  { 
    title: 'Payments', 
    flag: 'enablePayments', 
    description: 'Payment processing and verification',
    subs: [
      { key: 'paymentsVerify', label: 'Verify', description: 'Payment verification tools' },
    ]
  },
  { 
    title: 'Users', 
    flag: 'enableUsers', 
    description: 'User account management',
    subs: [
      { key: 'usersAccount', label: 'Account', description: 'User account settings' },
      { key: 'usersAdmin', label: 'Admin', description: 'Administrative user controls' },
    ]
  },
  { 
    title: 'Car Wash', 
    flag: 'enableCarWash', 
    description: 'Car wash operations and management',
    subs: [
      { key: 'carWashVerify', label: 'Verify', description: 'Wash verification system' },
      { key: 'carWashLogVisit', label: 'Log Visit', description: 'Manual visit logging' },
      { key: 'carWashManageVehicles', label: 'Manage Vehicles', description: 'Vehicle management tools' },
    ]
  },
];

const ModuleSettings: React.FC = () => {
  const { user, loading } = useAuth();
  const [flags, setFlagsState] = useState<ModuleFlags>(getModuleFlags());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFlagsState(getModuleFlags());
  }, []);

  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const handleChange = (key: keyof ModuleFlags) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...flags, [key]: e.target.checked };
    setFlagsState(updated);
    setModuleFlags({ [key]: e.target.checked });
    setHasChanges(true);
    // Auto-save after short delay
    setTimeout(() => setHasChanges(false), 1000);
  };

  const ToggleIcon = ({ enabled }: { enabled: boolean }) => 
    enabled ? (
      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) : (
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 4h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17.5 15.5M2.5 17.5L8.5 21.5" />
      </svg>
    );

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <HiCog className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Module Settings</h1>
                <p className="text-gray-600">Enable or disable platform features and capabilities</p>
              </div>
            </div>
            {hasChanges && (
              <div className="flex items-center space-x-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Changes saved</span>
              </div>
            )}
          </div>
        </div>

        {/* Module Groups */}
        <div className="grid gap-6 lg:grid-cols-2">
          {moduleGroups.map(({ title, flag, description, subs }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              {/* Main Module Toggle */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <ToggleIcon enabled={flags[flag]} />
                  </div>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={flags[flag]}
                    onChange={handleChange(flag)}
                  />
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    flags[flag] ? 'bg-green-600' : 'bg-gray-200'
                  }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      flags[flag] ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                </label>
              </div>

              {/* Sub-features */}
              <div className="space-y-3">
                {subs.map(({ key, label, description }) => (
                  <div key={key} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    !flags[flag] ? 'opacity-50 bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900">{label}</span>
                        {flags[key] && flags[flag] && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{description}</p>
                    </div>
                    <label className="flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={flags[key]}
                        onChange={handleChange(key)}
                        disabled={!flags[flag]}
                      />
                      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        flags[key] && flags[flag] ? 'bg-green-600' : 'bg-gray-200'
                      }`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          flags[key] && flags[flag] ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Module Configuration</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Changes are saved automatically and take effect immediately</li>
            <li>• Disabling a main module will disable all its sub-features</li>
            <li>• Some features may require page refresh to fully disable</li>
          </ul>
        </div>
      </div>
    </PageLayout>
  );
};

export default ModuleSettings;
