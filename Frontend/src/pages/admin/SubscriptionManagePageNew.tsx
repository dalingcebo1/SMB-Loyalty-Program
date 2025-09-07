import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/currency';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

// Types for subscription endpoints (best-effort based on existing pages/tests)
interface Plan { id:number; name:string; price_cents:number; billing_period:'monthly'|'annual'|string; modules:string[]; active?:boolean }
interface TenantSubDetail { plan: { id:number; name:string; price_cents:number; billing_period:string } | null; active_modules: string[]; status?: 'active'|'trialing'|'past_due'|'canceled'|'paused' }
interface BillingProfile { company?: string; email?: string; phone?: string; vat_number?: string; address_line1?: string; address_line2?: string; city?: string; country?: string; postal_code?: string }
interface PaymentMethod { brand: string; last4: string; exp_month: number; exp_year: number }
interface Invoice { id:string; date:string; amount_cents:number; currency:string; status:'paid'|'open'|'void'|'uncollectible'; hosted_invoice_url?: string }
interface ModuleDef { key:string; name:string; category?:string }
interface OverridesMap { [key:string]: boolean }
interface UsagePoint { module:string; count:number; limit?: number }
interface ChangeEvent { ts:string; action:string; actor?:string; details?:string }

const NotConfiguredNote: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
    {children ?? 'Billing service isn\'t configured in this environment. Actions below will be limited.'}
  </div>
);

// Compact plan grid used inside this page
const PlanSelector: React.FC<{ tenantId: string; currentPlanName?: string }>=({ tenantId, currentPlanName })=>{
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey:['plans','activeOnly'],
    queryFn: async ()=> {
      const { data } = await api.get('/subscriptions/plans');
      return data as Plan[];
    }
  });

  const rank = useMemo(()=>({ starter:0, advanced:1, premium:2 } as Record<string,number>),[]);
  const matrix = useMemo(()=>{
    const by = Object.fromEntries(plans.map(p=>[p.name.toLowerCase(), p]));
    return { starter: by['starter'], advanced: by['advanced'], premium: by['premium'] } as Record<string, Plan|undefined>;
  },[plans]);

  const assign = useMutation({
    mutationFn: async (planId:number)=>{
      await api.post(`/subscriptions/tenants/${tenantId}/assign-plan`, { plan_id: planId }, { headers: { 'X-Tenant-ID': tenantId }});
    },
    onSuccess: ()=>{
      toast.success('Plan updated');
      queryClient.invalidateQueries({ queryKey:['tenantSub', tenantId]});
    },
    onError: ()=> toast.error('Failed to assign plan'),
  });

  function priceCell(p?: Plan){
    if(!p) return <span className="opacity-60">—</span>;
    return <span>{p.price_cents>0? formatCurrency(p.price_cents,'ZAR')+ (p.billing_period==='annual'?' / yr':' / mo') : 'Free'}</span>;
  }
  function actionFor(p?: Plan){
    if(!p) return null;
    const nl = p.name.toLowerCase();
    if(currentPlanName && nl === currentPlanName.toLowerCase()){
      return <span className="inline-block px-2 py-1 rounded bg-green-600 text-white text-[10px]">Current</span>;
    }
    let intent: 'choose'|'upgrade'|'downgrade' = 'choose';
    if(currentPlanName && rank[nl]!==undefined && rank[currentPlanName.toLowerCase()]!==undefined){
      intent = rank[nl] > rank[currentPlanName.toLowerCase()] ? 'upgrade' : rank[nl] < rank[currentPlanName.toLowerCase()] ? 'downgrade' : 'choose';
    }
  const price = p.price_cents>0 ? formatCurrency(p.price_cents,'ZAR') + (p.billing_period==='annual'?' / yr':' / mo') : 'Free';
  const label = intent==='choose' ? `Choose ${p.name} • ${price}` : `${intent==='upgrade'?'Upgrade to':'Downgrade to'} ${p.name} • ${price}`;
    const color = intent==='downgrade' ? 'bg-amber-600 hover:bg-amber-700' : intent==='upgrade'? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700';
    return <button onClick={()=> assign.mutate(p.id)} disabled={assign.isPending} className={`px-2 py-1 rounded text-white text-xs ${color} disabled:opacity-50`}>{assign.isPending? 'Saving…' : label}</button>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-purple-700 text-white">
            <th className="p-3 text-left">Plan</th>
            <th className="p-3 text-center">Starter</th>
            <th className="p-3 text-center">Advanced</th>
            <th className="p-3 text-center">Premium</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3 font-medium">Price</td>
            <td className="p-3 text-center">{priceCell(matrix.starter)}</td>
            <td className="p-3 text-center">{priceCell(matrix.advanced)}</td>
            <td className="p-3 text-center">{priceCell(matrix.premium)}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3 font-medium">Includes</td>
            <td className="p-3 text-center text-xs text-gray-700">
              {(matrix.starter?.modules||[]).map(m=> <span key={m} className="inline-block m-0.5 px-2 py-0.5 rounded bg-gray-100">{m}</span>)}
            </td>
            <td className="p-3 text-center text-xs text-gray-700">
              {(matrix.advanced?.modules||[]).map(m=> <span key={m} className="inline-block m-0.5 px-2 py-0.5 rounded bg-gray-100">{m}</span>)}
            </td>
            <td className="p-3 text-center text-xs text-gray-700">
              {(matrix.premium?.modules||[]).map(m=> <span key={m} className="inline-block m-0.5 px-2 py-0.5 rounded bg-gray-100">{m}</span>)}
            </td>
          </tr>
          <tr>
            <td className="p-3 font-medium">Action</td>
            <td className="p-3 text-center">{actionFor(matrix.starter)}</td>
            <td className="p-3 text-center">{actionFor(matrix.advanced)}</td>
            <td className="p-3 text-center">{actionFor(matrix.premium)}</td>
          </tr>
        </tbody>
      </table>
      {isLoading && <div className="p-3 text-xs text-gray-500">Loading plans…</div>}
    </div>
  );
};

