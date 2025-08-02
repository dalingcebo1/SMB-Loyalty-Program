// src/pages/MyLoyalty.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import useFetch from "../hooks/useFetch";
import PageLayout from "../components/PageLayout";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { FiGift } from "react-icons/fi";
import RewardModal from "../components/RewardModal";
import Toast from "../components/Toast";
import { Profile, ReadyReward } from "../types";



const MyLoyalty: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: profile, loading: loadingProfile, error: profileError } = useFetch<Profile>("/loyalty/me", { phone: user?.phone });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQR, setModalQR] = useState<{ qr: string; pin: string; reward: string; milestone?: number } | null>(null);


  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  // --- Progress bar state for instant UI ---
  const milestoneSize = 5;
  const [visits, setVisits] = useState(() => {
    const stored = localStorage.getItem("visits");
    return stored ? parseInt(stored, 10) : 0;
  });


  // Initialize visits from fetched profile
  useEffect(() => {
    if (profile) {
      const v = profile.visits || 0;
      setVisits(v);
      localStorage.setItem("visits", String(v));
    }
  }, [profile]);

  // Load redemption history
  const { data: historyData, loading: historyLoading, error: historyError } = useFetch<any[]>(
    "/loyalty/history",
    { phone: user?.phone }
  );
  const history = historyData ?? [];

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

  const pageLoading = authLoading || loadingProfile;
  const pageError = profileError;

  // Render content within layout
  return (
    <PageLayout
      loading={pageLoading}
      error={pageError}
      onRetry={() => window.location.reload()}
      loadingText="Loading loyalty data..."
    >
      <div className="max-w-2xl mx-auto p-4">
        {/* Toast */}
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>

      <RewardModal
        isOpen={modalOpen && !!modalQR}
        reward={modalQR?.reward || ""}
        qr={modalQR?.qr}
        pin={modalQR?.pin || ""}
        onClose={handleCloseModal}
      />

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
          profile.rewards_ready.map((r: ReadyReward) => (
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
        {/* Handle history loading, errors, and display */}
        {historyError ? (
          <div className="text-red-500 mb-2">Error loading history: {historyError}</div>
        ) : historyLoading ? (
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
    <PageLayout
      loading={pageLoading}
      error={pageError}
      onRetry={() => window.location.reload()}
      loadingText="Loading loyalty data..."
    >
      <div className="max-w-2xl mx-auto p-4">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>

      <RewardModal
        isOpen={modalOpen && !!modalQR}
        reward={modalQR?.reward || ""}
        qr={modalQR?.qr}
        pin={modalQR?.pin || ""}
        onClose={handleCloseModal}
      />

      <h1 className="text-2xl font-bold mb-2 text-center">
        Welcome back, {profile?.name ?? "User"}!
      </h1>
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
        <div className="mt-2 text-gray-500 text-lg">Total visits: {visits}</div>
        <div className="mt-2 text-gray-500">
          {nextMilestone - progress > 0
            ? `Only ${nextMilestone - progress} more visit${nextMilestone - progress > 1 ? "s" : ""} to your next reward!`
            : "You've reached a milestone!"}
        </div>
      </div>

      <div className="bg-white rounded shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-center">Unlocked Rewards</h2>
        {profile && profile.rewards_ready && profile.rewards_ready.length ? (
          profile.rewards_ready.map((r: ReadyReward) => (
            <div key={r.milestone} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4 border border-purple-200 bg-purple-50 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <FiGift className="text-3xl text-purple-500" />
                <span className="font-medium text-base">{r.reward}</span>
              </div>
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
        {historyError ? (
          <div className="text-red-500 mb-2">Error loading history: {historyError}</div>
        ) : historyLoading ? (
          <div className="text-gray-500">Loading history…</div>
        ) : history.length ? (
          <ul className="divide-y">
            {history.map((h, idx) => (
              <li key={idx} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-3">
                  {h.status === "used" && <span title="Used" className="text-green-600 text-xl">✔️</span>}
                  {h.status === "pending" && <span title="Pending" className="text-yellow-500 text-xl">⏳</span>}
                  {h.status === "expired" && <span title="Expired" className="text-gray-400 text-xl">⌛</span>}
                  <span className="font-medium text-base">{h.reward}</span>
                  <span className="ml-2 text-xs text-gray-500">Milestone: {h.milestone}</span>
                </div>
                <div className="text-xs text-gray-600 flex flex-col md:items-end">
                  <div>
                    {h.redeemed_at ? (
                      <><span className="font-semibold text-gray-700">Redeemed:</span> {new Date(h.redeemed_at).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</>
                    ) : h.redeemed ? (
                      <span className="font-semibold text-purple-700">Redeemed online</span>
                    ) : h.status === "pending" && h.expiry_at ? (
                      <><span className="font-semibold text-gray-700">Expires:</span> {new Date(h.expiry_at).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</>
                    ) : (
                      <span className="text-red-600">Not redeemed</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-semibold ${h.status === "used" ? "bg-green-100 text-green-700" : ""} ${h.status === "pending" ? "bg-yellow-100 text-yellow-700" : ""} ${h.status === "expired" ? "bg-gray-200 text-gray-500" : ""}`}>{h.status.charAt(0).toUpperCase() + h.status.slice(1)}</span>
                    {h.status === "pending" && h.pin && <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">PIN: {h.pin}</span>}
                  </div>
                </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-500">No redemptions yet.</div>
        )}
      </div>

      <div className="flex justify-center">
        <button onClick={() => navigate("/services")} className="mt-4 px-4 py-2 bg-purple-200 text-purple-800 rounded font-medium text-sm shadow hover:bg-purple-300 min-w-[120px]">Book a Wash</button>
      </div>
    </PageLayout>
  );
