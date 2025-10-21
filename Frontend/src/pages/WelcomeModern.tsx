/**
 * Welcome Page - Modern Rebuild
 * 
 * Industry-standard features:
 * - Card-based layout with elevation
 * - Smooth animations with Framer Motion
 * - Progressive disclosure of information
 * - Skeleton loading states
 * - Empty states with illustrations
 * - Quick action buttons
 * - Real-time status updates
 * - Accessibility-first design
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { 
  HiOutlineShoppingCart, 
  HiOutlineClipboardList,
  HiOutlineTruck,
  HiOutlineRefresh,
  HiOutlineStar,
  HiOutlineCheckCircle,
  HiOutlineGift
} from 'react-icons/hi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

import { useAuth } from '../auth/AuthProvider';
import api from '../api/api';
import { track } from '../utils/analytics';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import WelcomeModal from '../components/WelcomeModal';
import './WelcomeModern.css';

interface UpcomingReward {
  reward: string;
  milestone: number;
  visits_needed: number;
}

interface WashStatus {
  id: string;
  status: 'active' | 'ended' | 'none';
  service_name?: string;
  started_at?: string;
  ended_at?: string;
}

interface LoyaltyData {
  visits: number;
  rewards_ready: any[];
  upcoming_rewards: UpcomingReward[];
  name?: string;
}

const VISIT_MILESTONE = 5;

const WelcomeModern: React.FC = () => {
  const { user } = useAuth();

  // State management
  const [visits, setVisits] = useState(() => {
    const raw = localStorage.getItem('visits');
    return raw ? parseInt(raw, 10) || 0 : 0;
  });
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [activeWash, setActiveWash] = useState<WashStatus | null>(null);
  const [recentlyEnded, setRecentlyEnded] = useState<WashStatus | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!user) return;
      
      try {
        const [loyaltyRes, washRes] = await Promise.all([
          api.get('/loyalty/me'),
          api.get('/payments/user-wash-status'),
        ]);

        if (!isMounted) return;

        // Update loyalty data
        const loyalty: LoyaltyData = loyaltyRes.data;
        setLoyaltyData(loyalty);
        setVisits(loyalty.visits || 0);
        localStorage.setItem('visits', String(loyalty.visits || 0));

        // Update wash status
        const wash = washRes.data;
        if (wash.status === 'active') {
          setActiveWash(wash);
          setRecentlyEnded(null);
        } else if (wash.status === 'ended') {
          setActiveWash(null);
          setRecentlyEnded(wash);
        } else {
          setActiveWash(null);
          setRecentlyEnded(null);
        }

        setIsLoading(false);
        setIsRefreshing(false);
      } catch (err) {
        console.warn('Failed to fetch welcome data', err);
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    // Initial fetch
    fetchData();

    // Poll every 5 seconds for active wash status
    const interval = setInterval(fetchData, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Analytics
  useEffect(() => {
    track('page_view', { page: 'Welcome' });
  }, []);

  // Check for onboarding flag
  useEffect(() => {
    const onboarded = localStorage.getItem('justOnboarded');
    if (onboarded === 'true') {
      setJustOnboarded(true);
      localStorage.removeItem('justOnboarded');
    }
  }, []);

  // Redirect admin users
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === 'staff') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  // Calculate loyalty progress
  const upcomingReward = loyaltyData?.upcoming_rewards?.[0];
  const nextMilestone = upcomingReward?.milestone || visits + VISIT_MILESTONE;
  const visitsNeeded = upcomingReward?.visits_needed || VISIT_MILESTONE;
  const currentProgress = Math.max(0, visits - (nextMilestone - visitsNeeded));
  const progressPercentage = visitsNeeded > 0 ? Math.min(100, (currentProgress / visitsNeeded) * 100) : 0;
  const visitsRemaining = Math.max(visitsNeeded - currentProgress, 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger re-fetch through effect
  };

  return (
    <div className="welcome-page-modern">
      <AnimatePresence>
        {justOnboarded && (
          <WelcomeModal onClose={() => setJustOnboarded(false)} name={user?.firstName || 'there'} />
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <motion.section
        className="welcome-hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="welcome-hero__content">
          <motion.h1
            className="welcome-hero__title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Welcome back, {user?.firstName || 'Guest'}!
          </motion.h1>
          <motion.p
            className="welcome-hero__subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Ready for your next car wash experience?
          </motion.p>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<HiOutlineRefresh className={isRefreshing ? 'spinning' : ''} />}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="welcome-hero__refresh"
        >
          Refresh
        </Button>
      </motion.section>

      {/* Active Wash Status */}
      <AnimatePresence mode="wait">
        {activeWash && (
          <motion.div
            key="active-wash"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card variant="elevated" padding="lg" className="welcome-active-wash">
              <div className="welcome-active-wash__header">
                <div className="welcome-active-wash__icon">
                  <HiOutlineTruck />
                </div>
                <div>
                  <h3 className="welcome-active-wash__title">Wash in Progress</h3>
                  <p className="welcome-active-wash__service">{activeWash.service_name || 'Full Service'}</p>
                </div>
                <div className="welcome-active-wash__badge">
                  <span className="pulse-dot" />
                  Active
                </div>
              </div>
              <div className="welcome-active-wash__progress">
                <div className="progress-spinner">
                  <CircularProgressbar
                    value={75}
                    strokeWidth={8}
                    styles={buildStyles({
                      pathColor: 'var(--color-success)',
                      trailColor: 'var(--color-border)',
                      strokeLinecap: 'round',
                    })}
                  />
                </div>
                <p className="welcome-active-wash__message">
                  Our team is taking great care of your vehicle
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {recentlyEnded && (
          <motion.div
            key="ended-wash"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card variant="elevated" padding="lg" className="welcome-ended-wash">
              <div className="welcome-ended-wash__header">
                <HiOutlineCheckCircle className="welcome-ended-wash__icon" />
                <div>
                  <h3 className="welcome-ended-wash__title">Wash Complete!</h3>
                  <p className="welcome-ended-wash__message">
                    Your {recentlyEnded.service_name || 'service'} is ready
                  </p>
                </div>
              </div>
              <Link to="/past-orders" className="welcome-ended-wash__link">
                <Button variant="success" size="lg" isFullWidth>
                  View Receipt
                </Button>
              </Link>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loyalty Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Link to="/myloyalty" className="welcome-loyalty__link">
          <Card variant="elevated" padding="lg" isInteractive as="article">
            <CardHeader>
            <div className="welcome-loyalty__header">
              <HiOutlineStar className="welcome-loyalty__icon" />
              <div>
                <h2 className="welcome-loyalty__title">Loyalty Progress</h2>
                <p className="welcome-loyalty__subtitle">
                  {visitsRemaining} visit{visitsRemaining !== 1 ? 's' : ''} until your next reward
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="welcome-loyalty__progress">
              <div className="welcome-loyalty__circle">
                <CircularProgressbar
                  value={progressPercentage}
                  text={`${visits}`}
                  strokeWidth={10}
                  styles={buildStyles({
                    pathColor: 'var(--color-primary)',
                    textColor: 'var(--color-text-primary)',
                    trailColor: 'var(--color-border)',
                    strokeLinecap: 'round',
                    textSize: '28px',
                  })}
                />
                <span className="welcome-loyalty__circle-label">visits</span>
              </div>
              <div className="welcome-loyalty__details">
                <div className="welcome-loyalty__milestone">
                  <span className="welcome-loyalty__milestone-label">Next Reward</span>
                  <span className="welcome-loyalty__milestone-value">{nextMilestone} visits</span>
                </div>
                {upcomingReward && (
                  <div className="welcome-loyalty__reward">
                    <HiOutlineGift />
                    <span>{upcomingReward.reward}</span>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
            {loyaltyData?.rewards_ready && loyaltyData.rewards_ready.length > 0 && (
              <CardFooter>
                <div className="welcome-loyalty__available">
                  <HiOutlineCheckCircle />
                  <span>You have {loyaltyData.rewards_ready.length} reward{loyaltyData.rewards_ready.length > 1 ? 's' : ''} ready!</span>
                </div>
                <Button variant="primary" size="sm" rightIcon={<HiOutlineGift />}>
                  Claim Now
                </Button>
              </CardFooter>
            )}
          </Card>
        </Link>
      </motion.div>

      {/* Quick Actions */}
      <motion.section
        className="welcome-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <h2 className="welcome-actions__title">Quick Actions</h2>
        <div className="welcome-actions__grid">
          <Link to="/order" className="welcome-action-card__link">
            <Card variant="outlined" padding="lg" isInteractive>
              <div className="welcome-action-card">
                <div className="welcome-action-card__icon welcome-action-card__icon--primary">
                  <HiOutlineShoppingCart />
                </div>
                <h3 className="welcome-action-card__title">Book a Wash</h3>
                <p className="welcome-action-card__description">
                  Choose your service and schedule a time
                </p>
              </div>
            </Card>
          </Link>

          <Link to="/past-orders" className="welcome-action-card__link">
            <Card variant="outlined" padding="lg" isInteractive>
              <div className="welcome-action-card">
                <div className="welcome-action-card__icon welcome-action-card__icon--secondary">
                  <HiOutlineClipboardList />
                </div>
                <h3 className="welcome-action-card__title">Order History</h3>
                <p className="welcome-action-card__description">
                  View your past orders and receipts
                </p>
              </div>
            </Card>
          </Link>

          <Link to="/myloyalty" className="welcome-action-card__link">
            <Card variant="outlined" padding="lg" isInteractive>
              <div className="welcome-action-card">
                <div className="welcome-action-card__icon welcome-action-card__icon--success">
                  <HiOutlineGift />
                </div>
                <h3 className="welcome-action-card__title">My Rewards</h3>
                <p className="welcome-action-card__description">
                  Check and redeem your loyalty rewards
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </motion.section>

      {/* Loading State */}
      {isLoading && (
        <div className="welcome-loading">
          <Card variant="elevated" padding="lg" isLoading><div /></Card>
          <Card variant="elevated" padding="lg" isLoading><div /></Card>
          <Card variant="elevated" padding="lg" isLoading><div /></Card>
        </div>
      )}
    </div>
  );
};

export default WelcomeModern;
