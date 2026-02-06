import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaCog, FaPlus, FaTrash, FaEdit, FaTimes,FaCheck, FaLightbulb, FaWrench } from 'react-icons/fa';
import api from '../../../api/api';
import { useTenant } from '../../../config/TenantConfigProvider';
import { formatCents } from '../../../utils/format';

interface Court {
  id: number;
  court_number: string;
  court_type: string;
  surface_type: string;
  has_lighting: boolean;
  base_price_cents: number;
  active: boolean;
  maintenance_mode: boolean;
  notes?: string;
  created_at: string;
}

interface PricingRule {
  id: number;
  court_id: number;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  price_per_hour_cents: number;
  label: string;
  priority: number;
  active: boolean;
  created_at: string;
}

interface CourtFormData {
  court_number: string;
  court_type: string;
  surface_type: string;
  has_lighting: boolean;
  base_price_cents: number;
  notes?: string;
}

interface PricingFormData {
  day_of_week?: number;
  start_time: string;
  end_time: string;
  price_per_hour_cents: number;
  label: string;
  priority: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const COURT_TYPES = ['standard', 'professional', 'training'];
const SURFACE_TYPES = ['synthetic_grass', 'concrete', 'artificial_turf'];

export default function CourtManagement() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [showCourtForm, setShowCourtForm] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [courtForPricing, setCourtForPricing] = useState<number | null>(null);

  const [courtForm, setCourtForm] = useState<CourtFormData>({
    court_number: '',
    court_type: 'standard',
    surface_type: 'synthetic_grass',
    has_lighting: false,
    base_price_cents: 15000, // R150/hour default
    notes: '',
  });

  const [pricingForm, setPricingForm] = useState<PricingFormData>({
    day_of_week: undefined,
    start_time: '18:00',
    end_time: '22:00',
    price_per_hour_cents: 20000, // R200/hour for peak
    label: 'Peak Hours',
    priority: 10,
  });

  // Fetch courts
  const { data: courts = [], isLoading } = useQuery({
    queryKey: ['padel', 'courts', tenantId],
    queryFn: async () => {
      const response = await api.get('/api/padel/courts');
      return response.data as Court[];
    },
    enabled: !!tenantId,
  });

  // Fetch pricing rules for a specific court
  const { data: pricingRules = [] } = useQuery({
    queryKey: ['padel', 'pricing', courtForPricing],
    queryFn: async () => {
      const response = await api.get(`/api/padel/courts/${courtForPricing}/pricing`);
      return response.data as PricingRule[];
    },
    enabled: !!courtForPricing,
  });

  // Create court mutation
  const createCourtMutation = useMutation({
    mutationFn: (data: CourtFormData) => api.post('/api/padel/courts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'courts'] });
      setShowCourtForm(false);
      resetCourtForm();
    },
  });

