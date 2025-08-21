// src/components/DashboardLayout.tsx

import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import NavTabs from "./NavTabs";
import BottomNav from "./BottomNav";

const DashboardLayout: React.FC = () => {
  const { user, loading } = useAuth();

  // 1) Show a full-screen loader while we’re checking auth
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
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
      {/* Top navigation bar */}
      <NavTabs />
      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Main page content */}
      <main className="flex-grow max-w-6xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
