/**
 * Shared types for the Beauty vertical.
 */

export interface BeautyService {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  online_booking_enabled: boolean;
  points_multiplier: number;
  active: boolean;
}

export interface BeautyServiceCreate {
  name: string;
  description?: string;
  category: string;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes?: number;
  online_booking_enabled?: boolean;
  points_multiplier?: number;
  active?: boolean;
}

export type BeautyServiceUpdate = Partial<BeautyServiceCreate>;

export interface Stylist {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  commission_rate: number;
  accepts_walk_ins: boolean;
  active: boolean;
}

export interface StylistCreate {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  bio?: string;
  photo_url?: string;
  commission_rate?: number;
  accepts_walk_ins?: boolean;
  active?: boolean;
}

export type StylistUpdate = Partial<StylistCreate>;

export interface StylistAvailability {
  id: number;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  specific_date: string | null;
  is_available: boolean;
}

export interface Appointment {
  id: number;
  customer_id: number;
  stylist_id: number;
  service_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  customer_notes: string | null;
  staff_notes: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreate {
  customer_id: number;
  stylist_id: number;
  service_id: number;
  appointment_date: string;
  start_time: string;
  customer_notes?: string;
}

export interface AppointmentUpdate {
  status?: Appointment['status'];
  staff_notes?: string;
}

export interface AvailableSlot {
  stylist_id: number;
  stylist_name: string;
  start_time: string;
  end_time: string;
}
