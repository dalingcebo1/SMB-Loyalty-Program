import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FaEdit, FaEnvelope, FaExclamationTriangle, FaPhone, FaSave, FaSignOutAlt, FaTimes, FaUser } from "react-icons/fa";
import { toast } from "react-toastify";
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import "./Account.css";

const Account: React.FC = () => {
  const { user, refreshUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="user-page user-page--narrow account-page">
        <section className="user-hero user-hero--compact">
          <span className="user-hero__eyebrow">Account</span>
          <h1 className="user-hero__title">Account Details</h1>
          <p className="user-hero__subtitle">
            Loading your account information...
          </p>
        </section>

        <section className="user-page__section">
          <div className="surface-card surface-card--muted account-card">
            <p className="account-loading">
              Please wait while we prepare your profile.
            </p>
          </div>
        </section>
      </div>
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
      toast.success("Profile updated successfully");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Successfully logged out");
      navigate("/login");
    } catch (err) {
      toast.error("Error logging out");
      console.error("Logout error:", err);
    }
  };

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Not provided";
  const phoneNumber = user.phone?.trim() || "Not provided";

  return (
    <div className="user-page user-page--narrow account-page">
      <section className="user-hero user-hero--compact">
        <span className="user-hero__eyebrow">Account</span>
        <h1 className="user-hero__title">Account Details</h1>
        <p className="user-hero__subtitle">
          Manage your personal information and preferences.
        </p>
      </section>

      <section className="user-page__section">
        <div className="surface-card surface-card--interactive account-card">
          <header className="account-card__header">
            <div>
              <h2 className="surface-card__title">Profile information</h2>
              <p className="surface-card__subtitle">
                Keep your details current so we can tailor your experience.
              </p>
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
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleCancel}
                >
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
        </div>
      </section>

      <section className="user-page__section">
        <div className="surface-card surface-card--muted account-actions">
          <h2 className="surface-card__title">Session controls</h2>
          <p className="surface-card__subtitle">
            Sign out when you’re done, especially on a shared device.
          </p>
          <div className="account-actions__body">
            <p className="account-actions__copy">
              Logging out will return you to the login screen and clear your session.
            </p>
            <button
              type="button"
              className="btn account-logout"
              onClick={handleLogout}
            >
              <FaSignOutAlt aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Account;