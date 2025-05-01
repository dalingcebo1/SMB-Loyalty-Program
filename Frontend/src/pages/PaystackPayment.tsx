// src/pages/PaystackPayment.tsx
import React from "react";
import { usePaystackPayment } from "react-paystack";
import { useQuery } from "@tanstack/react-query";
import api from "../api/api";

interface PaystackPaymentProps {
  orderId: number;
  amount: number; // in kobo
}

const PaystackPayment: React.FC<PaystackPaymentProps> = ({
  orderId,
  amount,
}) => {
  // 1) fetch current user, so we get their email
  const { data: user, isLoading: userLoading, error: userError } = useQuery<{
    email: string;
  }>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      return data;
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string;

  // 2) prepare Paystack config
  const paystackConfig = {
    reference: String(orderId),
    email: user?.email,
    amount,
    publicKey,
  };

  const onSuccess = (ref: { reference: string }) => {
    // you could call your backend to verify
    console.log("💰 Payment successful!", ref);
  };
  const onClose = () => {
    console.log("❌ Payment popup closed");
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  if (userLoading) return <div>Loading payment info…</div>;
  if (userError || !user?.email)
    return <div>Failed to load user info. Please log in again.</div>;

  return (
    <button
      onClick={() => initializePayment({ onSuccess, onClose })}
      style={{
        marginTop: "1rem",
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        backgroundColor: "#556cd6",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Pay R {(amount / 100).toFixed(2)}
    </button>
  );
};

export default PaystackPayment;
