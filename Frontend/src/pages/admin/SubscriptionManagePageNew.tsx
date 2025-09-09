import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/api';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/currency';
import ConfirmDialog from '../../components/ConfirmDialog';

// Types for subscription endpoints
interface Plan { id:number; name:string; price_cents:number; billing_period:'monthly'|'annual'|string; modules:string[]; active?:boolean }
interface TenantSubDetail { plan: { id:number; name:string; price_cents:number; billing_period:string } | null; active_modules: string[]; status?: 'active'|'trialing'|'past_due'|'canceled'|'paused' }
interface ChangeEvent { ts:string; action:string; actor?:string; details?:string }

// Modern plan selector with card-based layout
const PlanSelector: React.FC<{ tenantId: string; currentPlanName?: string }>=({ tenantId, currentPlanName })=>{
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey:['plans','activeOnly'],
    queryFn: async ()=> {
      const { data } = await api.get('/subscriptions/plans');
      return data as Plan[];
    }
  });

  // (History helpers moved to main page component)

  const rank = useMemo(()=>({ starter:0, advanced:1, premium:2 } as Record<string,number>),[]);

  const assign = useMutation({
    mutationFn: async (planId:number)=>{
      await api.post(`/subscriptions/tenants/${tenantId}/assign-plan`, { plan_id: planId }, { headers: { 'X-Tenant-ID': tenantId }});
    },
    onSuccess: ()=>{
      toast.success('Plan updated successfully');
      queryClient.invalidateQueries({ queryKey:['tenantSub', tenantId]});
    },
    onError: ()=> toast.error('Failed to assign plan'),
  });

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="border rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const sortedPlans = plans.sort((a, b) => (rank[a.name.toLowerCase()] ?? 999) - (rank[b.name.toLowerCase()] ?? 999));

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {sortedPlans.map((plan) => {
        const isCurrent = currentPlanName && plan.name.toLowerCase() === currentPlanName.toLowerCase();
        const currentRank = currentPlanName ? rank[currentPlanName.toLowerCase()] : -1;
        const planRank = rank[plan.name.toLowerCase()] ?? 999;
        
        let intent: 'current' | 'upgrade' | 'downgrade' | 'choose' = 'choose';
        if (isCurrent) intent = 'current';
        else if (currentRank !== -1 && planRank > currentRank) intent = 'upgrade';
        else if (currentRank !== -1 && planRank < currentRank) intent = 'downgrade';

        const isPopular = plan.name.toLowerCase() === 'advanced';

        return (
          <div key={plan.id} className={`relative border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
            isCurrent 
              ? 'border-green-500 bg-green-50' 
              : isPopular 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}>
            {isPopular && !isCurrent && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Most Popular
                </span>
              </div>
            )}
            
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Current Plan
                </span>
              </div>
            )}

            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-3 truncate">{plan.name}</h3>
              
              <div className="mb-6">
                <span className="text-2xl font-bold text-gray-900">
                  {plan.price_cents > 0 ? formatCurrency(plan.price_cents, 'ZAR') : 'Free'}
                </span>
                {plan.price_cents > 0 && (
                  <span className="text-sm text-gray-600 ml-1">
                    /{plan.billing_period === 'annual' ? 'year' : 'month'}
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-8 text-left">
                <p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-3">Includes:</p>
                {plan.modules.slice(0, 4).map(module => (
                  <div key={module} className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{module}</span>
                  </div>
                ))}
                {plan.modules.length > 4 && (
                  <div className="text-xs text-gray-500 pl-7">
                    +{plan.modules.length - 4} more features
                  </div>
                )}
              </div>

              {intent === 'current' ? (
                <div className="w-full py-3 px-4 bg-green-100 text-green-800 rounded-lg font-medium text-sm">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => assign.mutate(plan.id)}
                  disabled={assign.isPending}
                  className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    intent === 'upgrade'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : intent === 'downgrade'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {assign.isPending ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </div>
                  ) : (
                    intent === 'upgrade' ? `Upgrade to ${plan.name}` :
                    intent === 'downgrade' ? `Switch to ${plan.name}` :
                    `Choose ${plan.name}`
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
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

  // Change history timeline
  const { data: history } = useQuery<ChangeEvent[] | null>({
    queryKey:['subscriptionHistory', tenantId],
    queryFn: async ()=> {
  try { const { data } = await api.get(`/subscriptions/tenants/${tenantId}/history`, { headers: { 'X-Tenant-ID': tenantId }}); return data as ChangeEvent[]; }
      catch { return null; }
    },
    retry: false
  });

  // Plans lookup for history mapping (ID -> name)
  const { data: allPlans = [] } = useQuery<Plan[]>({
    queryKey: ['plans', 'all'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/plans');
      return data as Plan[];
    }
  });
  const planNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of allPlans) map[p.id] = p.name;
    return map;
  }, [allPlans]);

  const formatAction = (action: string) => {
    switch (action) {
      case 'plan.change':
        return 'Plan changed';
      case 'trial.start':
        return 'Trial started';
      case 'trial.cancel':
        return 'Trial canceled';
      case 'subscription.pause':
        return 'Subscription paused';
      case 'subscription.resume':
        return 'Subscription resumed';
      default:
        return action;
    }
  };

  const resolvePlanToken = (token: string) => {
    const t = token?.trim().toLowerCase();
    if (!t || t === 'none' || t === 'null' || t === '-') return 'None';
    const asNum = Number(t);
    if (!Number.isNaN(asNum) && planNameById[asNum]) return planNameById[asNum];
    return token?.trim();
  };

  const formatHistoryDetails = (evt: ChangeEvent) => {
    if (!evt.details) return null;
    if (evt.action === 'plan.change') {
      const parts = evt.details.split('->');
      if (parts.length === 2) {
        const from = resolvePlanToken(parts[0]);
        const to = resolvePlanToken(parts[1]);
        return `${from} → ${to}`;
      }
    }
    if (evt.action === 'trial.start') {
      return `Duration: ${evt.details}`;
    }
    return evt.details;
  };

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

  const planName = tenantSub?.plan?.name ?? 'No plan';
  const status = tenantSub?.status || 'active';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced header with better status display */}
        <header className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 truncate">Subscription Management</h1>
              <p className="text-sm lg:text-base text-gray-600">Manage your plan, billing, and feature access.</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                status === 'active' ? 'bg-green-100 text-green-800' :
                status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                status === 'past_due' ? 'bg-amber-100 text-amber-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    status === 'active' ? 'bg-green-500' :
                    status === 'trialing' ? 'bg-blue-500' :
                    status === 'past_due' ? 'bg-amber-500' :
                    'bg-gray-500'
                  }`}></div>
                  {status === 'active' ? 'Active' :
                   status === 'trialing' ? 'Trial Period' :
                   status === 'past_due' ? 'Payment Due' :
                   status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
              </div>
              <div className="px-3 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium truncate max-w-xs">
                {planName}
              </div>
            </div>
          </div>
        </header>

        {/* Enhanced current plan section */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
              <button 
                onClick={()=> setShowPlanSelector(v=>!v)} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                {showPlanSelector ? 'Hide Plans' : 'Change Plan'}
              </button>
            </div>
            
            {loadingSub ? (
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-3 w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded mb-4 w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : tenantSub?.plan ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{tenantSub.plan.name}</h3>
                    <p className="text-sm text-gray-600 truncate">
                      {tenantSub.plan.billing_period === 'annual' ? 'Billed annually' : 'Billed monthly'}
                    </p>
                    <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-2">
                      {tenantSub.plan.price_cents > 0 ? formatCurrency(tenantSub.plan.price_cents, 'ZAR') : 'Free'}
                      <span className="text-sm font-normal text-gray-500 ml-1">
                        /{tenantSub.plan.billing_period === 'annual' ? 'year' : 'month'}
                      </span>
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Active Features</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(tenantSub?.active_modules || []).map(module => (
                      <div key={module} className="flex items-center p-2 bg-gray-50 rounded-lg min-w-0">
                        <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700 truncate">{module}</span>
                      </div>
                    ))}
                  </div>
                  {tenantSub && tenantSub.active_modules?.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No features enabled</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <p className="text-gray-500">No plan assigned</p>
                <button 
                  onClick={()=> setShowPlanSelector(true)} 
                  className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Choose a Plan
                </button>
              </div>
            )}
            
            {showPlanSelector && (
              <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Plan</h3>
                <PlanSelector tenantId={tenantId} currentPlanName={tenantSub?.plan?.name} />
              </div>
            )}
          </div>

          {/* Enhanced Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={openPortal} 
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
              >
                <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="truncate">Open Billing Portal</span>
              </button>
              <p className="text-xs text-gray-600 leading-relaxed">
                Update payment methods, download invoices, and manage your subscription.
              </p>
            </div>
          </div>
        </section>

        {/* Enhanced control sections */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Trial</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">Start a trial for evaluation or cancel an ongoing trial.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={()=> startTrial(14)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm truncate">Start 14‑day Trial</button>
              <button onClick={()=> setConfirmState({ type: 'cancelTrial', loading: false })} className="px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors text-sm truncate">Cancel Trial</button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Pause Subscription</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">Temporarily pause billing and access. Can be resumed anytime.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={()=> setConfirmState({ type: 'pause', loading: false })} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm truncate">Pause</button>
              <button onClick={resumeSub} className="px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors text-sm truncate">Resume</button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Proration Preview</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">Open the plan selector and pick a plan to see pricing; final proration shown in portal.</p>
            <button onClick={()=> setShowPlanSelector(true)} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm truncate">Change Plan</button>
          </div>
        </section>

        {/* Enhanced Change history */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Change History</h2>
          {history?.length ? (
            <ol className="space-y-4">
              {history.map((e, idx)=> (
                <li key={idx} className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-purple-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 font-medium text-sm truncate">{formatAction(e.action)}</div>
                    {e.details && (
                      <div className="text-gray-600 text-sm mt-1 break-words">{formatHistoryDetails(e)}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {new Date(e.ts).toLocaleString()} {e.actor && `· ${e.actor}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">No recorded changes</p>
            </div>
          )}
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
      </div>
    </div>
  );
};

export default SubscriptionManagePage;