const SubscriptionManagePage: React.FC = () => {
  // Single-tenant app: use a fixed tenant id for API calls
  const tenantId = 'default';
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [confirmState, setConfirmState] = useState<{ type: 'pause' | 'cancelTrial' | null, loading?: boolean }>({ type: null, loading: false });
  const queryClient = useQueryClient();

  // 1) Current plan + active modules
  const { data: tenantSub, isLoading: loadingSub } = useQuery<TenantSubDetail>({
    queryKey:['tenantSub', tenantId],
    queryFn: async ()=> {
      const { data } = await api.get(`/subscriptions/tenants/${tenantId}`, { headers: { 'X-Tenant-ID': tenantId }});
      return data as TenantSubDetail;
    }
  });

  // Feature modules and per-tenant overrides
  const { data: allModules = [] } = useQuery<ModuleDef[]>({
    queryKey:['allModules'],
    queryFn: async ()=> {
      try { const { data } = await api.get('/subscriptions/modules'); return data as ModuleDef[]; }
      catch { return []; }
    }
  });
  const { data: overrides, refetch: refetchOverrides } = useQuery<OverridesMap | null>({
    queryKey:['moduleOverrides', tenantId],
    queryFn: async ()=> {
      try { const { data } = await api.get(`/subscriptions/tenants/${tenantId}/overrides`, { headers: { 'X-Tenant-ID': tenantId }}); return (data?.overrides ?? data) as OverridesMap; }
      catch { return null; }
    },
    retry: false
  });

  // Usage meters (last 30d)
  const { data: usage } = useQuery<UsagePoint[] | null>({
    queryKey:['usage', tenantId],
    queryFn: async ()=> {
      try { const { data } = await api.get(`/subscriptions/usage?window=30d`, { headers: { 'X-Tenant-ID': tenantId }}); return data as UsagePoint[]; }
      catch { return null; }
    },
    retry: false
  });

  // Change history timeline
  const { data: history } = useQuery<ChangeEvent[] | null>({
    queryKey:['subscriptionHistory', tenantId],
    queryFn: async ()=> {
  try { const { data } = await api.get(`/subscriptions/tenants/${tenantId}/history`, { headers: { 'X-Tenant-ID': tenantId }}); return data as ChangeEvent[]; }
      catch { return null; }
    },
    retry: false
  });

  // 2) Billing profile (404 => not configured)
  const { data: billingProfile, error: billingErr } = useQuery<BillingProfile>({
    queryKey:['billingProfile', tenantId],
    queryFn: async ()=> {
      const { data } = await api.get('/billing/profile');
      return data as BillingProfile;
    },
    retry: false
  });

  // 3) Payment method summary
  const { data: paymentMethods } = useQuery<PaymentMethod[] | null>({
    queryKey:['paymentMethods'],
    queryFn: async ()=> {
      try { const { data } = await api.get('/billing/payment-methods'); return data as PaymentMethod[]; }
      catch { return null; }
    },
    retry: false
  });

  // 4) Invoices
  const { data: invoices } = useQuery<Invoice[] | null>({
    queryKey:['invoices'],
    queryFn: async ()=> {
      try { const { data } = await api.get('/billing/invoices'); return data as Invoice[]; }
      catch { return null; }
    },
    retry: false
  });

  // Save billing profile (if API exists)
  const saveProfile = useMutation({
    mutationFn: async (payload: BillingProfile)=> {
      await api.put('/billing/profile', payload);
    },
    onSuccess: ()=> { toast.success('Billing profile saved'); },
    onError: ()=> { toast.error('Failed to save profile'); }
  });

  const openPortal = async () => {
    try {
      const { data } = await api.post<{ url:string }>('/billing/portal', {});
      if (data?.url) window.location.href = data.url; else toast.error('Portal URL unavailable');
    } catch {
      toast.warn('Billing portal not configured in this environment.');
    }
  };

  // Trial and pause controls (best-effort graceful calls)
  const startTrial = async (days=14) => {
    try { await api.post('/billing/start-trial', { days }); toast.success(`Trial started for ${days} days`); }
    catch { toast.warn('Start trial not available.'); }
  };
  const resumeSub = async () => {
    try { await api.post('/billing/resume', {}); toast.success('Subscription resumed'); }
    catch { toast.warn('Resume not available.'); }
  };

  // Toggle an individual module override
  const toggleOverride = async (key:string, enabled:boolean) => {
    try {
      await api.post(`/subscriptions/tenants/${tenantId}/override`, { module_key: key, enabled }, { headers: { 'X-Tenant-ID': tenantId }});
      await refetchOverrides();
    } catch {
      toast.warn('Override endpoint not available.');
    }
  };

  const planName = tenantSub?.plan?.name ?? 'No plan';
  const status = tenantSub?.status || 'active';

  return (
    <div className="p-6 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
          <p className="text-sm text-gray-600">Manage your plan, billing profile, payment method and invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs ${status==='active'?'bg-green-100 text-green-800':status==='trialing'?'bg-indigo-100 text-indigo-800':status==='past_due'?'bg-amber-100 text-amber-800':'bg-gray-100 text-gray-800'}`}>{status}</span>
          <span className="px-2 py-1 rounded bg-purple-600 text-white text-xs">{planName}</span>
        </div>
      </header>

      {/* Current plan */}
      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Current Plan</h2>
            <button onClick={()=> setShowPlanSelector(v=>!v)} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">{showPlanSelector? 'Hide Plans' : 'Change Plan'}</button>
          </div>
          {loadingSub && <p className="text-sm text-gray-500">Loading current plan…</p>}
          {tenantSub?.plan ? (
            <div className="text-sm">
              <div className="text-gray-800">{tenantSub.plan.name} • {tenantSub.plan.billing_period === 'annual' ? 'Billed yearly' : 'Billed monthly'}</div>
              <div className="text-gray-600">{tenantSub.plan.price_cents>0? formatCurrency(tenantSub.plan.price_cents,'ZAR'): 'Free'}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No plan assigned.</p>
          )}
          <div>
            <h3 className="mt-3 text-xs font-medium text-gray-700">Active Modules</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(tenantSub?.active_modules || []).map(m=> <span key={m} className="text-[11px] px-2 py-1 rounded bg-gray-100">{m}</span>)}
              {tenantSub && tenantSub.active_modules?.length===0 && <span className="text-xs text-gray-500">No modules enabled</span>}
            </div>
          </div>
          {showPlanSelector && (
            <div className="mt-4">
              <PlanSelector tenantId={tenantId} currentPlanName={tenantSub?.plan?.name} />
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Quick Actions</h2>
          <button onClick={openPortal} className="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Open Billing Portal</button>
          <p className="text-xs text-gray-600">Update card, download invoices, cancel or reactivate from the secure portal.</p>
        </div>
      </section>

      {/* Billing profile & Payment method*/}
      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Billing Profile</h2>
          {billingErr && <NotConfiguredNote>Billing profile API not available. Data can\'t be saved in this environment.</NotConfiguredNote>}
          <form onSubmit={(e)=>{ e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const payload: BillingProfile = Object.fromEntries(fd.entries()) as unknown as BillingProfile; saveProfile.mutate(payload); }} className="grid md:grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">Company
              <input name="company" defaultValue={billingProfile?.company || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">Email
              <input name="email" type="email" defaultValue={billingProfile?.email || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">Phone
              <input name="phone" defaultValue={billingProfile?.phone || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">VAT Number
              <input name="vat_number" defaultValue={billingProfile?.vat_number || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">Address Line 1
              <input name="address_line1" defaultValue={billingProfile?.address_line1 || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">Address Line 2
              <input name="address_line2" defaultValue={billingProfile?.address_line2 || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">City
              <input name="city" defaultValue={billingProfile?.city || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">Country
              <input name="country" defaultValue={billingProfile?.country || ''} className="border rounded px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">Postal Code
              <input name="postal_code" defaultValue={billingProfile?.postal_code || ''} className="border rounded px-3 py-2" />
            </label>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={openPortal} className="px-4 py-2 rounded border bg-white hover:bg-gray-50">Manage in Portal</button>
              <button type="submit" disabled={saveProfile.isPending} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{saveProfile.isPending? 'Saving…':'Save Profile'}</button>
            </div>
          </form>
        </div>

        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Payment Method</h2>
          {paymentMethods?.length ? (
            <ul className="text-sm">
              {paymentMethods.map((pm, i)=> (
                <li key={i} className="flex items-center justify-between border-b py-2">
                  <span className="text-gray-700">{pm.brand.toUpperCase()} •••• {pm.last4}</span>
                  <span className="text-xs text-gray-500">Exp {pm.exp_month}/{pm.exp_year}</span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-sm text-gray-600">No payment method on file.</p>
              <NotConfiguredNote />
            </>
          )}
          <button onClick={openPortal} className="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Update Card</button>
        </div>
      </section>

      {/* Module overrides and usage */}
      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Module Overrides</h2>
            <span className="text-xs text-gray-500">Per-tenant feature toggles</span>
          </div>
          {overrides === null && <NotConfiguredNote>Override APIs not available in this environment.</NotConfiguredNote>}
          <div className="grid md:grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto pr-1">
            {allModules.map(m => {
              const on = overrides ? Boolean(overrides[m.key]) : false;
              return (
                <label key={m.key} className="flex items-center justify-between gap-2 border rounded px-3 py-2 text-sm">
                  <span className="truncate max-w-[12rem]" title={m.name}>{m.name}</span>
                  <input type="checkbox" checked={on} onChange={(e)=> toggleOverride(m.key, e.target.checked)} />
                </label>
              );
            })}
            {allModules.length===0 && <p className="text-sm text-gray-600">No modules to configure.</p>}
          </div>
        </div>
        <div className="border rounded-lg p-5">
          <h2 className="font-semibold mb-2">Usage (30 days)</h2>
          {usage?.length ? (
            <div className="space-y-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={usage.map(u => ({
                      name: u.module,
                      Used: u.count,
                      Remaining: Math.max(0, (u.limit ?? 0) - u.count),
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(v: string)=> (v?.length>12? v.slice(0,12)+'…': v)} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Used" stackId="a" fill="#7c3aed" />
                    <Bar dataKey="Remaining" stackId="a" fill="#e5e7eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-sm space-y-3">
                {usage.map(u => {
                  const limit = u.limit ?? 0;
                  const used = u.count;
                  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                  return (
                    <li key={u.module}>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">{u.module}</span>
                        <span className="text-gray-900 font-medium">
                          {used}
                          {limit ? (
                            <>
                              {' '}/{' '}
                              <span className={used > limit ? 'text-red-600' : 'text-gray-500'}>{limit}</span>
                            </>
                          ) : null}
                        </span>
                      </div>
                      {limit > 0 && (
                        <div className="mt-1 h-2 w-full bg-gray-200 rounded">
                          <div
                            className={`h-2 rounded ${used > limit ? 'bg-red-500' : 'bg-purple-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <NotConfiguredNote>Usage metrics not available.</NotConfiguredNote>
          )}
        </div>
      </section>

      {/* Trial and Pause controls */}
      <section className="grid lg:grid-cols-3 gap-6">
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Trial</h2>
          <p className="text-sm text-gray-600">Start a trial for evaluation or cancel an ongoing trial.</p>
          <div className="flex gap-2">
            <button onClick={()=> startTrial(14)} className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">Start 14‑day Trial</button>
            <button onClick={()=> setConfirmState({ type: 'cancelTrial', loading: false })} className="px-3 py-2 rounded border bg-white text-sm hover:bg-gray-50">Cancel Trial</button>
          </div>
        </div>
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Pause Subscription</h2>
          <p className="text-sm text-gray-600">Temporarily pause billing and access. Can be resumed anytime.</p>
          <div className="flex gap-2">
            <button onClick={()=> setConfirmState({ type: 'pause', loading: false })} className="px-3 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700">Pause</button>
            <button onClick={resumeSub} className="px-3 py-2 rounded border bg-white text-sm hover:bg-gray-50">Resume</button>
          </div>
        </div>
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">Proration Preview</h2>
          <p className="text-sm text-gray-600">Open the plan selector and pick a plan to see pricing; final proration shown in portal.</p>
          <button onClick={()=> setShowPlanSelector(true)} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">Change Plan</button>
        </div>
      </section>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={!!confirmState.type}
        title={confirmState.type === 'pause' ? 'Pause subscription?' : 'Cancel trial?'}
        description={confirmState.type === 'pause' ? 'Access will be suspended until you resume. Billing will be paused as well.' : 'This will end your trial immediately. Billing will resume according to your plan.'}
        confirmLabel={confirmState.type === 'pause' ? 'Pause' : 'Cancel trial'}
        cancelLabel="Keep as is"
        loading={!!confirmState.loading}
        onCancel={() => setConfirmState({ type: null, loading: false })}
        onConfirm={async () => {
          setConfirmState(s => ({ ...s, loading: true }));
          try {
            if (confirmState.type === 'pause') {
              await api.post('/billing/pause', {});
              toast.success('Subscription paused');
            } else {
              await api.post('/billing/cancel-trial', {});
              toast.success('Trial canceled');
            }
            // Refresh subscription state if available
            queryClient.invalidateQueries({ queryKey: ['tenantSub', tenantId] });
          } catch {
            toast.warn(confirmState.type === 'pause' ? 'Pause not available.' : 'Cancel trial not available.');
          } finally {
            setConfirmState({ type: null, loading: false });
          }
        }}
      />

      {/* Invoices */}
      <section className="border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Invoices</h2>
          <button onClick={openPortal} className="px-3 py-1.5 rounded border bg-white text-sm hover:bg-gray-50">View all</button>
        </div>
        {invoices?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-700 text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b last:border-b-0">
                    <td className="p-2">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="p-2">{formatCurrency(inv.amount_cents, inv.currency || 'ZAR')}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${inv.status==='paid'?'bg-green-100 text-green-800':inv.status==='open'?'bg-amber-100 text-amber-800':'bg-gray-100 text-gray-800'}`}>{inv.status}</span>
                    </td>
                    <td className="p-2">
                      {inv.hosted_invoice_url ? (
                        <a target="_blank" rel="noreferrer" href={inv.hosted_invoice_url} className="text-blue-600 hover:underline">Download</a>
                      ) : (
                        <button onClick={openPortal} className="text-blue-600 hover:underline">Open in portal</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-gray-600">No invoices yet.</p>
            <NotConfiguredNote />
          </div>
        )}
      </section>

      {/* Change history */}
      <section className="border rounded-lg p-5">
        <h2 className="font-semibold">Change History</h2>
        {history?.length ? (
          <ol className="mt-3 space-y-2 text-sm">
            {history.map((e, idx)=> (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-600" />
                <div>
                  <div className="text-gray-900">{e.action} {e.details ? <span className="text-gray-600">— {e.details}</span> : null}</div>
                  <div className="text-xs text-gray-500">{new Date(e.ts).toLocaleString()} {e.actor? `· ${e.actor}`:''}</div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-sm text-gray-600">No recorded changes.</p>
        )}
      </section>
    </div>
  );
};

export default SubscriptionManagePage;
