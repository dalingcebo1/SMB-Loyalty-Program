import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCapabilities } from '../hooks/useCapabilities';
import api from '../../../api/api';
import { AdminPageContainer } from '../components/AdminGrid';
import { formatCents } from '../../../utils/format';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import {
  FaPlus,
  FaTimes,
  FaTrash,
  FaPaperPlane,
  FaCheckCircle,
  FaFileInvoiceDollar,
  FaExclamationTriangle,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import ExportButton from '../components/ExportButton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface Invoice {
  id: number;
  tenant_id: string;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal_cents: number;
  tax_rate: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  payment_method: string | null;
  is_overdue: boolean;
  days_overdue: number;
  created_at: string;
  line_items?: LineItem[];
  notes?: string | null;
  terms?: string | null;
  payment_reference?: string | null;
}

interface FormLineItem {
  description: string;
  quantity: string;
  unit_price: string; // Rands as string for input
}

const EMPTY_LINE_ITEM: FormLineItem = { description: '', quantity: '1', unit_price: '' };

const DEFAULT_VAT_RATE = 15;

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border border-gray-200',
  sent: 'bg-blue-100 text-blue-700 border border-blue-200',
  paid: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  overdue: 'bg-rose-100 text-rose-700 border border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const PAYMENT_METHODS = ['cash', 'card', 'eft', 'cheque', 'other'] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toCents(rands: string): number {
  const n = parseFloat(rands);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const InvoicesPage: React.FC = () => {
  const { has } = useCapabilities();
  const canManage = has('manage-finances');
  const queryClient = useQueryClient();

  // ---- filters / UI state ----
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payModalId, setPayModalId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState('');

  // ---- create form state ----
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<FormLineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [notes, setNotes] = useState('');
  const [dueDays, setDueDays] = useState('30');

  // ---- queries ----
  const {
    data: invoices,
    isLoading,
    isError,
    error,
  } = useQuery<Invoice[]>({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<Invoice[]>('/invoices/', { params });
      return res.data;
    },
    staleTime: 30_000,
    enabled: canManage,
  });

  const {
    data: detailInvoice,
    isFetching: detailFetching,
  } = useQuery<Invoice>({
    queryKey: ['invoice-detail', expandedId],
    queryFn: async () => {
      const res = await api.get<Invoice>(`/invoices/${expandedId}`);
      return res.data;
    },
    enabled: expandedId !== null && canManage,
    staleTime: 15_000,
  });

  // ---- mutations ----
  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        line_items: lineItems
          .filter((li) => li.description.trim())
          .map((li) => ({
            description: li.description,
            quantity: Number(li.quantity) || 1,
            unit_price_cents: toCents(li.unit_price),
          })),
        tax_rate: DEFAULT_VAT_RATE,
        discount_cents: 0,
        due_days: Number(dueDays) || 30,
        notes: notes || undefined,
      };
      const res = await api.post('/invoices/', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      resetCreateForm();
      toast.success('Invoice created');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to create invoice: ${msg}`);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/invoices/${id}/send`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
      toast.success('Invoice marked as sent');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to send invoice: ${msg}`);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const body = {
        payment_method: paymentMethod,
        payment_reference: paymentReference || undefined,
      };
      const res = await api.post(`/invoices/${id}/mark-paid`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
      setPayModalId(null);
      setPaymentMethod('cash');
      setPaymentReference('');
      toast.success('Invoice marked as paid');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to mark paid: ${msg}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setExpandedId(null);
      toast.success('Invoice deleted');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete invoice: ${msg}`);
    },
  });

  // ---- derived calculations for create form ----
  const { subtotalCents, taxCents, totalCents } = useMemo(() => {
    let sub = 0;
    for (const li of lineItems) {
      const qty = Number(li.quantity) || 0;
      const price = toCents(li.unit_price);
      sub += qty * price;
    }
    const tax = Math.round(sub * (DEFAULT_VAT_RATE / 100));
    return { subtotalCents: sub, taxCents: tax, totalCents: sub + tax };
  }, [lineItems]);

  // ---- form helpers ----
  const resetCreateForm = () => {
    setShowCreateModal(false);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
    setNotes('');
    setDueDays('30');
  };

  const updateLineItem = (idx: number, field: keyof FormLineItem, value: string) => {
    setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, [field]: value } : li)));
  };

  const addLineItem = () => setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);

  const removeLineItem = (idx: number) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleCreate = () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!lineItems.some((li) => li.description.trim())) {
      toast.error('At least one line item is required');
      return;
    }
    createMutation.mutate();
  };

  // ---- permission guard ----
  if (!canManage) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don&apos;t have permission to manage invoices.</p>
        </div>
      </div>
    );
  }

  // ---- render ----
  return (
    <AdminPageContainer
      title="Invoices"
      description="Create, send, and track customer invoices"
      actions={
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/invoices/export"
            params={statusFilter ? { status: statusFilter } : {}}
            format="csv"
            label="Export CSV"
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          />
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['invoices'] })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <HiOutlineRefresh className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-3 h-3" />
            New Invoice
          </button>
        </div>
      }
    >
      {/* ---- Filters ---- */}
      <div className="mb-6 flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* ---- Table ---- */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
            <p className="mt-2 text-gray-600">Loading invoices…</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">
                Failed to load invoices: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        ) : invoices && invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FaFileInvoiceDollar className="mx-auto w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices?.map((inv) => (
                  <React.Fragment key={inv.id}>
                    {/* Main row */}
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${
                        inv.is_overdue && inv.status !== 'paid' && inv.status !== 'cancelled'
                          ? 'bg-rose-50/40'
                          : ''
                      }`}
                      onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {expandedId === inv.id ? (
                            <FaChevronUp className="w-3 h-3 text-gray-400" />
                          ) : (
                            <FaChevronDown className="w-3 h-3 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-gray-900">
                            {inv.invoice_number}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 ml-5">{formatDate(inv.issue_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{inv.customer_name}</div>
                        {inv.customer_email && (
                          <div className="text-xs text-gray-500">{inv.customer_email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCents(inv.total_cents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft
                          }`}
                        >
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                        {inv.is_overdue &&
                          inv.status !== 'paid' &&
                          inv.status !== 'cancelled' && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-rose-600">
                              <FaExclamationTriangle className="w-3 h-3" />
                              {inv.days_overdue}d overdue
                            </span>
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(inv.due_date)}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {(inv.status === 'draft' || inv.status === 'sent') && (
                            <button
                              onClick={() => sendMutation.mutate(inv.id)}
                              disabled={sendMutation.isPending}
                              title="Mark as sent"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <FaPaperPlane className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setPayModalId(inv.id);
                                setPaymentMethod('cash');
                                setPaymentReference('');
                              }}
                              title="Mark as paid"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <FaCheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this draft invoice?')) {
                                  deleteMutation.mutate(inv.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              title="Delete draft"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <FaTrash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === inv.id && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50/80 px-6 py-4">
                          {detailFetching ? (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                              <LoadingSpinner size="sm" />
                              Loading details…
                            </div>
                          ) : detailInvoice ? (
                            <div className="space-y-3">
                              {/* Line items */}
                              {detailInvoice.line_items && detailInvoice.line_items.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                    Line Items
                                  </h4>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-xs text-gray-500">
                                        <th className="pb-1">Description</th>
                                        <th className="pb-1 text-right">Qty</th>
                                        <th className="pb-1 text-right">Unit Price</th>
                                        <th className="pb-1 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {detailInvoice.line_items.map((li, idx) => (
                                        <tr key={idx}>
                                          <td className="py-1 text-gray-700">{li.description}</td>
                                          <td className="py-1 text-right text-gray-600">
                                            {li.quantity}
                                          </td>
                                          <td className="py-1 text-right text-gray-600">
                                            {formatCents(li.unit_price_cents)}
                                          </td>
                                          <td className="py-1 text-right font-medium text-gray-800">
                                            {formatCents(li.quantity * li.unit_price_cents)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Totals */}
                              <div className="flex justify-end">
                                <div className="w-64 space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span>{formatCents(detailInvoice.subtotal_cents)}</span>
                                  </div>
                                  {detailInvoice.discount_cents > 0 && (
                                    <div className="flex justify-between text-emerald-600">
                                      <span>Discount</span>
                                      <span>-{formatCents(detailInvoice.discount_cents)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">
                                      VAT ({detailInvoice.tax_rate}%)
                                    </span>
                                    <span>{formatCents(detailInvoice.tax_cents)}</span>
                                  </div>
                                  <div className="flex justify-between font-semibold border-t pt-1">
                                    <span>Total</span>
                                    <span>{formatCents(detailInvoice.total_cents)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Notes */}
                              {detailInvoice.notes && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium text-gray-700">Notes: </span>
                                  {detailInvoice.notes}
                                </div>
                              )}

                              {/* Payment info */}
                              {detailInvoice.paid_date && (
                                <div className="text-sm text-emerald-700">
                                  Paid on {formatDate(detailInvoice.paid_date)}
                                  {detailInvoice.payment_method &&
                                    ` via ${detailInvoice.payment_method}`}
                                  {detailInvoice.payment_reference &&
                                    ` (Ref: ${detailInvoice.payment_reference})`}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Create Invoice Modal ---- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div className="fixed inset-0 bg-black/40" onClick={resetCreateForm} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900">New Invoice</h2>
              <button
                onClick={resetCreateForm}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+27 82 123 4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Line items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Line Items <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {lineItems.map((li, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <input
                        type="number"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                        placeholder="Qty"
                        min="1"
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <input
                        type="number"
                        value={li.unit_price}
                        onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)}
                        placeholder="Price (R)"
                        min="0"
                        step="0.01"
                        className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="p-2 text-gray-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                      >
                        <FaTimes className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addLineItem}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  + Add line item
                </button>
              </div>

              {/* Totals preview */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-end">
                  <div className="w-56 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatCents(subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">VAT ({DEFAULT_VAT_RATE}%)</span>
                      <span>{formatCents(taxCents)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total</span>
                      <span>{formatCents(totalCents)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes & due days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional notes for the customer…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Due (days)
                  </label>
                  <input
                    type="number"
                    value={dueDays}
                    onChange={(e) => setDueDays(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={resetCreateForm}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                {createMutation.isPending && <LoadingSpinner size="sm" color="white" />}
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Mark as Paid Modal ---- */}
      {payModalId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setPayModalId(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Mark Invoice as Paid</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Reference
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. EFT ref, cheque number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPayModalId(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => markPaidMutation.mutate(payModalId)}
                disabled={markPaidMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm"
              >
                {markPaidMutation.isPending && <LoadingSpinner size="sm" color="white" />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
};

export default InvoicesPage;
