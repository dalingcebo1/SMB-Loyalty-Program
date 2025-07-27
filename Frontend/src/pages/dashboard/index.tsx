import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bar, Line, Pie } from "react-chartjs-2";
import "chart.js/auto";

interface Summary {
  user_count: number;
  transaction_count: number;
  points_issued: number;
  points_redeemed: number;
  redemptions_count: number;
  visits_total: number;
  user_growth: { date: string; count: number }[];
  transaction_volume: { date: string; value: number }[];
  visits_over_time: { date: string; count: number }[];
  tier_distribution: { tier: string; count: number }[];
  top_rewards: { title: string; count: number }[];
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/analytics/summary").then(res => {
      setSummary(res.data);
      setLoading(false);
    });
  }, []);

  if (loading || !summary) return <div>Loading dashboard...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h1>Admin Dashboard</h1>
      <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Total Users" value={summary.user_count} />
        <StatCard label="Total Transactions" value={summary.transaction_count} />
        <StatCard label="Points Issued" value={summary.points_issued} />
        <StatCard label="Points Redeemed" value={summary.points_redeemed} />
        <StatCard label="Redemptions" value={summary.redemptions_count} />
        <StatCard label="Total Visits" value={summary.visits_total} />
      </div>
      {/* First row of charts */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
        <div style={{ flex: 1 }}>
          <h2>User Growth</h2>
          <Line
            data={{
              labels: summary.user_growth.map(u => u.date),
              datasets: [{
                label: "New Users",
                data: summary.user_growth.map(u => u.count),
                backgroundColor: "#1976d2",
                borderColor: "#1976d2",
                fill: false,
              }],
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <h2>Transaction Volume</h2>
          <Bar
            data={{
              labels: summary.transaction_volume.map(t => t.date),
              datasets: [{
                label: "Transactions",
                data: summary.transaction_volume.map(t => t.value),
                backgroundColor: "#43a047",
              }],
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <h2>Visists Over Time</h2>
          <Line
            data={{
              labels: summary.visits_over_time.map(v => v.date),
              datasets: [{
                label: "Visits",
                data: summary.visits_over_time.map(v => v.count),
                backgroundColor: "#ffa000",
                borderColor: "#ffa000",
                fill: false,
              }],
            }}
          />
        </div>
      </div>
      {/* Second row of charts */}
      <div style={{ display: "flex", gap: 32 }}>
        <div style={{ flex: 1 }}>
          <h2>User Tier Distribution</h2>
          <Pie
            data={{
              labels: summary.tier_distribution.map(t => t.tier),
              datasets: [{
                data: summary.tier_distribution.map(t => t.count),
                backgroundColor: ["#1976d2", "#43a047", "#fbc02d", "#e53935"],
              }],
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <h2>Top Rewards Redeemed</h2>
          <Bar
            data={{
              labels: summary.top_rewards.map(r => r.title),
              datasets: [{
                label: "Redemptions",
                data: summary.top_rewards.map(r => r.count),
                backgroundColor: "#8e24aa",
              }],
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 8,
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      padding: 24,
      minWidth: 180,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
