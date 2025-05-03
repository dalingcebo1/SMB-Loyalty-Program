// src/components/NavTabs.tsx

import React from "react";
import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/rewards", label: "Rewards" },
  { to: "/claimed",  label: "Claimed"  },
  { to: "/history",  label: "History"  },
];

const NavTabs: React.FC = () => (
  <nav className="flex space-x-4 bg-white p-2 shadow">
    {tabs.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        className={({ isActive }) =>
          isActive
            ? "px-4 py-2 font-medium border-b-2 border-blue-600"
            : "px-4 py-2 text-gray-600 hover:text-gray-900"
        }
      >
        {t.label}
      </NavLink>
    ))}
  </nav>
);

export default NavTabs;
