import React, { useEffect, useState } from "react";
import { HiOutlineRefresh, HiOutlineGift } from 'react-icons/hi';
import { FaGift, FaCar, FaCheckCircle, FaClock } from 'react-icons/fa';
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import WelcomeModal from '../components/WelcomeModal';
import { Link, Navigate } from 'react-router-dom';
import { UserPage, UserHero, UserSection, UserCard } from '../components/user';
import { track } from '../utils/analytics';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Wash } from '../types';
import { readJsonStorage } from '../utils/storage';
import './Welcome.css';

interface UpcomingReward {
  reward: string;
  milestone: number;
}

const VISIT_MILESTONE = 5;

const Welcome: React.FC = () => {
  const { user } = useAuth();

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
  const [rewardsReady, setRewardsReady] = useState<unknown[]>([]);

  // All useEffect hooks must be called before any conditional returns
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const fetchAll = async () => {
      try {
        const [visitsRes, washRes] = await Promise.all([
          api.get("/loyalty/me"),
          api.get("/payments/user-wash-status"),
        ]);

        const visitCount = visitsRes.data.visits || 0;
        setVisits(visitCount);
        localStorage.setItem("visits", String(visitCount));

        const ready = visitsRes.data.rewards_ready || [];
        setRewardsReady(ready);

        const upcoming = Array.isArray(visitsRes.data.upcoming_rewards)
          ? visitsRes.data.upcoming_rewards
          : [];
        setUpcomingReward(upcoming[0] || null);

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
      } catch (err) {
        console.warn('Welcome fetch failed, resetting cached state', err);
        setVisits(0);
        setActiveWashes([]);
        setRecentlyEnded(null);
        try {
          window.localStorage.removeItem('visits');
          window.localStorage.removeItem('activeWashes');
          window.localStorage.removeItem('recentlyEnded');
        } catch {
          /* ignore */
        }
      } finally {
        if (isMounted) {
          timer = setTimeout(fetchAll, 3000);
        }
      }
    };

    if (user) {
      void fetchAll();
    }

    return () => {
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
      }
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
  const nextMilestone = milestoneSize;
  const progress = visits % milestoneSize;
  const progressValue = progress === 0 && visits > 0 ? nextMilestone : progress;

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
      toast.success(`Reward issued: ${res.data.reward}`);
      setUpcomingReward(null);
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail || 'Could not claim reward');
    }
  };

  return (
    <UserPage className="welcome-page" size="wide">
      <UserHero
        eyebrow="Welcome back"
        title={(
          <span className="user-hero__title-lines">
            <span className="user-hero__title-greeting">Welcome</span>
            <span className="user-hero__title-name">{name || 'there'}!</span>
          </span>
        )}
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

      {statusBanner && (
        <UserCard
          className={`status-banner status-banner--${statusBanner.variant}`}
          muted
          role="status"
          aria-live="polite"
        >
          <span className="status-banner__icon" aria-hidden="true">
            {statusBanner.icon}
          </span>
          <div className="status-banner__content">
            <h3 className="status-banner__title">{statusBanner.title}</h3>
            <p className="status-banner__description">{statusBanner.description}</p>
          </div>
        </UserCard>
      )}

      <UserSection
        title="Real-time insights"
        className="welcome-insights"
      >
        <div className="insights-grid">
          <UserCard className="insight-card" interactive>
            <span className="insight-card__icon insight-card__icon--wash" aria-hidden="true">
              <HiOutlineRefresh />
            </span>
            <div className="surface-card__header">
              <h3 className="surface-card__title">Wash Status</h3>
              <span className="badge badge--info">Live</span>
            </div>
            <p className="surface-card__subtitle">
              {activeWashes.length > 0
                ? 'Your wash is currently in progress.'
                : recentlyEnded
                ? 'Your car is ready for collection.'
                : 'No active washes at the moment.'}
            </p>
          </UserCard>

          <UserCard className="insight-card" interactive>
            <span className="insight-card__icon insight-card__icon--loyalty" aria-hidden="true">
              <HiOutlineGift />
            </span>
            <div className="surface-card__header">
              <h3 className="surface-card__title">Loyalty Progress</h3>
              <span className="badge badge--success">Rewards</span>
            </div>
            <div className="insight-card__progress">
              <CircularProgressbar
                value={progressValue}
                maxValue={nextMilestone}
                text={`${progressValue}/${nextMilestone}`}
                styles={buildStyles({
                  textSize: '16px',
                  pathColor: '#2563eb',
                  textColor: '#0f172a',
                  trailColor: '#e5e7eb',
                  pathTransitionDuration: 0.5,
                })}
              />
              <p className="sr-only">
                You have completed {progressValue} of {nextMilestone} visits toward your next loyalty reward.
              </p>
            </div>
            <div className="insight-card__footer">
              {rewardsReady.length > 0 ? (
                <div className="insight-card__cta">
                  <p className="insight-card__text">You have a reward ready to claim!</p>
                  <button
                    onClick={handleClaimReward}
                    className="btn btn--primary btn--dense"
                    type="button"
                  >
                    Claim reward
                  </button>
                </div>
              ) : upcomingReward ? (
                <div>
                  <p className="insight-card__text">Next reward: {upcomingReward.reward}</p>
                  <p className="insight-card__meta">Unlocked at {upcomingReward.milestone} visits</p>
                </div>
              ) : (
                <p className="insight-card__text">Keep visiting to earn your next reward.</p>
              )}
            </div>
          </UserCard>
        </div>
      </UserSection>
    </UserPage>
  );
};

export default Welcome;


