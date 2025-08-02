import { ReactNode } from 'react';

// Frontend/src/types.ts

export interface Service {
  id: number;
  name: string;
  category: string;
  base_price: number;
}

export interface Extra {
  id: number;
  name: string;
  price_map: Record<string, number>;
}

export interface CartItem {
  price: number;
  quantity: ReactNode;
  name: ReactNode;
  service_id: number;
  category: string;
  qty: number;
  extras: number[];
}

// Loyalty reward types
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

// Order types
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

// Vehicles and users
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

// Wash session
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

// Verified order response
export interface VerifiedOrder {
  order_id: string;
  user?: User;
  payment_pin?: string;
}