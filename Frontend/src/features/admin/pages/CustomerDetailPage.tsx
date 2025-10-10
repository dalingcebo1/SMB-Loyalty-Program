import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaArrowLeft, FaEnvelope, FaPhone, FaCalendar, FaShoppingCart, FaGift, FaCar, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../../utils/format';

interface CustomerDetail {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  created_at: string;
  loyalty_points: number;
  total_spent: number;
  order_count: number;
  last_order_date: string | null;
  vehicles: Vehicle[];
  recent_orders: Order[];
  loyalty_summary: LoyaltySummary;
}

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  color: string;
}

interface Order {
  id: number;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  vehicle_info?: string;
}

interface LoyaltySummary {
  current_points: number;
  total_earned: number;
  total_redeemed: number;
  tier_name: string;
  next_tier_points: number | null;
}

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has: hasCapability } = useCapabilities();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });

  const { data: customer, isLoading, error, isError } = useQuery<CustomerDetail>({
    queryKey: ['customer-detail', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Initialize edit form when customer data loads
  React.useEffect(() => {
    if (customer && !isEditing) {
      setEditForm({
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      });
    }
  }, [customer, isEditing]);

  const updateCustomerMutation = useMutation({
    mutationFn: async (updates: Partial<CustomerDetail>) => {
      const response = await api.patch(`/customers/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setIsEditing(false);
      toast.success('Customer updated successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to update customer: ${errorMessage}`);
    },
  });

  const handleSaveEdit = () => {
    updateCustomerMutation.mutate(editForm);
  };

  const handleCancelEdit = () => {
    if (customer) {
      setEditForm({
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      });
    }
    setIsEditing(false);
  };

  // Check permissions
  if (!hasCapability('manage_customers')) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don't have permission to view customer details.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Failed to load customer details: {error?.message}</p>
          <button
            onClick={() => navigate('/admin/customers')}
            className="mt-2 text-blue-600 hover:text-blue-800"
          >
            ← Back to customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/customers')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Customers
          </button>
          <div className="h-6 border-l border-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-gray-600">Customer ID: {customer.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaEdit className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={updateCustomerMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <FaSave className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={updateCustomerMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <FaTimes className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['customer-detail', id] })}
            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <HiOutlineRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-900">{customer.first_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-900">{customer.last_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="flex items-center gap-2">
                  <FaEnvelope className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{customer.email}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <FaPhone className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-900">{customer.phone || 'Not provided'}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  customer.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                  customer.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {customer.role}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                <div className="flex items-center gap-2">
                  <FaCalendar className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{new Date(customer.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicles */}
          {customer.vehicles && customer.vehicles.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FaCar className="w-5 h-5" />
                Vehicles
              </h2>
              <div className="grid gap-4">
                {customer.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-sm text-gray-600">
                          License: {vehicle.license_plate} • Color: {vehicle.color}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {customer.recent_orders && customer.recent_orders.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FaShoppingCart className="w-5 h-5" />
                Recent Orders
              </h2>
              <div className="space-y-4">
                {customer.recent_orders.map((order) => (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{order.service_name}</h3>
                        <p className="text-sm text-gray-600">
                          Order #{order.id} • {new Date(order.created_at).toLocaleDateString()}
                        </p>
                        {order.vehicle_info && (
                          <p className="text-sm text-gray-500">{order.vehicle_info}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Statistics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Orders</span>
                <span className="font-semibold text-gray-900">{customer.order_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Spent</span>
                <span className="font-semibold text-gray-900">{formatCurrency(customer.total_spent)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Loyalty Points</span>
                <span className="font-semibold text-gray-900">{customer.loyalty_points} pts</span>
              </div>
              {customer.last_order_date && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Last Order</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(customer.last_order_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Loyalty Summary */}
          {customer.loyalty_summary && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FaGift className="w-5 h-5" />
                Loyalty Program
              </h2>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {customer.loyalty_summary.current_points}
                  </p>
                  <p className="text-sm text-gray-600">Current Points</p>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tier</span>
                    <span className="font-semibold text-gray-900">
                      {customer.loyalty_summary.tier_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Earned</span>
                    <span className="font-semibold text-gray-900">
                      {customer.loyalty_summary.total_earned} pts
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Redeemed</span>
                    <span className="font-semibold text-gray-900">
                      {customer.loyalty_summary.total_redeemed} pts
                    </span>
                  </div>
                  {customer.loyalty_summary.next_tier_points && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Next Tier</span>
                      <span className="font-semibold text-gray-900">
                        {customer.loyalty_summary.next_tier_points} pts
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailPage;
