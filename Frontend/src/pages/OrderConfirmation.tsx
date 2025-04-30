// src/pages/OrderConfirmation.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";

interface LocationState {
  orderId: string;
  qrData: string;
}

const OrderConfirmation: React.FC = () => {
  const { state } = useLocation();
  const { orderId, qrData } = state as LocationState;
  const navigate = useNavigate();

  // If someone lands here directly, kick them back to the order page
  React.useEffect(() => {
    if (!qrData) {
      navigate("/order", { replace: true });
    }
  }, [qrData, navigate]);

  if (!qrData) {
    return null;
  }

  return (
    <div style={{ padding: "1rem", textAlign: "center" }}>
      <h1>Order Confirmed</h1>
      <p>
        Your Order ID: <strong>{orderId}</strong>
      </p>
      <div
        style={{
          margin: "2rem auto",
          width: 200,
          height: 200,
          background: "white",
          padding: "1rem",
        }}
      >
        <QRCode value={qrData} size={200} />
      </div>
      <p>Save this QR code to redeem your service.</p>
      <button onClick={() => navigate("/claimed")}>
        View My Active Rewards
      </button>
    </div>
  );
};

export default OrderConfirmation;
