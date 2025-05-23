// Frontend/src/pages/Payment.tsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";

interface LocationState {
  orderId: string;
  total: number; // in cents
  summary?: string[];
  qrData?: string;
  paymentPin?: string;
}

declare global {
  interface Window {
    YocoSDK: any;
  }
}

interface Service {
  id: number;
  name: string;
  loyalty_eligible: boolean;
  // ...other fields as needed
}

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { orderId, total, summary = [] } = (state as LocationState) || {};

  const [paying, setPaying] = useState(false);
  const [yocoLoaded, setYocoLoaded] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);
  const [rewardDiscount, setRewardDiscount] = useState(0);
  const [rewardInfo, setRewardInfo] = useState<{ reward: string; expiry?: string; milestone?: number } | null>(null);
  const [, setService] = useState<Service | null>(null);
  const [canApplyLoyalty, setCanApplyLoyalty] = useState(false);

  const { refreshUser, user } = useAuth();

  useEffect(() => {
    // Validate all required state fields
    if (!orderId || typeof total !== "number" || isNaN(total)) {
      toast.error("Missing payment details");
      navigate("/", { replace: true });
    }
  }, [orderId, total, navigate]);

  // Dynamically load Yoco SDK if not already loaded
  useEffect(() => {
    if (window.YocoSDK) {
      setYocoLoaded(true);
      return;
    }
    const scriptId = "yoco-sdk";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://js.yoco.com/sdk/v1/yoco-sdk-web.js";
      script.async = true;
      script.onload = () => setYocoLoaded(true);
      script.onerror = () => {
        toast.error("Failed to load Yoco SDK. Please check your connection.");
      };
      document.body.appendChild(script);
    } else {
      // If script exists but not loaded yet, wait for onload
      const script = document.getElementById(scriptId) as HTMLScriptElement;
      script.onload = () => setYocoLoaded(true);
    }
  }, []);

  const publicKey = import.meta.env.VITE_YOCO_PUBLIC_KEY!;

  // Fetch the order's service to check loyalty_eligible
  useEffect(() => {
    if (!orderId) return;
    api.get(`/orders/${orderId}`)
      .then(res => {
        // Use loyalty_eligible directly from the order response if available
        if (typeof res.data.loyalty_eligible !== "undefined") {
          setCanApplyLoyalty(!!res.data.loyalty_eligible);
          // Optionally, setService with more info if needed
        } else {
          // Fallback: fetch service by ID if not present in order response
          const svcId = res.data.serviceId ?? res.data.service_id;
          if (svcId) {
            api.get(`/services/${svcId}`).then(svcRes => {
              setService(svcRes.data);
              setCanApplyLoyalty(!!svcRes.data.loyalty_eligible);
            }).catch(() => {
              setCanApplyLoyalty(false);
            });
          } else {
            setCanApplyLoyalty(false);
          }
        }
      })
      .catch(() => setCanApplyLoyalty(false));
  }, [orderId]);

  // Check if user has a reward available for this order
  useEffect(() => {
    if (!user) return;
    api.get("/loyalty/me", { params: { phone: user.phone } })
      .then(res => {
        // Find a ready reward for this user (milestone reward, e.g. "Full House" or "Free Wash")
        const reward = res.data.rewards_ready?.find(
          (r: any) =>
            r.reward.toLowerCase().includes("full house") ||
            r.reward.toLowerCase().includes("free wash")
        );
        if (reward) {
          setRewardInfo({
            reward: reward.reward,
            expiry: reward.expiry,
            milestone: reward.milestone,
          });
        }
      });
  }, [user]);

  const handleApplyReward = async () => {
    setPaying(true);
    try {
      // Use the new /loyalty/reward/apply endpoint
      const res = await api.post("/loyalty/reward/apply", { orderId, phone: user?.phone });
      if (res.data && res.data.discount) {
        setRewardDiscount(res.data.discount);
        setRewardApplied(true);
        toast.success(`Reward applied! Discount: R${(res.data.discount / 100).toFixed(2)}`);
      } else {
        toast.error("No valid reward found.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not apply reward.");
    }
    setPaying(false);
  };

  const handlePay = async () => {
    if (amountToPay <= 0) {
      toast.success("No payment needed! Reward covers the full amount.");
      // Mark order as redeemed if a reward was applied
      if (rewardApplied) {
        try {
          await api.post(`/orders/${orderId}/redeem`);
        } catch (e) {
          // Optionally handle error
        }
      }
      // Redirect to confirmation page
      navigate("/order/confirmation", {
        state: {
          orderId,
          qrData: orderId,
          qrCodeBase64: null,
          amount: 0,
          paymentPin: null,
          summary,
          timestamp: Date.now(),
        },
      });
      return;
    }
    if (!window.YocoSDK) {
      toast.error("Yoco SDK not loaded. Please refresh the page.");
      return;
    }
    setPaying(true);
    try {
      const yoco = new window.YocoSDK({ publicKey });
      yoco.showPopup({
        amountInCents: total - rewardDiscount,
        currency: "ZAR",
        name: "SMB Loyalty Payment",
        description: `Order #${orderId}`,
        callback: async (result: any) => {
          if (result.error) {
            setPaying(false);
            toast.error(result.error.message || "Payment failed. Please try again.");
          } else {
            toast.success("Payment successful! Finalizing...");
            try {
              await api.post("/payments/charge", {
                token: result.id,
                orderId,
                amount: total - rewardDiscount,
              });
              // Mark order as redeemed if a reward was applied
              if (rewardApplied) {
                try {
                  await api.post(`/orders/${orderId}/redeem`);
                } catch (e) {
                  // Optionally handle error
                }
              }
              // Fetch QR data for this order
              const qrResp = await api.get(`/payments/qr/${orderId}`);
              const qrData = qrResp.data.reference || orderId;
              const qrCodeBase64 = qrResp.data.qr_code_base64;
              const paymentPin = qrResp.data.payment_pin;
              const amount = qrResp.data.amount || total;

              await refreshUser();

              const confirmationData = {
                orderId,
                qrData,
                qrCodeBase64,
                amount,
                paymentPin,
                summary,
                timestamp: Date.now(),
              };
              localStorage.setItem("lastOrderConfirmation", JSON.stringify(confirmationData));

              navigate("/order/confirmation", { state: confirmationData });
            } catch (err: any) {
              setPaying(false);
              toast.error(
                err?.response?.data?.detail ||
                  "Payment could not be completed. Please contact support."
              );
            }
          }
        },
      });
    } catch (e: any) {
      setPaying(false);
      toast.error("Unexpected error: " + (e.message || e));
    }
  };

  const amountToPay = total - rewardDiscount;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-2 py-4">
      <ToastContainer position="top-right" />
      <div className="w-full sm:max-w-md bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">Complete Your Payment</h2>
        <div className="text-lg font-semibold text-center mb-6">
          Amount: <span className="text-black font-bold">R {(amountToPay / 100).toFixed(2)}</span>
        </div>
        {rewardInfo && canApplyLoyalty && (
          <div className="mb-4 text-center">
            <div className="text-green-700 font-semibold">
              Loyalty Reward Available: {rewardInfo.reward}
            </div>
            {rewardInfo.expiry && (
              <div className="text-xs text-gray-500">
                Expires: {new Date(rewardInfo.expiry).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
        {rewardInfo && !canApplyLoyalty && (
          <div className="mb-4 text-center">
            <div className="text-gray-500 font-semibold">
              Loyalty rewards cannot be applied to this service.
            </div>
          </div>
        )}
        {summary.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 mb-2 text-center">Order Summary</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              {summary.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={handlePay}
            disabled={paying || !yocoLoaded}
            className={`w-full py-2 rounded text-white font-semibold transition ${
              paying || !yocoLoaded ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {!yocoLoaded ? "Loading payment..." : paying ? "Processing..." : "Pay with Card"}
          </button>
          {rewardInfo && canApplyLoyalty && !rewardApplied && (
            <button
              onClick={handleApplyReward}
              disabled={paying}
              className="w-full py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 transition"
            >
              Apply Reward
            </button>
          )}
          {rewardApplied && (
            <div className="text-green-700 text-center font-semibold">
              Reward applied! New total: R{(amountToPay / 100).toFixed(2)}
            </div>
          )}
        </div>
        <div className="mt-6 text-xs text-gray-400 text-center">
          Secured by <span className="font-bold text-blue-500">YOCO</span>
        </div>
      </div>
    </div>
  );
};

export default Payment;