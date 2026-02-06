import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AdminPageContainer, AdminSection } from '../components/AdminGrid';
import { AdminCard } from '../components/AdminCard';
import { useCapabilities } from '../hooks/useCapabilities';
import api from '../../../api/api';
import { formatCents, formatDateTime } from '../../../utils/format';
import { Breadcrumb } from '../components/Breadcrumb';

interface TransactionPayment {
  id: number;
  amount_cents: number | null;
  amount: number | null;
  status: string | null;
  method: string | null;
  source: string | null;
  card_brand: string | null;
  reference: string | null;
  transaction_id: string | null;
  created_at: string | null;
}

interface TransactionOrder {
  id: string | null;
  status: string | null;
  amount_cents: number | null;
  created_at: string | null;
  tenant_id: string | null;
  service_id: number | null;
  quantity: number | null;
  type: string | null;
  payment_pin: string | null;
}

interface TransactionCustomer {
  id: number | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface TransactionService {
  id: number | null;
  name: string | null;
  category: string | null;
}

interface TransactionDetail {
  payment: TransactionPayment;
  order: TransactionOrder;
  customer: TransactionCustomer;
  service: TransactionService;
}

const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = useCapabilities();

  const { data: transaction, isLoading, error } = useQuery<TransactionDetail>({
    queryKey: ['transaction-detail', id],
    queryFn: async () => {
      const response = await api.get(`/admin/transactions/${id}`);
      return response.data;
    },
    enabled: !!id && has('payments.view'),
  });

  if (!has('payments.view')) {
    return (
      <AdminPageContainer title="Access Denied" description="">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Missing capability: payments.view</div>
        </div>
      </AdminPageContainer>
    );
  }

  if (isLoading) {
    return (
      <AdminPageContainer title="Transaction Details" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
        </div>
      </AdminPageContainer>
    );
  }

  if (error || !transaction) {
    return (
      <AdminPageContainer title="Transaction Details" description="">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Failed to load transaction</div>
          <button
            onClick={() => navigate('/admin/transactions')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Transactions
          </button>
        </div>
      </AdminPageContainer>
    );
  }

  const { payment, order, customer, service } = transaction;
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unknown';

  const statusColors: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <AdminPageContainer
      title={`Transaction #${payment.id}`}
      description="View detailed transaction information"
      breadcrumbs={
        <Breadcrumb
          items={[
            { label: 'Transactions', href: '/admin/transactions' },
            { label: `Transaction #${payment.id}` },
          ]}
        />
      }
    >
      <div className="mb-4">
        <Link
          to="/admin/transactions"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Transactions
        </Link>
      </div>

      <AdminSection>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Payment Information */}
          <AdminCard title="Payment Information" padding="base">
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Payment ID</dt>
                <dd className="text-sm font-semibold text-gray-900">{payment.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Amount</dt>
                <dd className="text-sm font-semibold text-gray-900">
                  {formatCents(payment.amount_cents || 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      statusColors[payment.status || ''] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {payment.status || 'Unknown'}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Method</dt>
                <dd className="text-sm text-gray-900">{payment.method || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Source</dt>
                <dd className="text-sm text-gray-900">{payment.source || '—'}</dd>
              </div>
              {payment.card_brand && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Card Brand</dt>
                  <dd className="text-sm text-gray-900">{payment.card_brand}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Reference</dt>
                <dd className="text-sm text-gray-900 font-mono">{payment.reference || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Transaction ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{payment.transaction_id || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="text-sm text-gray-900">
                  {payment.created_at ? formatDateTime(payment.created_at) : '—'}
                </dd>
              </div>
            </dl>
          </AdminCard>

          {/* Customer Information */}
          <AdminCard title="Customer Information" padding="base">
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
                <dd className="text-sm font-semibold text-gray-900">{customer.id || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">{customerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{customer.email || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="text-sm text-gray-900">{customer.phone || '—'}</dd>
              </div>
              {customer.id && (
                <div className="pt-3">
                  <Link
                    to={`/admin/customers/${customer.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Customer Profile →
                  </Link>
                </div>
              )}
            </dl>
          </AdminCard>
        </div>
      </AdminSection>

      <AdminSection>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Order Information */}
          <AdminCard title="Order Information" padding="base">
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Order ID</dt>
                <dd className="text-sm font-semibold text-gray-900">{order.id || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="text-sm text-gray-900">{order.status || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd className="text-sm text-gray-900">{order.type || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Quantity</dt>
                <dd className="text-sm text-gray-900">{order.quantity || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Amount</dt>
                <dd className="text-sm text-gray-900">
                  {order.amount_cents ? formatCents(order.amount_cents) : '—'}
                </dd>
              </div>
              {order.payment_pin && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Payment PIN</dt>
                  <dd className="text-sm text-gray-900 font-mono">{order.payment_pin}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="text-sm text-gray-900">
                  {order.created_at ? formatDateTime(order.created_at) : '—'}
                </dd>
              </div>
            </dl>
          </AdminCard>

          {/* Service Information */}
          <AdminCard title="Service Information" padding="base">
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Service ID</dt>
                <dd className="text-sm font-semibold text-gray-900">{service.id || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">{service.name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="text-sm text-gray-900">{service.category || '—'}</dd>
              </div>
            </dl>
          </AdminCard>
        </div>
      </AdminSection>
    </AdminPageContainer>
  );
};

export default TransactionDetail