// Frontend/src/utils/loyalty.ts
// Utility helpers for normalizing loyalty API responses that may include
// both legacy snake_case and new camelCase alias keys.

export interface NormalizedReward {
  milestone: number;
  reward?: string;
  pin?: string;
  qrReference?: string;
  expiryAt?: string;
  // Preserve original keys for any downstream code still expecting them
  qr_reference?: string;
  expiry_at?: string;
}

export interface NormalizedUpcomingReward {
  milestone: number;
  reward?: string;
  visitsNeeded?: number; // camelCase preferred
  visits_needed?: number; // original kept for reference
}

export interface NormalizedLoyalty {
  visits: number;
  rewardsReady: NormalizedReward[];
  upcomingRewards: NormalizedUpcomingReward[];
  // Legacy fields maintained for backward compatibility
  rewards_ready?: NormalizedReward[];
  upcoming_rewards?: NormalizedUpcomingReward[];
}

function mergeReward(obj: any): NormalizedReward {
  if (!obj || typeof obj !== 'object') return { milestone: 0 };
  return {
    milestone: obj.milestone ?? 0,
    reward: obj.reward,
    pin: obj.pin,
    qrReference: obj.qrReference || obj.qr_reference,
    expiryAt: obj.expiryAt || obj.expiry_at,
    // legacy passthrough
    qr_reference: obj.qr_reference,
    expiry_at: obj.expiry_at,
  };
}

function mergeUpcoming(obj: any): NormalizedUpcomingReward {
  if (!obj || typeof obj !== 'object') return { milestone: 0 } as NormalizedUpcomingReward;
  return {
    milestone: obj.milestone ?? 0,
    reward: obj.reward,
    visitsNeeded: obj.visitsNeeded || obj.visits_needed,
    visits_needed: obj.visits_needed,
  };
}

/**
 * Normalize loyalty API response so the rest of the app can rely on camelCase keys.
 * Falls back to snake_case when aliases haven't been rolled out yet.
 */
export function normalizeLoyaltyResponse(data: any): NormalizedLoyalty {
  if (!data || typeof data !== 'object') {
    return { visits: 0, rewardsReady: [], upcomingRewards: [] };
  }
  const visits = data.visits ?? 0;
  const rewardsRaw = data.rewardsReady || data.rewards_ready || [];
  const upcomingRaw = data.upcomingRewards || data.upcoming_rewards || [];
  const rewardsReady = Array.isArray(rewardsRaw) ? rewardsRaw.map(mergeReward) : [];
  const upcomingRewards = Array.isArray(upcomingRaw) ? upcomingRaw.map(mergeUpcoming) : [];
  return {
    visits,
    rewardsReady,
    upcomingRewards,
    // preserve originals for any legacy consumer still reading snake_case directly
    rewards_ready: rewardsReady as any,
    upcoming_rewards: upcomingRewards as any,
  };
}

/**
 * Derive visits remaining until next milestone based on fixed interval.
 * VISIT_MILESTONE kept external so caller can inject current constant.
 */
export function computeProgress(visits: number, milestoneSize: number) {
  const nextMilestone = milestoneSize;
  const progress = visits % milestoneSize;
  const progressValue = progress === 0 && visits > 0 ? nextMilestone : progress;
  return { progressValue, nextMilestone };
}
