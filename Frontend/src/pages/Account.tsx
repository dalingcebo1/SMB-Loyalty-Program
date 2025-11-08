import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FaSignOutAlt } from "react-icons/fa";
// Removed toast notifications; using inline StatusBanner instead.
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { UserPage, UserHero, UserSection, UserCard } from "../components/user";
import ProfileForm from '../components/user/ProfileForm';
import StatusBanner from '../components/ui/StatusBanner';
import "./Account.css";

const Account: React.FC = () => {
  const { user, refreshUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
  setBanner({ type: 'success', message: 'Profile updated successfully' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
  setBanner({ type: 'success', message: 'Successfully logged out' });
      navigate("/login");
    } catch (err) {
  setBanner({ type: 'error', message: 'Error logging out' });
      console.error("Logout error:", err);
    }
  };

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Not provided";
  const phoneNumber = user.phone?.trim() || "Not provided";

  // Derive initials for avatar placeholder
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || user.email[0].toUpperCase();

  return (
    <UserPage className="account-page" size="narrow" layout="split" aside={
      <div className="account-aside" aria-label="Session controls">
        <UserCard className="account-actions" muted>
          <h2 className="surface-card__title">Session controls</h2>
          <div className="account-actions__body">
            <button type="button" className="btn account-logout" onClick={handleLogout}>
              <FaSignOutAlt aria-hidden="true" />
              Logout
            </button>
          </div>
        </UserCard>
      </div>
    }>
      <UserHero
        eyebrow="Account"
        title="Account Details"
        variant="compact"
        align="start"
      />
      {banner && (
        <StatusBanner
          variant={banner.type === 'success' ? 'success' : 'error'}
          title={banner.type === 'success' ? 'Success' : 'Error'}
          description={banner.message}
          dismissible
          onDismiss={() => setBanner(null)}
          role={banner.type === 'error' ? 'alert' : 'status'}
          ariaLive={banner.type === 'error' ? 'assertive' : 'polite'}
        />
      )}
      <UserSection>
        <UserCard className="account-card" interactive>
          <div className="account-avatar" aria-hidden="true">{initials}</div>
          <ProfileForm
            editing={editing}
            firstName={firstName}
            lastName={lastName}
            error={error}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            onChangeFirst={setFirstName}
            onChangeLast={setLastName}
            fullName={fullName}
            email={user.email}
            phoneNumber={phoneNumber}
          />
          <p className="account-card__footnote">API Version: v1.0.0</p>
        </UserCard>
      </UserSection>
    </UserPage>
  );
};

export default Account;