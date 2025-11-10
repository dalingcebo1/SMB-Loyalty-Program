import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  FaEdit,
  FaEnvelope,
  FaExclamationTriangle,
  FaPhone,
  FaSave,
  FaSignOutAlt,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import { notifySuccess, notifyError, getNotificationsEnabled, setNotificationsEnabled, notifySuccessKey } from '../utils/notifications';
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { UserPage, UserHero, UserSection, UserCard } from "../components/user";
import "./Account.css";

const Account: React.FC = () => {
  const { user, refreshUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(getNotificationsEnabled());

  if (loading) {
    return (
      <UserPage className="account-page" size="narrow">
        <UserHero
          eyebrow="Account"
          title="Account Details"
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard muted className="account-card">
            <p className="account-loading">Please wait while we prepare your profile.</p>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleEdit = () => {
    setEditing(true);
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setError(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setError(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await api.put("/auth/me", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      await refreshUser();
      setEditing(false);
  notifySuccess("Profile updated successfully");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
  notifySuccess("Successfully logged out");
      navigate("/login");
    } catch (err) {
  notifyError("Error logging out");
      console.error("Logout error:", err);
    }
  };

  const toggleNotifications = () => {
    const next = !notificationsOn;
    setNotificationsEnabled(next);
    setNotificationsOn(next);
    notifySuccessKey(next ? 'notifications.settings.notifications.enabled' : 'notifications.settings.notifications.disabled');
  };

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Not provided";
  const phoneNumber = user.phone?.trim() || "Not provided";

  return (
    <UserPage className="account-page" size="narrow">
      <UserHero
        eyebrow="Account"
        title="Account Details"
        variant="compact"
        align="start"
      />

      <UserSection>
        <UserCard className="account-card" interactive>
          <header className="account-card__header">
            <div>
              <h2 className="surface-card__title">Profile information</h2>
            </div>
            {!editing && (
              <button
                type="button"
                className="btn btn--ghost btn--dense account-card__edit"
                onClick={handleEdit}
              >
                <FaEdit aria-hidden="true" />
                Edit
              </button>
            )}
          </header>

          {editing ? (
            <form onSubmit={handleSave} className="account-form">
              <div className="account-form__grid">
                <label className="account-form__field">
                  <span className="account-form__label">First name</span>
                  <input
                    className="account-form__input"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    placeholder="First name"
                  />
                </label>
                <label className="account-form__field">
                  <span className="account-form__label">Last name</span>
                  <input
                    className="account-form__input"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                  />
                </label>
              </div>

              {error && (
                <div className="account-error" role="alert">
                  <FaExclamationTriangle aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="account-form__actions">
                <button type="submit" className="btn btn--primary">
                  <FaSave aria-hidden="true" />
                  Save changes
                </button>
                <button type="button" className="btn btn--ghost" onClick={handleCancel}>
                  <FaTimes aria-hidden="true" />
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="account-details">
              <div className="account-details__row">
                <dt className="account-details__label">
                  <FaUser aria-hidden="true" />
                  Full name
                </dt>
                <dd className="account-details__value">{fullName}</dd>
              </div>

              <div className="account-details__row">
                <dt className="account-details__label">
                  <FaEnvelope aria-hidden="true" />
                  Email address
                </dt>
                <dd className="account-details__value">{user.email}</dd>
              </div>

              <div className="account-details__row">
                <dt className="account-details__label">
                  <FaPhone aria-hidden="true" />
                  Phone number
                </dt>
                <dd className="account-details__value">{phoneNumber}</dd>
              </div>
            </dl>
          )}

          <p className="account-card__footnote">API Version: v1.0.0</p>
        </UserCard>
      </UserSection>

      <UserSection>
        <UserCard className="account-actions" muted>
          <h2 className="surface-card__title">Session controls</h2>
          <div className="account-actions__body">
            <button type="button" className="btn account-logout" onClick={handleLogout}>
              <FaSignOutAlt aria-hidden="true" />
              Logout
            </button>
          </div>
        </UserCard>
      </UserSection>
      <UserSection>
        <UserCard className="account-actions" muted>
          <h2 className="surface-card__title">Notification preferences</h2>
          <div className="account-actions__body">
            <p className="text-sm mb-3">Toggle in-app toast messages. Critical errors may still appear regardless of this setting.</p>
            <button type="button" className="btn" onClick={toggleNotifications}>
              {notificationsOn ? 'Disable Toasts' : 'Enable Toasts'}
            </button>
          </div>
        </UserCard>
      </UserSection>
    </UserPage>
  );
};

export default Account;