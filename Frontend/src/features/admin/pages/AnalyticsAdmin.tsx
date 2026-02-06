import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCapabilities } from '../hooks/useCapabilities';
import { AdminPageContainer, AdminSection, AdminGrid } from '../components/AdminGrid';
import { StatCard, AdminCard } from '../components/AdminCard';
import api from '../../../api/api';
import { formatCurrency } from '../../../utils/format';

interface CustomerInsight {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  total_orders: number;
  total_revenue: number;
  last_order_date?: string;
  loyalty_points?: number;
}

interface ServicePerformance {
  service_name: string;
  order_count: number;
  total_revenue: number;
  avg_rating: number | null;
}

interface CustomerSegment {
  segment: string;
  count: number;
  percentage: number;
  avg_order_value: number;
  total_revenue: number;
}

interface LoyaltyStats {
  total_members: number;
  active_members: number;
  points_issued_this_month: number;
  points_redeemed_this_month: number;
  average_points_per_customer: number;
  redemption_rate: number;
}

type TabType = 'customers' | 'services' | 'loyalty' | 'segments';

const AnalyticsAdmin: React.FC = () => {
  const { has } = useCapabilities();
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [dateRange, setDateRange] = useState('30');

  // Top Customers (using existing endpoint)
  const { data: topCustomers, isLoading: customersLoading } = useQuery<CustomerInsight[]>({
    queryKey: ['top-customers', dateRange],
    queryFn: async () => {
      // This will return customer data - we'll use the customer-segmentation endpoint
      // In a real scenario, there should be a dedicated /analytics/customers/top endpoint
      const response = await api.get(`/customers?page=1&limit=20&sort_by=created_at&sort_order=desc`);
      return response.data.customers || [];
    },
    enabled: activeTab === 'customers',
  });

  // Service Performance
  const { data: servicePerformance, isLoading: servicesLoading } = useQuery<ServicePerformance[]>({
    queryKey: ['service-performance', dateRange],
    queryFn: async () => {
      const response = await api.get(`/reports/top-services?days=${dateRange}&limit=15`);
      return response.data;
    },
    enabled: activeTab === 'services',
  });

  // Loyalty Stats
  const { data: loyaltyStats, isLoading: loyaltyLoading } = useQuery<LoyaltyStats>({
    queryKey: ['loyalty-stats', dateRange],
    queryFn: async () => {
      const response = await api.get(`/reports/loyalty-stats?days=${dateRange}`);
      return response.data;
    },
    enabled: activeTab === 'loyalty',
  });

  // Customer Segmentation
  const { data: segments, isLoading: segmentsLoading } = useQuery<CustomerSegment[]>({
    queryKey: ['customer-segments', dateRange],
    queryFn: async () => {
      const response = await api.get(`/reports/customer-segmentation?days=${dateRange}`);
      return response.data;
    },
    enabled: activeTab === 'segments',
  });

  if (!has('view_reports')) {
    return (
      <AdminPageContainer title="Access Denied" description="">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Missing capability: view_reports</div>
        </div>
      </AdminPageContainer>
    );
  }

  const tabs = [
    { id: 'customers' as const, label: 'Customer Insights', icon: '👥' },
    { id: 'services' as const, label: 'Service Performance', icon: '📊' },
    { id: 'loyalty' as const, label: 'Loyalty Analytics', icon: '🎁' },
    { id: 'segments' as const, label: 'Segmentation', icon: '📈' },
  ];

  return (
    <AdminPageContainer
      title="Advanced Analytics"
      description="Deep dive into customer behavior, service performance, and business metrics"
    >
      {/* Date Range Filter */}
      <AdminSection>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </AdminSection>

      {/* Customer Insights Tab */}
      {activeTab === 'customers' && (
        <AdminSection>
          <AdminCard title="Top Customers by Activity" padding="base">
            {customersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
              </div>
            ) : topCustomers && topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                    <tr>
                      <th className="pb-3 pr-4">Customer</th>
                      <th className="pb-3 pr-4">Email</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {topCustomers.map((customer) => (
                      <tr key={customer.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-900">
                            {customer.first_name || customer.last_name
                              ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                              : 'Unknown'}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{customer.email || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Customer
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                        <td className="py-3 text-gray-600 text-xs">
                          {customer.last_order_date
                            ? new Date(customer.last_order_date).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No customer data available</p>
            )}
          </AdminCard>
        </AdminSection>
      )}

      {/* Service Performance Tab */}
      {activeTab === 'services' && (
        <AdminSection>
          <AdminCard title="Service Performance Metrics" padding="base">
            {servicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
              </div>
            ) : servicePerformance && servicePerformance.length > 0 ? (
              <div className="space-y-4">
                {servicePerformance.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{service.service_name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {service.order_count} orders
                        {service.avg_rating && ` • ${service.avg_rating.toFixed(1)}★ average rating`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(service.total_revenue)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(service.total_revenue / service.order_count)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No service data available</p>
            )}
          </AdminCard>
        </AdminSection>
      )}

      {/* Loyalty Analytics Tab */}
      {activeTab === 'loyalty' && (
        <>
          <AdminSection>
            <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }} gap="base">
              <StatCard
                label="Total Members"
                value={loyaltyStats?.total_members?.toLocaleString() || '0'}
              />
              <StatCard
                label="Active Members"
                value={loyaltyStats?.active_members?.toLocaleString() || '0'}
              />
              <StatCard
                label="Points Issued (Month)"
                value={loyaltyStats?.points_issued_this_month?.toLocaleString() || '0'}
              />
              <StatCard
                label="Redemption Rate"
                value={loyaltyStats?.redemption_rate ? `${(loyaltyStats.redemption_rate * 100).toFixed(1)}%` : '0%'}
              />
            </AdminGrid>
          </AdminSection>
          <AdminSection>
            <AdminCard title="Loyalty Program Health" padding="base">
              {loyaltyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
                </div>
              ) : loyaltyStats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Avg Points per Customer</span>
                    <span className="text-xl font-bold text-green-600">
                      {loyaltyStats.average_points_per_customer?.toFixed(0) || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Points Redeemed This Month</span>
                    <span className="text-xl font-bold text-blue-600">
                      {loyaltyStats.points_redeemed_this_month?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Member Engagement Rate</span>
                    <span className="text-xl font-bold text-purple-600">
                      {loyaltyStats.total_members > 0
                        ? ((loyaltyStats.active_members / loyaltyStats.total_members) * 100).toFixed(1)
                        : '0'}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No loyalty data available</p>
              )}
            </AdminCard>
          </AdminSection>
        </>
      )}

      {/* Customer Segmentation Tab */}
      {activeTab === 'segments' && (
        <AdminSection>
          <AdminCard title="Customer Segments" padding="base">
            {segmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
              </div>
            ) : segments && segments.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {segments.map((segment, index) => (
                  <div
                    key={index}
                    className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900">{segment.segment}</h3>
                      <span className="text-2xl font-bold text-blue-600">{segment.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customers:</span>
                        <span className="font-medium text-gray-900">{segment.count.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Order Value:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(segment.avg_order_value)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Revenue:</span>
                        <span className="font-medium text-green-600">{formatCurrency(segment.total_revenue)}</span>
                      </div>
                    </div>
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${segment.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No segmentation data available</p>
            )}
          </AdminCard>
        </AdminSection>
      )}
    </AdminPageContainer>
  );
};

export default AnalyticsAdmin;
