import React, { useEffect, useState } from "react";
import { HiOutlineRefresh, HiOutlineGift } from 'react-icons/hi';
import { FaGift, FaCar, FaCheckCircle, FaClock } from 'react-icons/fa';
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import WelcomeModal from '../components/WelcomeModal';
import { Link, Navigate } from 'react-router-dom';
import { track } from '../utils/analytics';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Wash } from '../types';
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
    const stored = localStorage.getItem("visits");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [activeWashes, setActiveWashes] = useState<Wash[]>(() => {
    const stored = localStorage.getItem("activeWashes");
    return stored ? JSON.parse(stored) : [];
  });
  const [recentlyEnded, setRecentlyEnded] = useState<Wash | null>(() => {
    const stored = localStorage.getItem("recentlyEnded");
    return stored ? JSON.parse(stored) : null;
  });
  const [upcomingReward, setUpcomingReward] = useState<UpcomingReward | null>(null);
  const [rewardsReady, setRewardsReady] = useState<unknown[]>([]);

  // All useEffect hooks must be called before any conditional returns
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isMounted = true;
    const fetchAll = async () => {
      try {
        const [visitsRes, washRes] = await Promise.all([
          api.get("/loyalty/me"),
          api.get("/payments/user-wash-status"),
        ]);
        setVisits(visitsRes.data.visits || 0);
        localStorage.setItem("visits", String(visitsRes.data.visits || 0));
        const ready = visitsRes.data.rewards_ready || [];
        setRewardsReady(ready);
        const upcoming = visitsRes.data.upcoming_rewards || [];
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
      } catch {
        setVisits(0);
        setActiveWashes([]);
        setRecentlyEnded(null);
      } finally {
        if (isMounted) {
          timer = setTimeout(fetchAll, 3000);
        }
      }
    };
    if (user) {
      fetchAll();
    }
    return () => {
      isMounted = false;
      clearTimeout(timer);
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
  const progress = visits % milestoneSize;
  const nextMilestone = milestoneSize;

  if (!user) return null;

  // Show welcome modal after onboarding
  if (justOnboarded) {
    return <WelcomeModal name={name} onClose={handleCloseModal} />;
  }

  // Status message logic
  let statusMessage = null;
  if (activeWashes.length > 0) {
    statusMessage = (
      <div className="status-message active">
        <h3><FaClock style={{ display: 'inline', marginRight: '0.5rem' }} />Wash in Progress</h3>
        <p>Your vehicles are currently being washed. You will be notified when ready for collection.</p>
      </div>
    );
  } else if (recentlyEnded) {
    statusMessage = (
      <div className="status-message ready">
        <h3><FaCheckCircle style={{ display: 'inline', marginRight: '0.5rem' }} />Ready for Collection</h3>
        <p>Your car is ready for collection.</p>
      </div>
    );
  }

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
    <div className="welcome-page">
      <div className="welcome-header">
        <h1>Welcome {name}!</h1>
        <p className="subtitle">Your car wash companion for loyalty rewards and service booking</p>
      </div>

      {/* Welcome message card */}
      <div className="welcome-message-card">
        <h2>
          {justOnboarded
            ? "Thank you for registering!"
            : "Glad to see you again"}
        </h2>
        <div className="description">
          {justOnboarded
            ? "Welcome to your full service car wash application. Start earning loyalty rewards with every visit!"
            : "Check out your rewards or book a service to keep your car looking great!"}
        </div>
        <div className="action-buttons">
          <Link
            to="/myloyalty"
            className="action-btn action-btn-primary"
            onClick={() => track('cta_click', { label: 'View Rewards', page: 'Welcome' })}
          >
            <FaGift /> View Rewards
          </Link>
          <Link
            to="/order"
            className="action-btn action-btn-secondary"
            onClick={() => track('cta_click', { label: 'Book a Service', page: 'Welcome' })}
          >
            <FaCar /> Book a Service
          </Link>
        </div>
      </div>

      {/* Status and panels grid */}
      <div className="panels-grid">
        {/* Status message if there is one */}
        {statusMessage}

        {/* Wash status panel */}
        <div className="panel-card">
          <HiOutlineRefresh className="panel-icon wash-icon" />
          <h3>Wash Status</h3>
          <div className="description">
            {activeWashes.length > 0
              ? "Your wash is currently in progress"
              : recentlyEnded
              ? "Your car is ready for collection"
              : "No active washes at the moment"}
          </div>
        </div>

        {/* Loyalty rewards panel */}
        <div className="panel-card">
          <HiOutlineGift className="panel-icon loyalty-icon" />
          <h3>Loyalty Progress</h3>
          <div className="progress-container">
            <CircularProgressbar
              value={progress === 0 && visits > 0 ? nextMilestone : progress}
              maxValue={nextMilestone}
              text={`${progress === 0 && visits > 0 ? nextMilestone : progress}/${nextMilestone}`}
              styles={buildStyles({
                textSize: '18px',
                pathColor: '#22c55e',
                textColor: '#ffffff',
                trailColor: 'rgba(255, 255, 255, 0.2)',
              })}
            />
          </div>
          <div className="loyalty-info">
            {rewardsReady.length > 0 ? (
              <div>
                <p>You have a reward ready to claim!</p>
                <button
                  onClick={handleClaimReward}
                  className="claim-button"
                >
                  Claim Now
                </button>
              </div>
            ) : upcomingReward ? (
              <div>
                <p>Next reward: {upcomingReward.reward}</p>
                <p>At {upcomingReward.milestone} visits</p>
              </div>
            ) : (
              <p>Keep visiting to earn rewards!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;


