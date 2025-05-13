// src/pages/MyLoyalty.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

interface Reward {
  id: number;
  name: string;
  description: string;
  points_required: number;
  image_url?: string;
  claimed?: boolean;
}
interface ReadyReward {
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
  rewards_ready: ReadyReward[];
  upcoming_rewards: Upcoming[];
}

const MyLoyalty: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // Fetch loyalty profile
    api
      .get<Profile>("/loyalty/me", { params: { phone: user.phone } })
      .then((res) => setProfile(res.data))
      .catch((err) => {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.message ||
            "Failed to load profile"
        );
      });

    // Fetch all rewards
    api
      .get<Reward[]>("/loyalty/rewards")
      .then((res) => setRewards(res.data))
      .catch((err) => {
        // Don't block the page if rewards fail, but log it
        console.error("Failed to load rewards catalog:", err);
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
      {profile!.upcoming_rewards.length ? (
        profile!.upcoming_rewards.map((r) => (
          <div key={r.milestone} className="mt-2">
            {r.reward} in {r.visits_needed} more visits.
          </div>
        ))
      ) : (
        <p className="mt-2">No upcoming rewards.</p>
      )}

      <h2 className="mt-8">All Available Rewards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {rewards.length ? (
          rewards.map((reward) => (
            <div key={reward.id} className="border rounded p-4 flex flex-col items-start">
              <div className="font-semibold">{reward.name}</div>
              <div className="text-sm text-gray-600">{reward.description}</div>
              <div className="mt-2 text-xs text-gray-500">
                Points required: {reward.points_required}
              </div>
              {reward.image_url && (
                <img src={reward.image_url} alt={reward.name} className="mt-2 w-24 h-24 object-cover" />
              )}
            </div>
          ))
        ) : (
          <div>No rewards found.</div>
        )}
      </div>

      <button
        onClick={() => navigate("/services")}
        className="mt-8 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Book a Wash
      </button>
    </div>
  );
};

export default MyLoyalty;
