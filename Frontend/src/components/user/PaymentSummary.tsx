import React from 'react';
import { formatCents } from '../../utils/format';

interface PaymentSummaryProps {
  total: number; // original total in cents
  discount: number; // discount applied in cents
  items: string[]; // textual summary lines
  scheduledDate?: string;
  scheduledTime?: string;
  rewardApplied: boolean;
  loadingReward: boolean;
  canApplyLoyalty: boolean;
  hasRewardExpired: boolean;
  onApplyReward?: () => void;
  rewardInfo?: { reward: string; expiry?: string | undefined } | null;
}

// Pure presentational component for payment order summary & reward status.
const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  total,
  discount,
  items,
  scheduledDate,
  scheduledTime,
  rewardApplied,
  loadingReward,
  canApplyLoyalty,
  hasRewardExpired,
  onApplyReward,
  rewardInfo,
}) => {
  const amountToPay = Math.max(total - discount, 0);
  const scheduledDisplay = scheduledDate || scheduledTime ? (
    <div className="payment-status payment-status--info" style={{ marginTop: '0.75rem' }}>
      <span>
        {scheduledDate ? new Date(scheduledDate).toLocaleDateString() : 'Date TBC'}
        {scheduledTime ? ` • ${scheduledTime}` : ''}
      </span>
    </div>
  ) : null;

  return (
    <div className="payment-summary" aria-label="Payment summary">
      <div className="payment-summary__amount">
        <span className="payment-summary__label">Amount due</span>
        <span className="payment-summary__value">{formatCents(amountToPay)}</span>
      </div>

      {items.length > 0 && (
        <ul className="payment-summary__items" aria-label="Order items">
          {items.map((line, idx) => (
            <li key={idx} className="payment-summary__item">{line}</li>
          ))}
        </ul>
      )}

      {loadingReward && !rewardApplied && (
        <div className="skeleton-lines" aria-hidden="true" style={{ marginTop: '0.75rem' }}>
          <p className="skeleton skeleton-text" style={{ width: '60%' }}>Checking rewards…</p>
          <p className="skeleton skeleton-text" style={{ width: '45%' }}>Verifying eligibility…</p>
        </div>
      )}
      {rewardInfo && canApplyLoyalty && !hasRewardExpired && !loadingReward && (
        <div className="payment-status payment-status--success" style={{ marginTop: '0.75rem' }}>
          <span>Reward available: {rewardInfo.reward}</span>
          {rewardInfo.expiry && (
            <div className="expiry-text">Expires {new Date(rewardInfo.expiry).toLocaleDateString()}</div>
          )}
        </div>
      )}
      {rewardInfo && hasRewardExpired && !loadingReward && (
        <div className="payment-status payment-status--error" style={{ marginTop: '0.75rem' }}>
          Reward expired
        </div>
      )}
      {!rewardInfo && canApplyLoyalty && !loadingReward && (
        <div className="payment-status payment-status--info" style={{ marginTop: '0.75rem' }}>
          No reward ready for this order yet.
        </div>
      )}
      {!canApplyLoyalty && !loadingReward && (
        <div className="payment-status payment-status--info" style={{ marginTop: '0.75rem' }}>
          Loyalty rewards cannot be applied to this service.
        </div>
      )}

      {scheduledDisplay}

      {rewardInfo && canApplyLoyalty && !rewardApplied && !hasRewardExpired && onApplyReward && !loadingReward && (
        <div className="payment-summary__actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onApplyReward}
            disabled={loadingReward}
            className="btn btn--primary btn--dense"
          >
            {loadingReward ? 'Checking reward…' : 'Apply reward'}
          </button>
        </div>
      )}

      {rewardApplied && (
        <div className="payment-status payment-status--success" style={{ marginTop: '0.75rem' }}>
          Reward applied! New total: {formatCents(amountToPay)}
        </div>
      )}
    </div>
  );
};

export default PaymentSummary;