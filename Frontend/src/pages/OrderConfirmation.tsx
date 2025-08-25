// src/pages/OrderConfirmation.tsx
import React, { useEffect, useState } from "react";
import StepIndicator from "../components/StepIndicator";
import { track } from '../utils/analytics';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { moduleFlags } from '../config/modules';
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import QRCode from "react-qr-code";
import axios from "axios";
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import Loading from "../components/Loading";
import "./OrderConfirmation.css";
import '../styles/shared-buttons.css';

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
    return (
      <div className="confirmation-wrapper">
        <div className="confirmation-page">
          <div className="confirmation-container">
            <Loading text="Loading your order…" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="confirmation-wrapper">
        <div className="confirmation-page">
          <div className="confirmation-container">
            <div className="text-center">
              <div className="text-red-400 mb-4">{error}</div>
                            <button
                onClick={() => navigate("/")}
                className="action-button secondary-button"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmation-wrapper">
      <div className="confirmation-page">
        <StepIndicator currentStep={3} stepsCompleted={[1, 2]} />
        <ToastContainer position="top-right" />
        
        {/* Persistent redemption banner */}
        {nextActionUrl && (
          <div
            className="redemption-banner"
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
            <div className="redemption-banner-title">
              🎁 Tap here to redeem your wash for loyalty points
            </div>
            <div className="redemption-banner-subtitle">
              Complete your wash and earn rewards
            </div>
          </div>
        )}

        <div className="confirmation-container">
          {/* Success Icon */}
          <div className="success-icon">
            <span className="success-icon-emoji">✅</span>
          </div>
          
          {/* Title */}
          <h1 className="confirmation-title">Your Order Is Confirmed!</h1>
          
          {/* Order Status Badge */}
          {orderStatus && (
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <span className={`status-badge ${orderStatus === "paid" || orderStatus === "completed" ? "confirmed" : "processing"}`}>
                Status: {orderStatus.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="error-card">
              {error}
            </div>
          )}
        </div>

        {/* Payment Card */}
        <div className="info-card payment-card">
          <h3 className="card-title">Payment Details</h3>
          
          {/* Payment PIN */}
          {paymentPin && (
            <div className="payment-pin-section">
              <div className="payment-pin-label">Payment PIN</div>
              <div className="payment-pin-value">{paymentPin}</div>
            </div>
          )}
          
          {/* Amount */}
          {amount > 0 && (
            <div className="amount-section">
              <span className="amount-label">Amount Paid:</span>
              <span className="amount-value">R{(amount / 100).toFixed(2)}</span>
            </div>
          )}
          
          {/* QR Code Section */}
          <div className="qr-section">
            <h4 className="qr-title">Payment QR Code</h4>
            <div className="qr-code-container">
              {qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${qrCodeBase64}`}
                  alt="Payment QR Code"
                  style={{ width: 200, height: 200 }}
                />
              ) : qrData ? (
                <QRCode value={qrData} size={200} />
              ) : (
                <div style={{ color: "#dc2626", marginBottom: "0.75rem" }}>
                  No QR code available.
                </div>
              )}
            </div>
            <p className="qr-instructions">
              Show this QR code at the car wash station to complete your payment
            </p>
          </div>
        </div>

        {/* Order Summary Card */}
        {summary.length > 0 && (
          <div className="info-card order-card">
            <h3 className="card-title">Order Summary</h3>
            <ul className="order-summary-list">
              {summary.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
            {loyaltyEligible && (
              <div className="loyalty-eligible-badge">
                ✓ This order is eligible for loyalty points!
              </div>
            )}
            {/* Timestamp */}
            {timestamp && (
              <div className="order-timestamp">
                Ordered on: {new Date(timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}
        
        {/* Loyalty Progress Card */}
        {loyaltyProgress && enableLoyalty && (
          <div className="info-card loyalty-card">
            <h3 className="card-title">Loyalty Progress</h3>
            <div className="loyalty-progress-visits">
              Total visits: <strong>{loyaltyProgress.visits}</strong>
            </div>
            {loyaltyProgress.upcomingRewards.length > 0 && (
              <div className="loyalty-progress-rewards">
                <div className="next-reward">
                  🎁 Next reward at <strong>{loyaltyProgress.nextMilestone}</strong> visits
                </div>
                <div className="visits-needed">
                  {loyaltyProgress.upcomingRewards[0].visits_needed} more visits to earn: {loyaltyProgress.upcomingRewards[0].reward}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Steps Card */}
        {(estimatedWashTime !== null || notificationMessage || bayNumber !== null) && (
          <div className="info-card steps-card">
            <h3 className="card-title">🚗 Next Steps</h3>
            {notificationMessage && (
              <div className="notification-message">
                {notificationMessage}
              </div>
            )}
            <div className="next-steps-grid">
              {estimatedWashTime !== null && (
                <div className="step-item">
                  <span className="step-icon">⏱️</span>
                  <span>Estimated wash time: <strong>{estimatedWashTime} minutes</strong></span>
                </div>
              )}
              {bayNumber !== null && (
                <div className="step-item">
                  <span className="step-icon">🅿️</span>
                  <span>Your bay number: <strong>{bayNumber}</strong></span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions Card */}
        <div className="info-card instructions-card">
          <p className="instructions-text">
            Show this QR code or PIN to staff to verify your payment. You can also find it in the Past Orders tab.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="action-buttons">
          {/* Primary Actions */}
          <div className="primary-actions">
            <button
              onClick={() => navigate("/")}
              className="action-button primary-button"
            >
              🏠 Home
            </button>
            {enableOrders && (
              <button
                onClick={() => {
                  track('cta_click', { label: 'View Orders', page: 'OrderConfirmation' });
                  navigate("/past-orders");
                }}
                className="action-button secondary-button"
              >
                📋 View Orders
              </button>
            )}
            {enableLoyalty && (
              <button
                onClick={() => navigate("/myloyalty")}
                className="action-button success-button"
              >
                🎁 My Loyalty
              </button>
            )}
          </div>
          
          {/* Secondary Actions */}
          <div className="secondary-actions">
            {qrCodeBase64 && (
              <a
                href={`data:image/png;base64,${qrCodeBase64}`} 
                download={`order-${orderId}.png`}
                className="download-button"
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
                className="copy-button"
              >
                📋 Copy PIN
              </button>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="security-footer">
          Secured by <span className="yoco-brand">YOCO</span>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
