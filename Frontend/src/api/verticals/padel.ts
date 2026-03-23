import api from '../api';
import type {
  PadelCourt,
  PadelCourtCreate,
  PadelCourtUpdate,
  PadelPricingRule,
  PadelPricingRuleCreate,
  PadelEquipment,
  PadelBooking,
  PadelBookingCreate,
  PadelAvailableSlot,
} from '../../features/padel/types';

export const padelApi = {
  // Courts
  listCourts: () =>
    api.get<PadelCourt[]>('/api/padel/courts'),

  getCourt: (id: number) =>
    api.get<PadelCourt>(`/api/padel/courts/${id}`),

  createCourt: (data: PadelCourtCreate) =>
    api.post<PadelCourt>('/api/padel/courts', data),

  updateCourt: (id: number, data: PadelCourtUpdate) =>
    api.put<PadelCourt>(`/api/padel/courts/${id}`, data),

  deleteCourt: (id: number) =>
    api.delete(`/api/padel/courts/${id}`),

  // Pricing Rules
  listPricingRules: (courtId: number) =>
    api.get<PadelPricingRule[]>(`/api/padel/courts/${courtId}/pricing`),

  createPricingRule: (courtId: number, data: PadelPricingRuleCreate) =>
    api.post<PadelPricingRule>(`/api/padel/courts/${courtId}/pricing`, data),

  deletePricingRule: (courtId: number, ruleId: number) =>
    api.delete(`/api/padel/courts/${courtId}/pricing/${ruleId}`),

  // Equipment
  listEquipment: () =>
    api.get<PadelEquipment[]>('/api/padel/equipment'),

  // Bookings
  listBookings: (params?: { date_from?: string; date_to?: string; court_id?: number; status?: string }) =>
    api.get<PadelBooking[]>('/api/padel/bookings', { params }),

  createBooking: (data: PadelBookingCreate) =>
    api.post<PadelBooking>('/api/padel/bookings', data),

  updateBooking: (id: number, data: Partial<PadelBooking>) =>
    api.put<PadelBooking>(`/api/padel/bookings/${id}`, data),

  // Availability
  getAvailableSlots: (params: { booking_date: string; duration_minutes?: number }) =>
    api.get<PadelAvailableSlot[]>('/api/padel/availability', { params }),
};
