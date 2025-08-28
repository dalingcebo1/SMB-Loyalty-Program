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
    <div className="min-h-screen flex flex-col bg-gray-50 pb-16 md:pb-0">
      {/* Top navigation bar - hidden on mobile, shown on tablet+ */}
      <NavTabs />
      
      {/* Mobile bottom nav - shown on mobile, hidden on tablet+ */}
      <BottomNav />

      {/* Main page content with proper spacing for navigation */}
      <main className="flex-grow max-w-6xl mx-auto p-6 pt-4 md:pt-6">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
