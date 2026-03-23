/**
 * Shared types for the Padel vertical.
 */

export interface PadelCourt {
  id: number;
  court_number: string;
  court_type: string;
  surface_type: string;
  has_lighting: boolean;
  base_price_cents: number;
  active: boolean;
  maintenance_mode: boolean;
  notes?: string;
  created_at: string;
}

export interface PadelCourtCreate {
  court_number: string;
  court_type: string;
  surface_type: string;
  has_lighting: boolean;
  base_price_cents: number;
  notes?: string;
}

export type PadelCourtUpdate = Partial<PadelCourtCreate>;

export interface PadelPricingRule {
  id: number;
  court_id: number;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  price_per_hour_cents: number;
  label: string;
  priority: number;
  active: boolean;
  created_at: string;
}

export interface PadelPricingRuleCreate {
  day_of_week?: number;
  start_time: string;
  end_time: string;
  price_per_hour_cents: number;
  label: string;
  priority: number;
}

export interface PadelEquipment {
  id: number;
  name: string;
  equipment_type: string;
  description?: string;
  quantity_available: number;
  rental_price_cents: number;
  active: boolean;
}

export interface PadelBooking {
  id: number;
  court_id: number;
  court_number: string;
  customer_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  court_price_cents: number;
  equipment_price_cents: number;
  total_price_cents: number;
  player_count: number;
  player_names?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  paid: boolean;
  payment_method?: string;
  customer_notes?: string;
  staff_notes?: string;
  reminder_sent: boolean;
  created_at: string;
  equipment_rentals: {
    equipment_id: number;
    equipment_name: string;
    quantity: number;
    price_cents: number;
  }[];
}

export interface PadelBookingCreate {
  customer_id: number;
  court_id: number;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  player_count: number;
  player_names?: string;
  equipment_rentals?: { equipment_id: number; quantity: number }[];
  customer_notes?: string;
}

export interface PadelAvailableSlot {
  court_id: number;
  court_number: string;
  start_time: string;
  duration_minutes: number;
  price_cents: number;
}
