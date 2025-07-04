// src/components/NavTabs.tsx

import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { moduleFlags } from "../config/modules";

const NavTabs: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { enableCatalog, enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

  const navOptions = [
    ...(enableCatalog ? [{ to: "/services", label: "Services" }] : []),
    ...(enableLoyalty ? [{ to: "/myloyalty", label: "Loyalty" }] : []),
    ...(enableOrders ? [{ to: "/past-orders", label: "Past Orders" }] : []),
    ...(enableUsers ? [{ to: "/account", label: "Account" }] : []),
    ...((user?.role === "staff" || user?.role === "admin") ? [
      ...(enablePayments ? [{ to: "/staff", label: "Car Wash" }] : []),
      { to: "/staff/manual-visit", label: "Log a visit" },
      { to: "/staff/vehicle-manager", label: "Manage Vehicles" },
    ] : []),
    ...(user?.role === "admin" ? [
      { to: "/admin/users", label: "Users" },
      ...(enableUsers ? [{ to: "/admin/register-staff", label: "Register Staff" }] : []),
      { to: "/admin/modules", label: "Modules" },
    ] : []),
  ];

  return (
    <>
      {/* Single Top Bar */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-white shadow">
        {/* Hamburger Icon */}
        <button
          className="text-3xl text-gray-700"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          &#9776;
        </button>
        {/* Centered Title */}
        <div className="flex-1 flex justify-center">
          <NavLink
            to="/"
            className="text-lg font-bold text-gray-800 hover:underline focus:outline-none"
            style={{ textDecoration: "none" }}
          >
            SMB Loyalty
          </NavLink>
        </div>
        {/* Logout Button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={logout}
            className="text-red-600 hover:underline text-sm font-medium"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Only render overlay and drawer when open */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-30 transition-opacity duration-300"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            className="fixed top-0 left-0 h-full z-50 bg-white shadow-lg flex flex-col transition-transform duration-300"
            style={{ width: "70vw", maxWidth: 320, minWidth: 240 }}
          >
            {/* User Info */}
            <div className="flex flex-col items-center py-6 border-b">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                <span className="text-3xl text-gray-400">👤</span>
              </div>
              <span className="font-semibold text-lg text-center">
                {user ? `${user.firstName} ${user.lastName}` : ""}
              </span>
            </div>
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 text-3xl text-gray-400 hover:text-gray-700 focus:outline-none"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
            >
              ×
            </button>
            {/* Navigation Links */}
            <div className="flex flex-col mt-6 space-y-2">
              {navOptions.map((opt) => (
                <NavLink
                  key={opt.to}
                  to={opt.to}
                  className={({ isActive }) =>
                    (isActive
                      ? "font-bold text-blue-700"
                      : "text-gray-900 hover:text-blue-600") +
                    " block px-8 py-4 text-2xl rounded transition text-left"
                  }
                  onClick={() => setOpen(false)}
                >
                  {opt.label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default NavTabs;
