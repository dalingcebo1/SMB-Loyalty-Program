// src/pages/MyLoyalty.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { FiGift } from "react-icons/fi";
import QRCode from "react-qr-code";

// Add a simple toast component
const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded shadow z-50">
    {message}
    <button className="ml-4 text-white font-bold" onClick={onClose}>&times;</button>
  </div>
);

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQR, setModalQR] = useState<{ qr: string; pin: string; reward: string; milestone?: number } | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  // --- Progress bar state for instant UI ---
  const milestoneSize = 5;
  const [visits, setVisits] = useState(() => {
    const stored = localStorage.getItem("visits");
    return stored ? parseInt(stored, 10) : 0;
  });

  // Fetch profile and rewards, and update visits in localStorage
  const fetchLoyalty = () => {
    setLoading(true);
    setError(null);
    api.get<Profile>("/loyalty/me", { params: { phone: user?.phone } })
      .then((profileRes) => {
        setProfile(profileRes.data);
        setVisits(profileRes.data.visits || 0);
        localStorage.setItem("visits", String(profileRes.data.visits || 0));
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.message ||
            "Failed to load loyalty data"
        );
        setLoading(false);
      });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    fetchLoyalty();
    // eslint-disable-next-line
  }, [authLoading, user, navigate]);

  // Fetch history after profile loads
  useEffect(() => {
    if (!user) return;
    setHistoryLoading(true);
    api
      .get("/loyalty/history", { params: { phone: user.phone } })
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [user]);

  // On component mount, check for last voucher
  useEffect(() => {
    const lastVoucher = localStorage.getItem("lastVoucher");
    if (lastVoucher) {
      setModalQR(JSON.parse(lastVoucher));
      // Optionally, show a "View Last Voucher" button instead of auto-opening
    }
  }, []);

  // Progress calculation (use visits from state for instant UI)
  const progress = visits % milestoneSize;
  const nextMilestone = milestoneSize;

  // Show QR modal for a reward
  const handleShowQR = async (milestone: number, rewardName: string) => {
    if (!user) return;
    try {
      const { data } = await api.post("/loyalty/reward", { phone: user.phone });
      const found = data.rewards?.find((rw: any) => rw.milestone === milestone);
      if (found) {
        // Use qr_reference for QR code and pin for PIN
        const voucherData = {
          qr: found.qr_reference || "",
          pin: found.pin || "",
          reward: rewardName,
          milestone,
        };
        setModalQR(voucherData);
        setModalOpen(true);
        localStorage.setItem("lastVoucher", JSON.stringify(voucherData));
      }
    } catch (err) {
      setToast("Failed to load QR code for reward.");
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="text-lg text-gray-600">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-2">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button
          className="btn bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Modal for QR/PIN */}
      {modalOpen && modalQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full flex flex-col items-center relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="font-semibold mb-2 text-center text-lg">{modalQR.reward}</div>
            {modalQR.qr && (
              <div className="w-56 h-56 mb-4 flex items-center justify-center">
                <QRCode value={modalQR.qr} size={220} />
              </div>
            )}
            <div className="mt-2 text-base break-all">
              PIN: <span className="font-mono">{modalQR.pin}</span>
            </div>
            <div className="text-gray-500 text-base mt-2 text-center">
              Show this code to staff to redeem your reward.
            </div>
            <button
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
              onClick={handleCloseModal}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-2 text-center">Welcome back, {profile?.name ?? "User"}!</h1>
      <div className="flex flex-col items-center my-6">
        <div className="w-40 h-40">
          <CircularProgressbar
            value={progress === 0 && visits > 0 ? nextMilestone : progress}
            maxValue={nextMilestone}
            text={`${progress === 0 && visits > 0 ? nextMilestone : progress}/${nextMilestone}`}
            styles={buildStyles({
              textSize: "18px",
              pathColor: "#2563eb",
              textColor: "#2563eb",
              trailColor: "#e5e7eb",
            })}
          />
        </div>
        <div className="mt-2 text-gray-500 text-lg">
          Total visits: {visits}
        </div>
        <div className="mt-2 text-gray-500">
          {nextMilestone - progress > 0
            ? `Only ${nextMilestone - progress} more visit${nextMilestone - progress > 1 ? "s" : ""} to your next reward!`
            : "You've reached a milestone!"}
        </div>
      </div>

      <div className="bg-white rounded shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-center">Unlocked Rewards</h2>
        {profile && profile.rewards_ready && profile.rewards_ready.length ? (
          profile.rewards_ready.map((r) => (
            <div
              key={r.milestone}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4 border border-purple-200 bg-purple-50 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FiGift className="text-3xl text-purple-500" />
                <span className="font-medium text-base">{r.reward}</span>
              </div>
              {/* Center the button */}
              <div className="flex flex-col items-center justify-center mt-2 md:mt-0 w-full">
                <button
                  className="px-4 py-2 bg-purple-200 text-purple-800 rounded font-medium text-sm shadow hover:bg-purple-300 border border-purple-300 transition min-w-[120px]"
                  onClick={() => handleShowQR(r.milestone, r.reward)}
                >
                  View QR Code
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2 md:mt-0 md:ml-8 text-center">
                Show this QR code or PIN to staff to redeem your reward.
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No unlocked rewards yet.</p>
        )}
      </div>

      <div className="bg-white rounded shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2 text-center">Redemption History</h2>
        {historyLoading ? (
          <div className="text-gray-500">Loading history…</div>
        ) : history.length ? (
          <ul className="divide-y">
            {history.map((h, idx) => (
              <li
                key={idx}
                className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  {h.status === "used" && (
                    <span title="Used" className="text-green-600 text-xl">✔️</span>
                  )}
                  {h.status === "pending" && (
                    <span title="Pending" className="text-yellow-500 text-xl">⏳</span>
                  )}
                  {h.status === "expired" && (
                    <span title="Expired" className="text-gray-400 text-xl">⌛</span>
                  )}
                  <span className="font-medium text-base">{h.reward}</span>
                  <span className="ml-2 text-xs text-gray-500">Milestone: {h.milestone}</span>
                </div>
                <div className="text-xs text-gray-600 flex flex-col md:items-end">
                  <div>
                    {h.redeemed_at ? (
                      <>
                        <span className="font-semibold text-gray-700">Redeemed:</span>{" "}
                        {new Date(h.redeemed_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    ) : h.redeemed ? (
                      <span className="font-semibold text-purple-700">Redeemed online</span>
                    ) : h.status === "pending" && h.expiry_at ? (
                      <>
                        <span className="font-semibold text-gray-700">Expires:</span>{" "}
                        {new Date(h.expiry_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    ) : (
                      <span className="text-red-600">Not redeemed</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-semibold
                      ${h.status === "used" ? "bg-green-100 text-green-700" : ""}
                      ${h.status === "pending" ? "bg-yellow-100 text-yellow-700" : ""}
                      ${h.status === "expired" ? "bg-gray-200 text-gray-500" : ""}
                    `}>
                      {h.status.charAt(0).toUpperCase() + h.status.slice(1)}
                    </span>
                    {h.status === "pending" && h.pin && (
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">PIN: {h.pin}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-500">No redemptions yet.</div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => navigate("/services")}
          className="mt-4 px-4 py-2 bg-purple-200 text-purple-800 rounded font-medium text-sm shadow hover:bg-purple-300 min-w-[120px]"
        >
          Book a Wash
        </button>
      </div>
    </div>
  );
};

export default MyLoyalty;
