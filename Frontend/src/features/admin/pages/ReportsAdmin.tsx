import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaChartLine, FaUsers, FaDollarSign, FaGift, FaTrophy, FaCalendarAlt } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatCurrency as formatCurrencyZAR } from '../../../utils/format';

interface BusinessSummary {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  active_customers: number;
  avg_order_value: number;
  loyalty_points_issued: number;
  loyalty_points_redeemed: number;
  top_service: {
    name: string;
    count: number;
  } | null;
}

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

interface ServicePerformance {
  service_name: string;
  order_count: number;
  total_revenue: number;
  avg_rating: number | null;
}

interface LoyaltyStats {
  total_members: number;
  active_members: number;
  points_issued_this_month: number;
  points_redeemed_this_month: number;
  average_points_per_customer: number;
  redemption_rate: number;
}

interface CustomerSegment {
  segment: string;
  count: number;
  percentage: number;
  avg_order_value: number;
  total_revenue: number;
}

const ReportsAdmin: React.FC = () => {
  const { has: hasCapability } = useCapabilities();
  const [dateRange, setDateRange] = useState('30'); // days
  const [refreshKey, setRefreshKey] = useState(0);

  // Business Summary
  const { data: summary, isLoading: summaryLoading } = useQuery<BusinessSummary>({
    queryKey: ['business-summary', dateRange, refreshKey],
    queryFn: async () => {
      const response = await api.get(`/reports/summary?days=${dateRange}`);
      return response.data;
    },
  });

  // Revenue Chart Data
  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData[]>({
    queryKey: ['revenue-chart', dateRange, refreshKey],
    queryFn: async () => {
      const response = await api.get(`/reports/revenue-chart?days=${dateRange}`);
      return response.data;
    },
  });

  // Service Performance
  const { data: servicePerformance, isLoading: serviceLoading } = useQuery<ServicePerformance[]>({
    queryKey: ['service-performance', dateRange, refreshKey],
    queryFn: async () => {
      const response = await api.get(`/reports/top-services?days=${dateRange}&limit=10`);
      return response.data;
    },
  });

  // Loyalty Statistics
  const { data: loyaltyStats, isLoading: loyaltyLoading } = useQuery<LoyaltyStats>({
    queryKey: ['loyalty-stats', dateRange, refreshKey],
    queryFn: async () => {
      const response = await api.get(`/reports/loyalty-stats?days=${dateRange}`);
      return response.data;
    },
  });

  // Customer Segmentation
  const { data: customerSegments, isLoading: segmentLoading } = useQuery<CustomerSegment[]>({
    queryKey: ['customer-segments', dateRange, refreshKey],
    queryFn: async () => {
      const response = await api.get(`/reports/customer-segmentation?days=${dateRange}`);
      return response.data;
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const formatCurrency = (amount?: number | null) => {
    if (amount === undefined || amount === null || Number.isNaN(amount)) {
      return formatCurrencyZAR(0);
    }
    return formatCurrencyZAR(amount);
  };

  const formatPercentage = (value: number) => {
    if (!Number.isFinite(value)) {
      return '0.0%';
    }
    const displayValue = value > 1 ? value : value * 100;
    return `${displayValue.toFixed(1)}%`;
  };

  // Check permissions
  if (!hasCapability('view_reports')) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don't have permission to view business reports.</p>
        </div>
      </div>
    );
  }

  const isLoading = summaryLoading || revenueLoading || serviceLoading || loyaltyLoading || segmentLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Reports</h1>
          <p className="text-gray-600">Analytics and insights for your business performance</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <HiOutlineRefresh className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(summary.total_revenue)}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <FaDollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total_orders}</p>
                    <p className="text-sm text-gray-500">
                      Avg: {formatCurrency(summary.avg_order_value)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <FaChartLine className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total_customers}</p>
                    <p className="text-sm text-gray-500">
                      Active: {summary.active_customers}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <FaUsers className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Loyalty Points</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summary.loyalty_points_issued.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Redeemed: {summary.loyalty_points_redeemed.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <FaGift className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            {revenueData && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FaChartLine className="w-5 h-5" />
                  Revenue Trend
                </h2>
                <div className="space-y-3">
                  {revenueData.slice(-10).map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <FaCalendarAlt className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(item.revenue)}
                        </p>
                        <p className="text-sm text-gray-500">{item.orders} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Services */}
            {servicePerformance && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FaTrophy className="w-5 h-5" />
                  Top Services
                </h2>
                <div className="space-y-3">
                  {servicePerformance.slice(0, 10).map((service, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{service.service_name}</p>
                        <p className="text-sm text-gray-500">
                          {service.order_count} orders
                          {service.avg_rating && (
                            <span> • {service.avg_rating.toFixed(1)}★</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(service.total_revenue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loyalty Statistics */}
            {loyaltyStats && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FaGift className="w-5 h-5" />
                  Loyalty Program Stats
                </h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Members</span>
                    <span className="font-semibold text-gray-900">
                      {loyaltyStats.total_members.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Active Members</span>
                    <span className="font-semibold text-gray-900">
                      {loyaltyStats.active_members.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Points Issued (Month)</span>
                    <span className="font-semibold text-gray-900">
                      {loyaltyStats.points_issued_this_month.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Points Redeemed (Month)</span>
                    <span className="font-semibold text-gray-900">
                      {loyaltyStats.points_redeemed_this_month.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Points/Customer</span>
                    <span className="font-semibold text-gray-900">
                      {loyaltyStats.average_points_per_customer.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Redemption Rate</span>
                    <span className="font-semibold text-gray-900">
                      {formatPercentage(loyaltyStats.redemption_rate)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Segmentation */}
            {customerSegments && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FaUsers className="w-5 h-5" />
                  Customer Segments
                </h2>
                <div className="space-y-3">
                  {customerSegments.map((segment, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{segment.segment}</h3>
                        <span className="text-sm text-gray-500">
                          {formatPercentage(segment.percentage)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Customers</p>
                          <p className="font-medium">{segment.count}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Avg Order</p>
                          <p className="font-medium">{formatCurrency(segment.avg_order_value)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Revenue</p>
                          <p className="font-medium">{formatCurrency(segment.total_revenue)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsAdmin;
