import React from 'react';
import { useSubscriptionData, Plan } from '../../features/subscription/hooks/useSubscriptionData';
import api from '../../api/api';
import { useQuery } from '@tanstack/react-query';
import { usePersistedState } from '../../features/core/hooks/usePersistedState';
import { contactSales } from '../../api/subscriptionAdmin';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import PlanCard from '../../features/subscription/components/PlanCard';
import { fetchUsage, fetchTenantModules, overrideModule } from '../../api/subscriptionAdmin';
import { computeModuleDiff } from '../../features/subscription/hooks/useModuleDiff';
import { formatCurrency } from '../../utils/currency';

// Tenant selector state
interface Tenant { id:string; name?:string }

// Provide fallback list inline if endpoint not present yet
const fallbackTenants: Tenant[] = [{ id:'default', name:'Default' }];

export const SubscriptionManagePage: React.FC = () => {
  const [tenantId, setTenantId] = usePersistedState<string>('admin.selectedTenant','default');
  const tenantsQuery = useQuery<Tenant[]>({
    queryKey:['tenants'],
    queryFn: async ()=>{
      try { const { data } = await api.get('/tenants'); return data as Tenant[]; } catch { return fallbackTenants; }
    },
    staleTime: 60_000
  });
  const { tenantSub, plans, changes, assignPlan } = useSubscriptionData(tenantId);
  
  // Usage meters (lightweight; refresh when tenant changes or after plan change)
  const usageQuery = useQuery<{module_key:string; count:number; updated_at:string|null}[]>({
    queryKey:['usageMeters', tenantId],
    queryFn: async ()=> fetchUsage(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000
  });
  
  const modulesQuery = useQuery({
    queryKey:['tenantModules', tenantId],
    queryFn: ()=> fetchTenantModules(tenantId),
    enabled: !!tenantId
  });
  
  const toggleMutation = useMutation({
    mutationFn: async ({key, enable}:{key:string; enable:boolean})=>{
      await overrideModule(tenantId, key, enable);
    },
    onSuccess: ()=>{ modulesQuery.refetch(); usageQuery.refetch(); },
    onError: ()=> toast.error('Failed to update module')
  });

  const [moduleSearch, setModuleSearch] = React.useState('');
  const filteredModules = React.useMemo(()=>{
    const q = moduleSearch.toLowerCase();
    const list = modulesQuery.data||[];
    if(!q) return list;
    return list.filter(m=> m.key.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }, [moduleSearch, modulesQuery.data]);

  const loadingSub = tenantSub.isLoading;
  const loadingPlans = plans.isLoading;
  const loadingChanges = changes.isLoading;
  const planList = plans.data || [];
  const changeList = changes.data || [];

  const currentPlanName = tenantSub.data?.plan?.name?.toLowerCase();
  const rank: Record<string, number> = { starter:0, advanced:1, premium:2 };
  const currentRank = currentPlanName ? rank[currentPlanName] : undefined;

  const actionFor = (p:Plan)=>{
    const lower = p.name.toLowerCase();
    if(lower === currentPlanName) return { label:'Current', disabled:true } as const;
    if(currentRank === undefined) return { label:`Choose ${p.name}`, intent:'choose' } as const;
    if(rank[lower] > currentRank) return { label:`Upgrade to ${p.name}`, intent:'upgrade' } as const;
    if(rank[lower] < currentRank) return { label:`Downgrade to ${p.name}`, intent:'downgrade' } as const;
    return { label:`Choose ${p.name}`, intent:'choose' } as const;
  };

  // Contact Sales Modal State
  const [showContact, setShowContact] = React.useState(false);
  const [contactMsg, setContactMsg] = React.useState('');
  const contactModalRef = React.useRef<HTMLFormElement|null>(null);
  const firstFieldRef = React.useRef<HTMLTextAreaElement|null>(null);
  
  const submitContact = (e: React.FormEvent) => {
    e.preventDefault();
    if(!contactMsg.trim()) return;
    contactMutation.mutate(contactMsg.trim());
  };
  
  const contactMutation = useMutation({
    mutationFn: async (msg:string)=>{ await contactSales(tenantId, msg); },
    onSuccess: ()=>{ toast.success('Request sent'); setShowContact(false); setContactMsg(''); },
    onError: (err:unknown)=> {
      if(axios.isAxiosError(err) && err.response?.status===429) {
        toast.error('Please wait a minute before sending another request');
      } else if(axios.isAxiosError(err) && err.response?.status===400) {
        toast.error('Message required');
      } else {
        toast.error('Failed to send request');
      }
    }
  });

  // Focus management for modal
  React.useEffect(()=>{
    if(showContact){
      setTimeout(()=> firstFieldRef.current?.focus(), 0);
    }
  }, [showContact]);

  // Basic focus trap when modal open
  React.useEffect(()=>{
    function handleKey(e:KeyboardEvent){
      if(!showContact) return;
      if(e.key==='Escape') { e.preventDefault(); if(!contactMutation.isPending) setShowContact(false); }
      if(e.key==='Tab' && contactModalRef.current){
        const focusable = contactModalRef.current.querySelectorAll<HTMLElement>('textarea,button');
        if(focusable.length===0) return;
        const first = focusable[0];
        const last = focusable[focusable.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener('keydown', handleKey);
    return ()=> window.removeEventListener('keydown', handleKey);
  }, [showContact, contactMutation.isPending]);

  // Announce plan change success via hidden live region
  const [liveMsg, setLiveMsg] = React.useState('');
  React.useEffect(()=>{
    if(assignPlan.isSuccess) setLiveMsg('Subscription plan updated');
  }, [assignPlan.isSuccess]);

  // Plan change confirm modal state
  const [pendingPlan, setPendingPlan] = React.useState<Plan|null>(null);
  const closePending = ()=>{ if(!assignPlan.isPending) setPendingPlan(null); };
  const confirmChange = ()=>{ if(pendingPlan) assignPlan.mutate(pendingPlan.id); };

  const diff = React.useMemo(()=>{
    if(!pendingPlan) return { gained:[], lost:[] };
    return computeModuleDiff(tenantSub.data?.active_modules, pendingPlan);
  }, [pendingPlan, tenantSub.data?.active_modules]);

  const currentPrice = tenantSub.data?.plan?.price_cents || 0;
  const newPrice = pendingPlan?.price_cents || 0;
  const priceDelta = newPrice - currentPrice;

  // View mode: plan cards vs comparison matrix
  const [viewMode, setViewMode] = React.useState<'cards'|'matrix'>('cards');
  const planArray = planList;
  const allModulesAcrossPlans = React.useMemo(()=>{
    const s = new Set<string>();
    planArray.forEach(p=> p.modules.forEach(m=> s.add(m)));
    return Array.from(s).sort();
  }, [planArray]);

  // Annual billing toggle (front-end simulation: yearly = monthly * 10)
  const [annualBilling, setAnnualBilling] = React.useState(false);
  const displayPrice = (cents:number)=> annualBilling ? cents*10 : cents;
  const displaySuffix = annualBilling ? '/yr' : '/mo';

  // Naive proration preview (placeholder: assumes 50% cycle remaining)
  const prorationPreview = React.useMemo(()=>{
    if(!pendingPlan || !tenantSub.data?.plan) return null;
    if(pendingPlan.id === tenantSub.data.plan.id) return null;
    const remainingPortion = 0.5;
    const credit = tenantSub.data.plan.price_cents * remainingPortion;
    const charge = pendingPlan.price_cents * remainingPortion;
    return { credit, charge, diff: charge - credit };
  }, [pendingPlan, tenantSub.data?.plan]);

  // Module category filtering + bulk selection for overrides
  const [moduleCategory, setModuleCategory] = React.useState('');
  const categories = React.useMemo(()=>{
    const s = new Set<string>();
    modulesQuery.data?.forEach(m=> s.add(m.category));
    return Array.from(s).sort();
  }, [modulesQuery.data]);
  
  const [selectedModuleKeys, setSelectedModuleKeys] = React.useState<string[]>([]);
  const toggleSelectModule = (k:string)=> setSelectedModuleKeys(prev=> prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
  const clearSelection = ()=> setSelectedModuleKeys([]);
  
  const bulkEnable = (enable:boolean)=> {
    const keys = [...selectedModuleKeys];
    const run = async()=> {
      for(const k of keys){
        try { await overrideModule(tenantId, k, enable); } catch {/* ignore individual errors */}
      }
      modulesQuery.refetch(); usageQuery.refetch(); clearSelection();
    };
    run();
  };

  // Export audit changes as JSON
  const exportChanges = ()=> {
    if(!changeList.length) return;
    const blob = new Blob([JSON.stringify(changeList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `subscription_changes_${tenantId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
                <p className="text-gray-600 mt-1">Manage plans, modules, and billing for your organization</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <select 
                  value={tenantId} 
                  onChange={e=>setTenantId(e.target.value)} 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]"
                >
                  {(tenantsQuery.data||fallbackTenants).map(t=> <option key={t.id} value={t.id}>{t.name||t.id}</option>)}
                </select>
                {tenantsQuery.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    Loading...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="sr-only">{liveMsg}</div>
        
        {/* Current Subscription Status */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
            {loadingSub ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                <span className="text-gray-600">Loading subscription details...</span>
              </div>
            ) : tenantSub.isError ? (
              <div className="flex items-center gap-3 text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>Failed to load subscription details</span>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Plan</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {tenantSub.data?.plan?.name || 'No plan selected'}
                  </div>
                  {tenantSub.data?.plan && (
                    <div className="text-sm text-gray-600 mt-1">
                      {tenantSub.data.plan.price_cents > 0 ? (
                        `${formatCurrency(tenantSub.data.plan.price_cents, 'ZAR')}/month`
                      ) : (
                        'Free'
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-2">Active Modules</div>
                  <div className="flex flex-wrap gap-2">
                    {tenantSub.data?.active_modules?.map(m=> {
                      const meter = usageQuery.data?.find(u=>u.module_key===m);
                      return (
                        <span key={m} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                          {m}
                          {meter && <span className="ml-1 text-xs text-green-600">({meter.count})</span>}
                        </span>
                      );
                    })}
                    {(!tenantSub.data?.active_modules?.length && !loadingSub) && (
                      <span className="text-sm text-gray-500 italic">No active modules</span>
                    )}
                  </div>
                  {usageQuery.isError && (
                    <div className="text-sm text-red-600 mt-2">Failed to load usage data</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Plan Selection Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>
                  <p className="text-gray-600 mt-1">Select the plan that best fits your organization's needs</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button 
                      onClick={()=>setViewMode('cards')} 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        viewMode==='cards'
                          ?'bg-white text-gray-900 shadow-sm'
                          :'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Cards
                    </button>
                    <button 
                      onClick={()=>setViewMode('matrix')} 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        viewMode==='matrix'
                          ?'bg-white text-gray-900 shadow-sm'
                          :'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Compare
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={annualBilling} 
                      onChange={e=>setAnnualBilling(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    /> 
                    <span className="text-sm text-gray-700">Annual billing</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6">
              {viewMode === 'cards' && (
                <div>
                  {loadingPlans ? (
                    <div className="grid md:grid-cols-3 gap-6">
                      <PlanSkeletons />
                    </div>
                  ) : plans.isError ? (
                    <div className="text-center py-12">
                      <div className="text-red-500 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load plans</h3>
                      <p className="text-gray-600">Please try refreshing the page or contact support if the problem persists.</p>
                    </div>
                  ) : planList.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No plans available</h3>
                      <p className="text-gray-600">Contact your administrator to set up subscription plans.</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-6">
                      {planList.map(p=> {
                        const action = actionFor(p);
                        const isCurrent = action.label === 'Current';
                        const overriddenOff = modulesQuery.data?.filter(m=> m.override===false && p.modules.includes(m.key)).map(m=>m.key) || [];
                        return (
                          <PlanCard
                            key={p.id}
                            plan={p}
                            current={isCurrent}
                            intent={action.intent|| (isCurrent?'current':'choose')}
                            recommended={!isCurrent && p.name.toLowerCase()==='advanced'}
                            loadingAssign={assignPlan.isPending}
                            activeModules={tenantSub.data?.active_modules}
                            premiumContact={()=> setShowContact(true)}
                            overriddenOff={overriddenOff}
                            onSelect={!isCurrent ? ()=> setPendingPlan(p) : undefined}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'matrix' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-4 px-4 font-semibold text-gray-900">Module</th>
                        {planArray.map(p=> (
                          <th key={p.id} className="py-4 px-4 text-left min-w-[140px]">
                            <div className="font-semibold text-gray-900">{p.name}</div>
                            <div className="text-sm text-gray-500 mt-1">
                              {p.price_cents>0? formatCurrency(displayPrice(p.price_cents),'ZAR')+displaySuffix:'Free'}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allModulesAcrossPlans.map(m=> (
                        <tr key={m} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{m}</td>
                          {planArray.map(p=> {
                            const included = p.modules.includes(m);
                            const overridden = modulesQuery.data?.some(r=> r.key===m && r.override===false && p.modules.includes(m));
                            return (
                              <td key={p.id} className="py-3 px-4">
                                {included ? (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    overridden 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {overridden ? 'Override Off' : 'Included'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module Management Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Module Management</h2>
                  <p className="text-gray-600 mt-1">Override module access and manage permissions</p>
                </div>
                <button 
                  onClick={exportChanges} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={!changeList.length}
                >
                  Export Changes
                </button>
              </div>
            </div>

            <div className="p-6">
              {modulesQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span className="text-gray-600">Loading modules...</span>
                  </div>
                </div>
              ) : modulesQuery.isError ? (
                <div className="text-center py-12">
                  <div className="text-red-500 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load modules</h3>
                  <p className="text-gray-600">Please try refreshing the page.</p>
                </div>
              ) : (
                <div>
                  {/* Filters */}
                  <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <input 
                        value={moduleSearch} 
                        onChange={e=>setModuleSearch(e.target.value)} 
                        placeholder="Search modules..." 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        aria-label="Search modules" 
                      />
                    </div>
                    <select 
                      value={moduleCategory} 
                      onChange={e=>setModuleCategory(e.target.value)} 
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]" 
                      aria-label="Filter by category"
                    >
                      <option value="">All categories</option>
                      {categories.map(c=> <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="text-sm text-gray-500 px-3 py-2">
                      {filteredModules.length} of {modulesQuery.data?.length || 0} modules
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  {selectedModuleKeys.length > 0 && (
                    <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-indigo-700">
                          {selectedModuleKeys.length} module{selectedModuleKeys.length > 1 ? 's' : ''} selected
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={()=>bulkEnable(true)} 
                            className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            Enable Selected
                          </button>
                          <button 
                            onClick={()=>{ 
                              if(window.confirm('Disable selected modules?')) bulkEnable(false); 
                            }} 
                            className="px-3 py-1 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700"
                          >
                            Disable Selected
                          </button>
                          <button 
                            onClick={clearSelection} 
                            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modules Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input 
                              type="checkbox" 
                              aria-label="Select all modules" 
                              checked={filteredModules.length > 0 && selectedModuleKeys.length === filteredModules.length} 
                              onChange={e=>{ 
                                if(e.target.checked) setSelectedModuleKeys(filteredModules.map(m=>m.key)); 
                                else clearSelection(); 
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Module</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Category</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">In Plan</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Override</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredModules.map(m=>{
                          const busy = toggleMutation.isPending;
                          const eff = m.effective;
                          return (
                            <tr key={m.key} className="hover:bg-gray-50">
                              <td className="px-4 py-4">
                                <input 
                                  type="checkbox" 
                                  aria-label={`Select ${m.name}`} 
                                  checked={selectedModuleKeys.includes(m.key)} 
                                  onChange={()=>toggleSelectModule(m.key)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <div className="font-medium text-gray-900">{m.name}</div>
                                <div className="text-sm text-gray-500">{m.key}</div>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-600">{m.category}</td>
                              <td className="px-4 py-4">
                                {m.in_plan ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Included
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Add-on
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {eff ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-600">
                                {m.override === null ? '—' : m.override ? 'Enabled' : 'Disabled'}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    disabled={busy || eff}
                                    onClick={()=> toggleMutation.mutate({key:m.key, enable:true})}
                                    className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Enable ${m.name}`}
                                  >
                                    Enable
                                  </button>
                                  <button
                                    disabled={busy || !eff}
                                    onClick={()=> {
                                      if(m.in_plan && !window.confirm('This module is included in your current plan. Disabling may remove functionality. Continue?')) return;
                                      toggleMutation.mutate({key:m.key, enable:false});
                                    }}
                                    className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Disable ${m.name}`}
                                  >
                                    Disable
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredModules.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No modules found</h3>
                      <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Changes Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Recent Changes</h2>
              <p className="text-gray-600 mt-1">Track subscription and module modifications</p>
            </div>
            <div className="p-6">
              {loadingChanges ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    <span className="text-gray-600">Loading changes...</span>
                  </div>
                </div>
              ) : changes.isError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">Failed to load recent changes</p>
                </div>
              ) : changeList.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-600">No recent changes to display</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-auto">
                  {changeList.map((c,i)=> (
                    <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{c.action}</div>
                        <div className="text-sm text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Sales Modal */}
        {showContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-sales-title">
            <form 
              ref={contactModalRef} 
              onSubmit={submitContact} 
              className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
            >
              <h3 id="contact-sales-title" className="text-lg font-semibold text-gray-900">Contact Sales</h3>
              <p className="text-sm text-gray-600">Get in touch with our sales team to discuss premium features and custom pricing.</p>
              
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea 
                  id="contact-message"
                  ref={firstFieldRef} 
                  value={contactMsg} 
                  onChange={e=>setContactMsg(e.target.value)} 
                  required 
                  placeholder="Describe your needs and requirements..." 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" 
                  rows={4}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={()=>!contactMutation.isPending && setShowContact(false)} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" 
                  disabled={contactMutation.isPending}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={contactMutation.isPending || !contactMsg.trim()} 
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {contactMutation.isPending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {contactMutation.isPending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plan Change Confirmation Modal */}
        {pendingPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="plan-change-title">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-6">
              <div>
                <h3 id="plan-change-title" className="text-lg font-semibold text-gray-900">
                  Confirm Plan {pendingPlan.name.toLowerCase() === tenantSub.data?.plan?.name?.toLowerCase() ? 'Selection' : 'Change'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Review the changes before confirming your new plan.</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Current Plan:</span>
                  <span className="text-sm text-gray-900">
                    {tenantSub.data?.plan?.name || 'None'}
                    {tenantSub.data?.plan && tenantSub.data.plan.price_cents > 0 && (
                      <span className="text-gray-500 ml-1">
                        ({formatCurrency(tenantSub.data.plan.price_cents, 'ZAR')}/mo)
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">New Plan:</span>
                  <span className="text-sm text-gray-900">
                    {pendingPlan.name}
                    {pendingPlan.price_cents > 0 && (
                      <span className="text-gray-500 ml-1">
                        ({formatCurrency(pendingPlan.price_cents, 'ZAR')}/mo)
                      </span>
                    )}
                  </span>
                </div>

                {priceDelta !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Monthly Change:</span>
                    <span className={`text-sm font-medium ${priceDelta > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {priceDelta > 0 ? '+' : ''}{formatCurrency(priceDelta, 'ZAR')}
                    </span>
                  </div>
                )}

                {(diff.gained.length > 0 || diff.lost.length > 0) && (
                  <div className="border-t border-gray-200 pt-3">
                    {diff.gained.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-green-700 mb-1">Modules Added:</div>
                        <div className="text-xs text-green-600">{diff.gained.join(', ')}</div>
                      </div>
                    )}
                    {diff.lost.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-amber-700 mb-1">Modules Removed:</div>
                        <div className="text-xs text-amber-600">{diff.lost.join(', ')}</div>
                      </div>
                    )}
                  </div>
                )}

                {prorationPreview && (
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">Estimated Proration (Demo)</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Credit:</span>
                        <span>{formatCurrency(prorationPreview.credit, 'ZAR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Charge:</span>
                        <span>{formatCurrency(prorationPreview.charge, 'ZAR')}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Net:</span>
                        <span className={prorationPreview.diff > 0 ? 'text-green-600' : prorationPreview.diff < 0 ? 'text-amber-600' : 'text-gray-700'}>
                          {prorationPreview.diff > 0 ? '+' : ''}{formatCurrency(prorationPreview.diff, 'ZAR')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {diff.lost.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm text-amber-800">
                    ⚠️ You will lose access to the highlighted modules immediately upon plan change.
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button 
                  onClick={closePending} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" 
                  disabled={assignPlan.isPending}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmChange} 
                  disabled={assignPlan.isPending} 
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                    priceDelta > 0 
                      ? 'bg-indigo-600 hover:bg-indigo-700' 
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {assignPlan.isPending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {assignPlan.isPending 
                    ? 'Applying...' 
                    : priceDelta > 0 
                      ? 'Confirm Upgrade' 
                      : priceDelta < 0 
                        ? 'Confirm Downgrade' 
                        : 'Confirm'
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Skeleton Loading Components
const PlanSkeletons: React.FC = () => {
  return (
    <>
      {[1,2,3].map(i=> (
        <div key={i} className="border border-gray-200 rounded-xl p-6 animate-pulse">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-5/6"></div>
              <div className="h-3 bg-gray-100 rounded w-4/6"></div>
            </div>
            <div className="h-9 bg-gray-200 rounded w-full mt-6"></div>
          </div>
        </div>
      ))}
    </>
  );
};

export default SubscriptionManagePage;
