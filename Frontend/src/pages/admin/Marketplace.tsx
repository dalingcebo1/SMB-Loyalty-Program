import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import api from '../../api/api';
import PageLayout from '../../components/PageLayout';
import { HiShoppingBag, HiCheck, HiPlus } from 'react-icons/hi';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useTenantConfig } from '../../config/useTenantConfig';

interface ModuleDef {
  key: string;
  name: string;
  category: string;
  description: string;
  is_addon: boolean;
}

interface SubscriptionStatus {
  plan: {
    id: number;
    name: string;
  };
  active_modules: string[];
  status: string;
}

const Marketplace: React.FC = () => {
  const { user } = useAuth();
  const { refresh } = useTenantConfig();
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Define module categories for permission checks
  const CORE_MODULES = ['core', 'loyalty', 'analytics'];
  const VERTICAL_MODULES = ['carwash', 'retail', 'dispensary'];
  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!user?.tenant_id) return;
    
    const fetchData = async () => {
      try {
        const [modsRes, subRes] = await Promise.all([
          api.get<ModuleDef[]>('/subscriptions/modules'),
          api.get<SubscriptionStatus>(`/subscriptions/tenants/${user.tenant_id}`)
        ]);
        setModules(modsRes.data);
        setSubStatus(subRes.data);
      } catch {
        toast.error('Failed to load modules');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user?.tenant_id]);

  const handleToggle = async (moduleKey: string, currentState: boolean) => {
    if (!user?.tenant_id) return;
    setProcessing(moduleKey);
    try {
      await api.post(`/subscriptions/tenants/${user.tenant_id}/override`, {
        module_key: moduleKey,
        enabled: !currentState
      });
      
      // Refresh local state
      const subRes = await api.get<SubscriptionStatus>(`/subscriptions/tenants/${user.tenant_id}`);
      setSubStatus(subRes.data);
      
      // Refresh global tenant config (feature flags)
      refresh();
      
      toast.success(currentState ? 'Module disabled' : 'Module enabled');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to update module';
      if (err?.response?.status === 403) {
        toast.error(`Permission denied: ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <PageLayout loading>{null}</PageLayout>;

  // Group modules by category
  const grouped = modules.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, ModuleDef[]>);

  const isActive = (key: string) => subStatus?.active_modules.includes(key);

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <HiShoppingBag className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
              <p className="text-gray-600">
                Current Plan: <span className="font-semibold text-purple-600">{subStatus?.plan.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        {Object.entries(grouped).map(([category, mods]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 ml-1">{category}</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {mods.map(mod => {
                const active = isActive(mod.key);
                
                return (
                  <div key={mod.key} className={`bg-white border rounded-xl p-5 flex flex-col h-full transition-shadow hover:shadow-md ${
                    active ? 'border-purple-200 ring-1 ring-purple-100' : 'border-gray-200'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{mod.name}</h3>
                        {active ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <HiCheck className="w-3 h-3 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Available
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{mod.description || 'No description available.'}</p>
                    </div>

                    <div className="pt-4 border-t border-gray-50 mt-auto">
                      {/* Action Button with Permission Checks */}
                      {(() => {
                        const isCoreModule = CORE_MODULES.includes(mod.key);
                        const isVerticalModule = VERTICAL_MODULES.includes(mod.key);
                        const canToggle = !isCoreModule && (!isVerticalModule || isSuperAdmin);
                        
                        if (isCoreModule) {
                          return (
                            <div className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 text-center">
                              Core Module (Always Active)
                            </div>
                          );
                        }

                        if (isVerticalModule && !isSuperAdmin) {
                          return (
                            <div className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 text-center">
                              Requires Super Admin
                            </div>
                          );
                        }

                        return (
                          <button
                            onClick={() => handleToggle(mod.key, !!active)}
                            disabled={!canToggle || processing === mod.key}
                            className={`w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              active
                                ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {processing === mod.key ? (
                              <LoadingSpinner size="sm" color={active ? 'blue' : 'white'} />
                            ) : active ? (
                              <>Disable Module</>
                            ) : (
                              <>
                                <HiPlus className="w-4 h-4 mr-1" /> Enable Module
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
};

export default Marketplace;
