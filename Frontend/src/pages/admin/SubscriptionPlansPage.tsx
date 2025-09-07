import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlans, createPlan, updatePlan, archivePlan, listAllPlans, restorePlan } from '../../api/subscriptionAdmin';
import api from '../../api/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../auth/AuthProvider';
import { formatCurrency } from '../../utils/currency';
import { usePersistedState } from '../../features/core/hooks/usePersistedState';

interface Plan { id:number; name:string; price_cents:number; billing_period:string; modules:string[]; active?:boolean }

export const SubscriptionPlansPage: React.FC = () => {
  const [showArchived, setShowArchived] = useState(false);
  const { data: plans = [] , isLoading } = useQuery<Plan[]>({ queryKey:['plans', showArchived], queryFn: ()=> showArchived ? listAllPlans() : fetchPlans() });
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<{name:string; price_cents:number; billing_period:'monthly'|'annual'; description:string; module_keys:string[]; active?:boolean}>({name:'', price_cents:0, billing_period:'monthly', description:'', module_keys:[], active:true});
  const [tenantId] = usePersistedState<string>('admin.selectedTenant','default');
  const { data: allModules=[] } = useQuery({ queryKey:['allModules'], queryFn: async()=>{ const {data} = await api.get('/subscriptions/modules'); return data as {key:string; name:string; category:string}[]; }});
  const [annual, setAnnual] = useState(false);
  interface TenantSubDetail { plan: { id:number; name:string; price_cents:number; billing_period:string } | null; active_modules: string[] }
  // tenantId already defined above
  const { data: tenantSub } = useQuery<TenantSubDetail>({
    queryKey:['tenantSub', tenantId],
    queryFn: async () => {
      const { data } = await api.get(`/subscriptions/tenants/${tenantId}`, { headers: { 'X-Tenant-ID': tenantId }});
      return data as TenantSubDetail;
    }
  });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const assignMutation = useMutation({
    mutationFn: async (planId:number) => {
      await api.post(`/subscriptions/tenants/${tenantId}/assign-plan`, { plan_id: planId }, { headers: { 'X-Tenant-ID': tenantId }});
    },
    onSuccess: ()=> { 
      toast.success('Plan updated'); 
      queryClient.invalidateQueries({queryKey:['plans']});
      queryClient.invalidateQueries({queryKey:['tenantSub', tenantId]});
    },
    onError: (e:unknown)=> {
      interface ErrorData { detail?: string }
      interface ErrorResp { data?: ErrorData }
      interface MaybeAxiosError { response?: ErrorResp }
      const maybe = e as MaybeAxiosError;
      const msg = maybe?.response?.data?.detail || 'Failed to assign plan';
      toast.error(msg);
    }
  });

  const planCreateMutation = useMutation({
    mutationFn: async ()=> {
      if(editing){
        await updatePlan(editing.id, form);
      } else {
        await createPlan(form);
      }
    },
    onSuccess: ()=> {
      toast.success(editing? 'Plan updated':'Plan created');
      setShowEditor(false); setEditing(null);
      queryClient.invalidateQueries({queryKey:['plans']});
    },
    onError: ()=> toast.error('Failed to save plan')
  });

  function openCreate(){
    setEditing(null);
    setForm({name:'', price_cents:0, billing_period:'monthly', description:'', module_keys:[], active:true});
    setShowEditor(true);
  }
  function openEdit(p:Plan){
    setEditing(p);
    const bp = p.billing_period === 'annual' ? 'annual' : 'monthly';
    // Plan interface currently omits active; treat unknown as true.
    setForm({name:p.name, price_cents:p.price_cents, billing_period:bp, description:'', module_keys:p.modules, active: p.active ?? true});
    setShowEditor(true);
  }
  function toggleModule(key:string){
    setForm(f=> ({...f, module_keys: f.module_keys.includes(key)? f.module_keys.filter(k=>k!==key): [...f.module_keys, key]}));
  }

  const marketingMatrix = useMemo(()=>{
    const byName = Object.fromEntries(plans.map(p=>[p.name.toLowerCase(), p]));
    const starter = byName['starter'];
    const advanced = byName['advanced'];
    const premium = byName['premium'];
    return { starter, advanced, premium };
  },[plans]);

  const FEATURE_ROWS: { label:string; starter:string[]; advanced:string[]; premium:string[] }[] = [
    { label:'Loyalty program', starter:['Basic Managed Customer Loyalty Program'], advanced:['Advanced Managed Customer Loyalty Program','Referral benefits'], premium:['Custom Loyalty program','Referral benefits'] },
    { label:'Loyalty Type', starter:['Basic rewards (milestone)'], advanced:['Stack rewards'], premium:['Enhance rewards'] },
    { label:'Marketing', starter:['One newsletter per month','Targeted Marketing Once per Month','Automated Loyalty'], advanced:['Up to 3 newsletters','AI Based Targeted Marketing (pattern recognition)','Automated Loyalty'], premium:['Unlimited newsletters','Google SEO & Adverts','Push Notifications','Unlimited advanced targeted marketing','Loyalty integration facilitation'] },
    { label:'Payments (2.9% ex VAT charge)', starter:['Client WebApp','Integrated payments'], advanced:['Client Webapp','Custom integration into POS'], premium:['Client Webapp','Complex integration into POS & CRM tools'] },
  ];

  function monthlyCentsDisplay(p: Plan){
    // If annual toggle is on, apply a simple industry convention: 2 months free (~16.7% off)
    const cents = annual ? Math.round(p.price_cents * 10) : p.price_cents; // pay 10 months
    return formatCurrency(cents, 'ZAR') + (annual ? ' / year (2 mo free)' : ' / month');
  }
  function priceCell(p:Plan|null|undefined, fallback:string='—'){
    if(!p) return fallback;
    const base = p.price_cents>0 ? monthlyCentsDisplay(p) : 'Free';
    if(p.active === false){
      return <span className="text-gray-400 line-through" title="Archived plan">{base}</span>;
    }
    return base;
  }

  const currentPlanName = tenantSub?.plan?.name?.toLowerCase();
  const rank: Record<string, number> = { starter: 0, advanced: 1, premium: 2 };
  const currentRank = currentPlanName ? rank[currentPlanName] : undefined;

  function renderActionButton(plan: Plan | undefined | null){
    if(!plan) return null;
    if(plan.active === false){
      return <span className="flex flex-col items-center gap-1">
        <span className="inline-block px-2 py-1 rounded bg-gray-400 text-white text-[10px]">Archived</span>
        <button onClick={()=>openEdit(plan)} className="text-[10px] underline text-gray-600">Manage</button>
      </span>;
    }
    const nameLower = plan.name.toLowerCase();
    if(currentPlanName === nameLower){
      return <span className="inline-block px-3 py-1 rounded bg-green-600 text-white text-xs">Current Plan</span>;
    }
    let intent: 'upgrade' | 'downgrade' | 'choose' = 'choose';
    if(currentRank !== undefined){
      if(rank[nameLower] > currentRank) intent = 'upgrade';
      else if(rank[nameLower] < currentRank) intent = 'downgrade';
      else intent = 'choose';
    }
  const price = plan.price_cents>0 ? (annual? formatCurrency(Math.round(plan.price_cents*10),'ZAR') + ' / year' : formatCurrency(plan.price_cents,'ZAR') + ' / month') : 'Free';
  const text = intent === 'choose' ? `Choose ${plan.name} • ${price}` : `${intent === 'upgrade' ? 'Upgrade to' : 'Downgrade to'} ${plan.name} • ${price}`;
    const colors = intent === 'downgrade' ? 'bg-amber-600 hover:bg-amber-700' : intent === 'upgrade' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700';
    const onClick = () => {
      if(intent === 'downgrade' && !window.confirm(`Downgrade to ${plan.name}? Some advanced features will be disabled.`)) return;
      assignMutation.mutate(plan.id);
    };
    return <button
      onClick={onClick}
      disabled={assignMutation.isPending}
      className={`px-3 py-1 rounded text-white text-xs transition-colors ${colors} disabled:opacity-50`}
      aria-label={text}
    >{assignMutation.isPending ? 'Saving...' : text}</button>;
  }

  return <div className="p-6 space-y-6">
    <div className="flex justify-end">
      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={showArchived} onChange={e=> setShowArchived(e.target.checked)} /> Show archived</label>
        <button onClick={openCreate} className="px-3 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700">New Plan</button>
      </div>
    </div>
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-bold">Plans & Pricing</h2>
        <p className="text-sm text-gray-600">Compare features across Starter, Advanced and Premium tiers.</p>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
        <input type="checkbox" className="accent-indigo-600" checked={annual} onChange={e=>setAnnual(e.target.checked)} aria-label="Toggle annual billing" />
        <span>{annual ? 'Annual Billing (2 months free)' : 'Monthly Billing'}</span>
      </label>
    </div>
    {isLoading && <p className="text-sm">Loading plans…</p>}
    <div className="overflow-x-auto border rounded-lg shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-purple-700 text-white text-left">
            <th className="p-4 w-52">&nbsp;</th>
            <th className="p-4 text-center font-semibold">Starter</th>
            <th className="p-4 text-center font-semibold">Advanced</th>
            <th className="p-4 text-center font-semibold">Premium</th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_ROWS.map(r=> (
            <tr key={r.label} className="align-top border-b last:border-b-0">
              <td className="p-4 font-medium text-gray-700 bg-gray-50">{r.label}</td>
              <td className="p-4">
                <ul className="list-disc ml-5 space-y-1">{r.starter.map(f=> <li key={f}>{f}</li>)}</ul>
              </td>
              <td className="p-4">
                <ul className="list-disc ml-5 space-y-1">{r.advanced.map(f=> <li key={f}>{f}</li>)}</ul>
              </td>
              <td className="p-4">
                <ul className="list-disc ml-5 space-y-1">{r.premium.map(f=> <li key={f}>{f}</li>)}</ul>
              </td>
            </tr>
          ))}
          <tr className="bg-purple-700 text-white text-center text-sm font-semibold">
            <td className="p-4 text-left">Pricing</td>
            <td className="p-4">{priceCell(marketingMatrix.starter,'R1000 per month')}</td>
            <td className="p-4">{priceCell(marketingMatrix.advanced,'R1500 per month')}</td>
            <td className="p-4">{marketingMatrix.premium ? priceCell(marketingMatrix.premium) : 'Contact us for an enterprise solution'}</td>
          </tr>
          {user && (
            <tr className="bg-gray-100">
              <td className="p-4 text-left font-medium">Plan Action</td>
              <td className="p-4 space-y-2">
                {renderActionButton(marketingMatrix.starter)}
                {marketingMatrix.starter && <button onClick={()=>openEdit(marketingMatrix.starter!)} className="mt-1 block w-full text-[10px] px-2 py-1 rounded border bg-white hover:bg-gray-50">Edit</button>}
              </td>
              <td className="p-4 space-y-2">
                {renderActionButton(marketingMatrix.advanced)}
                {marketingMatrix.advanced && <button onClick={()=>openEdit(marketingMatrix.advanced!)} className="mt-1 block w-full text-[10px] px-2 py-1 rounded border bg-white hover:bg-gray-50">Edit</button>}
              </td>
              <td className="p-4 space-y-2">
                {renderActionButton(marketingMatrix.premium)}
                {marketingMatrix.premium && <button onClick={()=>openEdit(marketingMatrix.premium!)} className="mt-1 block w-full text-[10px] px-2 py-1 rounded border bg-white hover:bg-gray-50">Edit</button>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <p className="text-xs text-gray-500">Pricing shown excludes VAT where applicable. Enterprise / Premium advanced integrations may require scoping.</p>
    {showEditor && (
      <div className="fixed inset-0 bg-black/40 flex items-start md:items-center justify-center z-50" onClick={()=> setShowEditor(false)}>
        <div className="bg-white w-full md:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-xl" onClick={e=> e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editing? 'Edit plan':'Create plan'}>
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editing? 'Edit Plan':'Create Plan'}</h3>
            <button onClick={()=> setShowEditor(false)} className="p-2 rounded hover:bg-gray-100">✕</button>
          </div>
          <form onSubmit={e=> { e.preventDefault(); planCreateMutation.mutate(); }} className="p-5 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">Name
                <input required value={form.name} onChange={e=> setForm(f=>({...f,name:e.target.value}))} className="border rounded px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">Price (cents)
                <input type="number" min={0} value={form.price_cents} onChange={e=> setForm(f=>({...f,price_cents:Number(e.target.value)}))} className="border rounded px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">Billing Period
                <select value={form.billing_period} onChange={e=> setForm(f=>({...f,billing_period:e.target.value as 'monthly'|'annual'}))} className="border rounded px-3 py-2 text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2">Description
                <textarea value={form.description} onChange={e=> setForm(f=>({...f,description:e.target.value}))} className="border rounded px-3 py-2 text-sm" rows={3} />
              </label>
              <label className="flex items-center gap-2 text-sm mt-1">
                <input type="checkbox" checked={form.active ?? true} onChange={e=> setForm(f=>({...f, active: e.target.checked}))} />
                <span>Active (available for assignment)</span>
              </label>
            </div>
            <div>
              <span className="block text-sm font-medium mb-2">Modules</span>
              <div className="grid md:grid-cols-3 gap-2">
                {allModules.map(m=> (
                  <label key={m.key} className="flex items-center gap-2 text-xs border rounded px-2 py-1 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.module_keys.includes(m.key)} onChange={()=>toggleModule(m.key)} />
                    <span className="truncate" title={m.name}>{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {editing && (form.active ?? true) && (
                <button type="button" onClick={async ()=> { if(window.confirm('Archive (deactivate) this plan? Tenants currently assigned remain on it but it will no longer appear in pricing.')) { await archivePlan(editing.id); toast.success('Plan archived'); setShowEditor(false); setEditing(null); queryClient.invalidateQueries({queryKey:['plans', true]}); queryClient.invalidateQueries({queryKey:['plans', false]}); }} } className="px-4 py-2 text-sm rounded border bg-white text-red-600 hover:bg-red-50">Archive</button>
              )}
              {editing && (form.active === false) && (
                <button type="button" onClick={async ()=> { await restorePlan(editing.id); toast.success('Plan restored'); setShowEditor(false); setEditing(null); queryClient.invalidateQueries({queryKey:['plans', true]}); queryClient.invalidateQueries({queryKey:['plans', false]}); }} className="px-4 py-2 text-sm rounded border bg-white text-green-600 hover:bg-green-50">Restore</button>
              )}
               <button type="button" onClick={()=> { setShowEditor(false); setEditing(null); }} className="px-4 py-2 text-sm rounded border bg-white hover:bg-gray-50">Cancel</button>
               <button type="submit" disabled={planCreateMutation.isPending} className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{planCreateMutation.isPending? 'Saving...' : editing? 'Update Plan':'Create Plan'}</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>;
};
export default SubscriptionPlansPage;
