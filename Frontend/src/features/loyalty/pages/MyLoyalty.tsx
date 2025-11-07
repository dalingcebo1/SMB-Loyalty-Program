// src/features/loyalty/pages/MyLoyalty.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaGift, FaHistory, FaTrophy } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';
import { UserCard, UserHero, UserPage, UserSection } from '../../../components/user';
import { useAuth } from '../../../auth/AuthProvider';
import { useLoyalty } from '../hooks/useLoyalty';
import type { RewardReady, UpcomingReward } from '../hooks/useLoyalty';
import { track } from '../../../utils/analytics';
import './MyLoyalty.css';

const MyLoyalty: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const phoneNumber = user?.phone ?? '';
  const { data, isLoading, isError } = useLoyalty(phoneNumber);
  const [selectedReward, setSelectedReward] = useState<RewardReady | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  useEffect(() => {
    track('page_view', { page: 'MyLoyalty' });
  }, []);

  const visits = data?.visits ?? 0;
  const rewards = data?.rewards_ready ?? [];
  const upcoming = useMemo(() => data?.upcoming_rewards ?? [], [data?.upcoming_rewards]);

  const progressData = useMemo(() => {
    const nextMilestone = upcoming.length > 0 ? upcoming[0].milestone : visits + 5;
    const visitsNeeded = upcoming.length > 0 ? upcoming[0].visits_needed : 5;
    const currentProgress = Math.max(0, visits - (nextMilestone - visitsNeeded));
    const progressPercentage = visitsNeeded > 0 ? Math.min(100, (currentProgress / visitsNeeded) * 100) : 0;
    const cappedProgress = Math.min(currentProgress, visitsNeeded);
    const visitsRemaining = Math.max(visitsNeeded - currentProgress, 0);
    const primaryUpcoming = upcoming.length > 0 ? upcoming[0] : null;

    return {
      visitsNeeded,
      progressPercentage,
      cappedProgress,
      visitsRemaining,
      primaryUpcoming,
    };
  }, [visits, upcoming]);

  const { visitsNeeded, progressPercentage, cappedProgress, visitsRemaining, primaryUpcoming } = progressData;

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
      <UserPage className="loyalty-page" size="narrow">
        <UserHero
          eyebrow="Loyalty"
          title="My Loyalty Rewards"
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard muted className="loyalty-state loyalty-state--loading" role="status" aria-live="polite">
            <CgSpinner className="loyalty-spinner" />
            <p>Fetching your loyalty progress...</p>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  if (isError) {
    return (
      <UserPage className="loyalty-page" size="narrow">
        <UserHero
          eyebrow="Loyalty"
          title="My Loyalty Rewards"
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard className="loyalty-state loyalty-state--error">
            <h2>Unable to load your loyalty information</h2>
            <p className="error-message">Please try again later.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn btn--primary">
              Try again
            </button>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  if (!user) {
    return (
      <UserPage className="loyalty-page" size="narrow">
        <UserHero
          eyebrow="Loyalty"
          title="My Loyalty Rewards"
          variant="compact"
          align="start"
        />
      </UserPage>
    );
  }

  const handleBookService = () => {
    navigate('/order');
  };

  const handleViewOrders = () => {
    navigate('/past-orders');
  };

  return (
    <UserPage className="loyalty-page" size="wide">
      <UserHero
        eyebrow="Loyalty"
        title="My Loyalty Rewards"
        variant="compact"
        align="start"
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={handleBookService}>
              Book a service
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleViewOrders}>
              View order history
            </button>
          </>
        }
      />

      <UserSection>
        <UserCard className="loyalty-stats-card">
          <div className="loyalty-stats">
            <div className="loyalty-stat-item visits">
              <FaHistory className="stat-icon" aria-hidden="true" />
              <div className="stat-value">{visits}</div>
              <div className="stat-label">Total visits</div>
            </div>
            <div className="loyalty-stat-item rewards">
              <FaTrophy className="stat-icon" aria-hidden="true" />
              <div className="stat-value">{rewards.length}</div>
              <div className="stat-label">Rewards ready</div>
            </div>
          </div>
        </UserCard>
      </UserSection>

      <UserSection>
        <UserCard className="loyalty-progress-card">
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
              <div
                className="progress-bar"
                style={{ transform: `scaleX(${progressPercentage / 100})` }}
                aria-hidden="true"
              />
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
        </UserCard>
      </UserSection>

      <UserSection>
        <UserCard className="loyalty-rewards-card">
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
                  aria-label={`${reward.reward}, earned at ${reward.milestone} visits. Click to view redemption details.`}
                >
                  <span className="reward-badge" aria-hidden="true">
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
              <FaGift className="no-rewards-icon" aria-hidden="true" />
              <p>You do not have any rewards available yet.</p>
              <p>Keep visiting us to earn rewards!</p>
              <button type="button" onClick={handleBookService} className="btn btn--primary">
                Book a service
              </button>
            </div>
          )}
        </UserCard>
      </UserSection>

      {upcoming.length > 0 && (
        <UserSection>
          <UserCard className="loyalty-upcoming-card">
            <h2 className="section-title">Coming soon</h2>
            <div className="rewards-grid">
              {upcoming.map((reward: UpcomingReward, index: number) => (
                <div key={`${reward.milestone}-${index}`} className="reward-card upcoming">
                  <div className="reward-badge locked" aria-hidden="true">
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
          </UserCard>
        </UserSection>
      )}

      {showRewardModal && selectedReward && (
        <div
          className="reward-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reward-modal-title"
          onClick={closeModal}
        >
          <div className="reward-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-modal" onClick={closeModal} aria-label="Close">
              &times;
            </button>
            <h2 id="reward-modal-title">{selectedReward.reward}</h2>
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
    </UserPage>
  );
};

export default MyLoyalty;
