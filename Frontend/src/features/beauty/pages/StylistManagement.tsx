import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiEdit2, FiTrash2, FiClock, FiCheck, FiX } from 'react-icons/fi';

interface Stylist {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  commission_rate: number;
  accepts_walk_ins: boolean;
  active: boolean;
}

interface BeautyService {
  id: number;
  name: string;
  category: string;
  price_cents: number;
  duration_minutes: number;
}

interface StylistAvailability {
  id: number;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  specific_date: string | null;
  is_available: boolean;
}

interface StylistFormData {
  name: string;
  email: string;
  phone: string;
  title: string;
  bio: string;
  photo_url: string;
  commission_rate: number;
  accepts_walk_ins: boolean;
  active: boolean;
}

const defaultFormData: StylistFormData = {
  name: '',
  email: '',
  phone: '',
  title: '',
  bio: '',
  photo_url: '',
  commission_rate: 0,
  accepts_walk_ins: true,
  active: true,
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StylistManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [formData, setFormData] = useState<StylistFormData>(defaultFormData);
  const [selectedStylist, setSelectedStylist] = useState<number | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);

  // Fetch stylists
  const { data: stylists = [], isLoading } = useQuery({
    queryKey: ['stylists'],
    queryFn: async () => {
      const response = await fetch('/api/beauty/stylists');
      if (!response.ok) throw new Error('Failed to fetch stylists');
      return response.json();
    },
  });

  // Fetch all services
  const { data: allServices = [] } = useQuery({
    queryKey: ['beauty-services'],
    queryFn: async () => {
      const response = await fetch('/api/beauty/services');
      if (!response.ok) throw new Error('Failed to fetch services');
      return response.json();
    },
  });

  // Fetch stylist availability
  const { data: availability = [] } = useQuery({
    queryKey: ['stylist-availability', selectedStylist],
    enabled: !!selectedStylist,
    queryFn: async () => {
      const response = await fetch(`/api/beauty/stylists/${selectedStylist}/availability`);
      if (!response.ok) throw new Error('Failed to fetch availability');
      return response.json();
    },
  });

  // Create stylist mutation
  const createMutation = useMutation({
    mutationFn: async (data: StylistFormData) => {
      const response = await fetch('/api/beauty/stylists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create stylist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stylists'] });
      setShowForm(false);
      setFormData(defaultFormData);
    },
  });

  // Update stylist mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: StylistFormData }) => {
      const response = await fetch(`/api/beauty/stylists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update stylist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stylists'] });
      setShowForm(false);
      setEditingStylist(null);
      setFormData(defaultFormData);
    },
  });

  // Delete stylist mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/beauty/stylists/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete stylist');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stylists'] });
    },
  });

  // Add service to stylist mutation
  const assignServiceMutation = useMutation({
    mutationFn: async ({ stylistId, serviceId }: { stylistId: number; serviceId: number }) => {
      const response = await fetch(`/api/beauty/stylists/${stylistId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });
      if (!response.ok) throw new Error('Failed to assign service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stylists'] });
    },
  });

  // Add availability mutation
  const addAvailabilityMutation = useMutation({
    mutationFn: async ({
      stylistId,
      data,
    }: {
      stylistId: number;
      data: {
        day_of_week: number | null;
        start_time: string;
        end_time: string;
        specific_date: string | null;
        is_available: boolean;
      };
    }) => {
      const response = await fetch(`/api/beauty/stylists/${stylistId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to add availability');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stylist-availability'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStylist) {
      updateMutation.mutate({ id: editingStylist.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (stylist: Stylist) => {
    setEditingStylist(stylist);
    setFormData({
      name: stylist.name,
      email: stylist.email || '',
      phone: stylist.phone || '',
      title: stylist.title || '',
      bio: stylist.bio || '',
      photo_url: stylist.photo_url || '',
      commission_rate: stylist.commission_rate,
      accepts_walk_ins: stylist.accepts_walk_ins,
      active: stylist.active,
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this stylist?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStylist(null);
    setFormData(defaultFormData);
  };

  const handleManageAvailability = (stylistId: number) => {
    setSelectedStylist(stylistId);
    setShowAvailabilityModal(true);
  };

  const handleManageServices = (stylistId: number) => {
    setSelectedStylist(stylistId);
    setShowServicesModal(true);
  };

  if (isLoading) {
    return <div className="p-6">Loading stylists...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stylist Management</h1>
          <p className="text-gray-600 mt-1">Manage your team members and their schedules</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <FiPlus /> Add Stylist
        </button>
      </div>

      {/* Stylist Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingStylist ? 'Edit Stylist' : 'Add New Stylist'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Senior Stylist, Nail Technician, Massage Therapist"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief professional bio..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo URL
                  </label>
                  <input
                    type="url"
                    value={formData.photo_url}
                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.commission_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.accepts_walk_ins}
                      onChange={(e) =>
                        setFormData({ ...formData, accepts_walk_ins: e.target.checked })
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Accepts Walk-ins</span>
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
                    : editingStylist
                    ? 'Update Stylist'
                    : 'Create Stylist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Availability Modal */}
      {showAvailabilityModal && selectedStylist && (
        <AvailabilityModal
          stylistId={selectedStylist}
          stylistName={stylists.find((s: Stylist) => s.id === selectedStylist)?.name || ''}
          availability={availability}
          onClose={() => {
            setShowAvailabilityModal(false);
            setSelectedStylist(null);
          }}
          onAdd={addAvailabilityMutation.mutate}
        />
      )}

      {/* Services Modal */}
      {showServicesModal && selectedStylist && (
        <ServicesModal
          stylistId={selectedStylist}
          stylistName={stylists.find((s: Stylist) => s.id === selectedStylist)?.name || ''}
          allServices={allServices}
          onClose={() => {
            setShowServicesModal(false);
            setSelectedStylist(null);
          }}
          onAssign={assignServiceMutation.mutate}
        />
      )}

      {/* Stylists Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stylists.map((stylist: Stylist) => (
          <div key={stylist.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex gap-3 mb-3">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 flex-shrink-0">
                {stylist.photo_url ? (
                  <img
                    src={stylist.photo_url}
                    alt={stylist.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  stylist.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{stylist.name}</h3>
                {stylist.title && <p className="text-sm text-gray-600">{stylist.title}</p>}
                <div className="flex gap-2 mt-1">
                  {!stylist.active && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      Inactive
                    </span>
                  )}
                  {stylist.accepts_walk_ins && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      Walk-ins
                    </span>
                  )}
                </div>
              </div>
            </div>

            {stylist.bio && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{stylist.bio}</p>
            )}

            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleManageAvailability(stylist.id)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
              >
                <FiClock size={14} />
                Manage Schedule
              </button>
              <button
                onClick={() => handleManageServices(stylist.id)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
              >
                <FiCheck size={14} />
                Assign Services
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(stylist)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  <FiEdit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(stylist.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                >
                  <FiTrash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stylists.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No stylists found</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Add your first team member
          </button>
        </div>
      )}
    </div>
  );
}

// Availability Modal Component
function AvailabilityModal({
  stylistId,
  stylistName,
  availability,
  onClose,
  onAdd,
}: {
  stylistId: number;
  stylistName: string;
  availability: StylistAvailability[];
  onClose: () => void;
  onAdd: (data: {
    stylistId: number;
    data: {
      day_of_week: number | null;
      start_time: string;
      end_time: string;
      specific_date: string | null;
      is_available: boolean;
    };
  }) => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isAvailable, setIsAvailable] = useState(true);

  const handleAdd = () => {
    onAdd({
      stylistId,
      data: {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        specific_date: null,
        is_available: isAvailable,
      },
    });
  };

  const recurringAvailability = availability.filter((a) => a.day_of_week !== null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Availability Schedule - {stylistName}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        {/* Current Schedule */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Weekly Schedule</h3>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day, index) => {
              const daySlots = recurringAvailability.filter((a) => a.day_of_week === index);
              return (
                <div
                  key={day}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium text-gray-700 w-24">{day}</span>
                  <div className="flex-1 flex gap-2 flex-wrap">
                    {daySlots.length > 0 ? (
                      daySlots.map((slot) => (
                        <span
                          key={slot.id}
                          className={`text-sm px-3 py-1 rounded ${
                            slot.is_available
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No availability set</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add New Availability */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Add Availability</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Available</span>
              </label>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Time Slot
          </button>
        </div>
      </div>
    </div>
  );
}

// Services Assignment Modal Component
function ServicesModal({
  stylistId,
  stylistName,
  allServices,
  onClose,
  onAssign,
}: {
  stylistId: number;
  stylistName: string;
  allServices: BeautyService[];
  onClose: () => void;
  onAssign: (data: { stylistId: number; serviceId: number }) => void;
}) {
  const [selectedService, setSelectedService] = useState<number | null>(null);

  const handleAssign = () => {
    if (selectedService) {
      onAssign({ stylistId, serviceId: selectedService });
      setSelectedService(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Assign Services - {stylistName}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a service to assign
          </label>
          <select
            value={selectedService || ''}
            onChange={(e) => setSelectedService(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select Service --</option>
            {allServices.map((service: BeautyService) => (
              <option key={service.id} value={service.id}>
                {service.name} - R{(service.price_cents / 100).toFixed(2)} (
                {service.duration_minutes} min)
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAssign}
          disabled={!selectedService}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Assign Service
        </button>

        <div className="mt-6 border-t pt-4">
          <p className="text-sm text-gray-600">
            Note: You can assign multiple services to a stylist. Each service assignment can have
            custom pricing if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
