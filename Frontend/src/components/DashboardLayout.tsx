// src/components/DashboardLayout.tsx

import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import NavTabs from "./NavTabs";
import BottomNav from "./BottomNav";
import './DashboardLayout.css';

const DashboardLayout: React.FC = () => {
  const { user, loading } = useAuth();

  // 1) Show a full-screen loader while we're checking auth
  if (loading) {
    return (
      <div className="dashboard-loading">
        Loading…
      </div>
    );
  }

  // 2) If still no user, redirect to /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3) Authenticated layout
  return (
    <div className="dashboard-layout">
      <NavTabs />
      <BottomNav />
      <main className="dashboard-main">
        <div className="dashboard-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
