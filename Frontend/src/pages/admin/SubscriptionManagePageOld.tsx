import React from 'react';
// formatCurrency no longer needed directly; PlanCard handles display
// Auth already enforced by route guard; no direct need to consume user context here.
import { useSubscriptionData, Plan } from '../../features/subscription/hooks/useSubscriptionData';
import api from '../../api/api';
import { useQuery } from '@tanstack/react-query';
import { usePersistedState } from '../../features/core/hooks/usePersistedState';
// computeModuleDiff handled inside PlanCard
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

  // Announce plan change success via hidden live region (React Query toasts already exist but this aids screen readers without toast region)
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
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <header className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
              <p className="text-gray-600 mt-1">Manage plans, modules, and billing for your organization</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Tenant</label>
              <select 
                value={tenantId} 
                onChange={e=>setTenantId(e.target.value)} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {(tenantsQuery.data||fallbackTenants).map(t=> <option key={t.id} value={t.id}>{t.name||t.id}</option>)}
              </select>
              {tenantsQuery.isLoading && <span className="text-sm text-gray-500">Loading...</span>}
            </div>
          </div>
        </header>

        <div aria-live="polite" className="sr-only">{liveMsg}</div>
        
        {/* Plan Selection Section */}
        <section className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>
                <p className="text-gray-600 mt-1">Select the plan that best fits your organization's needs</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={()=>setViewMode('cards')} 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode==='cards'?'bg-white text-gray-900 shadow-sm':'text-gray-600 hover:text-gray-900'}`}
                  >
                    Cards
                  </button>
                  <button 
                    onClick={()=>setViewMode('matrix')} 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode==='matrix'?'bg-white text-gray-900 shadow-sm':'text-gray-600 hover:text-gray-900'}`}
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
                <button 
                  onClick={exportChanges} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={!changeList.length}
                >
                  Export Changes
                </button>
              </div>
            </div>
          </div>

          </div>

          {viewMode==='cards' && (
            <div className="p-6">
              {loadingPlans ? (
                <div className="grid md:grid-cols-3 gap-6">
                  <PlanSkeletons />
                </div>
              ) : plans.isError ? (
                <div className="text-center py-12">
                  <div className="text-red-500 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">Failed to load plans. Please try again.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {planList.map(p=> {
                    const action = actionFor(p);
                    const isCurrent = action.label === 'Current';
                    const overriddenOff = modulesQuery.data?.filter(m=> m.override===false && p.modules.includes(m.key)).map(m=>m.key) || [];
                    return <PlanCard
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
                    />;
                  })}
                </div>
              )}
            </div>
          )}
          {viewMode==='matrix' && (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-gray-900">Module</th>
                      {planArray.map(p=> (
                        <th key={p.id} className="py-4 px-4 text-left">
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
            </div>
          )}
        </section>

      <section>
        <h3 className="font-semibold mb-2 flex items-center gap-3">Active Modules {usageQuery.isFetching && <span className="text-[10px] text-gray-400 animate-pulse">updating usage…</span>}</h3>
  {loadingSub && <p className="text-sm animate-pulse">Loading subscription…</p>}
  {tenantSub.isError && !loadingSub && <p className="text-xs text-red-600">Failed to load subscription.</p>}
        <div className="flex flex-wrap gap-2">
          {tenantSub.data?.active_modules?.map(m=> {
            const meter = usageQuery.data?.find(u=>u.module_key===m);
            return <span key={m} className="text-[11px] bg-gray-200 px-2 py-1 rounded inline-flex items-center gap-1">
              <span>{m}</span>
              {meter && <span className="text-[10px] text-gray-600">{meter.count}</span>}
            </span>;
          })}
          {!tenantSub.data?.active_modules?.length && !loadingSub && <span className="text-xs text-gray-500">None</span>}
          {usageQuery.isError && <span className="text-[10px] text-red-500">Usage failed</span>}
        </div>
        <div className="mt-4">
          <h4 className="text-xs font-semibold mb-1 flex items-center gap-2">Module Overrides <span className="text-[10px] text-gray-400">(advanced)</span></h4>
          {modulesQuery.isLoading && <p className="text-[11px] text-gray-500">Loading modules…</p>}
          {modulesQuery.isError && <p className="text-[11px] text-red-600">Failed to load modules.</p>}
          {modulesQuery.data && (
            <div className="overflow-x-auto border rounded bg-white">
              <div className="p-2 flex flex-wrap gap-2 items-center">
                <input value={moduleSearch} onChange={e=>setModuleSearch(e.target.value)} placeholder="Search modules" className="text-[11px] border rounded px-2 py-1" aria-label="Search modules" />
                <select value={moduleCategory} onChange={e=>setModuleCategory(e.target.value)} className="text-[11px] border rounded px-2 py-1" aria-label="Filter category">
                  <option value="">All categories</option>
                  {categories.map(c=> <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-[10px] text-gray-500">{filteredModules.length} / {modulesQuery.data.length}</span>
                {selectedModuleKeys.length>0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] text-gray-600">{selectedModuleKeys.length} selected</span>
                    <button onClick={()=>bulkEnable(true)} className="px-2 py-0.5 text-[10px] border rounded bg-green-600 text-white hover:bg-green-700">Enable</button>
                    <button onClick={()=>{ if(!window.confirm('Disable selected modules?')) return; bulkEnable(false); }} className="px-2 py-0.5 text-[10px] border rounded bg-amber-600 text-white hover:bg-amber-700">Disable</button>
                    <button onClick={clearSelection} className="px-2 py-0.5 text-[10px] border rounded hover:bg-gray-50">Clear</button>
                  </div>
                )}
              </div>
              <table className="min-w-full text-[11px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1"><input type="checkbox" aria-label="Select all" checked={filteredModules.length>0 && selectedModuleKeys.length===filteredModules.length} onChange={e=>{ if(e.target.checked) setSelectedModuleKeys(filteredModules.map(m=>m.key)); else clearSelection(); }} /></th>
                    <th className="text-left px-2 py-1 font-medium">Module</th>
                    <th className="text-left px-2 py-1 font-medium">Category</th>
                    <th className="text-left px-2 py-1 font-medium">In Plan</th>
                    <th className="text-left px-2 py-1 font-medium">Effective</th>
                    <th className="text-left px-2 py-1 font-medium">Override</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map(m=>{
                    const busy = toggleMutation.isPending;
                    const eff = m.effective;
                    return (
                      <tr key={m.key} className="border-t">
                        <td className="px-2 py-1"><input type="checkbox" aria-label={`Select ${m.name}`} checked={selectedModuleKeys.includes(m.key)} onChange={()=>toggleSelectModule(m.key)} /></td>
                        <td className="px-2 py-1 whitespace-nowrap font-medium">{m.name}</td>
                        <td className="px-2 py-1">{m.category}</td>
                        <td className="px-2 py-1">{m.in_plan? 'Yes':'No'}</td>
                        <td className="px-2 py-1">{eff? <span className="text-green-600">On</span>:<span className="text-gray-500">Off</span>}</td>
                        <td className="px-2 py-1">{m.override===null? <span className="text-gray-400">—</span>: m.override? 'On':'Off'}</td>
                        <td className="px-2 py-1 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              disabled={busy || eff}
                              onClick={()=> toggleMutation.mutate({key:m.key, enable:true})}
                              className="px-2 py-0.5 rounded border text-[10px] disabled:opacity-40 hover:bg-green-50"
                              aria-label={`Enable ${m.name}`}
                            >Enable</button>
                            <button
                              disabled={busy || !eff}
                              onClick={()=> {
                                if(m.in_plan && !window.confirm('This module is part of the current plan. Disabling may remove included functionality. Continue?')) return;
                                toggleMutation.mutate({key:m.key, enable:false});
                              }}
                              className="px-2 py-0.5 rounded border text-[10px] disabled:opacity-40 hover:bg-amber-50"
                              aria-label={`Disable ${m.name}`}
                            >Disable</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Recent Changes</h3>
  {loadingChanges && <p className="text-sm animate-pulse">Loading changes…</p>}
  {changes.isError && !loadingChanges && <p className="text-xs text-red-600">Failed to load changes.</p>}
        <ul className="space-y-2 text-xs max-h-64 overflow-auto border rounded p-3 bg-white">
          {changeList.map((c,i)=> <li key={i} className="flex gap-2"><span className="font-medium">{c.action}</span><span className="text-gray-500">{new Date(c.created_at).toLocaleString()}</span></li>)}
          {!changeList.length && !loadingChanges && <li className="text-gray-500">No recent changes</li>}
        </ul>
      </section>

      {showContact && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="contact-sales-title">
          <form ref={contactModalRef} onSubmit={submitContact} className="bg-white rounded-md w-full max-w-sm p-5 space-y-4 shadow-lg outline-none" tabIndex={-1}>
            <h4 id="contact-sales-title" className="font-semibold text-sm">Contact Sales (Premium)</h4>
            <textarea ref={firstFieldRef} value={contactMsg} onChange={e=>setContactMsg(e.target.value)} required placeholder="Describe your needs..." className="w-full border rounded p-2 text-xs h-28" aria-label="Message to sales" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={()=>!contactMutation.isPending && setShowContact(false)} className="text-xs px-3 py-1 rounded border" disabled={contactMutation.isPending}>Cancel</button>
              <button type="submit" disabled={contactMutation.isPending || !contactMsg.trim()} className="text-xs px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">{contactMutation.isPending?'Sending…':'Send'}</button>
            </div>
          </form>
        </div>
      )}

      {pendingPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="plan-change-title">
          <div className="bg-white rounded-md w-full max-w-md p-5 space-y-4 shadow-lg text-sm">
            <h4 id="plan-change-title" className="font-semibold">Confirm {pendingPlan.name} {pendingPlan.name.toLowerCase()===tenantSub.data?.plan?.name?.toLowerCase()?'Selection':'Change'}</h4>
            <p className="text-xs text-gray-600">Review differences before applying.</p>
            <div className="border rounded p-3 bg-gray-50 space-y-2">
              <p className="text-xs"><span className="font-medium">Current:</span> {tenantSub.data?.plan?.name || 'None'} {tenantSub.data?.plan && tenantSub.data.plan.price_cents>0 && `(${formatCurrency(tenantSub.data.plan.price_cents,'ZAR')}/mo)`}</p>
              <p className="text-xs"><span className="font-medium">New:</span> {pendingPlan.name} {pendingPlan.price_cents>0 && `(${formatCurrency(pendingPlan.price_cents,'ZAR')}/mo)`}</p>
              {priceDelta!==0 && <p className="text-xs {priceDelta>0?'text-green-700':'text-amber-700'}">Monthly change: {priceDelta>0?'+':''}{formatCurrency(priceDelta,'ZAR')}</p>}
              {(diff.gained.length>0 || diff.lost.length>0) && (
                <div className="text-[11px] space-y-1">
                  {diff.gained.length>0 && <p className="text-green-600">+ {diff.gained.join(', ')}</p>}
                  {diff.lost.length>0 && <p className="text-amber-600">- {diff.lost.join(', ')}</p>}
                </div>
              )}
              {prorationPreview && (
                <div className="text-[10px] mt-2 p-2 bg-white rounded border">
                  <p className="font-medium mb-1">Estimated Proration (demo)</p>
                  <p>Credit: {formatCurrency(prorationPreview.credit,'ZAR')}</p>
                  <p>Charge: {formatCurrency(prorationPreview.charge,'ZAR')}</p>
                  <p>Net: <span className={prorationPreview.diff>0?'text-green-700': prorationPreview.diff<0?'text-amber-700':'text-gray-700'}>{prorationPreview.diff>0?'+':''}{formatCurrency(prorationPreview.diff,'ZAR')}</span></p>
                </div>
              )}
              {diff.lost.length>0 && <p className="text-[10px] text-amber-700">You will lose access to the modules listed in orange immediately.</p>}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closePending} className="text-xs px-3 py-1 rounded border" disabled={assignPlan.isPending}>Cancel</button>
              <button onClick={confirmChange} disabled={assignPlan.isPending} className={`text-xs px-3 py-1 rounded text-white ${priceDelta>0?'bg-indigo-600 hover:bg-indigo-700':'bg-amber-600 hover:bg-amber-700'} disabled:opacity-50`}>{assignPlan.isPending?'Applying…': priceDelta>0 ? 'Confirm Upgrade' : priceDelta<0 ? 'Confirm Downgrade' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
export default SubscriptionManagePage;

// Skeleton cards for loading state
const PlanSkeletons: React.FC = () => {
  return <>
    {[1,2,3].map(i=> <div key={i} className="border rounded-md p-4 animate-pulse space-y-3">
      <div className="h-5 bg-gray-200 rounded w-2/3" />
      <div className="h-3 bg-gray-200 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="space-y-1">
        <div className="h-2 bg-gray-100 rounded w-full" />
        <div className="h-2 bg-gray-100 rounded w-5/6" />
        <div className="h-2 bg-gray-100 rounded w-4/6" />
      </div>
      <div className="h-7 bg-gray-200 rounded w-1/2 mt-4" />
    </div>)}
  </>;
};
