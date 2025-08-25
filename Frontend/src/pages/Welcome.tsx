import React, { useEffect, useState } from "react";
import { HiOutlineRefresh, HiOutlineGift } from 'react-icons/hi';
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import PageLayout from "../components/PageLayout";
import WelcomeModal from '../components/WelcomeModal';
import { Link, Navigate } from 'react-router-dom';
import { track } from '../utils/analytics';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Wash } from '../types';

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

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  
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
      <div className="w-full max-w-md bg-blue-100 rounded-2xl shadow-md p-4 mb-8 text-center text-blue-800 font-semibold">
        Your vehicles are currently being wash, you will be notified when ready for collection.
      </div>
    );
  } else if (recentlyEnded) {
    statusMessage = (
      <div className="w-full max-w-md bg-green-100 rounded-2xl shadow-md p-4 mb-8 text-center text-green-800 font-semibold">
        Your car is ready for collection.
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
    <PageLayout>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center px-2 py-4">
        {/* Welcome message card */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-4 mb-8 text-center">
          <h1 className="font-semibold text-base mb-1">
            Welcome {name}!
          </h1>
          <div className="text-gray-600 text-sm">
            {justOnboarded
              ? "Thank you for registering, welcome to your full service car wash application."
              : "Glad to see you again. Check out your rewards or book a service!"}
          </div>
          <div className="mt-4 flex justify-center space-x-4">
            <Link
              to="/myloyalty"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => track('cta_click', { label: 'View Rewards', page: 'Welcome' })}
            >
              View Rewards
            </Link>
            <Link
              to="/order"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => track('cta_click', { label: 'Book a Service', page: 'Welcome' })}
            >
              Book a Service
            </Link>
          </div>
        </div>

        {/* Modern grid layout for status and loyalty panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 w-full max-w-4xl mb-8 gap-6">
          {/* Wash status panel */}
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
            <HiOutlineRefresh className="w-12 h-12 text-blue-500 mb-4" />
    {statusMessage ? (
      statusMessage
    ) : (
      <p className="text-gray-700 text-center mb-4">No active washes at the moment.</p>
    )}
          </div>
          {/* Loyalty rewards panel */}
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition-shadow">
            <HiOutlineGift className="w-12 h-12 text-green-500 mb-4" />
            <div className="w-32 h-32 mb-4">
              <CircularProgressbar
                value={progress === 0 && visits > 0 ? nextMilestone : progress}
                maxValue={nextMilestone}
                text={`${progress === 0 && visits > 0 ? nextMilestone : progress}/${nextMilestone}`}
                styles={buildStyles({
                  textSize: '18px',
                  pathColor: '#10b981',
                  textColor: '#10b981',
                  trailColor: '#e5e7eb',
                })}
              />
            </div>
            <h3 className="text-lg font-semibold mb-2">Next Reward</h3>
            {rewardsReady.length > 0 ? (
              <div className="text-center mb-4">
                <p className="mb-2">You have a reward ready to claim!</p>
                <button
                  onClick={handleClaimReward}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Claim Now
                </button>
              </div>
            ) : upcomingReward ? (
              <div className="text-center mb-4">
                <p className="mb-2">Earn {upcomingReward.reward} at {upcomingReward.milestone} visits</p>
              </div>
            ) : (
              <p className="text-gray-500">No upcoming rewards</p>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Welcome;


