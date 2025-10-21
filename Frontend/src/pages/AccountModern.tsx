import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineUser,
  HiOutlineCog,
  HiOutlineTruck,
  HiOutlineLogout,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlinePlus
} from 'react-icons/hi';
import { FaCar, FaPhone, FaEnvelope, FaUser } from 'react-icons/fa';
import api from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { ToastProvider, useToast } from '../components/ui/Toast';
import { track } from '../utils/analytics';
import './AccountModern.css';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  registration: string;
  size?: string;
}

type TabType = 'profile' | 'vehicles' | 'settings';

const AccountModern: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  
  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);

  // Vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    make: '',
    model: '',
    registration: '',
    size: 'medium'
  });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (activeTab === 'vehicles') {
      fetchVehicles();
    }
    track('page_view', { page: 'AccountModern', tab: activeTab });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const response = await api.get('/vehicles/me');
      setVehicles(response.data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load vehicles'
      });
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/auth/me', {
        first_name: firstName.trim(),
        last_name: lastName.trim()
      });
      
      await refreshUser();
      setIsEditing(false);
      
      addToast({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully'
      });

      track('profile_updated');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: error.response?.data?.message || 'Failed to update profile'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
  };

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({
      make: '',
      model: '',
      registration: '',
      size: 'medium'
    });
    setShowVehicleModal(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      make: vehicle.make,
      model: vehicle.model,
      registration: vehicle.registration,
      size: vehicle.size || 'medium'
    });
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.make || !vehicleForm.model || !vehicleForm.registration) {
      addToast({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all required fields'
      });
      return;
    }

    setSavingVehicle(true);
    try {
      if (editingVehicle) {
        await api.put(`/vehicles/${editingVehicle.id}`, vehicleForm);
        addToast({
          type: 'success',
          title: 'Vehicle Updated',
          message: 'Vehicle has been updated successfully'
        });
        track('vehicle_updated', { vehicle_id: editingVehicle.id });
      } else {
        await api.post('/vehicles', vehicleForm);
        addToast({
          type: 'success',
          title: 'Vehicle Added',
          message: 'Vehicle has been added successfully'
        });
        track('vehicle_added');
      }

      setShowVehicleModal(false);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error.response?.data?.message || 'Failed to save vehicle'
      });
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;

    try {
      await api.delete(`/vehicles/${vehicleToDelete.id}`);
      
      addToast({
        type: 'success',
        title: 'Vehicle Deleted',
        message: 'Vehicle has been removed successfully'
      });

      track('vehicle_deleted', { vehicle_id: vehicleToDelete.id });
      
      setShowDeleteConfirm(false);
      setVehicleToDelete(null);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: error.response?.data?.message || 'Failed to delete vehicle'
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      addToast({
        type: 'success',
        title: 'Logged Out',
        message: 'You have been logged out successfully'
      });
      navigate('/login');
      track('logout');
    } catch (error) {
      console.error('Error logging out:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to log out'
      });
    }
  };

  return (
    <div className="account-modern">
      <div className="account-modern__container">
        {/* Header */}
        <div className="account-modern__header">
          <div className="account-modern__profile">
            <Avatar 
              name={user?.firstName || 'User'} 
              size="2xl"
              status="online"
            />
            <div className="account-modern__profile-info">
              <h1 className="account-modern__name">
                {user?.firstName} {user?.lastName}
              </h1>
              <p className="account-modern__phone">{user?.phone}</p>
            </div>
          </div>
          <Button
            variant="danger"
            size="base"
            leftIcon={<HiOutlineLogout />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <div className="account-modern__tabs">
          <button
            className={`tab ${activeTab === 'profile' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <HiOutlineUser className="tab__icon" />
            <span>Profile</span>
          </button>
          <button
            className={`tab ${activeTab === 'vehicles' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            <HiOutlineTruck className="tab__icon" />
            <span>Vehicles</span>
          </button>
          <button
            className={`tab ${activeTab === 'settings' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <HiOutlineCog className="tab__icon" />
            <span>Settings</span>
          </button>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="account-modern__content"
        >
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card variant="elevated" padding="lg">
              <CardHeader>
                <div className="card-header-with-action">
                  <h2>Personal Information</h2>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<HiOutlinePencil />}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardBody>
                <div className="profile-form">
                  <div className="form-row">
                    <Input
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={!isEditing}
                      leftIcon={<FaUser />}
                    />
                    <Input
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={!isEditing}
                      leftIcon={<FaUser />}
                    />
                  </div>

                  <Input
                    label="Phone Number"
                    value={user?.phone || ''}
                    disabled
                    leftIcon={<FaPhone />}
                  />

                  <Input
                    label="Email Address"
                    value={user?.email || 'Not provided'}
                    disabled
                    leftIcon={<FaEnvelope />}
                  />
                </div>
              </CardBody>

              {isEditing && (
                <CardFooter>
                  <div className="card-footer-actions">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleSaveProfile}
                      isLoading={saving}
                    >
                      Save Changes
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          )}

          {/* Vehicles Tab */}
          {activeTab === 'vehicles' && (
            <>
              <div className="vehicles-header">
                <h2>My Vehicles</h2>
                <Button
                  variant="primary"
                  size="base"
                  leftIcon={<HiOutlinePlus />}
                  onClick={handleAddVehicle}
                >
                  Add Vehicle
                </Button>
              </div>

              {loadingVehicles ? (
                <Card variant="elevated" padding="lg">
                  <div className="text-center py-8">
                    <p>Loading vehicles...</p>
                  </div>
                </Card>
              ) : vehicles.length > 0 ? (
                <div className="vehicles-grid">
                  {vehicles.map((vehicle) => (
                    <Card key={vehicle.id} variant="outlined" padding="lg" className="vehicle-card">
                      <CardBody>
                        <div className="vehicle-card__icon">
                          <FaCar />
                        </div>
                        <h3 className="vehicle-card__name">
                          {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="vehicle-card__reg">{vehicle.registration}</p>
                        {vehicle.size && (
                          <p className="vehicle-card__size">Size: {vehicle.size}</p>
                        )}
                      </CardBody>
                      <CardFooter>
                        <div className="vehicle-card__actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<HiOutlinePencil />}
                            onClick={() => handleEditVehicle(vehicle)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<HiOutlineTrash />}
                            onClick={() => {
                              setVehicleToDelete(vehicle);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<FaCar />}
                  title="No Vehicles Yet"
                  description="Add your first vehicle to get started with bookings"
                  action={
                    <Button
                      variant="primary"
                      leftIcon={<HiOutlinePlus />}
                      onClick={handleAddVehicle}
                    >
                      Add Vehicle
                    </Button>
                  }
                />
              )}
            </>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <Card variant="elevated" padding="lg">
              <CardHeader>
                <h2>Account Settings</h2>
              </CardHeader>
              <CardBody>
                <div className="settings-section">
                  <h3 className="settings-section__title">Notifications</h3>
                  <p className="settings-section__description">
                    Manage how you receive notifications about your bookings and rewards
                  </p>
                  <p className="settings-section__note">
                    Notification preferences coming soon
                  </p>
                </div>

                <div className="settings-section">
                  <h3 className="settings-section__title">Privacy</h3>
                  <p className="settings-section__description">
                    Control your data and privacy settings
                  </p>
                  <p className="settings-section__note">
                    Privacy controls coming soon
                  </p>
                </div>

                <div className="settings-section settings-section--danger">
                  <h3 className="settings-section__title">Danger Zone</h3>
                  <p className="settings-section__description">
                    Permanently delete your account and all associated data
                  </p>
                  <Button variant="danger" size="base" disabled>
                    Delete Account
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </motion.div>

        {/* Vehicle Modal */}
        <Modal
          isOpen={showVehicleModal}
          onClose={() => setShowVehicleModal(false)}
          title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          size="md"
        >
          <div className="vehicle-modal">
            <div className="form-group">
              <Input
                label="Make"
                value={vehicleForm.make}
                onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                placeholder="e.g., Toyota"
              />
            </div>

            <div className="form-group">
              <Input
                label="Model"
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                placeholder="e.g., Corolla"
              />
            </div>

            <div className="form-group">
              <Input
                label="Registration"
                value={vehicleForm.registration}
                onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value })}
                placeholder="e.g., ABC 123 GP"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Size</label>
              <select
                className="form-select"
                value={vehicleForm.size}
                onChange={(e) => setVehicleForm({ ...vehicleForm, size: e.target.value })}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </select>
            </div>

            <div className="vehicle-modal__actions">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setShowVehicleModal(false)}
                disabled={savingVehicle}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSaveVehicle}
                isLoading={savingVehicle}
              >
                {editingVehicle ? 'Update' : 'Add'} Vehicle
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Vehicle"
          size="sm"
        >
          <div className="delete-confirm">
            <p className="delete-confirm__message">
              Are you sure you want to delete{' '}
              <strong>
                {vehicleToDelete?.make} {vehicleToDelete?.model}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="delete-confirm__actions">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={handleDeleteVehicle}
              >
                Delete Vehicle
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

// Wrap with ToastProvider
const AccountModernWithToast: React.FC = () => (
  <ToastProvider position="top-right">
    <AccountModern />
  </ToastProvider>
);

export default AccountModernWithToast;
