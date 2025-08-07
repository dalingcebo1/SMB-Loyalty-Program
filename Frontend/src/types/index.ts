export * from './admin';
export * from './metrics';

export type Service = {
  id: number;
  name: string;
  base_price: number;
};

export type Extra = {
  id: number;
  name: string;
  price_map: Record<string, number>;
};

export interface ReadyReward {
  milestone: number;
  reward: string;
}

export interface Upcoming {
  milestone: number;
  visits_needed: number;
  reward: string;
}

export interface Profile {
  name: string;
  phone: string;
  visits: number;
  rewards_ready: ReadyReward[];
  upcoming_rewards: Upcoming[];
}

export interface Order {
  id: string;
  service_id: number;
  extras: Extra[];
  payment_pin: string;
  status: string;
  user_id: number;
  created_at: string;
  redeemed: boolean;
  started_at: string | null;
  ended_at: string | null;
  amount?: number;
  service_name?: string;
  order_redeemed_at?: string | null;
}

export interface Vehicle {
  id: number;
  reg: string;
  make: string;
  model: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface Wash {
  order_id: string;
  user?: User;
  vehicle?: Vehicle;
  payment_pin?: string;
  started_at: string;
  ended_at?: string;
  status: "started" | "ended";
  service_name?: string;
  extras?: string[];
}

export interface VerifiedOrder {
  order_id: string;
  user?: User;
  payment_pin?: string;
}
