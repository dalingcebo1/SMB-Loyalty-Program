import React from "react";
import { useAuth } from "../auth/AuthProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import api from "../api/api";

interface Reward {
  id: number;
  name: string;
  description: string;
  points_required: number;
  image_url?: string;
  claimed: boolean;
}

const fetchRewards = async (): Promise<Reward[]> => {
  const { data } = await api.get<Reward[]>("/loyalty/rewards");
  return data;
};

const RewardsPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["loyalty", "rewards"],
    queryFn: fetchRewards,
    staleTime: 1000 * 60 * 2,
  });

  if (!user) return <Navigate to="/login" replace />;

  if (isLoading)
    return <div className="p-4 text-center">Loading rewards…</div>;

  if (error)
    return (
      <div className="p-4 text-center">
        <p>Failed to load rewards.</p>
        <button onClick={() => refetch()} className="btn mt-2">
          Retry
        </button>
      </div>
    );

  const handleClaim = async (id: number) => {
    await api.post("/loyalty/claim", { reward_id: id });
    qc.invalidateQueries({ queryKey: ["loyalty", "rewards"] });
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Your Rewards</h1>

      {data!.length === 0 && (
        <p>No rewards available at the moment. Check back later!</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data!.map((r) => (
          <div
            key={r.id}
            className={`border rounded-lg p-4 flex flex-col ${
              r.claimed ? "opacity-50" : ""
            }`}
          >
            {r.image_url && (
              <img
                src={r.image_url}
                alt={r.name}
                className="h-32 object-cover rounded-md mb-2"
              />
            )}
            <h2 className="text-lg font-medium">{r.name}</h2>
            <p className="text-sm text-gray-600 flex-grow">
              {r.description}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-semibold">
                {r.points_required} pts
              </span>
              <button
                onClick={() => handleClaim(r.id)}
                disabled={r.claimed}
                className={`btn-sm ${
                  r.claimed
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white"
                }`}
              >
                {r.claimed ? "Claimed" : "Claim"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RewardsPage;
