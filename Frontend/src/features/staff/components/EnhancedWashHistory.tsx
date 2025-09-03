// src/features/staff/components/EnhancedWashHistory.tsx
import React, { useState, useMemo } from 'react';
import { formatCents } from '../../../utils/format';
import { useSharedPeriod } from '../hooks/useSharedPeriod';
import { usePagedWashHistory } from '../hooks/useWashHistory';
import { Wash } from '../../../types';
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

  const getDurationColorClass = (minutes?: number) => {
    if (!minutes) return 'text-gray-400';
    if (minutes < 30) return 'text-green-600';
    if (minutes < 60) return 'text-blue-600';
    if (minutes < 120) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl overflow-hidden">
      {/* History Header */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-8 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
            <StaffIcon name="wash" />
          </div>
          Wash History & Analytics
        </h2>
        <p className="text-gray-600">Comprehensive wash tracking and performance insights</p>
      </div>

      {/* Analytics Dashboard */}
      <div className="bg-gray-50/50 p-8 border-b border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full border border-blue-200 text-blue-600">
              <StaffIcon name="analytics" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.totalWashes}</div>
              <div className="text-sm font-medium text-gray-500">Total washes</div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full border border-emerald-200 text-emerald-600">
              <StaffIcon name="completed" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.completedCount}</div>
              <div className="text-sm font-medium text-gray-500">Completed</div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full border border-amber-200 text-amber-600">
              <StaffIcon name="inProgress" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.activeCount}</div>
              <div className="text-sm font-medium text-gray-500">In progress</div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full border border-violet-200 text-violet-600">
              <StaffIcon name="duration" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatDuration(analytics.avgDuration)}</div>
              <div className="text-sm font-medium text-gray-500">Avg duration</div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-rose-100 to-pink-100 rounded-full border border-rose-200 text-rose-600">
              <StaffIcon name="performance" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{analytics.completionRate}%</div>
              <div className="text-sm font-medium text-gray-500">Completion rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Period & Filters */}
      <div className="p-8 border-b border-gray-100">
        {/* Period Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6" role="tablist" aria-label="Period presets">
          {periodPresets.map(p => (
            <button
              key={p.value}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                period === p.value 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
              }`}
              onClick={() => { setPeriod(p.value); setCurrentPage(1); }}
              role="tab"
              aria-selected={period === p.value}
            >{p.label}</button>
          ))}
          <div className="ml-auto px-3 py-1 bg-gray-50 rounded-lg text-sm text-gray-600 font-mono">
            {derivedRange.start} → {derivedRange.end}
          </div>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {period === 'custom' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Service Type</label>
            <input
              type="text"
              defaultValue={filters.serviceType}
              onChange={(e) => debounceChange('serviceType', e.target.value)}
              placeholder="Search service..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Customer</label>
            <input
              type="text"
              defaultValue={filters.customerSearch}
              onChange={(e) => debounceChange('customerSearch', e.target.value)}
              placeholder="Search customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <div className="flex flex-wrap gap-2">
              {['all','started','ended'].map(s => (
                <button 
                  key={s} 
                  type="button" 
                  className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                    filters.status === s
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                  onClick={() => handleFilterChange('status', s)}
                >
                  {s === 'all' ? 'All' : s === 'started' ? 'In Progress' : 'Completed'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Payment</label>
            <div className="flex flex-wrap gap-2">
              {['all','paid','loyalty'].map(p => (
                <button 
                  key={p} 
                  type="button" 
                  className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                    filters.paymentType === p
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                  onClick={() => handleFilterChange('paymentType', p)}
                >
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Sort</label>
            <select 
              value={filters.sort} 
              onChange={e => handleFilterChange('sort', e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
            >
              <option value="started_desc">Start Time (Latest)</option>
              <option value="duration_desc">Duration (Longest)</option>
              <option value="amount_desc">Amount (Highest)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={clearFilters} 
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Wash History Table */}
      <div className="p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="animate-spin mb-4 w-8 h-8 text-indigo-600">
              <StaffIcon name="loading" />
            </div>
            <p className="text-lg font-medium">Loading wash history...</p>
          </div>
        ) : washes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="mb-4 w-16 h-16 text-gray-400">
              <StaffIcon name="wash" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No washes found</h3>
            <p className="text-gray-600">Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Table Header */}
              <div className="bg-gray-50 grid grid-cols-8 gap-4 px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                <div>Customer</div>
                <div>Vehicle</div>
                <div>Service</div>
                <div>Amount</div>
                <div>Started</div>
                <div>Ended</div>
                <div>Duration</div>
                <div>Status</div>
              </div>
              
              {washes.map((wash) => (
                <div
                  key={wash.order_id}
                  className={`grid grid-cols-8 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-b-0 ${
                    selectedWash?.order_id === wash.order_id ? 'bg-indigo-50 border-indigo-200' : ''
                  }`}
                  onClick={() => setSelectedWash(wash)}
                >
                  <div className="flex flex-col">
                    <div className="font-medium text-gray-900">
                      {wash.user?.first_name} {wash.user?.last_name}
                    </div>
                    {wash.user?.phone && (
                      <div className="text-sm text-gray-500">{wash.user.phone}</div>
                    )}
                  </div>
                  
                  <div className="flex flex-col">
                    {wash.vehicle ? (
                      <div>
                        <div className="font-medium text-gray-900">{wash.vehicle.reg}</div>
                        <div className="text-sm text-gray-500">
                          {wash.vehicle.make} {wash.vehicle.model}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">No vehicle</span>
                    )}
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="font-medium text-gray-900">
                      {wash.service_name || 'Unknown Service'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="font-medium text-gray-900">
                      {(() => {
                        const cents = (wash as unknown as { amount_cents?: number }).amount_cents ?? wash.amount;
                        if (cents == null) return '—';
                        return formatCents(cents);
                      })()}
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="text-sm text-gray-900">{formatDateTime(wash.started_at)}</div>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="text-sm text-gray-900">
                      {wash.ended_at ? formatDateTime(wash.ended_at) : '—'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className={`text-sm font-medium ${getDurationColorClass(wash.duration_minutes)}`}>
                      {formatDuration(wash.duration_minutes)}
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      wash.status === 'started' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {wash.status === 'started' ? 'In Progress' : 'Completed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 px-6 py-4 bg-gray-50 rounded-lg">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Page {currentPage} • Showing {washes.length} of {pagedHistory?.total ?? washes.length} washes
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={(pagedHistory?.total ?? 0) <= currentPage * pageSize}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Detailed View Modal */}
      {selectedWash && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedWash(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Wash Details</h3>
              <button
                onClick={() => setSelectedWash(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <StaffIcon name="close" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Name:</span>
                    <span className="text-sm text-gray-900 font-medium">
                      {selectedWash.user?.first_name} {selectedWash.user?.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Phone:</span>
                    <span className="text-sm text-gray-900">{selectedWash.user?.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              {selectedWash.vehicle && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Registration:</span>
                      <span className="text-sm text-gray-900 font-medium">{selectedWash.vehicle.reg}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Make & Model:</span>
                      <span className="text-sm text-gray-900">
                        {selectedWash.vehicle.make} {selectedWash.vehicle.model}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Service Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Service:</span>
                    <span className="text-sm text-gray-900 font-medium">{selectedWash.service_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Order ID:</span>
                    <span className="text-sm text-gray-900 font-mono">{selectedWash.order_id}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Timing Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Started:</span>
                    <span className="text-sm text-gray-900">{formatDateTime(selectedWash.started_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Ended:</span>
                    <span className="text-sm text-gray-900">
                      {selectedWash.ended_at ? formatDateTime(selectedWash.ended_at) : 'In Progress'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Duration:</span>
                    <span className={`text-sm font-medium ${getDurationColorClass(selectedWash.duration_minutes)}`}>
                      {formatDuration(selectedWash.duration_minutes)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedWash.status === 'started' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
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
