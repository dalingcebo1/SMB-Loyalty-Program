// src/components/NavTabs.tsx

import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const NavTabs: React.FC = () => {
  const { logout } = useAuth();

  return (
    <>
      {/* Desktop Only Top Bar - hide hamburger, keep title and logout */}
      <div className="hidden md:flex w-full items-center justify-between px-4 py-3 bg-white shadow">
        {/* Empty space for balance instead of hamburger */}
        <div className="w-8"></div>
        
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
    </>
  );
};

export default NavTabs;
