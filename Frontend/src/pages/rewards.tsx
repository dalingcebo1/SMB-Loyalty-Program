import React from "react";
import { useAuth } from "../auth/AuthProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import api from "../api/api";
import { UserPage, UserHero, UserSection, UserCard } from "../components/user";
import LoyaltyPanel from '../components/user/LoyaltyPanel';
import StatusBanner from '../components/ui/StatusBanner';
import { normalizeLoyaltyResponse, computeProgress } from '../utils/loyalty';

interface Reward {
  id: number;
  name: string;
  description: string;
  points_required: number;
  image_url?: string;
  claimed: boolean;
}

const fetchRewards = async (): Promise<Reward[]> => {
  const { data } = await api.get<Reward[]>("/loyalty/rewards");
  return data;
};

const RewardsPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const rewardsQuery = useQuery({
    queryKey: ["loyalty", "rewards"],
    queryFn: fetchRewards,
    staleTime: 1000 * 60 * 2,
  });
  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", "progress"],
    queryFn: async () => {
      const { data } = await api.get('/loyalty/me');
      return normalizeLoyaltyResponse(data);
    },
    staleTime: 1000 * 30,
  });

  if (!user) return <Navigate to="/login" replace />;

  if (rewardsQuery.isLoading || loyaltyQuery.isLoading) {
    return (
      <UserPage className="rewards-page" layout="split" aside={<UserCard muted padding="loose" aria-busy="true"><div className="skeleton-lines" aria-hidden="true"><div className="skeleton skeleton-text" style={{ width: '70%' }} /><div className="skeleton skeleton-text" style={{ width: '55%' }} /><div className="skeleton skeleton-text" style={{ width: '60%' }} /></div><p className="visually-hidden">Loading rewards…</p></UserCard>}>
        <UserHero eyebrow="Rewards" title="Your Loyalty Rewards" variant="compact" align="start" />
        <UserSection>
          <UserCard muted>
            <p>Loading rewards…</p>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }
  if (rewardsQuery.error) {
    return (
      <UserPage className="rewards-page">
        <UserHero eyebrow="Rewards" title="Your Loyalty Rewards" variant="compact" align="start" />
        <UserSection>
          <StatusBanner
            variant="error"
            title="Failed to load rewards"
            description={rewardsQuery.error instanceof Error ? rewardsQuery.error.message : 'Failed to load rewards.'}
            role="alert"
            ariaLive="assertive"
          />
        </UserSection>
      </UserPage>
    );
  }

  const handleClaim = async (id: number) => {
    await api.post("/loyalty/claim", { reward_id: id });
    qc.invalidateQueries({ queryKey: ["loyalty", "rewards"] });
    qc.invalidateQueries({ queryKey: ["loyalty", "progress"] });
  };

  const loyalty = loyaltyQuery.data;
  const milestoneSize = 5; // fixed milestone interval for loyalty progress
  const { progressValue, nextMilestone } = computeProgress(loyalty?.visits || 0, milestoneSize);
  const upcomingReward = loyalty?.upcomingRewards?.[0]
    ? { reward: loyalty.upcomingRewards[0].reward || '', milestone: nextMilestone, visitsNeeded: loyalty.upcomingRewards[0].visitsNeeded }
    : null;
  const rewardsReady = loyalty?.rewardsReady || [];

  const aside = (
    <div className="rewards-aside" aria-label="Loyalty progress">
      {loyalty && (
        <LoyaltyPanel
          loading={false}
            progressValue={progressValue}
            nextMilestone={nextMilestone}
            rewardsReady={rewardsReady}
            upcomingReward={upcomingReward}
            onClaimReward={() => {/* claim handled per reward item */}}
        />
      )}
      {!loyalty && (
        <UserCard muted>
          <p>Progress unavailable.</p>
        </UserCard>
      )}
    </div>
  );

  const rewards = rewardsQuery.data || [];
  return (
    <UserPage className="rewards-page" layout="split" aside={aside}>
      <UserHero eyebrow="Rewards" title="Your Loyalty Rewards" variant="compact" align="start" />
      <UserSection title="Available rewards" subtitle="Claim rewards you've unlocked">
        <UserCard className="rewards-list-card" padding="loose">
          {rewards.length === 0 ? (
            <p>No rewards available at the moment. Check back later!</p>
          ) : (
            <div className="u-grid u-grid--cols-2">
              {rewards.map(r => (
                <div key={r.id} className={`reward-item ${r.claimed ? 'reward-item--claimed' : ''}`} role="group" aria-label={`${r.name} reward`}>
                  {r.image_url && (
                    <img src={r.image_url} alt="" className="reward-item__image" aria-hidden="true" />
                  )}
                  <h3 className="reward-item__title">{r.name}</h3>
                  <p className="reward-item__desc">{r.description}</p>
                  <div className="reward-item__meta">
                    <span className="reward-item__points">{r.points_required} pts</span>
                    {r.claimed && <span className="badge badge--success" aria-label="Reward already claimed">Claimed</span>}
                  </div>
                  <div className="reward-item__actions u-actions">
                    <button
                      type="button"
                      onClick={() => handleClaim(r.id)}
                      disabled={r.claimed}
                      className={`btn btn--dense ${r.claimed ? 'btn--secondary' : 'btn--primary'}`}
                      aria-disabled={r.claimed}
                    >
                      {r.claimed ? 'Claimed' : 'Claim'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </UserCard>
      </UserSection>
    </UserPage>
  );
};

export default RewardsPage;
