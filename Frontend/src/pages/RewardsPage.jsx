import React from "react";

export default function RewardsPage({ user, claimedRewards, onClaim }) {
  // derive which milestones are already claimed
  const claimedSet = new Set(claimedRewards.map(c => String(c.milestone)));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-center">
        Hi {user.name}! You’ve visited {user.total_visits} times
      </h2>

      {user.upcoming_rewards.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-center">
          <p className="text-sm text-blue-700">🎯 Next Reward</p>
          <h3 className="text-xl font-semibold">{user.upcoming_rewards[0].reward}</h3>
          <p className="text-sm">
            Visit {user.upcoming_rewards[0].visits_needed} more time(s)
          </p>
        </div>
      )}

      {user.rewards_ready_to_claim.length > 0 && (
        <>
          <h3 className="text-lg font-medium mb-2">🎉 You’ve earned:</h3>
          <ul>
            {user.rewards_ready_to_claim.map((r, i) => (
              <li
                key={i}
                className="bg-green-100 p-3 mb-2 rounded flex justify-between"
              >
                <span>
                  {r.reward} <small>(Milestone {r.milestone})</small>
                </span>
                {!claimedSet.has(String(r.milestone)) && (
                  <button
                    onClick={onClaim}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Claim
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
);
}
