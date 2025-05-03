// src/components/DashboardLayout.tsx

import React from "react";
import { Outlet, Navigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import NavTabs from "./NavTabs";

const DashboardLayout: React.FC = () => {
  const { user, logout, loading } = useAuth();

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          {/* logo / home */}
          <Link
            to="/"
            className="text-2xl font-bold text-blue-600 hover:underline"
          >
            SMB Loyalty
          </Link>

          {/* greeting + logout */}
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">
              Hi, {user.firstName} {user.lastName}
            </span>
            <button
              onClick={logout}
              className="text-red-600 hover:underline text-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* your tab nav */}
      <NavTabs />

      {/* page content */}
      <main className="flex-grow max-w-6xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
