import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Reward { milestone: number; reward: string; }
interface Profile {
  name: string;
  phone: string;
  visits: number;
  rewards_ready: Reward[];
  upcoming_rewards: { milestone:number; visits_needed:number; reward:string; }[];
}

const MyLoyalty: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const phone = prompt('Phone for profile?') || '';  // or store in state

  useEffect(() => {
    axios
      .get('http://localhost:8000/loyalty/me', { params: { phone } })
      .then(res => setProfile(res.data));
  }, [phone]);

  if (!profile) return <div>Loading…</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome back, {profile.name}!</h1>
      <p>You’ve visited us {profile.visits} times.</p>
      <h2>Your Rewards</h2>
      {profile.rewards_ready.length
        ? profile.rewards_ready.map(r => (
            <div key={r.milestone}>
              ⭐ Unlocked: {r.reward}
            </div>
          ))
        : <p>No unlocked rewards yet.</p>
      }
      <h2>Upcoming</h2>
      {profile.upcoming_rewards.map(r => (
        <div key={r.milestone}>
          {r.reward} in {r.visits_needed} more visits.
        </div>
      ))}
      <button onClick={() => window.location.href = '/services'}>
        Book a Wash
      </button>
    </div>
  );
};

export default MyLoyalty;