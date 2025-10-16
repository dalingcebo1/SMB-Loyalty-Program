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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-gray-50">
      {/* Top navigation bar - hidden on mobile, shown on tablet+ */}
      <NavTabs />
      
      {/* Mobile bottom nav - shown on mobile, hidden on tablet+ */}
      <BottomNav />

      {/* Main page content with proper spacing for navigation */}
      <main className="flex-grow pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
