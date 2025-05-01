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
  total: number;
}

interface User {
  id: number;
  email: string;
}

const PaystackPayment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, total } = (location.state as LocationState) || {};

  // 1) grab logged-in user’s email
  const userQuery = useQuery<User, Error>({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data,
    onError: () => toast.error("Failed to load user"),
  });

  // 2) sanity-check that we were navigated here properly
  useEffect(() => {
    if (!orderId || !total) {
      toast.error("Missing payment details");
      navigate("/");
    }
  }, [orderId, total, navigate]);

  if (userQuery.isLoading) {
    return (
      <div style={{ padding: "1rem", textAlign: "center" }}>
        Loading user…
      </div>
    );
  }

  const email = userQuery.data?.email ?? "";
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  // 3) Paystack config
  const config = {
    reference: `${orderId}-${Date.now()}`,
    email,
    amount: total * 100, // in kobo
    publicKey,
    metadata: { orderId },
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (reference: any) => {
    toast.success("Payment successful!");
    // now go to your confirmation screen
    navigate("/order/confirmation", { state: { orderId, qrData: null } });
  };

  const onClose = () => {
    toast.info("Payment dialog closed");
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <ToastContainer position="top-right" />
      <h1>Complete Your Payment</h1>
      <p style={{ fontWeight: "bold" }}>Total: R {total}</p>
      <button
        onClick={() => initializePayment(onSuccess, onClose)}
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        Pay Now
      </button>
    </div>
  );
};

export default PaystackPayment;
