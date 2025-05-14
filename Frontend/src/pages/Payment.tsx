// Frontend/src/pages/Payment.tsx
import React, { useEffect } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../api/api";

interface LocationState {
  orderId: number;
  total: number; // in Rands
  summary?: string[];
  qrData?: string;
}

interface User {
  id: number;
  email: string;
}

// Add this to TypeScript to avoid type errors
declare global {
  interface Window {
    YocoSDK: any;
  }
}

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { orderId, total, summary = [], qrData } = (state as LocationState) || {};

  // Fetch user info
  const userQuery = useQuery<User, Error, User>({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });

  useEffect(() => {
    if (userQuery.isError) toast.error("Failed to load user");
  }, [userQuery.isError]);

  useEffect(() => {
    if (!orderId || typeof total !== "number" || isNaN(total)) {
      toast.error("Missing payment details");
      navigate("/", { replace: true });
    }
  }, [orderId, total, navigate]);

  if (userQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        Loading user…
      </div>
    );
  }

  if (!userQuery.data) return <Navigate to="/login" replace />;

  const publicKey = import.meta.env.VITE_YOCO_PUBLIC_KEY!;

  const handlePay = () => {
    if (!window.YocoSDK) {
      toast.error("Yoco SDK not loaded");
      return;
    }
    const yoco = new window.YocoSDK({ publicKey });
    yoco.showPopup({
      amountInCents: Math.round(total * 100),
      currency: "ZAR",
      name: "SMB Loyalty Payment",
      description: `Order #${orderId}`,
      callback: (result: any) => {
        if (result.error) {
          toast.error(result.error.message);
        } else {
          toast.success("Payment successful!");
          // Send result.id (the token) to your backend to complete the charge
          navigate("/order/confirmation", { state: { orderId, qrData } });
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-2 py-4">
      <ToastContainer position="top-right" />
      <div className="w-full sm:max-w-md bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">Complete Your Payment</h2>
        <div className="text-lg font-semibold text-center mb-6">
          Amount: <span className="text-black font-bold">R {total.toFixed(2)}</span>
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
          className="w-full mt-4 py-2 rounded text-white font-semibold transition bg-blue-600 hover:bg-blue-700"
        >
          Pay Now
        </button>
      </div>
    </div>
  );
};

export default Payment;