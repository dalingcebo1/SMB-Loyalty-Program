// src/pages/admin/ModuleSettings.tsx
import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import PageLayout from '../../components/PageLayout';


// Business-oriented module configurator
interface ModuleSettingsModel {
  payments: { enabled: boolean; provider: 'yoco' | 'paypal' };
  authentication: { enabled: boolean; method: 'email' | 'sms' };
  loyalty: { enabled: boolean; type: 'tiered' | 'milestone' };
  businessSetup: { enabled: boolean; type: 'carwash' | 'salon' | 'flowershop' };
  catalog: { enabled: boolean; services: boolean; extras: boolean };
  orders: { enabled: boolean; create: boolean; history: boolean };
}

const DEFAULT_SETTINGS: ModuleSettingsModel = {
  payments: { enabled: false, provider: 'yoco' },
  authentication: { enabled: false, method: 'email' },
  loyalty: { enabled: false, type: 'tiered' },
  businessSetup: { enabled: false, type: 'carwash' },
  catalog: { enabled: false, services: false, extras: false },
  orders: { enabled: false, create: false, history: false },
};
const ModuleSettings: React.FC = () => {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<ModuleSettingsModel>(DEFAULT_SETTINGS);


  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;


  // helper to toggle booleans
  const toggle = <K extends keyof ModuleSettingsModel>(mod: K) => {
    setSettings(s => ({ ...s, [mod]: { ...s[mod], enabled: !s[mod].enabled } }));
  };
  return (
    <PageLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Module Configuration</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Payments Provider */}
          <div className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={settings.payments.enabled}
                onChange={() => toggle('payments')}
              />
              <span className="font-semibold text-lg">Online Payments</span>
            </label>
            {settings.payments.enabled && (
              <select
                value={settings.payments.provider}
                onChange={e => setSettings(s => ({
                  ...s,
                  payments: { ...s.payments, provider: e.target.value as any }
                }))}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="yoco">YOCO</option>
                <option value="paypal">PayPal</option>
              </select>
            )}
          </div>
          {/* Authentication Method */}
          <div className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={settings.authentication.enabled}
                onChange={() => toggle('authentication')}
              />
              <span className="font-semibold text-lg">Authentication</span>
            </label>
            {settings.authentication.enabled && (
              <div className="space-x-4">
                <label>
                  <input
                    type="radio"
                    name="auth"
                    checked={settings.authentication.method === 'email'}
                    onChange={() => setSettings(s => ({ ...s, authentication: { ...s.authentication, method: 'email' } }))}
                  /> Email
                </label>
                <label>
                  <input
                    type="radio"
                    name="auth"
                    checked={settings.authentication.method === 'sms'}
                    onChange={() => setSettings(s => ({ ...s, authentication: { ...s.authentication, method: 'sms' } }))}
                  /> SMS
                </label>
              </div>
            )}
          </div>
          {/* Loyalty Type */}
          <div className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={settings.loyalty.enabled}
                onChange={() => toggle('loyalty')}
              />
              <span className="font-semibold text-lg">Loyalty & Rewards</span>
            </label>
            {settings.loyalty.enabled && (
              <select
                value={settings.loyalty.type}
                onChange={e => setSettings(s => ({ ...s, loyalty: { ...s.loyalty, type: e.target.value as any } }))}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="tiered">Tiered-based</option>
                <option value="milestone">Milestone</option>
              </select>
            )}
          </div>
          {/* Business Setup */}
          <div className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={settings.businessSetup.enabled}
                onChange={() => toggle('businessSetup')}
              />
              <span className="font-semibold text-lg">Business Setup</span>
            </label>
            {settings.businessSetup.enabled && (
              <select
                value={settings.businessSetup.type}
                onChange={e => setSettings(s => ({ ...s, businessSetup: { ...s.businessSetup, type: e.target.value as any } }))}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="carwash">Car Wash</option>
                <option value="salon">Salon</option>
                <option value="flowershop">Flower Shop</option>
              </select>
            )}
          </div>
          {/* Catalog */}
          <div className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={settings.catalog.enabled}
                onChange={() => toggle('catalog')}
              />
              <span className="font-semibold text-lg">Catalog</span>
            </label>
            <div className="ml-6 space-y-2">
              <label className={`flex items-center ${!settings.catalog.enabled ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 mr-2"
                  checked={settings.catalog.services}
                  disabled={!settings.catalog.enabled}
                  onChange={() =>
                    setSettings(s => ({ ...s, catalog: { ...s.catalog, services: !s.catalog.services } }))
                  }
                />
                <span>Services</span>
              </label>
              <label className={`flex items-center ${!settings.catalog.enabled ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 mr-2"
                  checked={settings.catalog.extras}
                  disabled={!settings.catalog.enabled}
                  onChange={() =>
                    setSettings(s => ({ ...s, catalog: { ...s.catalog, extras: !s.catalog.extras } }))
                  }
                />
                <span>Extras</span>
              </label>
            </div>
          </div>
          {/* Orders */}
          <div className="border rounded-lg p-4 bg-white shadow">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                className="h-5 w-5 mr-2"
                checked={settings.orders.enabled}
                onChange={() => toggle('orders')}
              />
              <span className="font-semibold text-lg">Orders</span>
            </label>
            <div className="ml-6 space-y-2">
              <label className={`flex items-center ${!settings.orders.enabled ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 mr-2"
                  checked={settings.orders.create}
                  disabled={!settings.orders.enabled}
                  onChange={() =>
                    setSettings(s => ({ ...s, orders: { ...s.orders, create: !s.orders.create } }))
                  }
                />
                <span>Create</span>
              </label>
              <label className={`flex items-center ${!settings.orders.enabled ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 mr-2"
                  checked={settings.orders.history}
                  disabled={!settings.orders.enabled}
                  onChange={() =>
                    setSettings(s => ({ ...s, orders: { ...s.orders, history: !s.orders.history } }))
                  }
                />
                <span>History</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ModuleSettings;
