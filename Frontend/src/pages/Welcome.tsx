import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import PageLayout from "../components/PageLayout";
import WelcomeModal from '../components/WelcomeModal';
import { Link } from 'react-router-dom';
import { track } from '../utils/analytics';

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

  // Fetch both visits and wash status every 3 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    const fetchAll = () => {
      Promise.all([
        api.get("/loyalty/me"),
        api.get("/payments/user-wash-status"),
      ])
        .then(([visitsRes, washRes]) => {
          setVisits(visitsRes.data.visits || 0);
          localStorage.setItem("visits", String(visitsRes.data.visits || 0));

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
        })
        .catch(() => {
          setVisits(0);
          setActiveWashes([]);
          setRecentlyEnded(null);
        });
    };

    if (user) {
      fetchAll();
      interval = setInterval(fetchAll, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
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
  const hasMilestone = progress === 0 && visits > 0;

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

        {/* Visit counter with circular progress */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-40 h-40">
            <CircularProgressbar
              value={progress === 0 && visits > 0 ? nextMilestone : progress}
              maxValue={nextMilestone}
              text={`${progress === 0 && visits > 0 ? nextMilestone : progress}/${nextMilestone}`}
              styles={buildStyles({
                textSize: "18px",
                pathColor: "#2563eb",
                textColor: "#2563eb",
                trailColor: "#e5e7eb",
              })}
            />
          </div>
          {hasMilestone && (
            <div className="mt-2 text-green-600 font-semibold">
              You've reached a milestone!
            </div>
          )}
        </div>

        {/* Status message or Engen Car Wash message */}
        {statusMessage ? (
          statusMessage
        ) : (
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-4 text-center mb-8">
            <div className="text-gray-700 text-sm">
              At Engen Car Wash, we like to acknowledge your continued support, that is why we are giving you the 6th Full Wash on us.
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Welcome;


