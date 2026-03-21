import React, { useState } from 'react';
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
  FaCheckCircle,
  FaReceipt,
} from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import ExportButton from '../components/ExportButton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Expense {
  id: number;
  tenant_id: string;
  description: string;
  category: string;
  amount_cents: number;
  expense_date: string;
  vendor_name: string | null;
  vendor_reference: string | null;
  payment_method: string;
  is_tax_deductible: boolean;
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EXPENSE_CATEGORIES = [
  'inventory',
  'rent',
  'utilities',
  'salaries',
  'marketing',
  'equipment',
  'maintenance',
  'insurance',
  'taxes',
  'professional_services',
  'travel',
  'other',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  inventory: 'Inventory',
  rent: 'Rent',
  utilities: 'Utilities',
  salaries: 'Salaries',
  marketing: 'Marketing',
  equipment: 'Equipment',
  maintenance: 'Maintenance',
  insurance: 'Insurance',
  taxes: 'Taxes',
  professional_services: 'Professional Services',
  travel: 'Travel',
  other: 'Other',
};

const PAYMENT_METHODS = ['cash', 'card', 'eft', 'cheque', 'other'] as const;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  eft: 'EFT',
  cheque: 'Cheque',
  other: 'Other',
};

const APPROVAL_BADGE: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
};

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

const ExpensesPage: React.FC = () => {
  const { has } = useCapabilities();
  const canManage = has('manage-finances');
  const queryClient = useQueryClient();

  // ---- filters ----
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [approvedFilter, setApprovedFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ---- UI state ----
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ---- create form state ----
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('other');
  const [formAmount, setFormAmount] = useState('');
  const [formExpenseDate, setFormExpenseDate] = useState('');
  const [formVendorName, setFormVendorName] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>('cash');
  const [formTaxDeductible, setFormTaxDeductible] = useState(true);
  const [formTaxRate, setFormTaxRate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formReceiptPath, setFormReceiptPath] = useState('');

  // ---- queries ----
  const {
    data: expenses,
    isLoading,
    isError,
    error,
  } = useQuery<Expense[]>({
    queryKey: ['expenses', categoryFilter, approvedFilter, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (approvedFilter === 'approved') params.approved_only = 'true';
      if (approvedFilter === 'pending') params.approved_only = 'false';
      const res = await api.get<Expense[]>('/expenses/', { params });
      return res.data;
    },
    staleTime: 30_000,
    enabled: canManage,
  });

  // ---- mutations ----
  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        description: formDescription,
        category: formCategory,
        amount_cents: toCents(formAmount),
        expense_date: formExpenseDate,
        payment_method: formPaymentMethod,
        is_tax_deductible: formTaxDeductible,
      };
      if (formVendorName.trim()) body.vendor_name = formVendorName;
      if (formTaxRate.trim()) body.tax_rate = parseFloat(formTaxRate);
      if (formNotes.trim()) body.notes = formNotes;
      if (formReceiptPath.trim()) body.receipt_path = formReceiptPath;
      const res = await api.post('/expenses/', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      resetCreateForm();
      toast.success('Expense created');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to create expense: ${msg}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/expenses/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense approved');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to approve expense: ${msg}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete expense: ${msg}`);
    },
  });

  // ---- form helpers ----
  const resetCreateForm = () => {
    setShowCreateModal(false);
    setFormDescription('');
    setFormCategory('other');
    setFormAmount('');
    setFormExpenseDate('');
    setFormVendorName('');
    setFormPaymentMethod('cash');
    setFormTaxDeductible(true);
    setFormTaxRate('');
    setFormNotes('');
    setFormReceiptPath('');
  };

  const handleCreate = () => {
    if (!formDescription.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!formAmount || toCents(formAmount) <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (!formExpenseDate) {
      toast.error('Expense date is required');
      return;
    }
    createMutation.mutate();
  };

  // ---- permission guard ----
  if (!canManage) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don&apos;t have permission to manage expenses.</p>
        </div>
      </div>
    );
  }

  // ---- render ----
  return (
    <AdminPageContainer
      title="Expenses"
      description="Track and manage business expenses"
      actions={
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/expenses/export"
            params={categoryFilter ? { category: categoryFilter } : {}}
            format="csv"
            label="Export CSV"
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          />
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
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
            New Expense
          </button>
        </div>
      }
    >
      {/* ---- Filters ---- */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        <select
          value={approvedFilter}
          onChange={(e) => setApprovedFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <label htmlFor="start-date">From</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <label htmlFor="end-date">To</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {(categoryFilter || approvedFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setCategoryFilter('');
              setApprovedFilter('');
              setStartDate('');
              setEndDate('');
            }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ---- Table ---- */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
            <p className="mt-2 text-gray-600">Loading expenses…</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">
                Failed to load expenses: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        ) : expenses && expenses.length === 0 ? (
          <div className="p-8 text-center">
            <FaReceipt className="mx-auto w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No expenses found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses?.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{exp.description}</div>
                      {exp.vendor_name && (
                        <div className="text-xs text-gray-500">{exp.vendor_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {CATEGORY_LABELS[exp.category] ?? exp.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCents(exp.amount_cents)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {PAYMENT_METHOD_LABELS[exp.payment_method] ?? exp.payment_method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          exp.is_approved ? APPROVAL_BADGE.approved : APPROVAL_BADGE.pending
                        }`}
                      >
                        {exp.is_approved ? 'Approved' : 'Pending'}
                      </span>
                      {exp.is_tax_deductible && (
                        <span className="ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          Tax Deductible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!exp.is_approved && (
                          <button
                            onClick={() => approveMutation.mutate(exp.id)}
                            disabled={approveMutation.isPending}
                            title="Approve expense"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <FaCheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this expense?')) {
                              deleteMutation.mutate(exp.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="Delete expense"
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Create Modal ---- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div className="fixed inset-0 bg-black/40" onClick={resetCreateForm} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Expense</h2>
              <button
                onClick={resetCreateForm}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaTimes className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Office supplies purchase"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (Rands) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Expense Date & Payment Method */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expense Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formExpenseDate}
                    onChange={(e) => setFormExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {PAYMENT_METHOD_LABELS[pm]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vendor Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name
                </label>
                <input
                  type="text"
                  value={formVendorName}
                  onChange={(e) => setFormVendorName(e.target.value)}
                  placeholder="e.g. Staples"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Tax Deductible & Tax Rate */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTaxDeductible}
                      onChange={(e) => setFormTaxDeductible(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                  <span className="text-sm font-medium text-gray-700">Tax Deductible</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formTaxRate}
                    onChange={(e) => setFormTaxRate(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Receipt Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Path
                </label>
                <input
                  type="text"
                  value={formReceiptPath}
                  onChange={(e) => setFormReceiptPath(e.target.value)}
                  placeholder="e.g. /receipts/2025/receipt-001.pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes about this expense"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
              <button
                onClick={resetCreateForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" color="white" />
                    Creating…
                  </>
                ) : (
                  <>
                    <FaPlus className="w-3 h-3" />
                    Create Expense
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
};

export default ExpensesPage;
