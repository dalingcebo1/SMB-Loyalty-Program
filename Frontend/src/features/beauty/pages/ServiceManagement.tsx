import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiEdit2, FiTrash2, FiTag } from 'react-icons/fi';
import { beautyApi } from '../../../api/verticals/beauty';
import type { BeautyService } from '../types';

interface ServiceFormData {
  name: string;
  description: string;
  category: string;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  online_booking_enabled: boolean;
  points_multiplier: number;
  active: boolean;
}

const defaultFormData: ServiceFormData = {
  name: '',
  description: '',
  category: '',
  price_cents: 0,
  duration_minutes: 30,
  buffer_minutes: 10,
  online_booking_enabled: true,
  points_multiplier: 1.0,
  active: true,
};

export default function ServiceManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<BeautyService | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(defaultFormData);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Fetch services
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['beauty-services', selectedCategory],
    queryFn: async () => {
      const params: { category?: string } = {};
      if (selectedCategory) params.category = selectedCategory;
      const response = await beautyApi.listServices(params);
      return response.data;
    },
  });

  // Create service mutation
  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const response = await beautyApi.createService(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beauty-services'] });
      setShowForm(false);
      setFormData(defaultFormData);
    },
  });

  // Update service mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ServiceFormData }) => {
      const response = await beautyApi.updateService(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beauty-services'] });
      setShowForm(false);
      setEditingService(null);
      setFormData(defaultFormData);
    },
  });

  // Delete service mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await beautyApi.deleteService(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beauty-services'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (service: BeautyService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category,
      price_cents: service.price_cents,
      duration_minutes: service.duration_minutes,
      buffer_minutes: service.buffer_minutes,
      online_booking_enabled: service.online_booking_enabled,
      points_multiplier: service.points_multiplier,
      active: service.active,
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this service?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData(defaultFormData);
  };

  const categories = Array.from(new Set(services.map((s: BeautyService) => s.category))) as string[];

  const formatPrice = (cents: number) => `R${(cents / 100).toFixed(2)}`;

  if (isLoading) {
    return <div className="p-6">Loading services...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Management</h1>
          <p className="text-gray-600 mt-1">Manage your beauty and salon services</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <FiPlus /> Add Service
        </button>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-lg ${
              !selectedCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Service Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingService ? 'Edit Service' : 'Add New Service'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Haircut, Manicure, Massage"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Detailed service description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Hair, Nails, Spa"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (R) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.price_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price_cents: Math.round(parseFloat(e.target.value) * 100),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes) *
                  </label>
                  <input
                    type="number"
                    required
                    min="5"
                    step="5"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buffer Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={formData.buffer_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, buffer_minutes: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points Multiplier
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.points_multiplier}
                    onChange={(e) =>
                      setFormData({ ...formData, points_multiplier: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.online_booking_enabled}
                      onChange={(e) =>
                        setFormData({ ...formData, online_booking_enabled: e.target.checked })
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Enable Online Booking</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingService
                    ? 'Update Service'
                    : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service: BeautyService) => (
          <div key={service.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <FiTag className="text-gray-400 text-sm" />
                  <span className="text-sm text-gray-600">{service.category}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(service)}
                  className="p-1 text-gray-600 hover:text-blue-600"
                  title="Edit"
                >
                  <FiEdit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="p-1 text-gray-600 hover:text-red-600"
                  title="Delete"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>

            {service.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{service.description}</p>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {formatPrice(service.price_cents)}
                </div>
                <div className="text-xs text-gray-500">{service.duration_minutes} min</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {!service.active && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
                {service.online_booking_enabled && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    Online
                  </span>
                )}
                {service.points_multiplier !== 1 && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {service.points_multiplier}x points
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {services.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No services found</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first service
          </button>
        </div>
      )}
    </div>
  );
}
