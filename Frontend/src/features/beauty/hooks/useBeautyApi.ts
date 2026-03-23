import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { beautyApi } from '../../../api/verticals/beauty';
import { toastApiError, toastSuccess } from '../../../utils/apiErrors';
import type {
  BeautyServiceCreate,
  BeautyServiceUpdate,
  StylistCreate,
  StylistUpdate,
  StylistAvailability,
  AppointmentCreate,
  AppointmentUpdate,
} from '../types';

// ── Query key factory ──────────────────────────────────────────────
export const beautyKeys = {
  all: ['beauty'] as const,
  services: (params?: Record<string, unknown>) => ['beauty', 'services', params] as const,
  service: (id: number) => ['beauty', 'services', id] as const,
  stylists: ['beauty', 'stylists'] as const,
  stylist: (id: number) => ['beauty', 'stylists', id] as const,
  stylistAvailability: (id: number) => ['beauty', 'stylists', id, 'availability'] as const,
  appointments: (params?: Record<string, unknown>) => ['beauty', 'appointments', params] as const,
  availableSlots: (params?: Record<string, unknown>) => ['beauty', 'available-slots', params] as const,
};

// ── Services ────────────────────────────────────────────────────────
export function useBeautyServices(params?: { category?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: beautyKeys.services(params as Record<string, unknown>),
    queryFn: () => beautyApi.listServices(params).then(r => r.data),
  });
}

export function useCreateBeautyService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BeautyServiceCreate) => beautyApi.createService(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beauty', 'services'] });
      toastSuccess('Service created successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateBeautyService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BeautyServiceUpdate }) =>
      beautyApi.updateService(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beauty', 'services'] });
      toastSuccess('Service updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeleteBeautyService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => beautyApi.deleteService(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beauty', 'services'] });
      toastSuccess('Service deleted');
    },
    onError: toastApiError,
  });
}

// ── Stylists ────────────────────────────────────────────────────────
export function useStylists() {
  return useQuery({
    queryKey: beautyKeys.stylists,
    queryFn: () => beautyApi.listStylists().then(r => r.data),
  });
}

export function useCreateStylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StylistCreate) => beautyApi.createStylist(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: beautyKeys.stylists });
      toastSuccess('Stylist added successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateStylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: StylistUpdate }) =>
      beautyApi.updateStylist(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: beautyKeys.stylists });
      toastSuccess('Stylist updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeleteStylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => beautyApi.deleteStylist(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: beautyKeys.stylists });
      toastSuccess('Stylist removed');
    },
    onError: toastApiError,
  });
}

export function useUpdateStylistServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stylistId, serviceIds }: { stylistId: number; serviceIds: number[] }) =>
      beautyApi.updateStylistServices(stylistId, serviceIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: beautyKeys.stylists });
      toastSuccess('Stylist services updated');
    },
    onError: toastApiError,
  });
}

export function useStylistAvailability(stylistId: number) {
  return useQuery({
    queryKey: beautyKeys.stylistAvailability(stylistId),
    queryFn: () => beautyApi.getStylistAvailability(stylistId).then(r => r.data),
    enabled: !!stylistId,
  });
}

export function useUpdateStylistAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stylistId, availability }: { stylistId: number; availability: Partial<StylistAvailability>[] }) =>
      beautyApi.updateStylistAvailability(stylistId, availability),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: beautyKeys.stylistAvailability(vars.stylistId) });
      toastSuccess('Availability updated');
    },
    onError: toastApiError,
  });
}

// ── Appointments ────────────────────────────────────────────────────
export function useAppointments(params?: { date_from?: string; date_to?: string; stylist_id?: number; status?: string }) {
  return useQuery({
    queryKey: beautyKeys.appointments(params as Record<string, unknown>),
    queryFn: () => beautyApi.listAppointments(params).then(r => r.data),
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentCreate) => beautyApi.createAppointment(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beauty', 'appointments'] });
      toastSuccess('Appointment booked successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AppointmentUpdate }) =>
      beautyApi.updateAppointment(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beauty', 'appointments'] });
      toastSuccess('Appointment updated');
    },
    onError: toastApiError,
  });
}

// ── Availability Slots ──────────────────────────────────────────────
export function useAvailableSlots(params: { service_id: number; appointment_date: string }) {
  return useQuery({
    queryKey: beautyKeys.availableSlots(params as unknown as Record<string, unknown>),
    queryFn: () => beautyApi.getAvailableSlots(params).then(r => r.data),
    enabled: !!params.service_id && !!params.appointment_date,
  });
}
