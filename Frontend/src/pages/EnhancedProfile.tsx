import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaCar,
  FaEdit,
  FaEnvelope,
  FaGift,
  FaHistory,
  FaPhone,
  FaPlus,
  FaSave,
  FaTimes,
  FaTrash,
  FaUser,
  FaShoppingCart,
} from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserCard, UserHero, UserPage, UserSection } from '../components/user';
import { notifySuccess, notifyError } from '../utils/notifications';
import { formatCents } from '../utils/format';
import { track } from '../utils/analytics';
import './EnhancedProfile.css';

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

const getOrderStatusClass = (status: string | undefined): string => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case 'completed':
      return 'enhanced-profile__status enhanced-profile__status--completed';
    case 'pending':
      return 'enhanced-profile__status enhanced-profile__status--pending';
    case 'cancelled':
    case 'canceled':
      return 'enhanced-profile__status enhanced-profile__status--cancelled';
    default:
      return 'enhanced-profile__status enhanced-profile__status--default';
  }
};

const formatStatusLabel = (status: string | undefined): string => {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const EnhancedProfile: React.FC = () => {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const currentYear = new Date().getFullYear();
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>({
    make: '',
    model: '',
    year: currentYear,
    license_plate: '',
    color: '',
  });

  useEffect(() => {
    track('page_view', { page: 'EnhancedProfile' });
  }, []);

  const { data: profileData, isLoading, error } = useQuery<ProfileData>({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const response = await api.get('/profile');
      return response.data;
    },
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (profileData && !isEditingProfile) {
      setProfileForm({
        first_name: profileData.profile.first_name || '',
        last_name: profileData.profile.last_name || '',
        phone: profileData.profile.phone || '',
      });
    }
  }, [profileData, isEditingProfile]);

  const handleCancelEdit = () => {
    if (profileData) {
      setProfileForm({
        first_name: profileData.profile.first_name || '',
        last_name: profileData.profile.last_name || '',
        phone: profileData.profile.phone || '',
      });
    }
    setIsEditingProfile(false);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const response = await api.patch('/profile', updates);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      await refreshUser();
      setIsEditingProfile(false);
  notifySuccess('Profile updated successfully');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
  notifyError(message);
    },
  });

  const addVehicleMutation = useMutation({
    mutationFn: async (vehicle: VehicleForm) => {
      const response = await api.post('/profile/vehicles', vehicle);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      setShowVehicleForm(false);
      setVehicleForm({
        make: '',
        model: '',
        year: currentYear,
        license_plate: '',
        color: '',
      });
  notifySuccess('Vehicle added successfully');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to add vehicle';
  notifyError(message);
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      await api.delete(`/profile/vehicles/${vehicleId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
  notifySuccess('Vehicle deleted successfully');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to delete vehicle';
  notifyError(message);
    },
  });

  const handleUpdateProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateProfileMutation.mutate({
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      phone: profileForm.phone.trim(),
    });
  };

  const handleAddVehicle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addVehicleMutation.mutate({
      make: vehicleForm.make.trim(),
      model: vehicleForm.model.trim(),
      year: Number(vehicleForm.year),
      license_plate: vehicleForm.license_plate.trim(),
      color: vehicleForm.color.trim(),
    });
  };

  const handleDeleteVehicle = (vehicleId: number) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      deleteVehicleMutation.mutate(vehicleId);
    }
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['user-profile'] });
  };

  const loadingView = (
    <UserPage className="enhanced-profile-page" size="wide">
      <UserHero
        eyebrow="Account"
        title="My Profile"
        variant="compact"
        align="start"
      />
      <UserSection>
        <UserCard muted className="enhanced-profile__loading-card">
          <LoadingSpinner />
          <p>Loading your profile. Please wait.</p>
        </UserCard>
      </UserSection>
    </UserPage>
  );

  if (authLoading) {
    return loadingView;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return loadingView;
  }

  if (error || !profileData) {
    return (
      <UserPage className="enhanced-profile-page" size="wide">
        <UserHero
          eyebrow="Account"
          title="My Profile"
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard className="enhanced-profile__error-card">
            <p>Something went wrong while fetching your profile. Please try again.</p>
            <button type="button" className="btn btn--primary" onClick={handleRefresh}>
              Try again
            </button>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  const { profile, vehicles, recent_orders: recentOrders, recent_redemptions: recentRedemptions, loyalty_summary: loyalty } = profileData;
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Not provided';
  const phoneNumber = profile.phone || 'Not provided';

  return (
    <UserPage className="enhanced-profile-page" size="wide">
      <UserHero
        eyebrow="Account"
        title="My Profile"
        variant="compact"
        align="start"
        actions={
          <button type="button" className="btn btn--ghost" onClick={handleRefresh}>
            <HiOutlineRefresh aria-hidden="true" /> Refresh
          </button>
        }
      />

      <UserSection
        title="Profile overview"
        className="enhanced-profile__layout"
      >
        <UserCard className="enhanced-profile__card" padding="loose">
          <header className="enhanced-profile__card-header">
            <div>
              <h2 className="surface-card__title">
                <FaUser aria-hidden="true" /> Personal information
              </h2>
            </div>
            {!isEditingProfile && (
              <button
                type="button"
                className="btn btn--ghost btn--dense"
                onClick={() => setIsEditingProfile(true)}
              >
                <FaEdit aria-hidden="true" /> Edit
              </button>
            )}
          </header>

          {isEditingProfile ? (
            <form onSubmit={handleUpdateProfile} className="enhanced-profile__form">
              <div className="enhanced-profile__form-grid">
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">First name</span>
                  <input
                    className="enhanced-profile__input"
                    value={profileForm.first_name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, first_name: event.target.value }))}
                    required
                    placeholder="First name"
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Last name</span>
                  <input
                    className="enhanced-profile__input"
                    value={profileForm.last_name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, last_name: event.target.value }))}
                    required
                    placeholder="Last name"
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Phone</span>
                  <input
                    className="enhanced-profile__input"
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Phone number"
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Email</span>
                  <input className="enhanced-profile__input" value={profile.email} disabled />
                </label>
              </div>
              <div className="enhanced-profile__form-actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={updateProfileMutation.isPending}
                >
                  <FaSave aria-hidden="true" /> Save changes
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleCancelEdit}
                  disabled={updateProfileMutation.isPending}
                >
                  <FaTimes aria-hidden="true" /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="enhanced-profile__details">
              <div className="enhanced-profile__detail-row">
                <dt className="enhanced-profile__detail-label">
                  <FaUser aria-hidden="true" /> Full name
                </dt>
                <dd className="enhanced-profile__detail-value">{fullName}</dd>
              </div>
              <div className="enhanced-profile__detail-row">
                <dt className="enhanced-profile__detail-label">
                  <FaEnvelope aria-hidden="true" /> Email address
                </dt>
                <dd className="enhanced-profile__detail-value">{profile.email}</dd>
              </div>
              <div className="enhanced-profile__detail-row">
                <dt className="enhanced-profile__detail-label">
                  <FaPhone aria-hidden="true" /> Phone number
                </dt>
                <dd className="enhanced-profile__detail-value">{phoneNumber}</dd>
              </div>
              <div className="enhanced-profile__detail-row">
                <dt className="enhanced-profile__detail-label">Member since</dt>
                <dd className="enhanced-profile__detail-value">
                  {new Date(profile.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          )}
        </UserCard>

        <UserCard className="enhanced-profile__card enhanced-profile__loyalty-card" padding="loose" muted>
          <h2 className="surface-card__title">
            <FaGift aria-hidden="true" /> Loyalty summary
          </h2>
          <div className="enhanced-profile__loyalty-score">
            <span className="enhanced-profile__loyalty-score-value">{loyalty.current_points}</span>
            <span className="enhanced-profile__loyalty-score-label">Current points</span>
          </div>
          <div className="enhanced-profile__loyalty-grid">
            <div className="enhanced-profile__loyalty-row">
              <span>Tier</span>
              <span>{loyalty.tier_name}</span>
            </div>
            <div className="enhanced-profile__loyalty-row">
              <span>Total earned</span>
              <span>{loyalty.total_earned} pts</span>
            </div>
            <div className="enhanced-profile__loyalty-row">
              <span>Total redeemed</span>
              <span>{loyalty.total_redeemed} pts</span>
            </div>
            {loyalty.next_tier_points !== null && (
              <div className="enhanced-profile__loyalty-row">
                <span>Next tier at</span>
                <span>{loyalty.next_tier_points} pts</span>
              </div>
            )}
          </div>
        </UserCard>
      </UserSection>

      <UserSection
        title="Vehicle garage"
      >
        <UserCard className="enhanced-profile__card enhanced-profile__vehicles-card" padding="loose">
          <header className="enhanced-profile__card-header">
            <div>
              <h2 className="surface-card__title">
                <FaCar aria-hidden="true" /> My vehicles
              </h2>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowVehicleForm(true)}
            >
              <FaPlus aria-hidden="true" /> Add vehicle
            </button>
          </header>

          {vehicles.length === 0 ? (
            <div className="enhanced-profile__empty">
              <FaCar aria-hidden="true" className="enhanced-profile__empty-icon" />
              <p>No vehicles added yet.</p>
            </div>
          ) : (
            <div className="enhanced-profile__vehicle-list">
              {vehicles.map((vehicle) => (
                <article key={vehicle.id} className="enhanced-profile__vehicle">
                  <div>
                    <h3>{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                    <p className="enhanced-profile__vehicle-meta">
                      License: {vehicle.license_plate} - Color: {vehicle.color}
                    </p>
                    <p className="enhanced-profile__vehicle-date">
                      Added on {new Date(vehicle.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="enhanced-profile__icon-button"
                    onClick={() => handleDeleteVehicle(vehicle.id)}
                    disabled={deleteVehicleMutation.isPending}
                    aria-label="Remove vehicle"
                  >
                    <FaTrash aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </UserCard>
      </UserSection>

      <UserSection
        title="Recent activity"
      >
        <div className="enhanced-profile__activity-grid">
          {recentOrders.length > 0 ? (
            <UserCard className="enhanced-profile__card enhanced-profile__orders-card" padding="loose">
              <h2 className="surface-card__title">
                <FaShoppingCart aria-hidden="true" /> Recent orders
              </h2>
              <div className="enhanced-profile__order-list">
                {recentOrders.map((order) => (
                  <article key={order.id} className="enhanced-profile__order">
                    <div>
                      <h3>{order.service_name}</h3>
                      <p className="enhanced-profile__order-meta">
                        Order #{order.id} - {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      {order.vehicle_info && (
                        <p className="enhanced-profile__order-info">{order.vehicle_info}</p>
                      )}
                    </div>
                    <div className="enhanced-profile__order-summary">
                      <p className="enhanced-profile__order-amount">{formatCents(order.total_amount)}</p>
                      <span className={getOrderStatusClass(order.status)}>
                        {formatStatusLabel(order.status)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </UserCard>
          ) : null}

          {recentRedemptions.length > 0 ? (
            <UserCard className="enhanced-profile__card enhanced-profile__redemptions-card" padding="loose">
              <h2 className="surface-card__title">
                <FaHistory aria-hidden="true" /> Recent redemptions
              </h2>
              <div className="enhanced-profile__redemption-list">
                {recentRedemptions.map((redemption) => (
                  <article key={redemption.id} className="enhanced-profile__redemption">
                    <div>
                      <h3>{redemption.reward_name}</h3>
                      <p className="enhanced-profile__redemption-date">
                        {new Date(redemption.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="enhanced-profile__points-change">
                      -{redemption.points_used} pts
                    </span>
                  </article>
                ))}
              </div>
            </UserCard>
          ) : null}

          {recentOrders.length === 0 && recentRedemptions.length === 0 ? (
            <UserCard className="enhanced-profile__card enhanced-profile__empty-card" muted>
              <p>No recent activity yet.</p>
              <p>Place an order or redeem a reward to see it appear here.</p>
            </UserCard>
          ) : null}
        </div>
      </UserSection>

      {showVehicleForm && (
        <div className="enhanced-profile__modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-vehicle-title">
          <UserCard className="enhanced-profile__modal" padding="loose">
            <div className="enhanced-profile__modal-header">
              <h2 id="add-vehicle-title" className="surface-card__title">Add vehicle</h2>
              <button
                type="button"
                className="enhanced-profile__icon-button"
                onClick={() => setShowVehicleForm(false)}
                aria-label="Close add vehicle form"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className="enhanced-profile__form">
              <div className="enhanced-profile__form-grid">
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Make</span>
                  <input
                    className="enhanced-profile__input"
                    value={vehicleForm.make}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, make: event.target.value }))}
                    required
                    placeholder="Toyota"
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Model</span>
                  <input
                    className="enhanced-profile__input"
                    value={vehicleForm.model}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, model: event.target.value }))}
                    required
                    placeholder="Corolla"
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Year</span>
                  <input
                    className="enhanced-profile__input"
                    type="number"
                    value={vehicleForm.year}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, year: Number(event.target.value) }))}
                    min="1900"
                    max={currentYear + 1}
                    required
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">Color</span>
                  <input
                    className="enhanced-profile__input"
                    value={vehicleForm.color}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, color: event.target.value }))}
                    required
                    placeholder="White"
                  />
                </label>
                <label className="enhanced-profile__field">
                  <span className="enhanced-profile__label">License plate</span>
                  <input
                    className="enhanced-profile__input"
                    value={vehicleForm.license_plate}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, license_plate: event.target.value }))}
                    required
                    placeholder="ABC123"
                  />
                </label>
              </div>
              <div className="enhanced-profile__form-actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={addVehicleMutation.isPending}
                >
                  <FaPlus aria-hidden="true" /> Save vehicle
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowVehicleForm(false)}
                  disabled={addVehicleMutation.isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </UserCard>
        </div>
      )}
    </UserPage>
  );
};

export default EnhancedProfile;
