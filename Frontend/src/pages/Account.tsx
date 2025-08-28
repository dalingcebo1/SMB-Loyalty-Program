import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../api/api";
import { FaUser, FaEnvelope, FaPhone, FaEdit, FaSave, FaTimes, FaExclamationTriangle, FaSignOutAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Account.css';

const Account: React.FC = () => {
  const { user, refreshUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [error, setError] = useState<string | null>(null);
  
  if (loading) {
    return (
      <div className="account-page">
        <div className="page-header">
          <h1>Account Details</h1>
          <p className="subtitle">Loading your account information...</p>
        </div>
        <div className="account-details-card">
          <div className="detail-section">
            <div className="detail-label">Loading...</div>
            <div className="detail-value">Please wait</div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;

  const handleEdit = () => {
    setEditing(true);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setError(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.put("/auth/me", {
        firstName,
        lastName,
      });
      await refreshUser();
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out');
      navigate('/login');
    } catch (err) {
      toast.error('Error logging out');
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="account-page">
      <div className="page-header">
        <h1>Account Details</h1>
        <p className="subtitle">Manage your personal information and preferences</p>
      </div>

      <div className="account-details-card">
        {/* Name Section */}
        <div className="detail-section">
          <div className="detail-label">
            <FaUser style={{ display: 'inline', marginRight: '0.5rem' }} />
            Full Name
          </div>
          {editing ? (
            <form onSubmit={handleSave} className="edit-form">
              <div className="form-row">
                <input
                  className="form-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  placeholder="First Name"
                />
                <input
                  className="form-input"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last Name"
                />
              </div>
              <div className="button-group">
                <button type="submit" className="btn btn-primary">
                  <FaSave /> Save Changes
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  <FaTimes /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="value-display">
              <span className="value-text">{user.firstName} {user.lastName}</span>
              <button className="btn btn-edit" onClick={handleEdit} type="button">
                <FaEdit /> Edit
              </button>
            </div>
          )}
          {error && (
            <div className="error-message">
              <FaExclamationTriangle />
              {error}
            </div>
          )}
        </div>

        {/* Email Section */}
        <div className="detail-section">
          <div className="detail-label">
            <FaEnvelope style={{ display: 'inline', marginRight: '0.5rem' }} />
            Email Address
          </div>
          <div className="detail-value">{user.email}</div>
        </div>

        {/* Phone Section */}
        <div className="detail-section">
          <div className="detail-label">
            <FaPhone style={{ display: 'inline', marginRight: '0.5rem' }} />
            Phone Number
          </div>
          <div className="detail-value">{user.phone}</div>
        </div>
      </div>

      {/* Logout Section */}
      <div className="logout-section">
        <button 
          className="btn btn-logout" 
          onClick={handleLogout}
          type="button"
        >
          <FaSignOutAlt /> Logout
        </button>
      </div>

      <div className="page-footer">
        API Version: v1.0.0
      </div>
    </div>
  );
};

export default Account;