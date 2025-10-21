import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  HiOutlineGift,
  HiOutlineCheckCircle,
  HiOutlineClock
} from 'react-icons/hi';
import { FaTrophy, FaGift, FaStar, FaHistory } from 'react-icons/fa';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import api from '../api/api';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { ToastProvider, useToast } from '../components/ui/Toast';
import { track } from '../utils/analytics';
import './MyLoyaltyModern.css';

interface LoyaltyData {
  points: number;
  visits: number;
  tier: string;
  points_to_next_reward?: number;
  upcoming_rewards?: Reward[];
  available_rewards?: Reward[];
  history?: Transaction[];
}

interface Reward {
  id: number;
  name: string;
  description?: string;
  points_required: number;
  available: boolean;
  expires_at?: string;
}

interface Transaction {
  id: number;
  type: string;
  points: number;
  description: string;
  created_at: string;
}

const MyLoyaltyModern: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    fetchLoyaltyData();
    track('page_view', { page: 'MyLoyaltyModern' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLoyaltyData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/loyalty/me');
      setLoyaltyData(response.data);
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load loyalty data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = (reward: Reward) => {
    setSelectedReward(reward);
    setShowRedeemModal(true);
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;

    setRedeeming(true);
    try {
      await api.post(`/loyalty/redeem/${selectedReward.id}`);
      
      addToast({
        type: 'success',
        title: 'Reward Redeemed!',
        message: `${selectedReward.name} has been redeemed successfully`
      });

      track('reward_redeemed', { 
        reward_id: selectedReward.id,
        reward_name: selectedReward.name
      });

      // Refresh data
      await fetchLoyaltyData();
      setShowRedeemModal(false);
      setSelectedReward(null);
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      addToast({
        type: 'error',
        title: 'Redemption Failed',
        message: error.response?.data?.message || 'Failed to redeem reward'
      });
    } finally {
      setRedeeming(false);
    }
  };

  const calculateProgress = () => {
    if (!loyaltyData || !loyaltyData.points_to_next_reward) return 100;
    
    const upcomingReward = loyaltyData.upcoming_rewards?.[0];
    if (!upcomingReward) return 100;

    const pointsNeeded = upcomingReward.points_required;
    const currentPoints = loyaltyData.points;
    
    return Math.min((currentPoints / pointsNeeded) * 100, 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="loyalty-modern">
        <div className="loyalty-modern__container">
          <Card variant="elevated" padding="lg">
            <div className="text-center py-8">
              <p>Loading your loyalty progress...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const upcomingReward = loyaltyData?.upcoming_rewards?.[0];

  return (
    <div className="loyalty-modern">
      <div className="loyalty-modern__container">
        {/* Header */}
        <div className="loyalty-modern__header">
          <div className="loyalty-modern__title-section">
            <h1 className="loyalty-modern__title">My Loyalty</h1>
            <p className="loyalty-modern__subtitle">
              Track your points and redeem amazing rewards
            </p>
          </div>
          <Avatar 
            name={user?.firstName || 'User'} 
            size="xl" 
            status="online"
          />
        </div>

        {/* Progress Card */}
        <Card variant="elevated" padding="lg" className="progress-card">
          <CardBody>
            <div className="progress-card__content">
              <div className="progress-card__circle">
                <CircularProgressbar
                  value={progress}
                  text={`${loyaltyData?.points || 0}`}
                  styles={buildStyles({
                    textSize: '24px',
                    pathColor: 'hsl(var(--color-primary-hsl))',
                    textColor: 'hsl(var(--color-primary-hsl))',
                    trailColor: 'hsl(var(--color-gray-hsl) / 0.2)',
                  })}
                />
                <p className="progress-card__label">Points</p>
              </div>
              
              <div className="progress-card__details">
                <div className="progress-card__stat">
                  <div className="progress-card__stat-icon">
                    <FaTrophy />
                  </div>
                  <div>
                    <p className="progress-card__stat-value">{loyaltyData?.tier || 'Bronze'}</p>
                    <p className="progress-card__stat-label">Current Tier</p>
                  </div>
                </div>

                <div className="progress-card__stat">
                  <div className="progress-card__stat-icon">
                    <FaStar />
                  </div>
                  <div>
                    <p className="progress-card__stat-value">{loyaltyData?.visits || 0}</p>
                    <p className="progress-card__stat-label">Total Visits</p>
                  </div>
                </div>

                {upcomingReward && (
                  <div className="progress-card__next-reward">
                    <HiOutlineGift className="progress-card__next-icon" />
                    <div>
                      <p className="progress-card__next-title">Next Reward</p>
                      <p className="progress-card__next-name">{upcomingReward.name}</p>
                      <p className="progress-card__next-points">
                        {upcomingReward.points_required - (loyaltyData?.points || 0)} points to go
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Available Rewards */}
        <section className="loyalty-modern__section">
          <div className="section-header">
            <h2 className="section-title">
              <HiOutlineGift className="section-icon" />
              Available Rewards
            </h2>
          </div>

          {loyaltyData?.available_rewards && loyaltyData.available_rewards.length > 0 ? (
            <div className="rewards-grid">
              {loyaltyData.available_rewards.map((reward) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card variant="outlined" padding="lg" className="reward-card">
                    <CardBody>
                      <div className="reward-card__icon">
                        <FaGift />
                      </div>
                      <h3 className="reward-card__name">{reward.name}</h3>
                      {reward.description && (
                        <p className="reward-card__description">{reward.description}</p>
                      )}
                      <div className="reward-card__points">
                        <Badge variant="primary" size="lg">
                          {reward.points_required} points
                        </Badge>
                      </div>
                      {reward.expires_at && (
                        <p className="reward-card__expires">
                          <HiOutlineClock className="inline mr-1" />
                          Expires {formatDate(reward.expires_at)}
                        </p>
                      )}
                    </CardBody>
                    <CardFooter>
                      <Button
                        variant="primary"
                        size="base"
                        isFullWidth
                        onClick={() => handleRedeemClick(reward)}
                        disabled={!reward.available || (loyaltyData?.points || 0) < reward.points_required}
                      >
                        {reward.available ? 'Redeem' : 'Not Available'}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<HiOutlineGift />}
              title="No Rewards Available"
              description="Keep earning points to unlock amazing rewards!"
              action={
                <Button variant="primary" onClick={() => navigate('/order')}>
                  Book a Wash
                </Button>
              }
            />
          )}
        </section>

        {/* Upcoming Rewards */}
        {loyaltyData?.upcoming_rewards && loyaltyData.upcoming_rewards.length > 0 && (
          <section className="loyalty-modern__section">
            <div className="section-header">
              <h2 className="section-title">
                <FaTrophy className="section-icon" />
                Upcoming Milestones
              </h2>
            </div>

            <div className="milestones-list">
              {loyaltyData.upcoming_rewards.map((reward, index) => (
                <Card key={reward.id} variant="outlined" padding="base" className="milestone-card">
                  <CardBody>
                    <div className="milestone-card__content">
                      <div className="milestone-card__number">{index + 1}</div>
                      <div className="milestone-card__details">
                        <h4 className="milestone-card__name">{reward.name}</h4>
                        <p className="milestone-card__points">
                          {reward.points_required} points required
                        </p>
                      </div>
                      <Badge variant="info" size="sm">
                        {reward.points_required - (loyaltyData?.points || 0)} points away
                      </Badge>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Transaction History */}
        <section className="loyalty-modern__section">
          <div className="section-header">
            <h2 className="section-title">
              <FaHistory className="section-icon" />
              Points History
            </h2>
          </div>

          {loyaltyData?.history && loyaltyData.history.length > 0 ? (
            <Card variant="outlined" padding="none">
              <div className="history-list">
                {loyaltyData.history.map((transaction) => (
                  <div key={transaction.id} className="history-item">
                    <div className="history-item__icon">
                      {transaction.type === 'earned' ? (
                        <HiOutlineCheckCircle className="text-success" />
                      ) : (
                        <HiOutlineGift className="text-primary" />
                      )}
                    </div>
                    <div className="history-item__details">
                      <p className="history-item__description">{transaction.description}</p>
                      <p className="history-item__date">{formatDate(transaction.created_at)}</p>
                    </div>
                    <div className={`history-item__points ${transaction.type === 'earned' ? 'text-success' : 'text-error'}`}>
                      {transaction.type === 'earned' ? '+' : '-'}{transaction.points}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={<FaHistory />}
              title="No History Yet"
              description="Your points transactions will appear here"
            />
          )}
        </section>

        {/* Redeem Modal */}
        <Modal
          isOpen={showRedeemModal}
          onClose={() => setShowRedeemModal(false)}
          title="Redeem Reward"
          size="md"
        >
          {selectedReward && (
            <div className="redeem-modal">
              <div className="redeem-modal__icon">
                <FaGift />
              </div>
              <h3 className="redeem-modal__title">{selectedReward.name}</h3>
              {selectedReward.description && (
                <p className="redeem-modal__description">{selectedReward.description}</p>
              )}
              <div className="redeem-modal__cost">
                <span>Cost:</span>
                <Badge variant="primary" size="lg">
                  {selectedReward.points_required} points
                </Badge>
              </div>
              <div className="redeem-modal__balance">
                <span>Your Balance:</span>
                <span className="redeem-modal__balance-value">
                  {loyaltyData?.points || 0} points
                </span>
              </div>
              <p className="redeem-modal__confirm">
                Are you sure you want to redeem this reward?
              </p>
              <div className="redeem-modal__actions">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowRedeemModal(false)}
                  disabled={redeeming}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleRedeem}
                  isLoading={redeeming}
                  disabled={(loyaltyData?.points || 0) < selectedReward.points_required}
                >
                  Confirm Redemption
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

// Wrap with ToastProvider
const MyLoyaltyModernWithToast: React.FC = () => (
  <ToastProvider position="top-right">
    <MyLoyaltyModern />
  </ToastProvider>
);

export default MyLoyaltyModernWithToast;
