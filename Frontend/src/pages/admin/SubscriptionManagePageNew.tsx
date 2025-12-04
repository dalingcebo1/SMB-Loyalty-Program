import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../api/api';
import { motion } from 'framer-motion';
import { 
  FaCheck, 
  FaCreditCard, 
  FaUsers, 
  FaChartLine, 
  FaBullhorn, 
  FaGift, 
  FaGlobe, 
  FaCode, 
  FaPaintBrush 
} from 'react-icons/fa';
import { toast } from 'react-toastify';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  features?: Record<string, any>;
  modules?: string[];
}

interface SubscriptionStatus {
  status: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface Usage {
  module: string;
  count: number;
  limit: number | null;
}

const FEATURE_CONFIG: Record<string, { label: string; icon: React.ElementType; priority: number }> = {
  loyalty: { label: 'Loyalty Customers', icon: FaGift, priority: 1 },
  orders: { label: 'Monthly Orders', icon: FaCreditCard, priority: 2 },
  campaigns: { label: 'Marketing Campaigns', icon: FaBullhorn, priority: 3 },
  analytics: { label: 'Analytics & Insights', icon: FaChartLine, priority: 4 },
  multi_user: { label: 'Team Access', icon: FaUsers, priority: 5 },
  custom_domain: { label: 'Custom Domain', icon: FaGlobe, priority: 6 },
  white_label: { label: 'White Labeling', icon: FaPaintBrush, priority: 7 },
  api_access: { label: 'API Access', icon: FaCode, priority: 8 },
};

const formatFeatureDetails = (key: string, value: any): string | null => {
  if (value === true) return null;
  if (typeof value !== 'object') return null;

  if (key === 'loyalty') {
    const customers = value.limit_customers === null ? 'Unlimited' : value.limit_customers;
    const orders = value.limit_orders_per_month === null ? 'Unlimited' : value.limit_orders_per_month;
    return `${customers} customers • ${orders} orders/mo`;
  }
  if (key === 'analytics') {
    return `${value.retention_days} days data retention`;
  }
  if (key === 'multi_user') {
    return value.limit_users === null ? 'Unlimited users' : `${value.limit_users} team members`;
  }
  return null;
};

const SubscriptionManagePageNew: React.FC = () => {
  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data;
    }
  });

  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/subscription-status');
      return res.data;
    }
  });

  const { data: usage } = useQuery<Usage[]>({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/usage');
      return res.data;
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post(`/subscriptions/checkout-session?plan_id=${planId}`);
      return res.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start checkout');
    }
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/subscriptions/portal-session');
      return res.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to open billing portal');
    }
  });

  if (plansLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const currentPlanId = status?.plan?.id || 'free';

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscription & Billing</h1>
          <p className="text-gray-500 mt-1">Manage your plan, billing details, and invoices.</p>
        </div>
        {status?.stripe_customer_id && (
          <button
            onClick={() => portalMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium shadow-sm"
          >
            <FaCreditCard className="text-gray-400" />
            Manage Billing
          </button>
        )}
      </div>

      {/* Current Usage Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {usage?.map((item) => {
            const percentage = item.limit ? (item.count / item.limit) * 100 : 0;
            const isNearLimit = percentage > 90;
            
            return (
              <div key={item.module} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {FEATURE_CONFIG[item.module]?.label || item.module}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    item.limit === null 
                      ? 'bg-green-100 text-green-800' 
                      : isNearLimit 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                  }`}>
                    {item.limit === null ? 'Unlimited' : `${Math.round(percentage)}%`}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{item.count}</span>
                  <span className="text-sm text-gray-500">
                    / {item.limit === null ? '∞' : item.limit}
                  </span>
                </div>
                {item.limit !== null && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percentage, 100)}%` }}
                      className={`h-full rounded-full ${isNearLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans?.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPopular = plan.id === 'pro';

          // Handle case where features might be missing but modules are present (backend compatibility)
          let features = plan.features || {};
          if (Object.keys(features).length === 0 && plan.modules && Array.isArray(plan.modules)) {
            features = plan.modules.reduce((acc, module) => {
              acc[module] = true;
              return acc;
            }, {} as Record<string, any>);
          }

          // Sort features by priority
          const sortedFeatures = Object.entries(features)
            .filter(([, value]) => value !== false)
            .sort(([keyA], [keyB]) => {
              const priorityA = FEATURE_CONFIG[keyA]?.priority || 99;
              const priorityB = FEATURE_CONFIG[keyB]?.priority || 99;
              return priorityA - priorityB;
            });

          return (
            <motion.div
              key={plan.id}
              whileHover={{ y: -5 }}
              className={`relative rounded-2xl border ${
                isCurrent
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50 shadow-md'
                  : isPopular
                  ? 'border-purple-500 shadow-xl scale-105 z-10'
                  : 'border-gray-200 shadow-sm'
              } bg-white p-8 flex flex-col h-full`}
            >
              {isPopular && !isCurrent && (
                <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wide shadow-sm">
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wide shadow-sm">
                  Current Plan
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-sm mt-1 min-h-[40px]">{plan.description}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-100">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatCurrency(plan.price_cents)}
                  </span>
                  <span className="text-gray-500 ml-1">/month</span>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                {sortedFeatures.map(([key, value]) => {
                  const config = FEATURE_CONFIG[key];
                  const label = config?.label || key.replace(/_/g, ' ');
                  const Icon = config?.icon || FaCheck;
                  const details = formatFeatureDetails(key, value);

                  return (
                    <div key={key} className="flex items-start gap-3 group">
                      <div className={`mt-1 flex-shrink-0 ${isCurrent || isPopular ? 'text-blue-600' : 'text-gray-400'}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                          {label}
                        </p>
                        {details && (
                          <p className="text-xs text-gray-500 mt-0.5">{details}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={() => !isCurrent && checkoutMutation.mutate(plan.id)}
                  disabled={isCurrent || checkoutMutation.isPending}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-default border border-gray-200'
                      : isPopular
                      ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                  }`}
                >
                  {isCurrent 
                    ? 'Active Plan' 
                    : (plan.price_cents < (status?.plan?.price_cents || 0) ? 'Downgrade to ' : 'Upgrade to ') + plan.name
                  }
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionManagePageNew;
