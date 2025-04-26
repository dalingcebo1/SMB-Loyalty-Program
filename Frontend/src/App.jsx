import React, { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

import RewardsPage from "./pages/RewardsPage";
import ClaimedPage from "./pages/ClaimedPage";
import HistoryPage from "./pages/HistoryPage";

const API_BASE = import.meta.env.VITE_API_URL;
const PHONE = "0735876972";  // temp; replace with real login later

export default function App() {
  const [activeTab, setActiveTab] = useState("rewards");
  const [user, setUser] = useState(null);
  const [claimedRewards, setClaimedRewards] = useState([]);
  const [redeemedHistory, setRedeemedHistory] = useState([]);

  // 1️⃣ Load persisted state & user profile
  useEffect(() => {
    const storedClaims = JSON.parse(localStorage.getItem("claimedRewards") || "[]");
    const storedHistory = JSON.parse(localStorage.getItem("redeemedHistory") || "[]");
    setClaimedRewards(storedClaims);
    setRedeemedHistory(storedHistory);
    fetchProfile();
  }, []);

  // 2️⃣ Auto-expire old QR codes every second
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const fresh = claimedRewards.filter(c => {
        try {
          return jwtDecode(c.token).exp * 1000 > now;
        } catch {
          return false;
        }
      });
      if (fresh.length !== claimedRewards.length) {
        setClaimedRewards(fresh);
        localStorage.setItem("claimedRewards", JSON.stringify(fresh));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [claimedRewards]);

  function fetchProfile() {
    fetch(`${API_BASE}/me?phone=${PHONE}`)
      .then(r => r.json())
      .then(setUser)
      .catch(console.error);
  }

  function claimReward() {
    fetch(`${API_BASE}/reward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.rewards?.length) {
          const items = data.rewards.map(r => ({
            reward: r.reward,
            milestone: r.milestone,
            token: r.token,
            qr: r.qr_code_base64,
          }));
          items.forEach(i => alert(`🎉 Unlocked: ${i.reward}`));
          const updated = [...claimedRewards, ...items];
          setClaimedRewards(updated);
          localStorage.setItem("claimedRewards", JSON.stringify(updated));
        } else {
          alert(data.message || "No reward available");
        }
        fetchProfile();
      })
      .catch(console.error);
  }

  function redeemReward(token, idx) {
    fetch(`${API_BASE}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(r => (r.ok ? r.json() : r.json().then(e => { throw e; })))
      .then(data => {
        alert(`✅ Redeemed: ${data.reward}`);
        const updatedClaims = claimedRewards.filter((_, i) => i !== idx);
        setClaimedRewards(updatedClaims);
        localStorage.setItem("claimedRewards", JSON.stringify(updatedClaims));

        const entry = {
          reward: data.reward,
          milestone: data.milestone,
          timestamp: new Date().toISOString(),
        };
        const updatedHist = [...redeemedHistory, entry];
        setRedeemedHistory(updatedHist);
        localStorage.setItem("redeemedHistory", JSON.stringify(updatedHist));
      })
      .catch(err => alert(err.detail || "❌ Redemption failed"));
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navbar */}
      <div className="bg-white shadow p-4 flex justify-center space-x-4">
        {["rewards","claimed","history"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded ${
              activeTab===tab ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {tab === "rewards" && "🎁 Rewards"}
            {tab === "claimed" && "📲 Claimed"}
            {tab === "history" && "📜 History"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto p-6">
        {!user ? (
          <div className="text-center">Loading profile…</div>
        ) : activeTab === "rewards" ? (
          <RewardsPage
            user={user}
            claimedRewards={claimedRewards}
            onClaim={claimReward}
          />
        ) : activeTab === "claimed" ? (
          <ClaimedPage
            claimedRewards={claimedRewards}
            onRedeem={redeemReward}
          />
        ) : (
          <HistoryPage history={redeemedHistory} />
        )}
      </div>
    </div>
  );
}
