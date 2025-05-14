// src/pages/PaystackPayment.tsx

import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePaystackPayment } from "react-paystack";
import api from "../api/api";

interface LocationState {
  orderId: number;
  total: number; // in Rands
}

interface User {
  id: number;
  email: string;
}

const PaystackPayment: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { orderId, total } = (state as LocationState) || {};

  // 1) grab logged-in user’s email
  const userQuery = useQuery<User, Error, User>({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });

  useEffect(() => {
    if (userQuery.isError) {
      toast.error("Failed to load user");
    }
  }, [userQuery.isError]);

  // 2) sanity-check that we were navigated here properly
  useEffect(() => {
    if (!orderId || !total) {
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

  const email = userQuery.data?.email ?? "";
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY!;

  // 3) Paystack config
  const config = {
    reference: `${orderId}-${Date.now()}`,
    email,
    amount: total * 100, // convert to kobo
    publicKey,
    metadata: {
      custom_fields: [
        {
          display_name: "Order ID",
          variable_name: "orderId",
          value: String(orderId),
        },
      ],
    },
    onSuccess: () => {
      toast.success("Payment successful!");
      navigate("/order/confirmation", { state: { orderId, qrData: null } });
    },
    onClose: () => {
      toast.info("Payment dialog closed");
    },
  };

  const initializePayment = usePaystackPayment(config);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-2 py-4">
      <ToastContainer position="top-right" />
      <div className="w-full sm:max-w-md bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">Complete Your Payment</h2>
        <div className="text-lg font-semibold text-center mb-6">
          Amount: <span className="text-black font-bold">R {total.toFixed(2)}</span>
        </div>
        <button
          onClick={() => initializePayment({})}
          className="w-full mt-4 py-2 rounded text-white font-semibold transition bg-blue-600 hover:bg-blue-700"
        >
          Pay Now
        </button>
      </div>
    </div>
  );
};

export default PaystackPayment;
