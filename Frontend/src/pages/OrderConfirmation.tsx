// src/pages/OrderConfirmation.tsx
import React, { useEffect, useState } from "react";
import StepIndicator from "../components/StepIndicator";
import { track } from '../utils/analytics';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { moduleFlags } from '../config/modules';
import { useLocation, useNavigate, useParams, Navigate, Outlet } from "react-router-dom";
import QRCode from "react-qr-code";
import axios from "axios";
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import PageLayout from "../components/PageLayout";
import Loading from "../components/Loading";

interface LocationState {
  orderId: string;
  qrData: string; // This should be the payment reference, not the base64 image
  qrCodeBase64?: string; // Optionally, the backend can send the base64 image
  amount: number;
  paymentPin?: string;
  error?: string;
  summary?: string[];
  timestamp?: number;
  serviceName?: string;
  loyaltyEligible?: boolean;
  status?: string;
}

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const { enableOrders, enableLoyalty } = moduleFlags;

  // Next action URL for redemption
  const [nextActionUrl, setNextActionUrl] = useState<string | null>(null);

  // Analytics: page view
  useEffect(() => {
    track('page_view', { page: 'OrderConfirmation' });
  }, []);
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
  const [summary, setSummary] = useState<string[]>([]);
  const [estimatedWashTime, setEstimatedWashTime] = useState<number | null>(null);
  const [bayNumber, setBayNumber] = useState<number | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [loyaltyEligible, setLoyaltyEligible] = useState<boolean>(false);
  const [loyaltyProgress, setLoyaltyProgress] = useState<{
    visits: number;
    nextMilestone: number;
    upcomingRewards: Array<{
      milestone: number;
      visits_needed: number;
      reward: string;
    }>;
  } | null>(null);

  useEffect(() => {
    let didSet = false;
    // Clear pending order once we reach confirmation
    localStorage.removeItem('pendingOrder');
    if (state && typeof state === "object") {
      const s = state as LocationState;
      if (s.orderId && s.qrData && typeof s.amount === "number") {
        setOrderId(s.orderId);
        setQrData(s.qrData);
        setQrCodeBase64(s.qrCodeBase64);
        setAmount(s.amount);
        setPaymentPin(s.paymentPin);
        setError(s.error);
        setSummary(s.summary || []);
        setTimestamp(s.timestamp);
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
          setSummary([]);
          setTimestamp(Date.now());
        })
        .catch((err) => {
          console.error("Error fetching order QR:", err);
          setError("Could not find order or QR code. Please check your order ID and try again.");
          setOrderId("");
          setQrData("");
        })
        .finally(() => setIsLoading(false));
    } else if (!didSet) {
      setIsLoading(false);
    }
  }, [state, paramOrderId]);

  // fetch next steps info from order details
  useEffect(() => {
    if (orderId) {
      api.get(`/orders/${orderId}`)
        .then(res => {
          setEstimatedWashTime(res.data.estimatedWashTime);
          setBayNumber(res.data.bayNumber);
          setNotificationMessage(res.data.notificationMessage);
          setNextActionUrl(res.data.nextActionUrl || null);
          setOrderStatus(res.data.status || "");
          setLoyaltyEligible(res.data.loyaltyEligible || false);
          // Update amount and summary from order details if available
          if (res.data.amount && !amount) {
            setAmount(res.data.amount);
          }
          if (res.data.serviceName && !summary.length) {
            const orderSummary = [res.data.serviceName];
            if (res.data.extras?.length) {
              orderSummary.push(...res.data.extras);
            }
            setSummary(orderSummary);
          }
          // Set loyalty progress info
          if (res.data.visits !== undefined) {
            setLoyaltyProgress({
              visits: res.data.visits,
              nextMilestone: res.data.nextMilestone,
              upcomingRewards: res.data.upcomingRewards || []
            });
          }
        })
        .catch(() => {
          // ignore errors
        });
    }
  }, [orderId, amount, summary.length]);

  // Show success toast after order data is loaded
  useEffect(() => {
    if (!isLoading && orderId && !error) {
      const hasShownToast = sessionStorage.getItem(`orderConfirmationToast_${orderId}`);
      if (!hasShownToast) {
        setTimeout(() => {
          toast.success('🎉 Order confirmed successfully!', {
            position: 'top-center',
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          sessionStorage.setItem(`orderConfirmationToast_${orderId}`, 'true');
        }, 800);
      }
    }
  }, [isLoading, orderId, error]);

  useEffect(() => {
    if (!isLoading && (!orderId || !qrData)) {
      navigate("/", { replace: true });
    }
  }, [orderId, qrData, isLoading, navigate]);

  // Verify payment before showing confirmation
  useEffect(() => {
    if (orderId && !state) {
      // If accessing directly without payment state, verify order is paid
      api.get(`/orders/${orderId}`)
        .then(res => {
          if (res.data.status !== "paid") {
            setError("Order has not been paid yet. Please complete payment first.");
            setTimeout(() => {
              navigate("/order", { replace: true });
            }, 3000);
          }
        })
        .catch(() => {
          setError("Order not found or invalid.");
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 2000);
        });
    }
  }, [orderId, state, navigate]);

  if (loading) return <Loading text="Checking authentication..." />;
  if (!user) return <Navigate to="/login" replace />;

  if (isLoading) {
    return <PageLayout loading loadingText="Loading your order…">{null}</PageLayout>;
  }

  return (
    <PageLayout error={error || undefined} onRetry={() => window.location.reload()}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          @keyframes slideInUp {
            from {
              transform: translateY(30px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          @keyframes celebrateSuccess {
            0% { transform: scale(0.8); opacity: 0; }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); opacity: 1; }
          }
          .order-confirmation-container {
            animation: slideInUp 0.6s ease-out;
          }
          .success-icon {
            animation: celebrateSuccess 0.8s ease-out;
          }
          @media (max-width: 640px) {
            .order-confirmation-container {
              margin: 16px auto !important;
              padding: 16px !important;
              max-width: calc(100vw - 32px) !important;
            }
          }
        `}
      </style>
      {/* Persistent redemption banner */}
      {nextActionUrl && (
        <div
          className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-green-400 to-green-600 text-white text-center py-4 cursor-pointer shadow-lg z-50"
          role="button"
          aria-live="polite"
          onClick={async () => {
            try {
              await api.post(nextActionUrl);
              toast.success('Wash redeemed for loyalty points!');
              navigate('/myloyalty');
            } catch {
              toast.error('Could not redeem wash. Please try again.');
            }
          }}
          style={{
            background: 'linear-gradient(45deg, #10b981, #059669)',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            animation: 'pulse 2s infinite',
            transform: 'scale(1)',
            transition: 'transform 0.2s'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            🎁 Tap here to redeem your wash for loyalty points
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            Complete your wash and earn rewards
          </div>
        </div>
      )}
      <StepIndicator currentStep={3} stepsCompleted={[1, 2]} />
      <section 
        className="order-confirmation-container"
        style={{ 
          margin: "32px auto", 
          maxWidth: 400, 
          padding: 24, 
          background: "#fafbfc", 
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
        }}
      >
        {/* Toast notifications */}
        <ToastContainer position="top-right" />
        <div className="success-icon" style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ 
            fontSize: "48px",
            marginBottom: "8px",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
          }}>
            ✅
          </div>
        </div>
        <h1 style={{ marginBottom: 16, textAlign: "center" }}>Your Order Is Confirmed!</h1>
        {/* Order Status Badge */}
        {orderStatus && (
          <div style={{
            textAlign: "center",
            marginBottom: 16
          }}>
            <span style={{
              padding: "6px 12px",
              borderRadius: 12,
              fontSize: "14px",
              fontWeight: "bold",
              backgroundColor: 
                orderStatus === "paid" ? "#d4edda" :
                orderStatus === "in_progress" ? "#fff3cd" :
                orderStatus === "completed" ? "#d1ecf1" : "#f8d7da",
              color:
                orderStatus === "paid" ? "#155724" :
                orderStatus === "in_progress" ? "#856404" :
                orderStatus === "completed" ? "#0c5460" : "#721c24"
            }}>
              Status: {orderStatus.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        )}
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
          {qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="Payment QR Code"
              style={{ width: 200, height: 200 }}
            />
          ) : qrData ? (
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
        {/* Order summary and timestamp */}
        {summary.length > 0 && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8 }}>Order Summary</h3>
            <ul style={{ listStyle: 'disc inside', fontSize: '14px', color: '#555' }}>
              {summary.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
            {loyaltyEligible && (
              <div style={{
                marginTop: 8,
                padding: "8px 12px",
                background: "#e8f5e8",
                color: "#2d6a2d",
                borderRadius: 6,
                fontSize: "13px",
                fontWeight: "bold"
              }}>
                ✓ This order is eligible for loyalty points!
              </div>
            )}
          </div>
        )}
        {timestamp && (
          <div style={{ marginTop: 8, fontSize: '12px', color: '#888', textAlign: 'center' }}>
            Ordered on: {new Date(timestamp).toLocaleString()}
          </div>
        )}
        {/* Loyalty Progress Section */}
        {loyaltyProgress && enableLoyalty && (
          <div style={{ marginTop: 16, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8, color: '#1e40af' }}>Loyalty Progress</h3>
            <div style={{ fontSize: '14px', marginBottom: 8 }}>
              Total visits: <strong>{loyaltyProgress.visits}</strong>
            </div>
            {loyaltyProgress.upcomingRewards.length > 0 && (
              <div style={{ fontSize: '14px' }}>
                <div>🎁 Next reward at <strong>{loyaltyProgress.nextMilestone}</strong> visits</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  {loyaltyProgress.upcomingRewards[0].visits_needed} more visits to earn: {loyaltyProgress.upcomingRewards[0].reward}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Next Steps Section */}
        {(estimatedWashTime !== null || notificationMessage) && (
          <div style={{ marginTop: 16, padding: 16, background: '#fffbeb', borderRadius: 8, border: '1px solid #fbbf24' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 12, color: '#92400e', display: 'flex', alignItems: 'center' }}>
              🚗 Next Steps
            </h3>
            {notificationMessage && (
              <div style={{ 
                padding: '12px',
                background: '#f59e0b',
                color: 'white',
                borderRadius: 6,
                marginBottom: 8,
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                {notificationMessage}
              </div>
            )}
            <div style={{ display: 'grid', gap: '8px' }}>
              {estimatedWashTime !== null && (
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ marginRight: '8px' }}>⏱️</span>
                  <span>Estimated wash time: <strong>{estimatedWashTime} minutes</strong></span>
                </div>
              )}
              {bayNumber !== null && (
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ marginRight: '8px' }}>🅿️</span>
                  <span>Your bay number: <strong>{bayNumber}</strong></span>
                </div>
              )}
            </div>
          </div>
        )}
        <p style={{ margin: "16px 0", textAlign: "center", color: "#6b7280" }}>
          Show this QR code or PIN to staff to verify your payment. You can also find it in the Past Orders tab.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
          {/* Primary Actions */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                background: "#6366f1",
                color: "#fff",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "14px",
                transition: "all 0.2s",
                boxShadow: "0 2px 4px rgba(99, 102, 241, 0.3)"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#4f46e5";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#6366f1";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              🏠 Home
            </button>
            {enableOrders && (
              <button
                onClick={() => {
                  track('cta_click', { label: 'View Orders', page: 'OrderConfirmation' });
                  navigate("/past-orders");
                }}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  background: "#007bff",
                  color: "#fff",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 4px rgba(0, 123, 255, 0.3)"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#0056b3";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#007bff";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                📋 View Orders
              </button>
            )}
            {enableLoyalty && (
              <button
                onClick={() => navigate("/myloyalty")}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#059669";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#10b981";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                🎁 My Loyalty
              </button>
            )}
          </div>
          {/* Secondary Actions */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            {qrCodeBase64 && (
              <a
                href={`data:image/png;base64,${qrCodeBase64}`} 
                download={`order-${orderId}.png`}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  fontWeight: "600",
                  cursor: "pointer",
                  textDecoration: 'none',
                  fontSize: "13px",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#e5e7eb";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#f3f4f6";
                }}
              >
                💾 Download QR
              </a>
            )}
            {paymentPin && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(paymentPin);
                  track('cta_click', { label: 'Copy PIN', page: 'OrderConfirmation' });
                  toast.success('PIN copied to clipboard');
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "13px",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#e5e7eb";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#f3f4f6";
                }}
              >
                📋 Copy PIN
              </button>
            )}
          </div>
        </div>
        <div className="mt-6 text-xs text-gray-400 text-center">
          Secured by <span className="font-bold text-blue-500">YOCO</span>
        </div>
        <Outlet />
      </section>
    </PageLayout>
  );
};

export default OrderConfirmation;

// This page has been moved to src/features/order/pages/OrderConfirmation.tsx
