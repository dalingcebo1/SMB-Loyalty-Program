// src/pages/OrderConfirmation.tsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate, Outlet } from "react-router-dom";
import QRCode from "react-qr-code";
import axios from "axios";
import { useAuth } from "../auth/AuthProvider";

interface LocationState {
  orderId: string; // should match backend (uuid string)
  qrData: string;
  amount: number; // in cents
  paymentPin?: string;
  error?: string;
}

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  let confirmation = state as LocationState | undefined;

  if (!confirmation) {
    const stored = localStorage.getItem("lastOrderConfirmation");
    if (stored) {
      confirmation = JSON.parse(stored);
    }
  }

  const { orderId: paramOrderId } = useParams<{ orderId: string }>();
  const { user, loading } = useAuth();

  // Local state to support reload/direct access
  const [orderId, setOrderId] = useState<string>("");
  const [qrData, setQrData] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentPin, setPaymentPin] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // On mount: try to get state from navigation or fallback to URL param
  useEffect(() => {
    let didSet = false;
    if (state && typeof state === "object") {
      const s = state as LocationState;
      if (s.orderId && s.qrData && typeof s.amount === "number") {
        setOrderId(s.orderId);
        setQrData(s.qrData);
        setAmount(s.amount);
        setPaymentPin(s.paymentPin);
        setError(s.error);
        setIsLoading(false);
        didSet = true;
      }
    }
    // Fallback: if state is missing or incomplete, try to fetch QR by orderId from URL
    if (!didSet && paramOrderId) {
      setIsLoading(true);
      axios
        .get(`/payments/qr/${paramOrderId}`)
        .then((resp) => {
          setOrderId(paramOrderId);
          setQrData(resp.data.qr_code_base64 || resp.data.reference || paramOrderId);
          setAmount(0); // Amount is unknown unless you fetch order details
          setPaymentPin(undefined);
          setError(undefined);
        })
        .catch(() => {
          setError("Could not find order or QR code.");
          setOrderId("");
          setQrData("");
        })
        .finally(() => setIsLoading(false));
    } else if (!didSet) {
      setIsLoading(false);
    }
    // eslint-disable-next-line
  }, [state, paramOrderId]);

  useEffect(() => {
    // If after all attempts, we still don't have orderId or qrData, redirect home
    if (!isLoading && (!orderId || !qrData)) {
      navigate("/", { replace: true });
    }
  }, [orderId, qrData, isLoading, navigate]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  console.log("OrderConfirmation user:", user, "loading:", loading, "state:", state);

  if (isLoading) {
    return (
      <section style={{ margin: "32px auto", maxWidth: 400, padding: 24, background: "#fafbfc", borderRadius: 8 }}>
        <h1 style={{ marginBottom: 16 }}>Loading your order…</h1>
      </section>
    );
  }

  return (
    <section style={{ margin: "32px auto", maxWidth: 400, padding: 24, background: "#fafbfc", borderRadius: 8 }}>
      <h1 style={{ marginBottom: 16 }}>Your Order Is Confirmed!</h1>
      {error && (
        <div style={{
          background: "#ffeaea",
          color: "#b00020",
          padding: "12px 18px",
          borderRadius: 6,
          marginBottom: 16,
          fontWeight: "bold"
        }}>
          {error}
        </div>
      )}
      <div style={{ margin: "1rem 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {qrData ? (
          <QRCode value={qrData} size={200} />
        ) : (
          <div style={{ color: "#b00020", marginBottom: 12 }}>No QR code available.</div>
        )}
        {paymentPin && (
          <div style={{
            marginTop: 16,
            padding: "12px 24px",
            background: "#e9ecef",
            borderRadius: 6,
            fontSize: 22,
            fontWeight: "bold",
            letterSpacing: 4,
            color: "#333"
          }}>
            Payment PIN: <span style={{ color: "#007bff" }}>{paymentPin}</span>
          </div>
        )}
        {/* Show amount paid if available */}
        {amount > 0 && (
          <div style={{
            marginTop: 12,
            fontSize: 18,
            color: "#222"
          }}>
            Amount Paid: <span style={{ fontWeight: "bold" }}>R{(amount / 100).toFixed(2)}</span>
          </div>
        )}
      </div>
      <p style={{ margin: "16px 0" }}>
        Save this QR code or PIN to redeem your service at the wash bay.
      </p>
      <button
        onClick={async () => {
          if (orderId) {
            try {
              await axios.post(`/api/orders/${orderId}/redeem`);
              localStorage.removeItem("lastOrderConfirmation");
            } catch (e) {
              alert("Could not mark order as redeemed. Please try again.");
              return;
            }
          }
          navigate("/claimed");
        }}
        style={{
          marginBottom: 24,
          padding: "10px 24px",
          borderRadius: 6,
          background: "#007bff",
          color: "#fff",
          border: "none",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        View My Active Rewards
      </button>
      <div className="mt-6 text-xs text-gray-400 text-center">
        Secured by <span className="font-bold text-blue-500">YOCO</span>
      </div>
      <Outlet />
    </section>
  );
};

export const createOrder = async (orderPayload: any, navigate: any) => {
  const response = await axios.post("/api/orders/create", orderPayload);
  const { order_id, qr_data, amount, payment_pin } = response.data;

  navigate("/order/payment", {
    state: {
      orderId: order_id,        // string (uuid)
      qrData: qr_data,          // string (could be order_id or payment.reference)
      total: amount,            // number (cents), renamed to 'total' for consistency
      paymentPin: payment_pin   // string (4-digit pin)
    }
  });
};

export default OrderConfirmation;
