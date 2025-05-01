import React from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { PaystackButton } from "react-paystack";
import { useAuth } from "../auth/AuthProvider";
import { toast, ToastContainer } from "react-toastify";

interface LocationState {
  orderId: number;
  qrData: string;
  amount: number; // in kobo
}

const PaymentPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation().state as LocationState | undefined;

  // must be logged in and have state
  if (!user) return <Navigate to="/login" replace />;
  if (!loc)  return <Navigate to="/rewards" replace />;

  const { orderId, qrData, amount } = loc;
  const publicKey  = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY!;
  const reference  = `${Date.now()}-${orderId}`;

  const handleSuccess = (_ref: any) => {
    toast.success("Payment successful!");
    // now show QR
    navigate("/order/confirmation", { state: { qrData } });
  };
  const handleClose = () => toast.info("Payment window closed");

  return (
    <div style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <ToastContainer position="top-right" />

      <h1>Complete Your Payment</h1>
      <p>
        Amount: <strong>R {(amount / 100).toFixed(2)}</strong>
      </p>

      <PaystackButton
        text="Pay Now"
        className="btn w-full"
        onSuccess={handleSuccess}
        onClose={handleClose}
        email={user.email!}
        amount={amount}
        publicKey={publicKey}
        reference={reference}
      />
    </div>
  );
};

export default PaymentPage;
