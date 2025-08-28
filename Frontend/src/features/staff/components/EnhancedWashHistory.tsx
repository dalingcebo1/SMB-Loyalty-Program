// src/features/staff/components/EnhancedWashHistory.tsx
import React, { useState } from 'react';
import { useWashHistory } from '../hooks';
import { Wash } from '../../../types';
import './EnhancedWashHistory.css';

interface FilterOptions {
  startDate: string;
  endDate: string;
  status: 'all' | 'started' | 'ended';
  serviceType: string;
  customerSearch: string;
}

interface WashWithDuration extends Wash {
  duration_minutes?: number;
}

const EnhancedWashHistory: React.FC = () => {
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: '',
    endDate: '',
    status: 'all',
    serviceType: '',
    customerSearch: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedWash, setSelectedWash] = useState<WashWithDuration | null>(null);

  // Build query parameters
  const queryParams = {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
    serviceType: filters.serviceType || undefined,
    customerSearch: filters.customerSearch || undefined,
    page: currentPage,
    limit: pageSize
  };

  const { data: historyData, isLoading } = useWashHistory(queryParams);
  
  // Process history data
  const washes: WashWithDuration[] = React.useMemo(() => {
    if (!historyData) return [];
    
    return historyData.map((wash: Wash) => {
      let duration_minutes: number | undefined;
      
      if (wash.status === 'ended' && wash.ended_at) {
        const startTime = new Date(wash.started_at);
        const endTime = new Date(wash.ended_at);
        duration_minutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      }
      
      return { ...wash, duration_minutes };
    });
  }, [historyData]);

  // Analytics calculations
  const analytics = React.useMemo(() => {
    const completedWashes = washes.filter(w => w.status === 'ended' && w.duration_minutes);
    const totalWashes = washes.length;
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
  }, [washes]);

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
      customerSearch: ''
    });
    setCurrentPage(1);
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
            <div className="card-icon">📊</div>
            <div className="card-content">
              <div className="card-value">{analytics.totalWashes}</div>
              <div className="card-label">Total Washes</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">✅</div>
            <div className="card-content">
              <div className="card-value">{analytics.completedCount}</div>
              <div className="card-label">Completed</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">🔄</div>
            <div className="card-content">
              <div className="card-value">{analytics.activeCount}</div>
              <div className="card-label">In Progress</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">⏱️</div>
            <div className="card-content">
              <div className="card-value">{formatDuration(analytics.avgDuration)}</div>
              <div className="card-label">Avg Duration</div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">📈</div>
            <div className="card-content">
              <div className="card-value">{analytics.completionRate}%</div>
              <div className="card-label">Completion Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
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
          
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-input"
            >
              <option value="all">All Status</option>
              <option value="started">In Progress</option>
              <option value="ended">Completed</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Service Type</label>
            <input
              type="text"
              value={filters.serviceType}
              onChange={(e) => handleFilterChange('serviceType', e.target.value)}
              placeholder="Service name..."
              className="filter-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Customer</label>
            <input
              type="text"
              value={filters.customerSearch}
              onChange={(e) => handleFilterChange('customerSearch', e.target.value)}
              placeholder="Customer name..."
              className="filter-input"
            />
          </div>
          
          <div className="filter-actions">
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Wash History Table */}
      <div className="history-section">
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <p>Loading wash history...</p>
          </div>
        ) : washes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧽</div>
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
                Page {currentPage} • Showing {washes.length} washes
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={washes.length < pageSize}
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
                ✕
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
