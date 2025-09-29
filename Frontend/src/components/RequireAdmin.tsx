import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import LoadingFallback from "./LoadingFallback";

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  const hasToken = typeof window !== 'undefined' ? Boolean(localStorage.getItem('token')) : false;

  if (loading || (!user && hasToken)) {
    return <LoadingFallback message="Checking admin access…" />;
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;