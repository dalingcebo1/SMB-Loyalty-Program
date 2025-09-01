import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

// Strict staff-only gate; admins should not use /staff/* URLs.
const RequireStaff: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'staff') return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

export default RequireStaff;