import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { FaGift } from 'react-icons/fa';
import UserCard from './UserCard';

export interface LoyaltyPanelUpcomingReward {
  reward: string;
  milestone: number;
  visitsNeeded?: number;
}

export interface LoyaltyPanelRewardReady {
  milestone: number;
  reward?: string;
  pin?: string;
}

interface LoyaltyPanelProps {
  loading: boolean;
  progressValue: number;
  nextMilestone: number;
  rewardsReady: LoyaltyPanelRewardReady[];
  upcomingReward: LoyaltyPanelUpcomingReward | null;
  onClaimReward: () => void;
  ariaProgressLabel?: string;
}

/**
 * Reusable loyalty progress card. Extracted from Welcome page for reuse on Rewards and Payment summary.
 */
const LoyaltyPanel: React.FC<LoyaltyPanelProps> = ({
  loading,
  progressValue,
  nextMilestone,
  rewardsReady,
  upcomingReward,
  onClaimReward,
  ariaProgressLabel = 'Loyalty progress toward next reward'
}) => {
  return (
    <UserCard className="loyalty-panel" interactive>
      <span className="insight-card__icon insight-card__icon--loyalty" aria-hidden="true">
        <FaGift />
      </span>
      <div className="surface-card__header">
        <h3 className="surface-card__title">Loyalty Progress</h3>
        <span className="badge badge--success">Rewards</span>
      </div>
      <div className="insight-card__progress" role="progressbar" aria-valuenow={progressValue} aria-valuemin={0} aria-valuemax={nextMilestone} aria-label={ariaProgressLabel}>
        {loading ? (
          <div className="skeleton skeleton-circle" aria-hidden="true" />
        ) : (
          <CircularProgressbar
            value={progressValue}
            maxValue={nextMilestone}
            text={`${progressValue}/${nextMilestone}`}
            styles={buildStyles({
              textSize: '14px',
              pathColor: 'var(--color-primary)',
              textColor: 'var(--color-text)',
              trailColor: 'var(--color-border)',
              pathTransitionDuration: 0.5,
            })}
          />
        )}
        <p className="sr-only">You have completed {progressValue} of {nextMilestone} visits toward your next loyalty reward.</p>
      </div>
      <div className="insight-card__footer">
        {loading ? (
          <p className="insight-card__text skeleton skeleton-text" aria-hidden="true">Loading loyalty…</p>
        ) : rewardsReady.length > 0 ? (
          <div className="insight-card__cta" aria-live="polite">
            <p className="insight-card__text">You have a reward ready to claim!</p>
            <button
              onClick={onClaimReward}
              className="btn btn--success btn--dense"
              type="button"
              aria-label="Claim loyalty reward"
            >
              Claim reward
            </button>
          </div>
        ) : upcomingReward ? (
          <div>
            <p className="insight-card__text">Next reward: {upcomingReward.reward}</p>
            <p className="insight-card__meta">Unlocked at {upcomingReward.milestone} visits{typeof upcomingReward.visitsNeeded === 'number' ? ` (needs ${upcomingReward.visitsNeeded} more)` : ''}</p>
          </div>
        ) : (
          <p className="insight-card__text">Keep visiting to earn your next reward.</p>
        )}
      </div>
    </UserCard>
  );
};

export default LoyaltyPanel;
