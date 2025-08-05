import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import PageLayout from "../components/PageLayout";
import WelcomeModal from '../components/WelcomeModal';
import { Link } from 'react-router-dom';
import { track } from '../utils/analytics';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const VISIT_MILESTONE = 5;

const Welcome: React.FC = () => {
  const { user } = useAuth();

  // Initialize from localStorage if available
  const [visits, setVisits] = useState(() => {
    const stored = localStorage.getItem("visits");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [justOnboarded, setJustOnboarded] = useState(false);
  
  const handleCloseModal = () => {
    setJustOnboarded(false);
  };

  const [activeWashes, setActiveWashes] = useState<any[]>(() => {
    const stored = localStorage.getItem("activeWashes");
    return stored ? JSON.parse(stored) : [];
  });
  const [recentlyEnded, setRecentlyEnded] = useState<any | null>(() => {
    const stored = localStorage.getItem("recentlyEnded");
    return stored ? JSON.parse(stored) : null;
  });
  const [upcomingReward, setUpcomingReward] = useState<any | null>(null);

  // Poll loyalty and wash status with debounced interval to reduce jitter
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
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Could not claim reward');
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

        {/* Two-column layout: Wash status and Loyalty progress */}
        <div className="flex flex-col md:flex-row w-full max-w-4xl mb-8 gap-8">
          {/* Left column: wash status and Start New Wash */}
          <div className="w-full md:w-1/2 flex flex-col items-center">
            {statusMessage ? (
              statusMessage
            ) : recentlyEnded ? (
              <div className="w-full bg-white rounded-2xl shadow-md p-4 mb-4 text-center text-green-800 font-semibold">
                Your car is ready for collection.
              </div>
            ) : (
              <div className="w-full bg-white rounded-2xl shadow-md p-4 mb-4 text-center">
                <div className="text-gray-700 text-sm">
                  No active washes at the moment.
                </div>
              </div>
            )}
            <Link
              to="/order"
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center font-semibold"
              onClick={() => track('cta_click', { label: 'Start New Wash', page: 'Welcome' })}
            >
              Start New Wash
            </Link>
          </div>
          {/* Right column: loyalty progress and next reward */}
          <div className="w-full md:w-1/2 bg-white rounded-2xl shadow-md p-4 flex flex-col items-center">
            <div className="w-40 h-40 mb-4">
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
            {upcomingReward ? (
              <div className="text-center mb-4">
                <p>Earn {upcomingReward.reward} at {upcomingReward.milestone} visits</p>
                <button
                  onClick={handleClaimReward}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
                >
                  Claim Now
                </button>
              </div>
            ) : (
              <div className="text-gray-500">Loading rewards…</div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Welcome;


