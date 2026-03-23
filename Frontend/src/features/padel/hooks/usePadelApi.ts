import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { padelApi } from '../../../api/verticals/padel';
import { toastApiError, toastSuccess } from '../../../utils/apiErrors';
import type {
  PadelCourtCreate,
  PadelCourtUpdate,
  PadelPricingRuleCreate,
  PadelBooking,
  PadelBookingCreate,
} from '../types';

// ── Query key factory ──────────────────────────────────────────────
export const padelKeys = {
  all: ['padel'] as const,
  courts: ['padel', 'courts'] as const,
  court: (id: number) => ['padel', 'courts', id] as const,
  pricingRules: (courtId: number) => ['padel', 'courts', courtId, 'pricing'] as const,
  equipment: ['padel', 'equipment'] as const,
  bookings: (params?: Record<string, unknown>) => ['padel', 'bookings', params] as const,
  availability: (params?: Record<string, unknown>) => ['padel', 'availability', params] as const,
};

// ── Courts ──────────────────────────────────────────────────────────
export function usePadelCourts() {
  return useQuery({
    queryKey: padelKeys.courts,
    queryFn: () => padelApi.listCourts().then(r => r.data),
  });
}

export function useCreatePadelCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PadelCourtCreate) => padelApi.createCourt(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: padelKeys.courts });
      toastSuccess('Court created successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdatePadelCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PadelCourtUpdate }) =>
      padelApi.updateCourt(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: padelKeys.courts });
      toastSuccess('Court updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeletePadelCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => padelApi.deleteCourt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: padelKeys.courts });
      toastSuccess('Court deleted');
    },
    onError: toastApiError,
  });
}

// ── Pricing Rules ───────────────────────────────────────────────────
export function usePadelPricingRules(courtId: number) {
  return useQuery({
    queryKey: padelKeys.pricingRules(courtId),
    queryFn: () => padelApi.listPricingRules(courtId).then(r => r.data),
    enabled: !!courtId,
  });
}

export function useCreatePadelPricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courtId, data }: { courtId: number; data: PadelPricingRuleCreate }) =>
      padelApi.createPricingRule(courtId, data).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: padelKeys.pricingRules(vars.courtId) });
      toastSuccess('Pricing rule created');
    },
    onError: toastApiError,
  });
}

export function useDeletePadelPricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courtId, ruleId }: { courtId: number; ruleId: number }) =>
      padelApi.deletePricingRule(courtId, ruleId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: padelKeys.pricingRules(vars.courtId) });
      toastSuccess('Pricing rule removed');
    },
    onError: toastApiError,
  });
}

// ── Equipment ───────────────────────────────────────────────────────
export function usePadelEquipment() {
  return useQuery({
    queryKey: padelKeys.equipment,
    queryFn: () => padelApi.listEquipment().then(r => r.data),
  });
}

// ── Bookings ────────────────────────────────────────────────────────
export function usePadelBookings(params?: { date_from?: string; date_to?: string; court_id?: number; status?: string }) {
  return useQuery({
    queryKey: padelKeys.bookings(params as Record<string, unknown>),
    queryFn: () => padelApi.listBookings(params).then(r => r.data),
  });
}

export function useCreatePadelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PadelBookingCreate) => padelApi.createBooking(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['padel', 'bookings'] });
      toastSuccess('Booking confirmed');
    },
    onError: toastApiError,
  });
}

export function useUpdatePadelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PadelBooking> }) =>
      padelApi.updateBooking(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['padel', 'bookings'] });
      toastSuccess('Booking updated');
    },
    onError: toastApiError,
  });
}

// ── Availability ────────────────────────────────────────────────────
export function usePadelAvailableSlots(params: { booking_date: string; duration_minutes?: number }) {
  return useQuery({
    queryKey: padelKeys.availability(params as unknown as Record<string, unknown>),
    queryFn: () => padelApi.getAvailableSlots(params).then(r => r.data),
    enabled: !!params.booking_date,
  });
}
