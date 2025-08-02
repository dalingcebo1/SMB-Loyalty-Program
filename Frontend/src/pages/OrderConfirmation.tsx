// src/pages/OrderConfirmation.tsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate, Outlet } from "react-router-dom";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import QRCode from "react-qr-code";
import axios from "axios";
import { useAuth } from "../auth/AuthProvider";

interface LocationState {
  orderId: string;
  qrData: string; // This should be the payment reference, not the base64 image
  qrCodeBase64?: string; // Optionally, the backend can send the base64 image
  amount: number;
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

  const [orderId, setOrderId] = useState<string>("");
  const [qrData, setQrData] = useState<string>("");
  const [qrCodeBase64, setQrCodeBase64] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState<number>(0);
  const [paymentPin, setPaymentPin] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let didSet = false;
    if (state && typeof state === "object") {
      const s = state as LocationState;
      if (s.orderId && s.qrData && typeof s.amount === "number") {
        setOrderId(s.orderId);
        setQrData(s.qrData);
        setQrCodeBase64(s.qrCodeBase64);
        setAmount(s.amount);
        setPaymentPin(s.paymentPin);
        setError(s.error);
        setIsLoading(false);
        didSet = true;
      }
    }
    if (!didSet && paramOrderId) {
      setIsLoading(true);
      axios
        .get(`/payments/qr/${paramOrderId}`)
        .then((resp) => {
          setOrderId(paramOrderId);
          setQrData(resp.data.reference || paramOrderId);
          setQrCodeBase64(resp.data.qr_code_base64);
          setAmount(resp.data.amount || 0);
          setPaymentPin(resp.data.payment_pin);
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
    if (!isLoading && (!orderId || !qrData)) {
      navigate("/", { replace: true });
    }
  }, [orderId, qrData, isLoading, navigate]);

  if (loading) return <Loading text="Checking authentication..." />;
  if (!user) return <Navigate to="/login" replace />;

  if (isLoading) return <Loading text="Loading your order..." />;

  return (
    <section className="mx-auto my-8 max-w-md p-6 bg-gray-50 rounded-lg">
      <h1 className="mb-4 text-center text-xl font-semibold">Your Order Is Confirmed!</h1>
      {error && <ErrorMessage message={error} onRetry={() => window.location.reload()} />}
      <div className="my-4 flex flex-col items-center">
        {qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="Payment QR Code"
              className="w-48 h-48"
            />
        ) : qrData ? (
          <QRCode value={qrData} size={200} />
        ) : (
          <div style={{ color: "#b00020", marginBottom: 12 }}>No QR code available.</div>
        )}
        {paymentPin && (
          <div className="mt-4 px-6 py-3 bg-gray-100 rounded-lg text-lg font-bold tracking-widest text-gray-800">
            Payment PIN: <span className="text-blue-500">{paymentPin}</span>
          </div>
        )}
        {amount > 0 && (
          <div className="mt-3 text-lg text-gray-800">
            Amount Paid: <span className="font-bold">R{(amount / 100).toFixed(2)}</span>
          </div>
        )}
      </div>
      <p className="my-4 text-center">
        Show this QR code or pin to staff to verify your payment. You can also find it in the Past Order Tab
      </p>
      <div className="flex justify-center">
        <button
          onClick={() => navigate("/past-orders")}
          className="mb-6 px-6 py-3 bg-blue-600 text-white rounded font-bold cursor-pointer"
        >
          View Orders
        </button>
      </div>
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
