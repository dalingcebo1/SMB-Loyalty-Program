// src/pages/DashboardHome.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // suppose your backend returns visits so far and the milestone:
  const [visits, setVisits] = useState(0);
  const milestone = 5;

  useEffect(() => {
    // fetch profile to get visits count
    // replace with your real API call if needed
    fetch("/api/loyalty/me", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then((data: { visits: number }) => setVisits(data.visits))
      .catch(() => {
        // swallow or show an error
      });
  }, []);

  return (
    <div className="max-w-sm mx-auto text-center mt-12 space-y-6">
      <h1 className="text-3xl font-bold">
        Welcome, {user?.firstName} {user?.lastName}!
      </h1>
      <p className="text-gray-600">
        Thank you for registering, welcome to your full-service car wash application.
      </p>

      <div className="mx-auto w-32 h-32 border-4 border-gray-400 rounded-full flex items-center justify-center text-2xl font-semibold">
        {visits}/{milestone}
      </div>

      <p className="text-gray-600 px-4">
        At Sparkle Car Wash, we like to acknowledge your continued support; that is why we are giving you the {milestone+1}th Full Wash on us.
      </p>

      <button
        onClick={() => navigate("/rewards")}
        className="mt-4 w-full py-2 border-2 border-gray-700 rounded-lg font-medium"
      >
        View My Loyalty
      </button>
    </div>
  );
};

export default DashboardHome;
