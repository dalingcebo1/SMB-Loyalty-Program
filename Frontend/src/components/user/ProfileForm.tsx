import React from 'react';
import { FaEdit, FaExclamationTriangle, FaSave, FaTimes, FaUser } from 'react-icons/fa';

interface ProfileFormProps {
  editing: boolean;
  firstName: string;
  lastName: string;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (e: React.FormEvent) => void;
  onChangeFirst: (val: string) => void;
  onChangeLast: (val: string) => void;
  fullName: string;
  email: string;
  phoneNumber: string;
}

// Reusable profile form / display component.
// Handles both read-only and editing states; parent owns state so this stays pure.
const ProfileForm: React.FC<ProfileFormProps> = ({
  editing,
  firstName,
  lastName,
  error,
  onEdit,
  onCancel,
  onSave,
  onChangeFirst,
  onChangeLast,
  fullName,
  email,
  phoneNumber,
}) => {
  return (
    <div className="profile-form">
      <header className="account-card__header">
        <div>
          <h2 className="surface-card__title">Profile information</h2>
        </div>
        {!editing && (
          <button
            type="button"
            className="btn btn--ghost btn--dense account-card__edit"
            onClick={onEdit}
          >
            <FaEdit aria-hidden="true" />
            Edit
          </button>
        )}
      </header>

      {editing ? (
        <form onSubmit={onSave} className="account-form" aria-label="Edit profile">
          <div className="account-form__grid">
            <label className="account-form__field">
              <span className="account-form__label">First name</span>
              <input
                className="account-form__input"
                value={firstName}
                onChange={(e) => onChangeFirst(e.target.value)}
                required
                placeholder="First name"
              />
            </label>
            <label className="account-form__field">
              <span className="account-form__label">Last name</span>
              <input
                className="account-form__input"
                value={lastName}
                onChange={(e) => onChangeLast(e.target.value)}
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
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              <FaTimes aria-hidden="true" />
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="account-details" aria-label="Profile details">
          <div className="account-details__row">
            <dt className="account-details__label">
              <FaUser aria-hidden="true" />
              Full name
            </dt>
            <dd className="account-details__value">{fullName}</dd>
          </div>
          <div className="account-details__row">
            <dt className="account-details__label">Email address</dt>
            <dd className="account-details__value">{email}</dd>
          </div>
          <div className="account-details__row">
            <dt className="account-details__label">Phone number</dt>
            <dd className="account-details__value">{phoneNumber}</dd>
          </div>
        </dl>
      )}
    </div>
  );
};

export default ProfileForm;