// src/pages/MyLoyalty.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

interface Reward {
  milestone: number;
  reward: string;
}
interface Upcoming {
  milestone: number;
  visits_needed: number;
  reward: string;
}
interface Profile {
  name: string;
  phone: string;
  visits: number;
  rewards_ready: Reward[];
  upcoming_rewards: Upcoming[];
}

const MyLoyalty: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // Redirect to login if not authenticated
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // Fetch loyalty profile by phone
    api
      .get<Profile>("/loyalty/me", { params: { phone: user.phone } })
      .then((res) => {
        setProfile(res.data);
      })
      .catch((err) => {
        console.error("Failed to load loyalty profile:", err);
        setError(
          err.response?.data?.detail ||
            err.response?.data?.message ||
            "Failed to load profile"
        );
      });
  }, [authLoading, user, navigate]);

  if (authLoading || (!profile && !error)) {
    return <div>Loading…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome back, {profile!.name}!</h1>
      <p>You’ve visited us {profile!.visits} times.</p>

      <h2 className="mt-6">Your Rewards</h2>
      {profile!.rewards_ready.length ? (
        profile!.rewards_ready.map((r) => (
          <div key={r.milestone} className="mt-2">
            ⭐ Unlocked: {r.reward}
          </div>
        ))
      ) : (
        <p className="mt-2">No unlocked rewards yet.</p>
      )}

      <h2 className="mt-6">Upcoming</h2>
      {profile!.upcoming_rewards.map((r) => (
        <div key={r.milestone} className="mt-2">
          {r.reward} in {r.visits_needed} more visits.
        </div>
      ))}

      <button
        onClick={() => (window.location.href = "/services")}
        className="mt-8 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Book a Wash
      </button>
    </div>
  );
};

export default MyLoyalty;
