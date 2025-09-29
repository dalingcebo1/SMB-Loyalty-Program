import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import LoadingFallback from './LoadingFallback';

// Strict staff-only gate; admins should not use /staff/* URLs.
const RequireStaff: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const hasToken = typeof window !== 'undefined' ? Boolean(localStorage.getItem('token')) : false;
  if (loading || (!user && hasToken)) {
    return <LoadingFallback message="Loading staff workspace…" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'staff') return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

export default RequireStaff;