import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaUser, FaEnvelope, FaPhone, FaEdit, FaSave, FaTimes, FaCar, FaPlus, FaTrash, FaShoppingCart, FaGift, FaHistory } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  created_at: string;
}

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  color: string;
  created_at: string;
}

interface Order {
  id: number;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  vehicle_info: string | null;
}

interface Redemption {
  id: number;
  reward_name: string;
  points_used: number;
  created_at: string;
}

interface LoyaltySummary {
  current_points: number;
  total_earned: number;
  total_redeemed: number;
  tier_name: string;
  next_tier_points: number | null;
}

interface ProfileData {
  profile: UserProfile;
  vehicles: Vehicle[];
  recent_orders: Order[];
  recent_redemptions: Redemption[];
  loyalty_summary: LoyaltySummary;
}

interface VehicleForm {
  make: string;
  model: string;
  year: number;
  license_plate: string;
  color: string;
}

const EnhancedProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
    color: '',
  });

  // Fetch complete profile data
  const { data: profileData, isLoading, error } = useQuery<ProfileData>({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const response = await api.get('/profile');
      return response.data;
    },
    enabled: !!user,
  });

  // Initialize forms when data loads
  React.useEffect(() => {
    if (profileData && !isEditingProfile) {
      setProfileForm({
        first_name: profileData.profile.first_name,
        last_name: profileData.profile.last_name,
        phone: profileData.profile.phone,
      });
    }
  }, [profileData, isEditingProfile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const response = await api.patch('/profile', updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      refreshUser();
      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(errorMessage);
    },
  });

  // Add vehicle mutation
  const addVehicleMutation = useMutation({
    mutationFn: async (vehicle: VehicleForm) => {
      const response = await api.post('/profile/vehicles', vehicle);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      setShowVehicleForm(false);
      setVehicleForm({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
        color: '',
      });
      toast.success('Vehicle added successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add vehicle';
      toast.error(errorMessage);
    },
  });

  // Delete vehicle mutation
  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      await api.delete(`/profile/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast.success('Vehicle deleted successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete vehicle';
      toast.error(errorMessage);
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    addVehicleMutation.mutate(vehicleForm);
  };

  const handleDeleteVehicle = (vehicleId: number) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      deleteVehicleMutation.mutate(vehicleId);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Failed to load profile data. Please try again.</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['user-profile'] })}
            className="mt-2 text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['user-profile'] })}
          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <HiOutlineRefresh className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FaUser className="w-5 h-5" />
                Personal Information
              </h2>
              {!isEditingProfile ? (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <FaEdit className="w-4 h-4" />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <FaSave className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <FaTimes className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                ) : (
                  <p className="text-gray-900">{profileData.profile.first_name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                ) : (
                  <p className="text-gray-900">{profileData.profile.last_name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="flex items-center gap-2">
                  <FaEnvelope className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{profileData.profile.email}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                {isEditingProfile ? (
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <FaPhone className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-900">{profileData.profile.phone || 'Not provided'}</p>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Vehicles */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FaCar className="w-5 h-5" />
                My Vehicles
              </h2>
              <button
                onClick={() => setShowVehicleForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="w-4 h-4" />
                Add Vehicle
              </button>
            </div>

            {profileData.vehicles.length === 0 ? (
              <div className="text-center py-8">
                <FaCar className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No vehicles added yet</p>
                <p className="text-sm text-gray-500 mt-2">Add your vehicles to make booking easier</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {profileData.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-sm text-gray-600">
                          License: {vehicle.license_plate} • Color: {vehicle.color}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Added: {new Date(vehicle.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order History */}
          {profileData.recent_orders.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FaShoppingCart className="w-5 h-5" />
                Recent Orders
              </h2>
              <div className="space-y-4">
                {profileData.recent_orders.map((order) => (
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
                        <p className="font-medium text-gray-900">${order.total_amount.toFixed(2)}</p>
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Loyalty Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaGift className="w-5 h-5" />
              Loyalty Program
            </h2>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-blue-600">
                {profileData.loyalty_summary.current_points}
              </p>
              <p className="text-sm text-gray-600">Current Points</p>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tier</span>
                <span className="font-semibold text-gray-900">
                  {profileData.loyalty_summary.tier_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Earned</span>
                <span className="font-semibold text-gray-900">
                  {profileData.loyalty_summary.total_earned} pts
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Redeemed</span>
                <span className="font-semibold text-gray-900">
                  {profileData.loyalty_summary.total_redeemed} pts
                </span>
              </div>
              {profileData.loyalty_summary.next_tier_points && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next Tier</span>
                  <span className="font-semibold text-gray-900">
                    {profileData.loyalty_summary.next_tier_points} pts
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Redemptions */}
          {profileData.recent_redemptions.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FaHistory className="w-5 h-5" />
                Recent Redemptions
              </h2>
              <div className="space-y-3">
                {profileData.recent_redemptions.map((redemption) => (
                  <div key={redemption.id} className="border border-gray-200 rounded-lg p-3">
                    <h3 className="font-medium text-gray-900">{redemption.reward_name}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-gray-600">
                        {new Date(redemption.created_at).toLocaleDateString()}
                      </span>
                      <span className="font-medium text-red-600">
                        -{redemption.points_used} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Vehicle</h2>
              <button
                onClick={() => setShowVehicleForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    value={vehicleForm.make}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Toyota"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Camry"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="text"
                    value={vehicleForm.color}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="White"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                <input
                  type="text"
                  value={vehicleForm.license_plate}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ABC123"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={addVehicleMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <FaPlus className="w-4 h-4" />
                  Add Vehicle
                </button>
                <button
                  type="button"
                  onClick={() => setShowVehicleForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedProfile;
