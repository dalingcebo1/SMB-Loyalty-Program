// src/pages/OrderConfirmation.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import PaystackPayment from "./PaystackPayment";

interface LocationState {
  orderId: number;
  qrData: string;
  amount: number; // in kobo
}

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { orderId, qrData, amount } = state as LocationState;

  return (
    <div style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Your Order Is Confirmed!</h1>
      <div style={{ margin: "1rem 0" }}>
        <QRCode value={qrData} size={200} />
      </div>
      <p>Save this QR code to redeem your service.</p>
      <button onClick={() => navigate("/claimed")}>
        View My Active Rewards
      </button>

      <h2 style={{ marginTop: "2rem" }}>Complete Payment</h2>
      {/* drop in your Paystack button */}
      <PaystackPayment orderId={orderId} amount={amount} />
    </div>
  );
};

export default OrderConfirmation;
