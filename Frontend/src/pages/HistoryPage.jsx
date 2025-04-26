import React from "react";

export default function HistoryPage({ history }) {
  if (history.length === 0) {
    return <p className="text-center text-gray-600">No past redemptions.</p>;
  }
  return (
    <ul className="space-y-3">
      {history.map((h, i) => (
        <li key={i} className="p-3 border rounded bg-gray-50">
          <p className="font-medium">{h.reward}</p>
          <p className="text-xs text-gray-500">Milestone: {h.milestone}</p>
          <p className="text-xs text-gray-400">
            Redeemed at: {new Date(h.timestamp).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
