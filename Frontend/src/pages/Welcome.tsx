import React, { useEffect, useState, useRef } from "react";
import { HiOutlineRefresh } from 'react-icons/hi';
import { FaGift, FaCar, FaCheckCircle, FaClock } from 'react-icons/fa';
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
// CircularProgressbar now encapsulated by LoyaltyPanel; remove direct import.
import WelcomeModal from '../components/WelcomeModal';
import { Link, Navigate } from 'react-router-dom';
import { UserPage, UserHero, UserSection, UserCard } from '../components/user';
import LoyaltyPanel from '../components/user/LoyaltyPanel';
import StatusBanner from '../components/ui/StatusBanner';
import { track } from '../utils/analytics';
// Removed toast notifications in favor of inline reward banner component.
import { Wash } from '../types';
import { readJsonStorage } from '../utils/storage';
import './Welcome.css';
import { normalizeLoyaltyResponse, computeProgress } from '../utils/loyalty';

interface UpcomingReward {
  reward: string;
  milestone: number;
  visitsNeeded?: number; // camelCase alias of visits_needed if present
}

interface LoyaltyReward {
  milestone: number;
  reward?: string;
  pin?: string;
  qr_reference?: string; // original snake_case
  expiry_at?: string;
  qrReference?: string; // camelCase alias
  expiryAt?: string;
}

const VISIT_MILESTONE = 5;

