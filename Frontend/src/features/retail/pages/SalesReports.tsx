import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FaChartLine, 
  FaCalendarAlt, 
  FaDownload, 
  FaFilter, 
  FaMoneyBillWave, 
  FaShoppingCart,
  FaReceipt,
  FaCreditCard,
  FaCashRegister,
  FaMobileAlt,
  FaWallet,
  FaTimes,
  FaPrint
} from 'react-icons/fa';
import api from '../../../api/api';
import { formatCents } from '../../../utils/format';
import { AdminPageContainer } from '../../admin/components/AdminGrid';
import '../../../styles/admin-modern.css';

interface SaleItem {
  id: number;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
}

interface Payment {
  id: number;
  payment_method: string;
  amount_cents: number;
  change_given_cents: number;
  status: string;
  created_at: string;
}

interface Sale {
  id: number;
  receipt_number: string;
  location: string;
  customer_id?: number;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  sale_status: string;
  payment_status: string;
  created_at: string;
  completed_at?: string;
  items: SaleItem[];
  sale_payments: Payment[];
}

interface SalesStats {
  total_sales: number;
  total_revenue_cents: number;
  average_sale_cents: number;
  sales_today: number;
  revenue_today_cents: number;
}

export default function SalesReports() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState<string>('completed');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch sales stats
  const { data: stats } = useQuery<SalesStats>({
    queryKey: ['pos-stats'],
    queryFn: async () => {
      const response = await api.get('/api/retail/pos/stats');
      return response.data;
    },
  });

  // Fetch sales list
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['pos-sales', statusFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('start_date', `${startDate}T00:00:00Z`);
      if (endDate) params.append('end_date', `${endDate}T23:59:59Z`);
      params.append('limit', '100');

      const response = await api.get(`/api/retail/pos/sales?${params}`);
      return response.data;
    },
  });

  // Update date range based on preset
  const handleDateRangeChange = (range: 'today' | 'week' | 'month' | 'custom') => {
    setDateRange(range);
    const today = new Date();
    
    switch (range) {
      case 'today':
        setStartDate(today.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
        break;
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setStartDate(weekAgo.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
        break;
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStartDate(monthAgo.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
        break;
      }
    }
  };

  // Calculate summary metrics from filtered sales
  const summary = useMemo(() => {
    const completedSales = sales.filter(s => s.sale_status === 'completed');
    const totalRevenue = completedSales.reduce((sum, s) => sum + s.total_cents, 0);
    const totalItems = completedSales.reduce(
      (sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.quantity, 0),
      0
    );
    
    // Payment method breakdown
    const paymentMethods = completedSales.reduce((acc, sale) => {
      sale.sale_payments.forEach(payment => {
        if (!acc[payment.payment_method]) {
          acc[payment.payment_method] = { count: 0, amount: 0 };
        }
        acc[payment.payment_method].count++;
        acc[payment.payment_method].amount += payment.amount_cents;
      });
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return {
      totalSales: completedSales.length,
      totalRevenue,
      averageSale: completedSales.length > 0 ? totalRevenue / completedSales.length : 0,
      totalItems,
      paymentMethods,
    };
  }, [sales]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Receipt Number',
      'Date',
      'Location',
      'Status',
      'Items',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'Payment Method',
    ];

    const rows = sales.map(sale => [
      sale.receipt_number,
      new Date(sale.created_at).toLocaleDateString(),
      sale.location,
      sale.sale_status,
      sale.items.length,
      formatCents(sale.subtotal_cents),
      formatCents(sale.tax_cents),
      formatCents(sale.discount_cents),
      formatCents(sale.total_cents),
      sale.sale_payments.map(p => p.payment_method).join(', '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <FaCashRegister className="text-green-600" />;
      case 'card':
        return <FaCreditCard className="text-blue-600" />;
      case 'mobile':
        return <FaMobileAlt className="text-purple-600" />;
      case 'wallet':
        return <FaWallet className="text-orange-600" />;
      default:
        return <FaMoneyBillWave className="text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'Completed', className: 'badge-success' },
      pending: { label: 'Pending', className: 'badge-warning' },
      voided: { label: 'Voided', className: 'badge-danger' },
      refunded: { label: 'Refunded', className: 'badge-secondary' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: 'badge-secondary',
    };

    return <span className={`badge ${config.className}`}>{config.label}</span>;
  };

  return (
    <AdminPageContainer title="Sales Reports">
      {/* Header */} title="Sales Reports"
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FaChartLine /> Sales Reports
          </h1>
          <p className="page-subtitle">
            Track sales performance and analyze transaction history
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Hide' : 'Show'} Filters
          </button>
          <button className="btn-primary" onClick={exportToCSV} disabled={sales.length === 0}>
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="admin-card">
          <div className="stat-card">
            <div className="stat-icon">
              <FaShoppingCart />
            </div>
            <div className="stat-content">
              <div className="stat-label">Today's Sales</div>
              <div className="stat-value">{stats?.sales_today || 0}</div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="stat-card">
            <div className="stat-icon text-green-600">
              <FaMoneyBillWave />
            </div>
            <div className="stat-content">
              <div className="stat-label">Today's Revenue</div>
              <div className="stat-value text-green-600">
                {formatCents(stats?.revenue_today_cents || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="stat-card">
            <div className="stat-icon text-blue-600">
              <FaReceipt />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Sales</div>
              <div className="stat-value">{stats?.total_sales || 0}</div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="stat-card">
            <div className="stat-icon text-purple-600">
              <FaChartLine />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value text-purple-600">
                {formatCents(stats?.total_revenue_cents || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="stat-card">
            <div className="stat-icon text-orange-600">
              <FaMoneyBillWave />
            </div>
            <div className="stat-content">
              <div className="stat-label">Average Sale</div>
              <div className="stat-value text-orange-600">
                {formatCents(stats?.average_sale_cents || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="admin-card mb-6">
          <div className="card-header">
            <h3 className="card-title">
              <FaFilter /> Filters
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Range Presets */}
              <div className="form-group">
                <label className="form-label">Date Range</label>
                <div className="flex gap-2">
                  {(['today', 'week', 'month', 'custom'] as const).map((range) => (
                    <button
                      key={range}
                      className={`btn-sm ${
                        dateRange === range ? 'btn-primary' : 'btn-secondary'
                      }`}
                      onClick={() => handleDateRangeChange(range)}
                    >
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Date */}
              <div className="form-group">
                <label className="form-label">
                  <FaCalendarAlt /> Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => {
                    setDateRange('custom');
                    setStartDate(e.target.value);
                  }}
                />
              </div>

              {/* End Date */}
              <div className="form-group">
                <label className="form-label">
                  <FaCalendarAlt /> End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => {
                    setDateRange('custom');
                    setEndDate(e.target.value);
                  }}
                />
              </div>

              {/* Status Filter */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="voided">Voided</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {/* Period Summary */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-600">Period Sales</div>
                  <div className="text-2xl font-bold">{summary.totalSales}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-600">Period Revenue</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCents(summary.totalRevenue)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-600">Average Sale</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCents(summary.averageSale)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-600">Items Sold</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {summary.totalItems}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods Breakdown */}
      {Object.keys(summary.paymentMethods).length > 0 && (
        <div className="admin-card mb-6">
          <div className="card-header">
            <h3 className="card-title">
              <FaCreditCard /> Payment Methods
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(summary.paymentMethods).map(([method, data]) => (
                <div key={method} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {getPaymentMethodIcon(method)}
                    <span className="font-medium capitalize">{method}</span>
                  </div>
                  <div className="text-sm text-gray-600">{data.count} transactions</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCents(data.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="admin-card">
        <div className="card-header">
          <h3 className="card-title">
            <FaReceipt /> Sales Transactions
          </h3>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="text-center py-8">Loading sales...</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sales found for the selected period
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date/Time</th>
                    <th>Location</th>
                    <th>Items</th>
                    <th>Subtotal</th>
                    <th>Tax</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-mono text-sm">{sale.receipt_number}</td>
                      <td>
                        <div className="text-sm">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(sale.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-secondary">{sale.location}</span>
                      </td>
                      <td>{sale.items.length}</td>
                      <td>{formatCents(sale.subtotal_cents)}</td>
                      <td>{formatCents(sale.tax_cents)}</td>
                      <td className="font-bold">{formatCents(sale.total_cents)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {sale.sale_payments.map((payment) => (
                            <div key={payment.id} className="flex items-center gap-1 text-sm">
                              {getPaymentMethodIcon(payment.payment_method)}
                              <span className="capitalize">{payment.payment_method}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>{getStatusBadge(sale.sale_status)}</td>
                      <td>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => setSelectedSale(sale)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="modal-overlay" onClick={() => setSelectedSale(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                Sale Details - {selectedSale.receipt_number}
              </h3>
              <button
                className="modal-close"
                onClick={() => setSelectedSale(null)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              {/* Sale Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-sm text-gray-600">Date/Time</div>
                  <div className="font-medium">
                    {new Date(selectedSale.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="font-medium">{selectedSale.location}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div>{getStatusBadge(selectedSale.sale_status)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Payment Status</div>
                  <div>{getStatusBadge(selectedSale.payment_status)}</div>
                </div>
              </div>

              {/* Items */}
              <h4 className="font-bold mb-3">Items</h4>
              <table className="table mb-6">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Discount</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td className="font-mono text-sm">{item.product_sku || '-'}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCents(item.unit_price_cents)}</td>
                      <td>{formatCents(item.discount_cents)}</td>
                      <td className="font-bold">{formatCents(item.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span>Subtotal:</span>
                  <span>{formatCents(selectedSale.subtotal_cents)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Discount:</span>
                  <span className="text-red-600">
                    -{formatCents(selectedSale.discount_cents)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Tax:</span>
                  <span>{formatCents(selectedSale.tax_cents)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-green-600">
                    {formatCents(selectedSale.total_cents)}
                  </span>
                </div>
              </div>

              {/* Payments */}
              <h4 className="font-bold mt-6 mb-3">Payments</h4>
              {selectedSale.sale_payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded mb-2"
                >
                  <div className="flex items-center gap-2">
                    {getPaymentMethodIcon(payment.payment_method)}
                    <span className="capitalize font-medium">
                      {payment.payment_method}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCents(payment.amount_cents)}</div>
                    {payment.change_given_cents > 0 && (
                      <div className="text-sm text-gray-600">
                        Change: {formatCents(payment.change_given_cents)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedSale(null)}>
                Close
              </button>
              <button className="btn-primary">
                <FaPrint /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
}