  // Update court mutation
  const updateCourtMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CourtFormData> }) =>
      api.put(`/api/padel/courts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'courts'] });
      setSelectedCourt(null);
      setShowCourtForm(false);
      resetCourtForm();
    },
  });

  // Delete court mutation
  const deleteCourtMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/padel/courts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'courts'] });
    },
  });

  // Toggle maintenance mode
  const toggleMaintenanceMutation = useMutation({
    mutationFn: ({ id, maintenance_mode }: { id: number; maintenance_mode: boolean }) =>
      api.put(`/api/padel/courts/${id}`, { maintenance_mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'courts'] });
    },
  });

  // Create pricing rule mutation
  const createPricingMutation = useMutation({
    mutationFn: ({ courtId, data }: { courtId: number; data: PricingFormData }) =>
      api.post(`/api/padel/courts/${courtId}/pricing`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'pricing'] });
      setShowPricingForm(false);
      resetPricingForm();
    },
  });

  // Delete pricing rule mutation
  const deletePricingMutation = useMutation({
    mutationFn: ({ courtId, pricingId }: { courtId: number; pricingId: number }) =>
      api.delete(`/api/padel/courts/${courtId}/pricing/${pricingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'pricing'] });
    },
  });

  const resetCourtForm = () => {
    setCourtForm({
      court_number: '',
      court_type: 'standard',
      surface_type: 'synthetic_grass',
      has_lighting: false,
      base_price_cents: 15000,
      notes: '',
    });
  };

  const resetPricingForm = () => {
    setPricingForm({
      day_of_week: undefined,
      start_time: '18:00',
      end_time: '22:00',
      price_per_hour_cents: 20000,
      label: 'Peak Hours',
      priority: 10,
    });
  };

  const handleAddCourt = () => {
    setSelectedCourt(null);
    resetCourtForm();
    setShowCourtForm(true);
  };

  const handleEditCourt = (court: Court) => {
    setSelectedCourt(court);
    setCourtForm({
      court_number: court.court_number,
      court_type: court.court_type,
      surface_type: court.surface_type,
      has_lighting: court.has_lighting,
      base_price_cents: court.base_price_cents,
      notes: court.notes || '',
    });
    setShowCourtForm(true);
  };

  const handleSubmitCourt = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCourt) {
      updateCourtMutation.mutate({ id: selectedCourt.id, data: courtForm });
    } else {
      createCourtMutation.mutate(courtForm);
    }
  };

  const handleManagePricing = (courtId: number) => {
    setCourtForPricing(courtId);
    setShowPricingForm(false);
  };

  const handleSubmitPricing = (e: React.FormEvent) => {
    e.preventDefault();
    if (courtForPricing) {
      createPricingMutation.mutate({ courtId: courtForPricing, data: pricingForm });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Court Management</h1>
          <p className="text-gray-600 text-sm mt-1">Manage padel courts, pricing rules, and maintenance</p>
        </div>
        <button
          onClick={handleAddCourt}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FaPlus className="w-4 h-4" />
          Add Court
        </button>
      </div>

      {/* Courts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map((court) => (
          <div
            key={court.id}
            className={`p-4 rounded-lg border-2 ${
              court.maintenance_mode
                ? 'bg-yellow-50 border-yellow-300'
                : court.active
                ? 'bg-white border-gray-200'
                : 'bg-gray-50 border-gray-300'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Court {court.court_number}</h3>
                <p className="text-sm text-gray-600 capitalize">{court.court_type.replace('_', ' ')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditCourt(court)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit court"
                >
                  <FaEdit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete court ${court.court_number}?`)) {
                      deleteCourtMutation.mutate(court.id);
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete court"
                >
                  <FaTrash className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Surface:</span>
                <span className="capitalize">{court.surface_type.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Base Price:</span>
                <span className="font-semibold text-blue-600">{formatCents(court.base_price_cents)}/hour</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {court.has_lighting ? (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <FaLightbulb className="w-4 h-4" />
                    Night play available
                  </span>
                ) : (
                  <span className="text-gray-500">No lighting</span>
                )}
              </div>
            </div>

            {court.notes && (
              <p className="text-xs text-gray-600 italic mb-3 line-clamp-2">{court.notes}</p>
            )}

            {court.maintenance_mode && (
              <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded mb-3">
                <FaWrench className="w-4 h-4" />
                <span className="font-medium">Under Maintenance</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleManagePricing(court.id)}
                className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
              >
                <FaCog className="w-3 h-3" />
                Pricing Rules
              </button>
              <button
                onClick={() =>
                  toggleMaintenanceMutation.mutate({
                    id: court.id,
                    maintenance_mode: !court.maintenance_mode,
                  })
                }
                className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                  court.maintenance_mode
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                <FaWrench className="w-3 h-3" />
                {court.maintenance_mode ? 'Enable' : 'Maintenance'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {courts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <FaCog className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No courts yet</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first padel court</p>
          <button
            onClick={handleAddCourt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Add First Court
          </button>
        </div>
      )}

      {/* Court Form Modal */}
      {showCourtForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedCourt ? 'Edit Court' : 'Add Court'}
              </h2>
              <button
                onClick={() => {
                  setShowCourtForm(false);
                  setSelectedCourt(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCourt} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Court Number *
                </label>
                <input
                  type="text"
                  required
                  value={courtForm.court_number}
                  onChange={(e) => setCourtForm({ ...courtForm, court_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1, A, Center, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Court Type *</label>
                <select
                  value={courtForm.court_type}
                  onChange={(e) => setCourtForm({ ...courtForm, court_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                >
                  {COURT_TYPES.map((type) => (
                    <option key={type} value={type} className="capitalize">
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surface Type *</label>
                <select
                  value={courtForm.surface_type}
                  onChange={(e) => setCourtForm({ ...courtForm, surface_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                >
                  {SURFACE_TYPES.map((type) => (
                    <option key={type} value={type} className="capitalize">
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Price (R/hour) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="10"
                  value={courtForm.base_price_cents / 100}
                  onChange={(e) =>
                    setCourtForm({ ...courtForm, base_price_cents: parseFloat(e.target.value) * 100 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="150"
                />
                <p className="text-xs text-gray-500 mt-1">Default hourly rate (before time-based pricing)</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="has_lighting"
                  checked={courtForm.has_lighting}
                  onChange={(e) => setCourtForm({ ...courtForm, has_lighting: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="has_lighting" className="text-sm font-medium text-gray-700">
                  Has lighting for night play
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={courtForm.notes}
                  onChange={(e) => setCourtForm({ ...courtForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Additional information about this court..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createCourtMutation.isPending || updateCourtMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <FaCheck className="w-4 h-4" />
                  {selectedCourt ? 'Update Court' : 'Create Court'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCourtForm(false);
                    setSelectedCourt(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pricing Rules Modal */}
      {courtForPricing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                Pricing Rules - Court {courts.find((c) => c.id === courtForPricing)?.court_number}
              </h2>
              <button
                onClick={() => {
                  setCourtForPricing(null);
                  setShowPricingForm(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="mb-4">
                <button
                  onClick={() => setShowPricingForm(!showPricingForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaPlus className="w-4 h-4" />
                  {showPricingForm ? 'Cancel' : 'Add Pricing Rule'}
                </button>
              </div>

              {/* Pricing Form */}
              {showPricingForm && (
                <form onSubmit={handleSubmitPricing} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                      <select
                        value={pricingForm.day_of_week ?? ''}
                        onChange={(e) =>
                          setPricingForm({
                            ...pricingForm,
                            day_of_week: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All days</option>
                        {DAYS_OF_WEEK.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <input
                        type="number"
                        required
                        value={pricingForm.priority}
                        onChange={(e) =>
                          setPricingForm({ ...pricingForm, priority: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="10"
                      />
                      <p className="text-xs text-gray-500 mt-1">Higher = higher priority</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                      <input
                        type="time"
                        required
                        value={pricingForm.start_time}
                        onChange={(e) => setPricingForm({ ...pricingForm, start_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                      <input
                        type="time"
                        required
                        value={pricingForm.end_time}
                        onChange={(e) => setPricingForm({ ...pricingForm, end_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                      <input
                        type="text"
                        required
                        value={pricingForm.label}
                        onChange={(e) => setPricingForm({ ...pricingForm, label: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Peak Hours, Weekend Rate, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price (R/hour) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="10"
                        value={pricingForm.price_per_hour_cents / 100}
                        onChange={(e) =>
                          setPricingForm({
                            ...pricingForm,
                            price_per_hour_cents: parseFloat(e.target.value) * 100,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="200"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={createPricingMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <FaCheck className="w-4 h-4" />
                    Add Pricing Rule
                  </button>
                </form>
              )}

              {/* Pricing Rules List */}
              <div className="space-y-2">
                {pricingRules.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No custom pricing rules. Court will use base price.
                  </p>
                ) : (
                  pricingRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{rule.label}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            Priority: {rule.priority}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {rule.day_of_week !== null && rule.day_of_week !== undefined
                            ? DAYS_OF_WEEK[rule.day_of_week].label
                            : 'All days'}{' '}
                          • {rule.start_time} - {rule.end_time} • {formatCents(rule.price_per_hour_cents)}/hour
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Delete pricing rule "${rule.label}"?`)) {
                            deletePricingMutation.mutate({ courtId: courtForPricing, pricingId: rule.id });
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
