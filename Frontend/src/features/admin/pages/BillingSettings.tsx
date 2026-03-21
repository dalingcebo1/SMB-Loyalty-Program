/**
 * BillingSettings - Subscription and usage management page
 * Displays current plan, plan comparison cards, upgrade/downgrade flows,
 * invoice history, payment method info, and usage meters.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  FaCreditCard,
  FaExclamationCircle,
  FaUsers,
  FaFileAlt,
  FaDatabase,
  FaCheck,
  FaTimes,
  FaFileInvoiceDollar,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import api from '../../../api/api';
import { formatCents } from '../../../utils/format';
import { AdminPageContainer, AdminSection } from '../components/AdminGrid';
import { AdminCard, StatCard } from '../components/AdminCard';

interface UsageData {
  customers: number;
  transactions: number;
  transactions_this_month: number;
  api_calls_today: number;
  storage_mb: number;
  last_updated: string;
}

interface LimitCheck {
  resource: string;
  current: number;
  limit: number | null;
  remaining: number | null;
  percent_used: number;
  exceeded: boolean;
}

interface UsageSummary {
  usage: UsageData;
  plan_id: string;
  plan_name: string;
  limits: Record<string, number | null>;
  checks: LimitCheck[];
  upgrade_available: boolean;
}

interface PlanConfig {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  features: Record<string, any>;
  stripe_price_id: string | null;
}

interface Invoice {
  id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

// Human-readable feature descriptions for plan comparison
const PLAN_FEATURE_LABELS: Record<string, string[]> = {
  free: [
    'Up to 100 customers',
    '50 transactions per month',
    '7-day analytics retention',
    '1 team member',
    'Email support',
  ],
  pro: [
    'Up to 1,000 customers',
    '500 transactions per month',
    '90-day analytics retention',
    '5 team members',
    'Marketing campaigns',
    'Custom domain',
    'API access',
    'Priority support',
  ],
  enterprise: [
    'Unlimited customers',
    'Unlimited transactions',
    '365-day analytics retention',
    'Unlimited team members',
    'Marketing campaigns',
    'Custom domain',
    'White-label branding',
    'API access',
    'Dedicated account manager',
  ],
};

const PLAN_ORDER = ['free', 'pro', 'enterprise'];

const BillingSettings = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState<string | null>(null);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setStatusMessage({ type: 'success', text: 'Your subscription has been updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payment-method'] });
      // Clean query params without reloading
      setSearchParams({}, { replace: true });
    } else if (status === 'cancelled') {
      setStatusMessage({ type: 'error', text: 'Checkout was cancelled. No changes were made.' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Fetch usage summary
  const { data: summary, isLoading, error } = useQuery<UsageSummary>({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await api.get('/usage/summary');
      return res.data;
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });

  // Fetch available plans
  const { data: plans } = useQuery<PlanConfig[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data;
    },
    staleTime: 300000,
  });

  // Fetch invoices
  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/invoices');
      return res.data;
    },
    staleTime: 300000,
  });

  // Fetch payment method
  const { data: paymentMethod } = useQuery<PaymentMethod | null>({
    queryKey: ['payment-method'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/payment-method');
      return res.data;
    },
    staleTime: 300000,
  });

  // Invalidate cache mutation
  const invalidateMutation = useMutation({
    mutationFn: async () => {
      await api.post('/usage/invalidate-cache');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
    },
  });

  // Checkout session mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post(`/subscriptions/checkout-session?plan_id=${planId}`);
      return res.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      setStatusMessage({ type: 'error', text: 'Failed to start checkout. Please try again.' });
    },
  });

  // Portal session mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/subscriptions/portal-session');
      return res.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const handlePlanAction = (targetPlanId: string) => {
    if (!summary) return;
    const currentIdx = PLAN_ORDER.indexOf(summary.plan_id);
    const targetIdx = PLAN_ORDER.indexOf(targetPlanId);
    if (targetIdx < currentIdx) {
      // Downgrade — show confirmation
      setConfirmDowngrade(targetPlanId);
    } else {
      // Upgrade — go straight to checkout
      checkoutMutation.mutate(targetPlanId);
    }
  };

  const confirmDowngradeAction = () => {
    if (confirmDowngrade) {
      checkoutMutation.mutate(confirmDowngrade);
      setConfirmDowngrade(null);
    }
  };

  if (isLoading) {
    return (
      <AdminPageContainer title="Billing & Usage" description="Manage your subscription and monitor resource usage">
        <AdminSection title="Billing & Usage">
          <div className="text-center py-12 text-gray-500">Loading...</div>
        </AdminSection>
      </AdminPageContainer>
    );
  }

  if (error) {
    return (
      <AdminPageContainer title="Billing & Usage" description="Manage your subscription and monitor resource usage">
        <AdminSection title="Billing & Usage">
          <AdminCard variant="error" icon={<FaExclamationCircle size={20} />}>
            <p className="text-red-600">Failed to load billing information. Please try again.</p>
          </AdminCard>
        </AdminSection>
      </AdminPageContainer>
    );
  }

  if (!summary) {
    return null;
  }

  const { usage, plan_id, plan_name, checks } = summary;

  // Get usage meter color based on percentage
  const getMeterColor = (percentUsed: number): string => {
    if (percentUsed >= 90) return 'bg-red-500';
    if (percentUsed >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusVariant = (percentUsed: number): 'success' | 'warning' | 'error' => {
    if (percentUsed >= 90) return 'error';
    if (percentUsed >= 70) return 'warning';
    return 'success';
  };

  // Sort plans in the display order
  const sortedPlans = plans
    ? [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id))
    : [];

  return (
    <AdminPageContainer title="Billing & Usage" description="Manage your subscription and monitor resource usage">
      <AdminSection
        title="Billing & Usage"
        description="Manage your subscription and monitor resource usage"
      >
        {/* Status banner */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? <FaCheck size={16} /> : <FaExclamationCircle size={16} />}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-gray-500 hover:text-gray-700">
              <FaTimes size={16} />
            </button>
          </div>
        )}

        {/* Payment Method & Current Plan Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <AdminCard
            title="Current Plan"
            icon={<FaCreditCard size={20} />}
            variant="primary"
            padding="lg"
          >
            <div className="space-y-3">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1 capitalize">
                  {plan_name}
                </h2>
                <p className="text-sm text-gray-500">Plan: {plan_id}</p>
              </div>
              {/* Manage billing button */}
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {portalMutation.isPending ? 'Opening...' : 'Manage Billing in Stripe →'}
              </button>
            </div>
          </AdminCard>

          <AdminCard
            title="Payment Method"
            icon={<FaCreditCard size={20} />}
            padding="lg"
          >
            {paymentMethod ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900 capitalize">
                    {paymentMethod.brand}
                  </span>
                  <span className="text-gray-600">•••• {paymentMethod.last4}</span>
                </div>
                <p className="text-sm text-gray-500">
                  Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No payment method on file</p>
            )}
          </AdminCard>
        </div>

        {/* Usage Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Customers"
            value={usage.customers}
            icon={<FaUsers size={20} />}
          />
          <StatCard
            label="Total Transactions"
            value={usage.transactions}
            icon={<FaFileAlt size={20} />}
          />
          <StatCard
            label="Storage Used"
            value={`${usage.storage_mb.toFixed(1)} MB`}
            icon={<FaDatabase size={20} />}
          />
        </div>

        {/* Plan Comparison Cards */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sortedPlans.map((plan) => {
              const isCurrent = plan.id === plan_id;
              const isPopular = plan.id === 'pro';
              const currentIdx = PLAN_ORDER.indexOf(plan_id);
              const targetIdx = PLAN_ORDER.indexOf(plan.id);
              const isDowngrade = targetIdx < currentIdx;
              const features = PLAN_FEATURE_LABELS[plan.id] || [];

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-6 flex flex-col ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50/30 shadow-md'
                      : isPopular
                      ? 'border-purple-400 shadow-lg'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Badges */}
                  {isCurrent && (
                    <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      Current Plan
                    </span>
                  )}
                  {isPopular && !isCurrent && (
                    <span className="absolute -top-3 left-4 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      Most Popular
                    </span>
                  )}

                  <div className="mb-4 mt-1">
                    <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price_cents === 0 ? 'Free' : formatCents(plan.price_cents)}
                    </span>
                    {plan.price_cents > 0 && (
                      <span className="text-gray-500 text-sm ml-1">/month</span>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-6">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <FaCheck size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => !isCurrent && handlePlanAction(plan.id)}
                    disabled={isCurrent || checkoutMutation.isPending}
                    className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-400 cursor-default border border-gray-200'
                        : isDowngrade
                        ? 'bg-gray-800 text-white hover:bg-gray-900'
                        : isPopular
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCurrent
                      ? 'Current Plan'
                      : isDowngrade
                      ? `Downgrade to ${plan.name}`
                      : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Downgrade Confirmation Dialog */}
        {confirmDowngrade && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Downgrade</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to downgrade to the{' '}
                <span className="font-semibold capitalize">{confirmDowngrade}</span> plan?
                You may lose access to features available on your current plan.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDowngrade(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDowngradeAction}
                  disabled={checkoutMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {checkoutMutation.isPending ? 'Processing...' : 'Confirm Downgrade'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Usage Meters */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage</h3>
          <div className="space-y-4">
            {checks.map((check) => {
              const percentUsed = check.percent_used;
              const statusVariant = getStatusVariant(percentUsed);
              const meterColor = getMeterColor(percentUsed);
              const isUnlimited = check.limit === null;

              return (
                <AdminCard
                  key={check.resource}
                  variant={statusVariant}
                  padding="base"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 capitalize">
                        {check.resource}
                      </h4>
                      <div className="text-sm">
                        {isUnlimited ? (
                          <span className="text-green-600 font-medium">Unlimited</span>
                        ) : (
                          <span className="text-gray-600">
                            {check.current.toLocaleString()} / {check.limit?.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isUnlimited && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${meterColor}`}
                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">
                            {percentUsed.toFixed(1)}% used
                          </span>
                          {check.remaining !== null && check.remaining > 0 && (
                            <span className="text-gray-600">
                              {check.remaining.toLocaleString()} remaining
                            </span>
                          )}
                          {check.exceeded && (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <FaExclamationCircle size={14} />
                              Limit exceeded
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </AdminCard>
              );
            })}
          </div>
        </div>

        {/* Invoice History */}
        {invoices && invoices.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice History</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(inv.created * 1000).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {formatCents(inv.amount_paid || inv.amount_due)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            inv.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : inv.status === 'open'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                          >
                            <FaFileInvoiceDollar size={14} />
                            View
                            <FaExternalLinkAlt size={10} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Last updated info */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
          <span>Last updated: {new Date(usage.last_updated).toLocaleString()}</span>
          <button
            onClick={() => invalidateMutation.mutate()}
            disabled={invalidateMutation.isPending}
            className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {invalidateMutation.isPending ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </AdminSection>
    </AdminPageContainer>
  );
};

export default BillingSettings;
