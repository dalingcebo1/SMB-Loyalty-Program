/**
 * PaymentSettings - Admin page for payment provider configuration
 *
 * Allows admins to configure Yoco API keys, view Stripe status,
 * and manage accepted payment methods for their tenant.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FaCreditCard,
  FaKey,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaLink,
  FaToggleOn,
  FaToggleOff,
  FaSpinner,
} from 'react-icons/fa';
import api from '../../../api/api';
import { AdminPageContainer, AdminSection } from '../components/AdminGrid';
import { AdminCard } from '../components/AdminCard';
import { useCapabilities } from '../hooks/useCapabilities';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface YocoConfig {
  public_key: string;
  secret_key_masked: string;
  webhook_url: string;
  status: 'connected' | 'not_configured' | 'error';
}

interface StripeConfig {
  status: 'connected' | 'not_connected';
  current_plan: string | null;
}

interface PaymentMethods {
  accepted: string[];
  default_method: string;
}

interface PaymentSettingsData {
  yoco: YocoConfig;
  stripe: StripeConfig;
  payment_methods: PaymentMethods;
}

interface TestResult {
  success: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  connected: {
    icon: <FaCheckCircle className="text-green-500" />,
    label: 'Connected',
    color: 'text-green-700 bg-green-50 border-green-200',
  },
  not_configured: {
    icon: <FaExclamationTriangle className="text-yellow-500" />,
    label: 'Not Configured',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  error: {
    icon: <FaTimesCircle className="text-red-500" />,
    label: 'Error',
    color: 'text-red-700 bg-red-50 border-red-200',
  },
  not_connected: {
    icon: <FaTimesCircle className="text-gray-400" />,
    label: 'Not Connected',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
  },
};

const AVAILABLE_METHODS = [
  { key: 'card', label: 'Card Payments' },
  { key: 'cash', label: 'Cash' },
  { key: 'eft', label: 'EFT / Bank Transfer' },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const PaymentSettings = () => {
  const { has } = useCapabilities();
  const queryClient = useQueryClient();

  // Form state
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch payment settings
  const { data: settings, isLoading, error } = useQuery<PaymentSettingsData>({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      const res = await api.get('/admin/settings/payments');
      return res.data;
    },
    staleTime: 30000,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.patch('/admin/settings/payments', payload);
      return res.data;
    },
    onSuccess: () => {
      setStatusMessage({ type: 'success', text: 'Payment settings updated successfully.' });
      setSecretKey('');
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setStatusMessage({ type: 'error', text: detail || 'Failed to update payment settings.' });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async (key?: string) => {
      const res = await api.post('/admin/settings/payments/test', {
        secret_key: key || undefined,
      });
      return res.data as TestResult;
    },
    onSuccess: (data: TestResult) => {
      setTestResult(data);
    },
    onError: () => {
      setTestResult({ success: false, error: 'Connection test failed.' });
    },
  });

  // Payment methods toggle mutation
  const toggleMethodMutation = useMutation({
    mutationFn: async ({ method, enabled }: { method: string; enabled: boolean }) => {
      const current = settings?.payment_methods.accepted || [];
      const updated = enabled
        ? [...current, method]
        : current.filter((m) => m !== method);
      const res = await api.patch('/admin/settings/payments', {
        accepted_methods: updated,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
    },
  });

  const setDefaultMethodMutation = useMutation({
    mutationFn: async (method: string) => {
      const res = await api.patch('/admin/settings/payments', {
        default_method: method,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
    },
  });

  if (!has('manage-settings')) {
    return (
      <AdminPageContainer title="Payment Settings" description="You do not have permission to view this page.">
        <div />
      </AdminPageContainer>
    );
  }

  if (isLoading) {
    return (
      <AdminPageContainer title="Payment Settings" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <FaSpinner className="animate-spin text-2xl text-gray-400" />
        </div>
      </AdminPageContainer>
    );
  }

  if (error) {
    return (
      <AdminPageContainer title="Payment Settings" description="Failed to load payment settings.">
        <AdminCard variant="error">
          <p className="text-red-600">
            Failed to load payment settings. Please try again or contact support.
          </p>
        </AdminCard>
      </AdminPageContainer>
    );
  }

  const yoco = settings?.yoco;
  const stripe = settings?.stripe;
  const methods = settings?.payment_methods;
  const yocoStatus = STATUS_CONFIG[yoco?.status || 'not_configured'];
  const stripeStatus = STATUS_CONFIG[stripe?.status || 'not_connected'];

  const handleSaveKeys = () => {
    if (!publicKey && !secretKey) return;
    const payload: Record<string, string> = {};
    if (publicKey) payload.yoco_public_key = publicKey;
    if (secretKey) payload.yoco_secret_key = secretKey;
    updateMutation.mutate(payload);
  };

  const handleTestConnection = () => {
    setTestResult(null);
    testMutation.mutate(secretKey || undefined);
  };

  return (
    <AdminPageContainer
      title="Payment Settings"
      description="Configure payment providers and accepted payment methods for your business."
    >
      {/* Status message */}
      {statusMessage && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {statusMessage.text}
          <button
            className="ml-2 underline text-xs"
            onClick={() => setStatusMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Yoco Configuration */}
      <AdminSection title="Yoco Configuration" description="Configure your Yoco payment gateway credentials.">
        <AdminCard icon={<FaCreditCard />} variant="default">
          {/* Status badge */}
          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${yocoStatus.color}`}>
              {yocoStatus.icon}
              {yocoStatus.label}
            </span>
          </div>

          {/* Public Key */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Public Key
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={yoco?.public_key || 'pk_live_...'}
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
            />
            {yoco?.public_key && !publicKey && (
              <p className="text-xs text-gray-500 mt-1">Current: {yoco.public_key}</p>
            )}
          </div>

          {/* Secret Key */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret Key
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="sk_live_..."
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
            {yoco?.secret_key_masked && (
              <p className="text-xs text-gray-500 mt-1">
                Stored: {yoco.secret_key_masked}
              </p>
            )}
          </div>

          {/* Webhook URL */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FaLink className="inline mr-1" />
              Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                value={yoco?.webhook_url || ''}
              />
              <button
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 whitespace-nowrap"
                onClick={() => {
                  if (yoco?.webhook_url) {
                    navigator.clipboard.writeText(yoco.webhook_url).then(
                      () => setStatusMessage({ type: 'success', text: 'Webhook URL copied to clipboard.' }),
                      () => setStatusMessage({ type: 'error', text: 'Failed to copy to clipboard.' }),
                    );
                  }
                }}
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Add this URL in your Yoco dashboard under webhook settings.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6">
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={(!publicKey && !secretKey) || updateMutation.isPending}
              onClick={() => setShowConfirm(true)}
            >
              {updateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <FaSpinner className="animate-spin" /> Saving...
                </span>
              ) : (
                'Save Keys'
              )}
            </button>
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 border border-gray-300 disabled:opacity-50"
              disabled={testMutation.isPending}
              onClick={handleTestConnection}
            >
              {testMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <FaSpinner className="animate-spin" /> Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </button>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg border text-sm ${
                testResult.success
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {testResult.success ? (
                <span className="flex items-center gap-2">
                  <FaCheckCircle /> Connection successful!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FaTimesCircle /> {testResult.error || 'Connection failed.'}
                </span>
              )}
            </div>
          )}
        </AdminCard>
      </AdminSection>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Key Update</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to update your payment provider keys? This will immediately
              affect how payments are processed for your business.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                onClick={handleSaveKeys}
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Configuration */}
      <AdminSection title="Stripe Configuration" description="Stripe is used for subscription billing.">
        <AdminCard icon={<FaKey />} variant="default">
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${stripeStatus.color}`}>
                {stripeStatus.icon}
                {stripeStatus.label}
              </span>
              {stripe?.current_plan && (
                <p className="text-sm text-gray-600 mt-2">
                  Current plan: <span className="font-medium">{stripe.current_plan}</span>
                </p>
              )}
            </div>
            <button
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
              disabled
              title="Stripe Connect integration coming soon"
            >
              Connect with Stripe
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Stripe Connect OAuth integration will be available in a future update.
          </p>
        </AdminCard>
      </AdminSection>

      {/* Payment Methods */}
      <AdminSection title="Payment Methods Accepted" description="Configure which payment methods your customers can use.">
        <AdminCard icon={<FaCreditCard />} variant="default">
          <div className="space-y-3">
            {AVAILABLE_METHODS.map((method) => {
              const isActive = methods?.accepted.includes(method.key) ?? false;
              const isDefault = methods?.default_method === method.key;
              return (
                <div key={method.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <button
                      className="text-xl"
                      onClick={() =>
                        toggleMethodMutation.mutate({ method: method.key, enabled: !isActive })
                      }
                      disabled={toggleMethodMutation.isPending}
                    >
                      {isActive ? (
                        <FaToggleOn className="text-blue-600" />
                      ) : (
                        <FaToggleOff className="text-gray-400" />
                      )}
                    </button>
                    <span className={`text-sm ${isActive ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      {method.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDefault && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 font-medium">
                        Default
                      </span>
                    )}
                    {isActive && !isDefault && (
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                        onClick={() => setDefaultMethodMutation.mutate(method.key)}
                        disabled={setDefaultMethodMutation.isPending}
                      >
                        Set as default
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AdminCard>
      </AdminSection>
    </AdminPageContainer>
  );
};

export default PaymentSettings;
