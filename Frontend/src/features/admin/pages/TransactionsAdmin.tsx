import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { useCapabilities } from '../hooks/useCapabilities';
import { formatCents, formatDateTime, formatRelativeTime } from '../../../utils/format';

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

interface TransactionItem {
  payment: TransactionPayment;
  order: TransactionOrder;
  customer: TransactionCustomer;
  service: TransactionService;
}

interface TransactionsResponse {
  items: TransactionItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  summary: {
    count: number;
    total_amount_cents: number;
    status_counts: Record<string, number>;
    method_counts: Record<string, number>;
  };
  available_filters: {
    statuses: string[];
    methods: string[];
    sources: string[];
  };
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const statusBadge = (status?: string | null) => {
  switch ((status || '').toLowerCase()) {
    case 'success':
    case 'paid':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'failed':
    case 'declined':
      return 'bg-rose-100 text-rose-700 border border-rose-200';
    case 'pending':
    case 'processing':
    case 'initialized':
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
};

const methodBadge = (method?: string | null) => {
  if (!method) return 'bg-slate-100 text-slate-600 border border-slate-200';
  const normalized = method.toLowerCase();
  if (normalized.includes('yoco')) return 'bg-blue-100 text-blue-700 border border-blue-200';
  if (normalized.includes('cash')) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
};

const DEFAULT_PAGE_SIZE = 25;

const TransactionsAdmin: React.FC = () => {
  const { has } = useCapabilities();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'amount' | 'status' | 'order_created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const debouncedSearch = useDebounce(search);

  const filterMemo = useMemo(() => ({
    statusFilter,
    methodFilter,
    sourceFilter,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
  }), [statusFilter, methodFilter, sourceFilter, startDate, endDate, minAmount, maxAmount, sortBy, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [filterMemo, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const fetchTransactions = async (): Promise<TransactionsResponse> => {
    const params: Record<string, string | number> = {
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    if (statusFilter) params.status = statusFilter;
    if (methodFilter) params.method = methodFilter;
    if (sourceFilter) params.source = sourceFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (debouncedSearch) params.search = debouncedSearch.trim();
    const min = parseFloat(minAmount);
    if (!Number.isNaN(min)) params.min_amount = Math.round(min * 100);
    const max = parseFloat(maxAmount);
    if (!Number.isNaN(max)) params.max_amount = Math.round(max * 100);
    const response = await api.get<TransactionsResponse>('/admin/transactions', { params });
    return response.data;
  };

  const { data, isLoading, isFetching, refetch } = useQuery<TransactionsResponse>({
    queryKey: ['admin-transactions', page, pageSize, filterMemo, debouncedSearch],
    queryFn: fetchTransactions,
    placeholderData: (previous) => previous,
    enabled: has('payments.view'),
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { page: 1, page_size: pageSize, total: 0, total_pages: 0 };
  const summary = data?.summary ?? { count: 0, total_amount_cents: 0, status_counts: {}, method_counts: {} };
  const availableFilters = data?.available_filters ?? { statuses: [], methods: [], sources: [] };

  const totalCount = summary.count ?? 0;
  const totalAmountFormatted = formatCents(summary.total_amount_cents ?? 0);
  const successCount = summary.status_counts?.success ?? 0;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  const methodEntries = useMemo(() => (
    Object.entries(summary.method_counts ?? {}) as [string, number][]
  ), [summary.method_counts]);
  const computedTotalPages = useMemo(() => {
    if (pagination.total_pages && pagination.total_pages > 0) {
      return pagination.total_pages;
    }
    if (totalCount > 0) {
      return Math.max(1, Math.ceil(totalCount / pageSize));
    }
    return 1;
  }, [pagination.total_pages, totalCount, pageSize]);

  useEffect(() => {
    if (!isLoading && page > computedTotalPages) {
      setPage(computedTotalPages);
    }
  }, [page, computedTotalPages, isLoading]);

  const resetFilters = () => {
    setStatusFilter('');
    setMethodFilter('');
    setSourceFilter('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSearch('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  if (!has('payments.view')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-10 text-center shadow-sm">
            <div className="text-2xl font-semibold text-red-700 mb-2">Access denied</div>
            <p className="text-sm text-red-500">Missing capability: payments.view</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-500 text-white shadow-xl">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_55%)]" />
          <div className="relative z-10 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
              <p className="mt-1 text-blue-100">Review all payment activity across your tenant with real-time filters.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/30 disabled:opacity-60 transition"
              >
                <HiOutlineRefresh className={isFetching ? 'animate-spin' : ''} />
                <span>{isFetching ? 'Refreshing…' : 'Refresh'}</span>
              </button>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE)}
                className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/40 text-white text-sm focus:outline-none"
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size} className="text-slate-900">{size} / page</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 backdrop-blur border border-slate-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Volume</p>
            <div className="text-3xl font-bold text-slate-900 mt-2">{totalAmountFormatted}</div>
            <p className="text-xs text-slate-500 mt-2">Across {totalCount} transactions</p>
          </div>
          <div className="bg-white/90 backdrop-blur border border-slate-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Success Rate</p>
            <div className="text-3xl font-bold text-emerald-600 mt-2">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-slate-500 mt-2">{successCount} successful payments</p>
          </div>
          <div className="bg-white/90 backdrop-blur border border-slate-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Top Methods</p>
            <div className="mt-2 space-y-1">
              {methodEntries.length === 0 && <div className="text-sm text-slate-500">No method data yet</div>}
              {methodEntries.slice(0, 3).map(([method, count]) => (
                <div key={method} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{method || 'Unknown'}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur border border-slate-100 rounded-3xl px-6 py-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Reference, transaction, email, phone…"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                >
                  <option value="">All statuses</option>
                  {availableFilters.statuses.map((status: string) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Method</label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                >
                  <option value="">All methods</option>
                  {availableFilters.methods.map((method: string) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                >
                  <option value="">All sources</option>
                  {availableFilters.sources.map((src: string) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Min amount (ZAR)</label>
                <input
                  type="number"
                  min="0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Max amount (ZAR)</label>
                <input
                  type="number"
                  min="0"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="5000.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Sort by</label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  >
                    <option value="created_at">Payment date</option>
                    <option value="order_created_at">Order date</option>
                    <option value="amount">Amount</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                    className="w-28 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 flex items-end gap-3">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-24 flex items-center justify-center"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-4 text-left">Payment</th>
                    <th className="px-6 py-4 text-left">Amount</th>
                    <th className="px-6 py-4 text-left">Customer</th>
                    <th className="px-6 py-4 text-left">Order</th>
                    <th className="px-6 py-4 text-left">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium text-slate-700">No transactions found</div>
                            <div className="text-sm text-slate-500">Adjust your filters or date range to discover payments.</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {items.map((item: TransactionItem) => {
                    const payment = item.payment;
                    const order = item.order;
                    const customer = item.customer;
                    const service = item.service;
                    const paymentDate = payment.created_at ?? order.created_at ?? '';
                    const orderIdLabel = order.id ? `#${order.id}` : '—';
                    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email || 'Unknown customer';
                    return (
                      <tr key={payment.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(payment.status)}`}>
                                {payment.status || 'unknown'}
                              </span>
                              {payment.method && (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${methodBadge(payment.method)}`}>
                                  {payment.method}
                                </span>
                              )}
                              {payment.source && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  {payment.source}
                                </span>
                              )}
                              {payment.card_brand && (
                                <span className="text-xs text-slate-400">{payment.card_brand}</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {paymentDate ? formatDateTime(paymentDate) : '—'}
                            </div>
                            {paymentDate && (
                              <div className="text-xs text-slate-400">{formatRelativeTime(paymentDate)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-semibold text-slate-900">{formatCents(payment.amount_cents ?? 0)}</div>
                          {order.amount_cents != null && order.amount_cents !== payment.amount_cents && (
                            <div className="text-xs text-slate-500">Order: {formatCents(order.amount_cents)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-medium text-slate-900">{customerName}</div>
                          {customer.email && (
                            <div className="text-xs text-slate-500">{customer.email}</div>
                          )}
                          {customer.phone && (
                            <div className="text-xs text-slate-500">{customer.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-medium text-slate-900">{orderIdLabel}</div>
                          <div className="text-xs text-slate-500">{order.status || '—'}</div>
                          {service.name && (
                            <div className="text-xs text-slate-400">{service.name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-mono text-sm text-slate-900 break-all">{payment.reference || '—'}</div>
                          {payment.transaction_id && (
                            <div className="font-mono text-xs text-slate-500 break-all">{payment.transaction_id}</div>
                          )}
                          {order.payment_pin && (
                            <div className="text-xs text-slate-400">PIN: {order.payment_pin}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {isFetching && !isLoading && (
            <div className="border-t border-slate-100 px-6 py-2 text-xs text-slate-500 flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span>Updating results…</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-500">
            Showing {items.length} of {pagination.total} transactions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              Previous
            </button>
            <div className="text-sm font-medium text-slate-600">
              Page {page} of {computedTotalPages}
            </div>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= computedTotalPages || totalCount === 0}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionsAdmin;