const Welcome: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // If admin user, send to admin dashboard
  // Initialize from localStorage if available - must be called before any early returns
  const [visits, setVisits] = useState(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('visits') : null;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isNaN(parsed)) {
      if (raw) {
        try { window.localStorage.removeItem('visits'); } catch { /* ignore */ }
      }
      return 0;
    }
    return parsed;
  });
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [activeWashes, setActiveWashes] = useState<Wash[]>(() => {
    return readJsonStorage<Wash[]>("activeWashes", []);
  });
  const [recentlyEnded, setRecentlyEnded] = useState<Wash | null>(() => {
    return readJsonStorage<Wash | null>("recentlyEnded", null);
  });
  const [upcomingReward, setUpcomingReward] = useState<UpcomingReward | null>(null);
  const [rewardsReady, setRewardsReady] = useState<LoyaltyReward[]>([]);
  // Inline reward banner state (must be declared before conditional returns)
  const [rewardBanner, setRewardBanner] = useState<{ message: string; reward?: string } | null>(null);

  // All useEffect hooks must be called before any conditional returns
  const pollingDelayRef = useRef(3000);
  const lastSnapshotRef = useRef<string>('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const fetchAll = async () => {
      try {
        const [loyaltyRes, washRes] = await Promise.all([
          api.get("/loyalty/me"),
          api.get("/payments/user-wash-status"),
        ]);

        const loyalty = normalizeLoyaltyResponse(loyaltyRes.data);
        setVisits(loyalty.visits);
        localStorage.setItem("visits", String(loyalty.visits));
        setRewardsReady(loyalty.rewardsReady);
        const firstUpcoming = loyalty.upcomingRewards[0] || null;
        setUpcomingReward(firstUpcoming ? { reward: firstUpcoming.reward || '', milestone: firstUpcoming.milestone, visitsNeeded: firstUpcoming.visitsNeeded } : null);

        if (washRes.data.status === "active") {
          setActiveWashes([washRes.data]);
          setRecentlyEnded(null);
          localStorage.setItem("activeWashes", JSON.stringify([washRes.data]));
          localStorage.removeItem("recentlyEnded");
        } else if (washRes.data.status === "ended") {
          setActiveWashes([]);
          setRecentlyEnded(washRes.data);
          localStorage.removeItem("activeWashes");
          localStorage.setItem("recentlyEnded", JSON.stringify(washRes.data));
        } else {
          setActiveWashes([]);
          setRecentlyEnded(null);
          localStorage.removeItem("activeWashes");
          localStorage.removeItem("recentlyEnded");
        }

        // Adaptive polling snapshot logic (successful fetch path)
        const snapshot = JSON.stringify({ visitCount: loyalty.visits, washStatus: washRes.data.status, rewardsReady: loyalty.rewardsReady.length });
        if (snapshot === lastSnapshotRef.current) {
          pollingDelayRef.current = Math.min(pollingDelayRef.current + 1000, 12000);
        } else {
          pollingDelayRef.current = 3000;
          lastSnapshotRef.current = snapshot;
        }
      } catch (err) {
        console.warn('Welcome fetch failed, resetting cached state', err);
        setVisits(0);
        setActiveWashes([]);
        setRecentlyEnded(null);
        try {
          window.localStorage.removeItem('visits');
          window.localStorage.removeItem('activeWashes');
          window.localStorage.removeItem('recentlyEnded');
        } catch { /* ignore */ }
        // Back off more aggressively on error
        pollingDelayRef.current = Math.min(pollingDelayRef.current + 2000, 15000);
      } finally {
        if (isMounted) {
          // Pause polling if tab not visible
          if (document.visibilityState === 'visible') {
            timer = setTimeout(fetchAll, pollingDelayRef.current);
          } else {
            // When hidden, re-check after a longer interval
            timer = setTimeout(fetchAll, Math.max(pollingDelayRef.current, 10000));
          }
        }
        setLoading(false);
      }
    };

    if (user) {
      void fetchAll();
    }

    const handleVisibility = () => {
      // Trigger immediate fetch when user returns and data is stale > delay
      if (document.visibilityState === 'visible') {
        pollingDelayRef.current = 3000; // reset for freshness
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  useEffect(() => {
    if (localStorage.getItem("justOnboarded") === "true") {
      setJustOnboarded(true);
      localStorage.removeItem("justOnboarded");
    }
    // Analytics: page view
    track('page_view', { page: 'Welcome' });
  }, []);

  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'staff') return <Navigate to="/staff/dashboard" replace />;
  
  const handleCloseModal = () => {
    setJustOnboarded(false);
  };

  const name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || "";

  const milestoneSize = VISIT_MILESTONE;
  const { progressValue, nextMilestone } = computeProgress(visits, milestoneSize);

  if (!user) return null;

  // Show welcome modal after onboarding
  if (justOnboarded) {
    return <WelcomeModal name={name} onClose={handleCloseModal} />;
  }

  // Status banner logic for wash progress insights
  const statusBanner = (() => {
    if (activeWashes.length > 0) {
      return {
        variant: 'info' as const,
        title: 'Wash in Progress',
        description: 'Your vehicles are currently being washed. You will be notified when ready for collection.',
  icon: <FaClock aria-hidden="true" />,
      };
    }
    if (recentlyEnded) {
      return {
        variant: 'success' as const,
        title: 'Ready for Collection',
        description: 'Your car is ready for collection.',
  icon: <FaCheckCircle aria-hidden="true" />,
      };
    }
    return null;
  })();


  const handleClaimReward = async () => {
    if (!user) return;
    try {
      const res = await api.post('/loyalty/reward', { phone: user.phone });
      setUpcomingReward(null);
      setRewardBanner({ message: 'Reward issued successfully!', reward: res.data.reward });
      setTimeout(() => setRewardBanner(null), 5000);
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } } };
      setRewardBanner({ message: error.response?.data?.detail || 'Could not claim reward' });
      setTimeout(() => setRewardBanner(null), 6000);
    }
  };

  return (
    <UserPage className="welcome-page" size="wide">
      <UserHero
        eyebrow="Welcome back"
        title={<>Welcome {name || 'there'}!</>}
        actions={(
          <>
            <Link
              to="/myloyalty"
              className="btn btn--primary"
              onClick={() => track('cta_click', { label: 'View Rewards', page: 'Welcome' })}
            >
              <FaGift aria-hidden="true" /> View Rewards
            </Link>
            <Link
              to="/order"
              className="btn btn--secondary"
              onClick={() => track('cta_click', { label: 'Book a Service', page: 'Welcome' })}
            >
              <FaCar aria-hidden="true" /> Book a Service
            </Link>
          </>
        )}
      />

      {rewardBanner && (
        <StatusBanner
          variant="success"
          title={rewardBanner.reward ? 'Reward Claimed' : 'Notice'}
          description={rewardBanner.reward ? `${rewardBanner.message} (${rewardBanner.reward})` : rewardBanner.message}
          icon={<FaGift aria-hidden="true" />}
          dismissible
          onDismiss={() => setRewardBanner(null)}
          role="alert"
          ariaLive="assertive"
        />
      )}
      {statusBanner && (
        <StatusBanner
          variant={statusBanner.variant}
          title={statusBanner.title}
          description={statusBanner.description}
          icon={statusBanner.icon}
          ariaLive="polite"
          role="status"
        />
      )}

      <UserSection
        title="Real-time insights"
        className="welcome-insights"
        subtitle="Live status and your loyalty progress"
      >
        <div className="u-grid u-grid--cols-2">
          <UserCard className="insight-card" interactive>
            <span className="insight-card__icon insight-card__icon--wash" aria-hidden="true">
              <HiOutlineRefresh />
            </span>
            <div className="surface-card__header">
              <h3 className="surface-card__title">Wash Status</h3>
              <span className="badge badge--info">Live</span>
            </div>
              {loading ? (
              <div className="skeleton-lines" aria-hidden="true">
                <p className="surface-card__subtitle skeleton skeleton-text" style={{ width: '65%' }}>Loading status…</p>
                <p className="surface-card__subtitle skeleton skeleton-text" style={{ width: '50%' }}>Fetching latest wash…</p>
              </div>
            ) : (
              <p className="surface-card__subtitle">
                {activeWashes.length > 0
                  ? 'Your wash is currently in progress.'
                  : recentlyEnded
                  ? 'Your car is ready for collection.'
                  : 'No active washes at the moment.'}
              </p>
            )}
          </UserCard>

          <LoyaltyPanel
            loading={loading}
            progressValue={progressValue}
            nextMilestone={nextMilestone}
            rewardsReady={rewardsReady}
            upcomingReward={upcomingReward}
            onClaimReward={handleClaimReward}
          />
        </div>
        {recentlyEnded && (
          <div className="u-stack-md" style={{ marginTop: '1.5rem' }}>
            <UserCard className="insight-card surface-tier-1" muted>
              <h3 className="surface-card__title">Recent Activity</h3>
              <p className="surface-card__subtitle">Your last wash finished and is ready for collection.</p>
              <p className="insight-card__text" style={{ fontSize: '0.875rem' }}>
                Order #{recentlyEnded.order_id} • Completed
              </p>
            </UserCard>
          </div>
        )}
      </UserSection>
    </UserPage>
  );
};

export default Welcome;


