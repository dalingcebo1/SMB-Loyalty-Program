import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import NavTabs from "./NavTabs";

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();

  // If not logged in, send to /login
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Optional: a header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto p-4 flex justify-between">
          <h1 className="text-xl font-semibold">SMB Loyalty</h1>
          <span className="text-sm text-gray-600">Hi, {user.name}</span>
        </div>
      </header>

      {/* Tab navigation */}
      <NavTabs />

      {/* Outlet for the selected page */}
      <main className="flex-grow max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
