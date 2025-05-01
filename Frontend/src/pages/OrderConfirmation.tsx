import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import PaystackPayment from "./PaystackPayment";

interface LocationState {
  orderId: number;
  qrData:  string;
  email:   string;
  amount:  number;   // in rands
}

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { orderId, qrData, email, amount } =
    (state as LocationState) || {};

  if (!orderId || !qrData || !email || amount == null) {
    return <div>Something went wrong — missing order info.</div>;
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Your Order Is Confirmed!</h1>
      <QRCode value={qrData} size={200} />
      <p>Save this QR code to redeem your service.</p>
      <button onClick={() => navigate("/claimed")}>
        View My Active Rewards
      </button>

      <section style={{ marginTop: "2rem" }}>
        <h2>Complete Payment</h2>
        <p>Total: R {amount}</p>
        <PaystackPayment
          email={email}
          amount={amount * 100}
          orderId={orderId}
        />
      </section>
    </div>
  );
};

export default OrderConfirmation;
