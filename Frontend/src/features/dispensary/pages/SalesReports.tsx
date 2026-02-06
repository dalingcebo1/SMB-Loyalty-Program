/**
 * Dispensary Sales & Reports - Admin Page
 * View sales history and compliance reports
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaChartLine, FaSearch, FaFilter, FaDownload, FaEye } from 'react-icons/fa';
import { useTenant } from '../../../config/TenantConfigProvider';
import { formatCents } from '../../../utils/format';
import '../../../styles/admin-modern.css';

interface SaleItem {
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

interface Sale {
  id: number;
  customer_id: number;
  customer_name?: string;
  staff_id?: number;
  staff_name?: string;
  total_amount_cents: number;
  tax_amount_cents: number;
  payment_method: string;
  transaction_reference?: string;
  status: string;
  items: SaleItem[];
  sale_date: string;
  created_at: string;
}

const SalesReports: React.FC = () => {
  const { tenantId } = useTenant();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Fetch sales
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['dispensary-sales', tenantId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`${API_BASE}/api/dispensary/sales?${params}`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch sales');
      return response.json();
    },
    enabled: !!tenantId
  });

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch = 
        sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.id.toString().includes(searchTerm);
      
      const matchesStatus = !filterStatus || sale.status === filterStatus;
      const matchesPaymentMethod = !filterPaymentMethod || sale.payment_method === filterPaymentMethod;

      return matchesSearch && matchesStatus && matchesPaymentMethod;
    });
  }, [sales, searchTerm, filterStatus, filterPaymentMethod]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_amount_cents, 0);
    const totalTax = filteredSales.reduce((sum, sale) => sum + sale.tax_amount_cents, 0);
    const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;

    const completedSales = filteredSales.filter(s => s.status === 'completed').length;
    const pendingSales = filteredSales.filter(s => s.status === 'pending').length;

    return {
      totalSales,
      totalRevenue,
      totalTax,
      averageSale,
      completedSales,
      pendingSales,
    };
  }, [filteredSales]);

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetailModal(true);
  };

  const handleExportReport = () => {
    // Create CSV data
    const headers = ['Sale ID', 'Date', 'Customer', 'Items', 'Total', 'Tax', 'Payment Method', 'Status'];
    const rows = filteredSales.map(sale => [
      sale.id,
      new Date(sale.sale_date).toLocaleDateString(),
      sale.customer_name || `Customer #${sale.customer_id}`,
      sale.items.length,
      formatCents(sale.total_amount_cents),
      formatCents(sale.tax_amount_cents),
      sale.payment_method,
      sale.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispensary-sales-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>
            <FaChartLine style={{ marginRight: '0.5rem' }} />
            Sales & Reports
          </h1>
          <p>View sales history and generate compliance reports</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportReport}>
          <FaDownload /> Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row" style={{ marginBottom: '2rem' }}>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#2196f3' }}>{stats.totalSales}</h3>
            <p style={{ margin: 0, color: '#666' }}>Total Sales</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#4caf50' }}>{formatCents(stats.totalRevenue)}</h3>
            <p style={{ margin: 0, color: '#666' }}>Total Revenue</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#ff9800' }}>{formatCents(stats.totalTax)}</h3>
            <p style={{ margin: 0, color: '#666' }}>Total Tax</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#9c27b0' }}>{formatCents(stats.averageSale)}</h3>
            <p style={{ margin: 0, color: '#666' }}>Average Sale</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <h4><FaFilter /> Filters</h4>
        <div className="row">
          <div className="col-md-3">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3">
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-2">
            <div className="form-group">
              <label>Status</label>
              <select
                className="form-control"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <label>Search</label>
              <div className="input-group">
                <span className="input-group-text"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by customer, transaction ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="admin-card">
        <h3>Sales History ({filteredSales.length})</h3>
        
        {isLoading ? (
          <p>Loading sales...</p>
        ) : filteredSales.length === 0 ? (
          <p>No sales found</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Customer</th>
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
                {filteredSales.map(sale => (
                  <tr key={sale.id}>
                    <td>#{sale.id}</td>
                    <td>{new Date(sale.sale_date).toLocaleString()}</td>
                    <td>{sale.customer_name || `Customer #${sale.customer_id}`}</td>
                    <td>{sale.items.length} items</td>
                    <td>{formatCents(sale.total_amount_cents - sale.tax_amount_cents)}</td>
                    <td>{formatCents(sale.tax_amount_cents)}</td>
                    <td><strong>{formatCents(sale.total_amount_cents)}</strong></td>
                    <td>
                      <span className="badge badge-info">
                        {sale.payment_method}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        sale.status === 'completed' ? 'badge-success' :
                        sale.status === 'pending' ? 'badge-warning' :
                        'badge-secondary'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleViewDetails(sale)}
                      >
                        <FaEye /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {showDetailModal && selectedSale && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Sale Details - #{selectedSale.id}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="row" style={{ marginBottom: '1rem' }}>
                <div className="col-md-6">
                  <p><strong>Date:</strong> {new Date(selectedSale.sale_date).toLocaleString()}</p>
                  <p><strong>Customer:</strong> {selectedSale.customer_name || `Customer #${selectedSale.customer_id}`}</p>
                  {selectedSale.staff_name && (
                    <p><strong>Staff:</strong> {selectedSale.staff_name}</p>
                  )}
                </div>
                <div className="col-md-6">
                  <p><strong>Payment Method:</strong> {selectedSale.payment_method}</p>
                  <p><strong>Status:</strong> {selectedSale.status}</p>
                  {selectedSale.transaction_reference && (
                    <p><strong>Transaction ID:</strong> {selectedSale.transaction_reference}</p>
                  )}
                </div>
              </div>

              <h4>Items</h4>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.product_name || `Product #${item.product_id}`}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCents(item.unit_price_cents)}</td>
                        <td>{formatCents(item.total_price_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: '2px solid #ddd', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Subtotal:</span>
                  <span>{formatCents(selectedSale.total_amount_cents - selectedSale.tax_amount_cents)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Tax:</span>
                  <span>{formatCents(selectedSale.tax_amount_cents)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', borderTop: '1px solid #ddd', paddingTop: '0.5rem' }}>
                  <span>Total:</span>
                  <span>{formatCents(selectedSale.total_amount_cents)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReports;
