// src/pages/Payment.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { FaCreditCard, FaShieldAlt } from "react-icons/fa";
import { normalizeLoyaltyResponse } from '../utils/loyalty';
import StepIndicator from "../components/StepIndicator";
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { UserCard, UserHero, UserPage, UserSection } from "../components/user";
import PaymentSummary from '../components/user/PaymentSummary';
import { track } from "../utils/analytics";
import { formatCents } from "../utils/format";
import "react-toastify/dist/ReactToastify.css";
import "./Payment.css";
import "../styles/yoco-modal.css";

interface LocationState {
  orderId: string;
  total: number; // in cents
  summary?: string[];
  qrData?: string;
  paymentPin?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

interface RewardData {
  reward: string;
  expiry?: string;
  milestone?: number;
}

interface YocoResult {
  id: string;
  status: string;
  error?: {
    message?: string;
  };
  [key: string]: unknown;
}

declare global {
  interface Window {
    YocoSDK: {
      new (options: { publicKey: string }): {
        showPopup: (options: {
          amountInCents: number;
          currency: string;
          name: string;
          description: string;
          callback: (result: YocoResult) => void;
        }) => void;
      };
      popup: (options: {
        amountInCents: number;
        currency: string;
        name: string;
        description: string;
        callback: (result: YocoResult) => void;
      }) => void;
    };
  }
}

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser, loading: authLoading } = useAuth();

  const [initializing, setInitializing] = useState(true);
  const [paymentState, setPaymentState] = useState<LocationState | null>(
    (location.state as LocationState) ?? null,
  );
  const [paying, setPaying] = useState(false);
  const [yocoLoaded, setYocoLoaded] = useState(false);
  const [rewardApplied, setRewardApplied] = useState(false);
  const [rewardDiscount, setRewardDiscount] = useState(0);
  const [rewardInfo, setRewardInfo] = useState<RewardData | null>(null);
  const [canApplyLoyalty, setCanApplyLoyalty] = useState(false);
  // Removed loadingEligibility state after refactor; summary aside no longer shows intermediate eligibility message.
  const [loadingReward, setLoadingReward] = useState(false);

  // Persist or resume pending payment state
  useEffect(() => {
    if (location.state) {
      const nextState = location.state as LocationState;
      setPaymentState(nextState);
      localStorage.setItem("pendingOrder", JSON.stringify(nextState));
      setInitializing(false);
      return;
    }

    const pending = localStorage.getItem("pendingOrder");
    if (pending) {
      try {
        const stored = JSON.parse(pending) as LocationState;
        setPaymentState(stored);
      } catch {
        localStorage.removeItem("pendingOrder");
      }
    } else {
      navigate("/order", { replace: true });
    }
    setInitializing(false);
  }, [location.state, navigate]);

  useEffect(() => {
    if (!paymentState) return;
    const { orderId, total } = paymentState;
    if (!orderId || typeof total !== "number" || Number.isNaN(total)) {
      toast.error("Missing payment details");
      navigate("/", { replace: true });
    }
  }, [paymentState, navigate]);

  useEffect(() => {
    track("page_view", { page: "Payment" });
  }, []);

  useEffect(() => {
    if (window.YocoSDK) {
      setYocoLoaded(true);
      return;
    }

    const scriptId = "yoco-sdk";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://js.yoco.com/sdk/v1/yoco-sdk-web.js";
      script.async = true;
      script.onload = () => setYocoLoaded(true);
      script.onerror = () => {
        toast.error("Failed to load Yoco SDK. Showing fallback payment UI.");
        setYocoLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      existing.onload = () => setYocoLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!yocoLoaded) {
        toast.info("SDK load timeout, proceeding with payment UI.");
        setYocoLoaded(true);
      }
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [yocoLoaded]);

  const publicKey = import.meta.env.VITE_YOCO_PUBLIC_KEY;

  useEffect(() => {
    const orderId = paymentState?.orderId;
    if (!orderId) {
      return;
    }

    let isActive = true;

    api
      .get(`/orders/${orderId}`)
      .then((res) => {
        if (!isActive) return;
        if (typeof res.data.loyalty_eligible !== "undefined") {
          setCanApplyLoyalty(Boolean(res.data.loyalty_eligible));
          return;
        }

        const svcId = res.data.serviceId ?? res.data.service_id;
        if (!svcId) {
          setCanApplyLoyalty(false);
          return;
        }

        api
          .get(`/services/${svcId}`)
          .then((svcRes) => {
            if (!isActive) return;
            setCanApplyLoyalty(Boolean(svcRes.data.loyalty_eligible));
          })
          .catch(() => {
            if (!isActive) return;
            setCanApplyLoyalty(false);
          });
      })
      .catch(() => {
        if (!isActive) return;
        setCanApplyLoyalty(false);
      });

    return () => {
      isActive = false;
    };
  }, [paymentState?.orderId]);

  useEffect(() => {
    if (!user) {
      setRewardInfo(null);
      setLoadingReward(false);
      return;
    }

    let isActive = true;
    setLoadingReward(true);
    api
      .get("/loyalty/me", { params: { phone: user.phone } })
      .then((res) => {
        if (!isActive) return;
        const loyalty = normalizeLoyaltyResponse(res.data);
        const reward = loyalty.rewardsReady.find((candidate) => {
          const normalized = (candidate.reward || '').toLowerCase();
          return normalized.includes('full house') || normalized.includes('free wash');
        });
        if (reward) {
          const expiryVal = reward.expiryAt || reward.expiry_at;
          setRewardInfo({
            reward: reward.reward || '',
            expiry: expiryVal, // maintain existing type (string | undefined)
            milestone: reward.milestone,
          });
        } else {
          setRewardInfo(null);
        }
      })
      .catch(() => {
        if (!isActive) return;
        setRewardInfo(null);
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingReward(false);
      });

    return () => {
      isActive = false;
    };
  }, [user]);

  const summaryItems = useMemo(() => paymentState?.summary ?? [], [paymentState?.summary]);
  const scheduledDate = paymentState?.scheduledDate;
  const scheduledTime = paymentState?.scheduledTime;
  const orderId = paymentState?.orderId ?? "";
  const total = paymentState?.total ?? 0;

  const amountToPay = useMemo(() => Math.max(total - rewardDiscount, 0), [total, rewardDiscount]);
  const hasRewardExpired = useMemo(() => {
    if (!rewardInfo?.expiry) return false;
    return new Date(rewardInfo.expiry) < new Date();
  }, [rewardInfo?.expiry]);

  const handleApplyReward = useCallback(async () => {
    if (!orderId || !user?.phone) return;

    track("cta_click", { label: "Apply Reward", page: "Payment" });
    setPaying(true);
    setLoadingReward(true);

    try {
      const response = await api.post("/loyalty/reward/apply", {
        orderId,
        phone: user.phone,
      });

      if (response.data?.discount) {
        setRewardDiscount(response.data.discount);
        setRewardApplied(true);
        toast.success(`Reward applied! Discount: ${formatCents(response.data.discount)}`);
      } else {
        toast.error("No valid reward found.");
      }
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(message || "Could not apply reward.");
    } finally {
      setPaying(false);
      setLoadingReward(false);
    }
  }, [orderId, user?.phone]);

  const handlePay = useCallback(async () => {
    if (!orderId) return;

    track("cta_click", { label: "Pay", page: "Payment" });

    if (amountToPay <= 0) {
      toast.success("No payment needed! Reward covers the full amount.");
      if (rewardApplied) {
        try {
          await api.post(`/orders/${orderId}/redeem`);
        } catch {
          /* redemption errors are handled server-side */
        }
      }

      navigate("/order/confirmation", {
        state: {
          orderId,
          qrData: orderId,
          qrCodeBase64: null,
          amount: 0,
          paymentPin: null,
          summary: summaryItems,
          timestamp: Date.now(),
          scheduledDate,
          scheduledTime,
        },
      });
      return;
    }

    if (!publicKey) {
      toast.error("Payment configuration missing. Please contact support.");
      return;
    }

    if (!window.YocoSDK) {
      toast.error("Yoco SDK not loaded. Please refresh the page.");
      return;
    }

    setPaying(true);

    try {
      const popup = new window.YocoSDK({ publicKey });
      popup.showPopup({
        amountInCents: amountToPay,
        currency: "ZAR",
        name: "SMB Loyalty Payment",
        description: `Order #${orderId}`,
        callback: async (result: YocoResult) => {
          if (result.error) {
            setPaying(false);
            toast.error(result.error.message || "Payment failed. Please try again.");
            return;
          }

          try {
            await api.post("/payments/charge", {
              token: result.id,
              orderId,
              amount: amountToPay,
            });

            if (rewardApplied) {
              try {
                await api.post(`/orders/${orderId}/redeem`);
              } catch {
                /* redemption errors are handled server-side */
              }
            }

            const qrResponse = await api.get(`/payments/qr/${orderId}`);
            const qrData = qrResponse.data.reference || orderId;
            const qrCodeBase64 = qrResponse.data.qr_code_base64;
            const paymentPin = qrResponse.data.payment_pin;
            const amount = qrResponse.data.amount ?? total;

            await refreshUser();

            const confirmationData = {
              orderId,
              qrData,
              qrCodeBase64,
              amount,
              paymentPin,
              summary: summaryItems,
              timestamp: Date.now(),
              scheduledDate,
              scheduledTime,
            };

            localStorage.setItem("lastOrderConfirmation", JSON.stringify(confirmationData));
            toast.success("Payment successful!", { autoClose: 2000 });
            navigate("/order/confirmation", { state: confirmationData });
          } catch (error: unknown) {
            setPaying(false);
            const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            toast.error(message || "Payment could not be completed. Please contact support.");
          }
        },
      });
    } catch (error: unknown) {
      setPaying(false);
      const message = (error as Error)?.message ?? String(error);
      toast.error(`Unexpected error: ${message}`);
    }
  }, [
    orderId,
    amountToPay,
    rewardApplied,
    navigate,
    publicKey,
    summaryItems,
    scheduledDate,
    scheduledTime,
    refreshUser,
    total,
  ]);

  if (authLoading || initializing) {
    return (
      <UserPage className="payment-page" size="narrow">
        <UserHero
          eyebrow="Payment"
          title="Preparing your checkout"
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard muted aria-busy="true">
            <div className="skeleton-lines" aria-hidden="true">
              <p className="skeleton skeleton-text" style={{ width: '55%' }}>Loading payment…</p>
              <p className="skeleton skeleton-text" style={{ width: '40%' }}>Fetching order data…</p>
              <p className="skeleton skeleton-text" style={{ width: '30%' }}>Checking rewards…</p>
            </div>
            <p className="visually-hidden">Loading payment information, please wait.</p>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!paymentState || !orderId) {
    return null;
  }

  return (
    <UserPage className="payment-page" size="narrow" layout="split" aside={
      <div className="payment-aside" aria-label="Summary and rewards">
        <UserCard className="payment-summary-card" padding="loose" muted>
          <PaymentSummary
            total={total}
            discount={rewardDiscount}
            items={summaryItems}
            scheduledDate={scheduledDate}
            scheduledTime={scheduledTime}
            rewardApplied={rewardApplied}
            loadingReward={loadingReward}
            canApplyLoyalty={canApplyLoyalty}
            hasRewardExpired={hasRewardExpired}
            onApplyReward={handleApplyReward}
            rewardInfo={rewardInfo}
          />
        </UserCard>
      </div>
    }>
      <ToastContainer position="top-right" />
      <UserHero
        eyebrow="Payment"
        title="Complete Your Payment"
        variant="compact"
        align="start"
        actions={
          <div className="payment-step-indicator">
            <StepIndicator currentStep={2} stepsCompleted={[1]} />
          </div>
        }
      />

      <UserSection>
        <UserCard className="payment-actions-card" padding="loose">
          <div className="payment-buttons">
            <button
              type="button"
              onClick={handlePay}
              disabled={paying || !yocoLoaded}
              className={`payment-button payment-button--primary ${
                paying || !yocoLoaded ? "payment-button--disabled" : ""
              }`}
            >
              {!yocoLoaded ? "Loading payment…" : paying ? "Processing…" : "Pay with card"}
            </button>

            {/* Reward apply button moved into PaymentSummary aside for consistent layout */}
          </div>

          <div className="payment-security">
            <FaShieldAlt aria-hidden="true" />
            <span>
              Secured by <span className="payment-security-brand">YOCO</span>
            </span>
          </div>
        </UserCard>
      </UserSection>

      <UserSection>
        <UserCard muted>
          <div className="payment-status payment-status--info">
            <FaCreditCard aria-hidden="true" />
            <span>
              Having trouble? Reach out to our support team and we’ll help you finish checkout.
            </span>
          </div>
        </UserCard>
      </UserSection>
    </UserPage>
  );
};

export default Payment;