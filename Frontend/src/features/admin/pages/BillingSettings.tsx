/**
 * BillingSettings - Subscription and usage management page
 * Displays current plan, usage meters, and upgrade options
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaCreditCard, FaChartLine, FaExclamationCircle, FaUsers, FaFileAlt, FaDatabase, FaCheck } from 'react-icons/fa';
import api from '../../../api/api';
import { AdminPageContainer, AdminSection, AdminGrid } from '../components/AdminGrid';
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

const BillingSettings = () => {
  const queryClient = useQueryClient();

  // Fetch usage summary
  const { data: summary, isLoading, error } = useQuery<UsageSummary>({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await api.get('/usage/summary');
      return res.data;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refetch every 5 minutes
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

  const { usage, plan_id, plan_name, checks, upgrade_available } = summary;

  // Plan feature lists
  const planFeatures: Record<string, string[]> = {
    free: [
      'Up to 100 customers',
      '50 transactions per month',
      'Basic analytics',
      'Email support',
    ],
    pro: [
      'Up to 1,000 customers',
      '500 transactions per month',
      'Advanced analytics',
      'Priority email support',
      'Custom branding',
      'API access',
    ],
    enterprise: [
      'Unlimited customers',
      'Unlimited transactions',
      'Full analytics suite',
      '24/7 phone & email support',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
    ],
  };

  // Get usage meter color based on percentage
  const getMeterColor = (percentUsed: number): string => {
    if (percentUsed >= 90) return 'bg-red-500';
    if (percentUsed >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Get status variant based on percentage
  const getStatusVariant = (percentUsed: number): 'success' | 'warning' | 'error' => {
    if (percentUsed >= 90) return 'error';
    if (percentUsed >= 70) return 'warning';
    return 'success';
  };

  const features = planFeatures[plan_id] || [];

  return (
    <AdminPageContainer title="Billing & Usage" description="Manage your subscription and monitor resource usage">
      <AdminSection
        title="Billing & Usage"
        description="Manage your subscription and monitor resource usage"
      >
        {/* Current Plan */}
        <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
          <AdminCard
            title="Current Plan"
            icon={<FaCreditCard size={20} />}
            variant="primary"
            padding="lg"
          >
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1 capitalize">
                  {plan_name}
                </h2>
                <p className="text-sm text-gray-500">Plan ID: {plan_id}</p>
              </div>

              {/* Features list */}
              <ul className="space-y-2 pt-4 border-t border-gray-200">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                    <FaCheck size={16} className="text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Upgrade button */}
              {upgrade_available && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    onClick={() => {
                      // TODO: Integrate Stripe Checkout
                      alert('Stripe integration coming soon!');
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <FaChartLine size={18} />
                      <span>Upgrade Plan</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </AdminCard>

          {/* Usage Stats Overview */}
          <div className="space-y-4">
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
        </AdminGrid>

        {/* Usage Meters */}
        <div className="mt-8">
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
                    {/* Resource header */}
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

                    {/* Progress bar (only show if not unlimited) */}
                    {!isUnlimited && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${meterColor}`}
                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                          />
                        </div>

                        {/* Status text */}
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
