import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import api from '../../api/api';
import { HiCog, HiInformationCircle, HiSparkles, HiCheckCircle, HiXCircle } from 'react-icons/hi';

// Types based on backend API
interface Module {
  key: string;
  name: string;
  category?: string;
  description?: string;
  is_addon?: boolean;
}

interface TenantSubscription {
  plan: {
    id: number;
    name: string;
    price_cents: number;
    billing_period: string;
  } | null;
  active_modules: string[];
  status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
}

interface ModuleOverride {
  [key: string]: boolean;
}

const ModulesAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const [tenantId] = useState('default'); // Match subscription page pattern

  // Fetch available modules with fallback to demo data
  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/subscriptions/modules', { headers: { 'X-Tenant-ID': tenantId }});
        return data;
      } catch {
        // Fallback demo data based on backend MODULE_REGISTRY
        return [
          { key: 'core', name: 'Core', category: 'Core Operations', description: 'Tenant, auth, settings' },
          { key: 'team', name: 'Team & Roles', category: 'Core Operations' },
          { key: 'orders', name: 'Orders / POS', category: 'Core Operations' },
          { key: 'inventory', name: 'Inventory', category: 'Core Operations', description: 'Catalog & stock' },
          { key: 'bookings', name: 'Bookings', category: 'Core Operations', description: 'Scheduling / courts' },
          { key: 'loyalty', name: 'Loyalty', category: 'Customer Growth' },
          { key: 'messaging', name: 'Messaging', category: 'Customer Growth', description: 'Email/SMS/WhatsApp' },
          { key: 'referrals', name: 'Referrals', category: 'Customer Growth' },
          { key: 'automation', name: 'Automations', category: 'Customer Growth' },
          { key: 'campaigns', name: 'Campaigns', category: 'Customer Growth' },
          { key: 'analytics', name: 'Analytics', category: 'Intelligence' },
          { key: 'data_export', name: 'Data Export', category: 'Intelligence' },
          { key: 'audits', name: 'Audit Logs', category: 'Intelligence' },
          { key: 'integrations', name: 'Integrations', category: 'Platform' },
          { key: 'api', name: 'Public API & Webhooks', category: 'Platform' },
          { key: 'branding_plus', name: 'Branding+', category: 'Platform', is_addon: true },
          { key: 'priority_support', name: 'Priority Support', category: 'Platform', is_addon: true },
          { key: 'billing', name: 'Billing', category: 'Platform' },
        ];
      }
    }
  });

  // Fetch current tenant subscription
  const { data: subscription, isLoading: subLoading } = useQuery<TenantSubscription>({
    queryKey: ['tenantSub', tenantId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/subscriptions/tenants/${tenantId}`, { headers: { 'X-Tenant-ID': tenantId }});
        return data;
      } catch {
        // Fallback demo data
        return {
          id: tenantId,
          subscription_plan: {
            id: 1,
            name: 'Starter',
            modules: ['core', 'team', 'orders', 'loyalty', 'analytics'],
            price_cents: 2999
          },
          overrides: []
        };
      }
    }
  });

  // Fetch current overrides
  const { data: overrides = {}, isLoading: overridesLoading } = useQuery<ModuleOverride>({
    queryKey: ['overrides', tenantId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/subscriptions/tenants/${tenantId}/overrides`, { headers: { 'X-Tenant-ID': tenantId }});
        return data;
      } catch {
        return {};
      }
    }
  });

  // Toggle module override
  const toggleOverride = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      await api.post(`/subscriptions/tenants/${tenantId}/override`, {
        module_key: moduleKey,
        enabled
      }, { headers: { 'X-Tenant-ID': tenantId }});
    },
    onSuccess: (_, { moduleKey, enabled }) => {
      toast.success(`${moduleKey} ${enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['overrides', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenantSub', tenantId] });
    },
    onError: () => {
      toast.error('Failed to update module');
    }
  });

  const getModuleStatus = (moduleKey: string) => {
    const isInPlan = subscription?.active_modules?.includes(moduleKey) || false;
    const hasOverride = moduleKey in overrides;
    const overrideValue = overrides[moduleKey];
    
    if (hasOverride) {
      return {
        enabled: overrideValue,
        source: overrideValue ? 'override-enabled' : 'override-disabled',
        canToggle: true
      };
    }
    
    return {
      enabled: isInPlan,
      source: isInPlan ? 'plan' : 'unavailable',
      canToggle: !isInPlan // Can only enable modules not in plan via override
    };
  };

  const getStatusBadge = (status: ReturnType<typeof getModuleStatus>) => {
    if (status.source === 'override-enabled') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <HiSparkles className="w-3 h-3 mr-1" />
          Override: ON
        </span>
      );
    }
    if (status.source === 'override-disabled') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          Override: OFF
        </span>
      );
    }
    if (status.source === 'plan') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Plan Included
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Not Available
      </span>
    );
  };

  if (modulesLoading || subLoading || overridesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group modules by category
  const moduleGroups = modules.reduce((acc, module) => {
    const category = module.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <HiCog className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Module Management</h1>
              <p className="text-gray-600">Control feature access and module overrides</p>
            </div>
          </div>
          
          {/* Subscription Info */}
          {subscription && (
            <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Current Plan: {subscription.plan?.name || 'No Plan'}</h3>
                <p className="text-sm text-gray-600">
                  {subscription.active_modules?.length || 0} active modules
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {(subscription.status ? subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1) : 'Active')}
              </div>
            </div>
          )}
        </header>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <HiInformationCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Module Overrides Work:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><strong>Plan Included:</strong> Module is included in your subscription plan</li>
                <li><strong>Override ON:</strong> Module manually enabled (may incur additional charges)</li>
                <li><strong>Override OFF:</strong> Module manually disabled (overrides plan inclusion)</li>
                <li><strong>Not Available:</strong> Module not in plan and not overridden</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Module Groups */}
        <div className="space-y-6">
          {Object.entries(moduleGroups).map(([category, categoryModules]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {categoryModules.filter(m => getModuleStatus(m.key).enabled).length} of {categoryModules.length} enabled
                </p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {categoryModules.map((module) => {
                  const status = getModuleStatus(module.key);
                  
                  return (
                    <div key={module.key} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {module.name}
                            </h3>
                            {module.is_addon && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Add-on
                              </span>
                            )}
                            {getStatusBadge(status)}
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            Module Key: <code className="bg-gray-100 px-1 rounded text-xs">{module.key}</code>
                          </p>
                          
                          {module.description && (
                            <p className="text-sm text-gray-600">{module.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {/* Toggle Button */}
                          {status.canToggle ? (
                            <button
                              onClick={() => toggleOverride.mutate({
                                moduleKey: module.key,
                                enabled: !status.enabled
                              })}
                              disabled={toggleOverride.isPending}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                                status.enabled
                                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              }`}
                            >
                              {status.enabled ? (
                                <>
                                  <HiXCircle className="w-5 h-5" />
                                  Disable Override
                                </>
                              ) : (
                                <>
                                  <HiCheckCircle className="w-5 h-5" />
                                  Enable Override
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="text-sm text-gray-500">
                              {status.enabled ? 'Included in Plan' : 'Contact Support'}
                            </div>
                          )}
                          
                          {/* Status Indicator */}
                          <div className={`w-3 h-3 rounded-full ${
                            status.enabled ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <p className="text-sm text-gray-600">
            Need to add more modules to your plan? Contact support or{' '}
            <a href="/admin/subscription" className="text-indigo-600 hover:text-indigo-800 font-medium">
              upgrade your subscription
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModulesAdmin;
