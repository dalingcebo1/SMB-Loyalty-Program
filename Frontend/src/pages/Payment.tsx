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

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { orderId, total, summary = [] } = (state as LocationState) || {};

  const [paying, setPaying] = useState(false);
  const [yocoLoaded, setYocoLoaded] = useState(false);

  const { refreshUser, user } = useAuth(); // <-- Add user here

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

  const handlePay = async () => {
    if (!window.YocoSDK) {
      toast.error("Yoco SDK not loaded. Please refresh the page.");
      return;
    }
    setPaying(true);
    try {
      const yoco = new window.YocoSDK({ publicKey });
      yoco.showPopup({
        amountInCents: total,
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
                amount: total,
              });
              // Fetch QR data for this order
              const qrResp = await api.get(`/payments/qr/${orderId}`);
              const qrData = qrResp.data.qr_code_base64 || qrResp.data.reference || orderId;
              const paymentPin = qrResp.data.payment_pin; // <-- Use the pin from backend
              const amount = qrResp.data.amount || total; // <-- Use amount from backend if present

              console.log("Navigating to order-confirmation", { orderId, qrData, amount, paymentPin, summary });
              console.log("Before refreshUser, user:", user);
              await refreshUser();
              console.log("After refreshUser, user:", user);

              const confirmationData = {
                orderId,
                qrData,
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-2 py-4">
      <ToastContainer position="top-right" />
      <div className="w-full sm:max-w-md bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">Complete Your Payment</h2>
        <div className="text-lg font-semibold text-center mb-6">
          Amount: <span className="text-black font-bold">R {(total / 100).toFixed(2)}</span>
        </div>
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
        <button
          onClick={handlePay}
          disabled={paying || !yocoLoaded}
          className={`w-full mt-4 py-2 rounded text-white font-semibold transition ${
            paying || !yocoLoaded ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {!yocoLoaded ? "Loading payment..." : paying ? "Processing..." : "Pay Now"}
        </button>
        <div className="mt-6 text-xs text-gray-400 text-center">
          Secured by <span className="font-bold text-blue-500">YOCO</span>
        </div>
      </div>
    </div>
  );
};

export default Payment;