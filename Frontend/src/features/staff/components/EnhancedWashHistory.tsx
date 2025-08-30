// src/features/staff/components/EnhancedWashHistory.tsx
import React, { useState, useMemo } from 'react';
import { useSharedPeriod } from '../hooks/useSharedPeriod';
import { usePagedWashHistory } from '../hooks/useWashHistory';
import { Wash } from '../../../types';
import './EnhancedWashHistory.css';
import { StaffIcon } from './StaffIcon';

interface FilterOptions {
  startDate: string;
  endDate: string;
  status: 'all' | 'started' | 'ended';
  serviceType: string;
  customerSearch: string;
  paymentType: 'all' | 'paid' | 'loyalty';
  sort: 'started_desc' | 'duration_desc' | 'amount_desc';
}

interface WashWithDuration extends Wash {
  duration_minutes?: number;
  duration_seconds?: number; // mirrored from backend
  amount?: number; // ensure amount recognized in this component
}

const periodPresets = [
  { label: 'Today', value: 'today', days: 1 },
  { label: 'Week', value: 'week', days: 7 },
  { label: 'Month', value: 'month', days: 30 },
  { label: 'Quarter', value: 'quarter', days: 90 },
  { label: 'Custom', value: 'custom', days: 0 }
];

const EnhancedWashHistory: React.FC = () => {
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: '',
    endDate: '',
    status: 'all',
    serviceType: '',
	customerSearch: '',
	paymentType: 'all',
    sort: 'started_desc'
  });
  const [period, setPeriod] = useSharedPeriod('week');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedWash, setSelectedWash] = useState<WashWithDuration | null>(null);

  // Build query parameters
  // Derive date range from period presets if manual dates not chosen
  const derivedRange = useMemo(() => {
    if (period === 'custom' && filters.startDate && filters.endDate) {
      return { start: filters.startDate, end: filters.endDate };
    }
    const preset = periodPresets.find(p => p.value === period && p.value !== 'custom') || periodPresets[1];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (preset.days - 1));
    return {
      start: start.toISOString().slice(0,10),
      end: end.toISOString().slice(0,10)
    };
  }, [period, filters.startDate, filters.endDate]);

  const queryParams = {
    startDate: derivedRange.start,
    endDate: derivedRange.end,
    status: filters.status !== 'all' ? filters.status : undefined,
    serviceType: filters.serviceType || undefined,
    customerSearch: filters.customerSearch || undefined,
  paymentType: filters.paymentType !== 'all' ? filters.paymentType : undefined,
    page: currentPage,
    limit: pageSize
  };

  const { data: pagedHistory, isLoading } = usePagedWashHistory(queryParams);
  
  // Process history data
  const washes: WashWithDuration[] = React.useMemo(() => {
    if (!pagedHistory) return [];
    return pagedHistory.items.map((wash) => {
      const w = wash as WashWithDuration; // may already include duration_seconds
      let duration_minutes: number | undefined;
      if (typeof w.duration_seconds === 'number') {
        duration_minutes = Math.floor(w.duration_seconds / 60);
      } else if (w.status === 'ended' && w.ended_at) {
        const startTime = new Date(w.started_at);
        const endTime = new Date(w.ended_at);
        duration_minutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      }
      return { ...w, duration_minutes };
    });
  }, [pagedHistory]);

  // Analytics calculations
  const analytics = React.useMemo(() => {
    const completedWashes = washes.filter(w => w.status === 'ended' && w.duration_minutes);
  const totalWashes = pagedHistory?.total ?? washes.length;
    const completedCount = completedWashes.length;
    const activeCount = washes.filter(w => w.status === 'started').length;
    
    const avgDuration = completedWashes.length > 0
      ? Math.round(completedWashes.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) / completedWashes.length)
      : 0;
    
    const completionRate = totalWashes > 0 ? Math.round((completedCount / totalWashes) * 100) : 0;
    
    // Service type breakdown
    const serviceBreakdown = washes.reduce((acc, wash) => {
      const service = wash.service_name || 'Unknown';
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalWashes,
      completedCount,
      activeCount,
      avgDuration,
      completionRate,
      serviceBreakdown
    };
  }, [washes, pagedHistory?.total]);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: 'all',
      serviceType: '',
	customerSearch: '',
	paymentType: 'all',
      sort: 'started_desc'
    });
    setCurrentPage(1);
  };

  // Debounce for text inputs
  const [debouncers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceChange = (key: keyof FilterOptions, value: string) => {
    if (debouncers[key]) clearTimeout(debouncers[key]);
    debouncers[key] = setTimeout(() => {
      setFilters(prev => ({ ...prev, [key]: value }));
      setCurrentPage(1);
    }, 300);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getDurationClass = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes < 30) return 'duration-fast';
    if (minutes < 60) return 'duration-normal';
    if (minutes < 120) return 'duration-slow';
    return 'duration-very-slow';
  };

  return (
    <div className="enhanced-wash-history">
      <div className="history-header">
        <h2>Wash History & Analytics</h2>
        <p>Comprehensive wash tracking and performance insights</p>
      </div>

      {/* Analytics Dashboard */}
      <div className="analytics-section">
        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="card-icon"><StaffIcon name="analytics" /></div>
            <div className="card-content">
              <div className="card-value">{analytics.totalWashes}</div>
              <div className="card-label">Total Washes</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon"><StaffIcon name="completed" /></div>
            <div className="card-content">
              <div className="card-value">{analytics.completedCount}</div>
              <div className="card-label">Completed</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon"><StaffIcon name="inProgress" /></div>
            <div className="card-content">
              <div className="card-value">{analytics.activeCount}</div>
              <div className="card-label">In Progress</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon"><StaffIcon name="duration" /></div>
            <div className="card-content">
              <div className="card-value">{formatDuration(analytics.avgDuration)}</div>
              <div className="card-label">Avg Duration</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon"><StaffIcon name="performance" /></div>
            <div className="card-content">
              <div className="card-value">{analytics.completionRate}%</div>
              <div className="card-label">Completion Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Period & Filters */}
      <div className="filters-section">
        <div className="period-tabs" role="tablist" aria-label="Period presets">
          {periodPresets.map(p => (
            <button
              key={p.value}
              className={`period-tab ${period === p.value ? 'active' : ''}`}
              onClick={() => { setPeriod(p.value); setCurrentPage(1); }}
              role="tab"
              aria-selected={period === p.value}
            >{p.label}</button>
          ))}
          <div className="range-indicator">{derivedRange.start} → {derivedRange.end}</div>
        </div>
        <div className="filters-grid">
          {period === 'custom' && (
            <>
              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="filter-input"
                />
              </div>
            </>
          )}
          <div className="filter-group wide">
            <label>Service Type</label>
            <input
              type="text"
              defaultValue={filters.serviceType}
              onChange={(e) => debounceChange('serviceType', e.target.value)}
              placeholder="Search service..."
              className="filter-input"
            />
          </div>
          <div className="filter-group wide">
            <label>Customer</label>
            <input
              type="text"
              defaultValue={filters.customerSearch}
              onChange={(e) => debounceChange('customerSearch', e.target.value)}
              placeholder="Search customer..."
              className="filter-input"
            />
          </div>
          <div className="filter-group pills">
            <label>Status</label>
            <div className="pill-group">
              {['all','started','ended'].map(s => (
                <button key={s} type="button" className={`pill ${filters.status === s ? 'active' : ''}`} onClick={() => handleFilterChange('status', s)}>
                  {s === 'all' ? 'All' : s === 'started' ? 'In Progress' : 'Completed'}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group pills">
            <label>Payment</label>
            <div className="pill-group">
              {['all','paid','loyalty'].map(p => (
                <button key={p} type="button" className={`pill ${filters.paymentType === p ? 'active' : ''}`} onClick={() => handleFilterChange('paymentType', p)}>
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label>Sort</label>
            <select value={filters.sort} onChange={e => handleFilterChange('sort', e.target.value)} className="filter-input">
              <option value="started_desc">Start Time (Latest)</option>
              <option value="duration_desc">Duration (Longest)</option>
              <option value="amount_desc">Amount (Highest)</option>
            </select>
          </div>
          <div className="filter-actions">
            <button onClick={clearFilters} className="clear-filters-btn">Clear Filters</button>
          </div>
        </div>
      </div>

      {/* Wash History Table */}
      <div className="history-section">
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"><StaffIcon name="loading" /></div>
            <p>Loading wash history...</p>
          </div>
        ) : washes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><StaffIcon name="wash" /></div>
            <h3>No washes found</h3>
            <p>Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <>
            <div className="history-table">
              <div className="table-header">
                <div className="header-cell">Customer</div>
                <div className="header-cell">Vehicle</div>
                <div className="header-cell">Service</div>
                <div className="header-cell">Amount</div>
                <div className="header-cell">Started</div>
                <div className="header-cell">Ended</div>
                <div className="header-cell">Duration</div>
                <div className="header-cell">Status</div>
              </div>
              
              {washes.map((wash) => (
                <div
                  key={wash.order_id}
                  className={`table-row ${selectedWash?.order_id === wash.order_id ? 'selected' : ''}`}
                  onClick={() => setSelectedWash(wash)}
                >
                  <div className="table-cell">
                    <div className="customer-info">
                      <div className="customer-name">
                        {wash.user?.first_name} {wash.user?.last_name}
                      </div>
                      {wash.user?.phone && (
                        <div className="customer-phone">{wash.user.phone}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="table-cell">
                    {wash.vehicle ? (
                      <div className="vehicle-info">
                        <div className="vehicle-reg">{wash.vehicle.reg}</div>
                        <div className="vehicle-model">
                          {wash.vehicle.make} {wash.vehicle.model}
                        </div>
                      </div>
                    ) : (
                      <span className="no-data">No vehicle</span>
                    )}
                  </div>
                  
                  <div className="table-cell">
                    <div className="service-name">
                      {wash.service_name || 'Unknown Service'}
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="amount-cell">{wash.amount != null ? `R${(wash.amount/100).toFixed(2)}` : '—'}</div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="datetime">{formatDateTime(wash.started_at)}</div>
                  </div>
                  
                  <div className="table-cell">
                    <div className="datetime">
                      {wash.ended_at ? formatDateTime(wash.ended_at) : '—'}
                    </div>
                  </div>
                  
                  <div className="table-cell">
                    <div className={`duration ${getDurationClass(wash.duration_minutes)}`}>
                      {formatDuration(wash.duration_minutes)}
                    </div>
                  </div>
                  
                  <div className="table-cell">
                    <div className={`status status-${wash.status}`}>
                      {wash.status === 'started' ? 'In Progress' : 'Completed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                ← Previous
              </button>
              
              <span className="pagination-info">
                Page {currentPage} • Showing {washes.length} of {pagedHistory?.total ?? washes.length} washes
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={(pagedHistory?.total ?? 0) <= currentPage * pageSize}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Detailed View Modal */}
      {selectedWash && (
        <div className="modal-overlay" onClick={() => setSelectedWash(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Wash Details</h3>
              <button
                onClick={() => setSelectedWash(null)}
                className="modal-close"
              >
                <StaffIcon name="close" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h4>Customer Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">
                      {selectedWash.user?.first_name} {selectedWash.user?.last_name}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{selectedWash.user?.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              {selectedWash.vehicle && (
                <div className="detail-section">
                  <h4>Vehicle Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Registration:</span>
                      <span className="detail-value">{selectedWash.vehicle.reg}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Make & Model:</span>
                      <span className="detail-value">
                        {selectedWash.vehicle.make} {selectedWash.vehicle.model}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="detail-section">
                <h4>Service Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Service:</span>
                    <span className="detail-value">{selectedWash.service_name || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Order ID:</span>
                    <span className="detail-value">{selectedWash.order_id}</span>
                  </div>
                </div>
              </div>
              
              <div className="detail-section">
                <h4>Timing Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Started:</span>
                    <span className="detail-value">{formatDateTime(selectedWash.started_at)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Ended:</span>
                    <span className="detail-value">
                      {selectedWash.ended_at ? formatDateTime(selectedWash.ended_at) : 'In Progress'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Duration:</span>
                    <span className={`detail-value ${getDurationClass(selectedWash.duration_minutes)}`}>
                      {formatDuration(selectedWash.duration_minutes)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-${selectedWash.status}`}>
                      {selectedWash.status === 'started' ? 'In Progress' : 'Completed'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedWashHistory;
