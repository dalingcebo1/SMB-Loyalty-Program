import React from "react";
import { jwtDecode } from "jwt-decode";

function formatRemaining(exp) {
  const ms = exp * 1000 - Date.now();
  if (ms <= 0) return "Expired";
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClaimedPage({ claimedRewards, onRedeem }) {
  if (claimedRewards.length === 0) {
    return <p className="text-center text-gray-600">No active QR rewards.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {claimedRewards.map((c, i) => {
        let exp = 0;
        try { exp = jwtDecode(c.token).exp; } catch {}
        return (
          <div key={i} className="border rounded p-4 text-center">
            <p className="font-semibold">{c.reward}</p>
            <p className="text-xs text-gray-500 mb-2">Milestone: {c.milestone}</p>
            <img
              src={`data:image/png;base64,${c.qr}`}
              alt="QR Code"
              className="mx-auto w-28 h-28 mb-2"
            />
            <p className="text-xs text-gray-500 mb-2">
              ⏱ {formatRemaining(exp)}
            </p>
            <button
              onClick={() => onRedeem(c.token, i)}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              Redeem
            </button>
          </div>
        );
      })}
    </div>
  );
}
