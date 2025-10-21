// src/features/loyalty/pages/MyLoyalty.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaGift, FaHistory, FaTrophy } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';
import { useAuth } from '../../../auth/AuthProvider';
import { useLoyalty } from '../hooks/useLoyalty';
import type { RewardReady, UpcomingReward } from '../hooks/useLoyalty';
import './MyLoyalty.css';

const MyLoyalty: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const phoneNumber = user?.phone ?? '';
  const { data, isLoading, isError } = useLoyalty(phoneNumber);
  const [selectedReward, setSelectedReward] = useState<RewardReady | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const handleRewardClick = (reward: RewardReady) => {
    setSelectedReward(reward);
    setShowRewardModal(true);
  };

  const closeModal = () => {
    setShowRewardModal(false);
    setSelectedReward(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading || isLoading) {
    return (
      <div className="loyalty-page user-page user-page--narrow">
        <section className="user-hero user-hero--compact">
          <span className="user-hero__eyebrow">Loyalty</span>
          <h1 className="user-hero__title">My Loyalty Rewards</h1>
          <p className="user-hero__subtitle">We are fetching the latest rewards for you.</p>
        </section>
        <section className="user-page__section">
          <div className="surface-card surface-card--muted loyalty-state loyalty-state--loading" role="status" aria-live="polite">
            <CgSpinner className="loyalty-spinner" />
            <p>Fetching your loyalty progress…</p>
          </div>
        </section>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="loyalty-page user-page user-page--narrow">
        <section className="user-hero user-hero--compact">
          <span className="user-hero__eyebrow">Loyalty</span>
          <h1 className="user-hero__title">My Loyalty Rewards</h1>
          <p className="user-hero__subtitle">We could not load your loyalty information.</p>
        </section>
        <section className="user-page__section">
          <div className="surface-card loyalty-state loyalty-state--error">
            <h2>Unable to load your loyalty information</h2>
            <p className="error-message">Please try again later.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn btn--primary">
              Try again
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loyalty-page user-page user-page--narrow">
        <section className="user-hero user-hero--compact">
          <span className="user-hero__eyebrow">Loyalty</span>
          <h1 className="user-hero__title">My Loyalty Rewards</h1>
          <p className="user-hero__subtitle">Please log in to view your loyalty status.</p>
        </section>
      </div>
    );
  }

  const visits = data?.visits ?? 0;
  const rewards = data?.rewards_ready ?? [];
  const upcoming = data?.upcoming_rewards ?? [];
  const userName = data?.name || user.firstName || 'User';

  const nextMilestone = upcoming.length > 0 ? upcoming[0].milestone : visits + 5;
  const visitsNeeded = upcoming.length > 0 ? upcoming[0].visits_needed : 5;
  const currentProgress = Math.max(0, visits - (nextMilestone - visitsNeeded));
  const progressPercentage = visitsNeeded > 0 ? Math.min(100, (currentProgress / visitsNeeded) * 100) : 0;
  const cappedProgress = Math.min(currentProgress, visitsNeeded);
  const visitsRemaining = Math.max(visitsNeeded - currentProgress, 0);
  const primaryUpcoming = upcoming.length > 0 ? upcoming[0] : null;

  return (
    <div className="loyalty-page user-page user-page--wide">
      <section className="user-hero user-hero--compact">
        <span className="user-hero__eyebrow">Loyalty</span>
        <h1 className="user-hero__title">My Loyalty Rewards</h1>
        <p className="user-hero__subtitle">Welcome back, {userName}! Earn rewards with every visit.</p>
        <div className="user-hero__actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/order')}>
            Book a service
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/past-orders')}>
            View order history
          </button>
        </div>
      </section>

      <section className="user-page__section">
        <div className="surface-card loyalty-stats-card">
          <div className="loyalty-stats">
            <div className="loyalty-stat-item visits">
              <FaHistory className="stat-icon" />
              <div className="stat-value">{visits}</div>
              <div className="stat-label">Total visits</div>
            </div>
            <div className="loyalty-stat-item rewards">
              <FaTrophy className="stat-icon" />
              <div className="stat-value">{rewards.length}</div>
              <div className="stat-label">Rewards ready</div>
            </div>
          </div>
        </div>
      </section>

      <section className="user-page__section">
        <div className="surface-card loyalty-progress-card">
          <div className="card-header">
            <h2 className="section-title">Progress to next reward</h2>
            {primaryUpcoming && (
              <p className="section-subtitle">
                Next up: {primaryUpcoming.reward} at {primaryUpcoming.milestone} visits
              </p>
            )}
          </div>
          <div className="progress-container">
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progressPercentage}%` }} />
            </div>
            <div className="progress-meta">
              <span className="progress-count">{cappedProgress} / {visitsNeeded} visits</span>
              <span className="progress-remaining">
                {visitsRemaining === 0
                  ? 'Reward ready!'
                  : `${visitsRemaining} visit${visitsRemaining === 1 ? '' : 's'} to go`}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="user-page__section">
        <div className="surface-card loyalty-rewards-card">
          <header className="card-header">
            <h2 className="section-title">Available rewards</h2>
            <p className="section-subtitle">Tap a reward to view redemption details.</p>
          </header>
          {rewards.length > 0 ? (
            <div className="rewards-grid">
              {rewards.map((reward, index) => (
                <button
                  type="button"
                  key={`${reward.milestone}-${index}`}
                  className="reward-card available"
                  onClick={() => handleRewardClick(reward)}
                >
                  <span className="reward-badge">
                    <FaGift className="reward-icon" />
                  </span>
                  <span className="reward-content">
                    <h3>{reward.reward}</h3>
                    <div className="reward-milestone">Earned at {reward.milestone} visits</div>
                    {reward.status && (
                      <span className={`reward-status ${reward.status}`}>
                        {reward.status.toUpperCase()}
                      </span>
                    )}
                    <span className="reward-cta">
                      View reward <FaArrowRight aria-hidden="true" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="no-rewards">
              <FaGift className="no-rewards-icon" />
              <p>You do not have any rewards available yet.</p>
              <p>Keep visiting us to earn rewards!</p>
              <button type="button" onClick={() => navigate('/order')} className="btn btn--primary">
                Book a service
              </button>
            </div>
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="user-page__section">
          <div className="surface-card loyalty-upcoming-card">
            <h2 className="section-title">Coming soon</h2>
            <div className="rewards-grid">
              {upcoming.map((reward: UpcomingReward, index: number) => (
                <div key={`${reward.milestone}-${index}`} className="reward-card upcoming">
                  <div className="reward-badge locked">
                    <FaGift className="reward-icon" />
                  </div>
                  <div className="reward-content">
                    <h3>{reward.reward}</h3>
                    <div className="reward-milestone">At {reward.milestone} visits</div>
                    <div className="visits-needed">
                      {reward.visits_needed} more visit{reward.visits_needed !== 1 ? 's' : ''} needed
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showRewardModal && selectedReward && (
        <div className="reward-modal-overlay" onClick={closeModal}>
          <div className="reward-modal" onClick={event => event.stopPropagation()}>
            <button type="button" className="close-modal" onClick={closeModal} aria-label="Close">
              &times;
            </button>
            <h2>{selectedReward.reward}</h2>
            <div className="reward-details">
              <div className="detail-item">
                <span className="detail-label">Milestone:</span>
                <span className="detail-value">{selectedReward.milestone} visits</span>
              </div>
              {selectedReward.pin && (
                <div className="detail-item">
                  <span className="detail-label">Redemption PIN:</span>
                  <span className="detail-value highlight">{selectedReward.pin}</span>
                </div>
              )}
              {selectedReward.expiry_at && (
                <div className="detail-item">
                  <span className="detail-label">Valid until:</span>
                  <span className="detail-value">{formatDate(selectedReward.expiry_at)}</span>
                </div>
              )}
              {selectedReward.status && (
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value status-${selectedReward.status}`}>
                    {selectedReward.status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <p className="redemption-instructions">Show this PIN to staff when redeeming your reward.</p>
              <button type="button" className="btn btn--primary" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLoyalty;
