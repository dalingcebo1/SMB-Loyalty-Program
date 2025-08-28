// src/features/staff/components/EnhancedVehicleManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './EnhancedVehicleManager.css';

interface Vehicle {
  id: number;
  reg: string;
  make: string;
  model: string;
  user?: User;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
}

interface VehicleSearchResult extends Vehicle {
  user: User;
  total_washes?: number;
  last_wash?: string;
}

const EnhancedVehicleManager: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VehicleSearchResult[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSearchResult | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'add'>('search');
  
  // New vehicle form
  const [newVehicle, setNewVehicle] = useState({
    reg: '',
    make: '',
    model: ''
  });

  const token = localStorage.getItem('token');
  const axiosAuth = axios.create({
    headers: { Authorization: `Bearer ${token}` }
  });

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const userDebounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Search vehicles with enhanced data
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axiosAuth.get(`/users/search-vehicles?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error('Vehicle search error:', error);
        toast.error('Failed to search vehicles');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [searchQuery, axiosAuth]);

  // Search users for adding vehicles
  useEffect(() => {
    if (!userSearch.trim()) {
      setUserResults([]);
      return;
    }

    if (userDebounceTimeout.current) clearTimeout(userDebounceTimeout.current);
    userDebounceTimeout.current = setTimeout(async () => {
      setUserLoading(true);
      try {
        const response = await axiosAuth.get(`/users/search?q=${encodeURIComponent(userSearch)}`);
        setUserResults(response.data);
      } catch (error) {
        console.error('User search error:', error);
        toast.error('Failed to search users');
      } finally {
        setUserLoading(false);
      }
    }, 500);

    return () => {
      if (userDebounceTimeout.current) clearTimeout(userDebounceTimeout.current);
    };
  }, [userSearch, axiosAuth]);

  const normalizeReg = (reg: string) => {
    return reg.replace(/\s+/g, '').toUpperCase();
  };

  const handleAddVehicle = async () => {
    if (!selectedUser || !newVehicle.reg || !newVehicle.make || !newVehicle.model) {
      toast.error('Please fill in all fields and select a user');
      return;
    }

    try {
      setLoading(true);
      await axiosAuth.post('/users/vehicles', {
        user_id: selectedUser.id,
        reg: normalizeReg(newVehicle.reg),
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim()
      });

      toast.success('Vehicle added successfully! 🚗');
      
      // Reset form
      setNewVehicle({ reg: '', make: '', model: '' });
      setSelectedUser(null);
      setUserSearch('');
      setUserResults([]);
      
      // Switch to search tab if there's a query
      if (searchQuery.trim()) {
        setActiveTab('search');
        // Trigger search refresh
        const refreshEvent = new Event('refresh-search');
        window.dispatchEvent(refreshEvent);
      }
    } catch (error: unknown) {
      console.error('Add vehicle error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 409) {
          toast.error('Vehicle registration already exists');
        } else {
          toast.error('Failed to add vehicle');
        }
      } else {
        toast.error('Failed to add vehicle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) {
      return;
    }

    try {
      await axiosAuth.delete(`/users/vehicles/${vehicleId}`);
      toast.success('Vehicle deleted successfully');
      
      // Remove from search results
      setSearchResults(prev => prev.filter(v => v.id !== vehicleId));
      if (selectedVehicle?.id === vehicleId) {
        setSelectedVehicle(null);
      }
    } catch (error) {
      console.error('Delete vehicle error:', error);
      toast.error('Failed to delete vehicle');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="enhanced-vehicle-manager">
      <div className="manager-header">
        <h2>Vehicle Management</h2>
        <p>Search, add, and manage customer vehicles</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <span className="tab-icon">🔍</span>
          Search Vehicles
        </button>
        <button
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <span className="tab-icon">➕</span>
          Add Vehicle
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="search-section">
          <div className="search-input-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by registration, make, model, or owner name..."
              className="search-input"
            />
            {loading && <div className="search-spinner">⏳</div>}
          </div>

          <div className="search-results">
            {searchResults.length > 0 && (
              <div className="results-grid">
                {searchResults.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className={`vehicle-card ${selectedVehicle?.id === vehicle.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVehicle(vehicle)}
                  >
                    <div className="vehicle-header">
                      <div className="reg-plate">{vehicle.reg}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVehicle(vehicle.id);
                        }}
                        className="delete-btn"
                        title="Delete vehicle"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div className="vehicle-details">
                      <div className="vehicle-info">
                        <span className="vehicle-icon">🚗</span>
                        <span className="vehicle-text">
                          {vehicle.make} {vehicle.model}
                        </span>
                      </div>
                      
                      <div className="owner-info">
                        <span className="owner-icon">👤</span>
                        <span className="owner-text">
                          {vehicle.user.first_name} {vehicle.user.last_name}
                        </span>
                      </div>
                      
                      <div className="stats-row">
                        <div className="stat">
                          <span className="stat-label">Washes</span>
                          <span className="stat-value">{vehicle.total_washes || 0}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Last Wash</span>
                          <span className="stat-value">{formatDate(vehicle.last_wash)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && !loading && searchResults.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No vehicles found</h3>
                <p>Try searching with different keywords</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Vehicle Tab */}
      {activeTab === 'add' && (
        <div className="add-section">
          <div className="add-form">
            <div className="form-section">
              <h3>Select Customer</h3>
              <div className="user-search-container">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search customer by name or phone..."
                  className="search-input"
                />
                {userLoading && <div className="search-spinner">⏳</div>}
              </div>

              {userResults.length > 0 && (
                <div className="user-results">
                  {userResults.map((user) => (
                    <div
                      key={user.id}
                      className={`user-card ${selectedUser?.id === user.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedUser(user);
                        setUserResults([]);
                        setUserSearch(`${user.first_name} ${user.last_name}`);
                      }}
                    >
                      <div className="user-info">
                        <span className="user-name">
                          {user.first_name} {user.last_name}
                        </span>
                        <span className="user-phone">{user.phone}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="selected-user">
                  <div className="selected-badge">
                    <span className="badge-icon">✅</span>
                    <span>Selected: {selectedUser.first_name} {selectedUser.last_name}</span>
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setUserSearch('');
                      }}
                      className="clear-btn"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>Vehicle Details</h3>
              <div className="vehicle-form">
                <div className="form-group">
                  <label>Registration Number</label>
                  <input
                    type="text"
                    value={newVehicle.reg}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, reg: e.target.value }))}
                    placeholder="e.g., ABC123GP"
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Make</label>
                    <input
                      type="text"
                      value={newVehicle.make}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, make: e.target.value }))}
                      placeholder="e.g., Toyota"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Model</label>
                    <input
                      type="text"
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="e.g., Corolla"
                      className="form-input"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddVehicle}
                  disabled={loading || !selectedUser || !newVehicle.reg || !newVehicle.make || !newVehicle.model}
                  className="add-vehicle-btn"
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner">⏳</span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">🚗</span>
                      Add Vehicle
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedVehicleManager;
