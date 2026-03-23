import api from '../api';
import type {
  BeautyService,
  BeautyServiceCreate,
  BeautyServiceUpdate,
  Stylist,
  StylistCreate,
  StylistUpdate,
  StylistAvailability,
  Appointment,
  AppointmentCreate,
  AppointmentUpdate,
  AvailableSlot,
} from '../../features/beauty/types';

export const beautyApi = {
  // Services
  listServices: (params?: { category?: string; active_only?: boolean }) =>
    api.get<BeautyService[]>('/api/beauty/services', { params }),

  getService: (id: number) =>
    api.get<BeautyService>(`/api/beauty/services/${id}`),

  createService: (data: BeautyServiceCreate) =>
    api.post<BeautyService>('/api/beauty/services', data),

  updateService: (id: number, data: BeautyServiceUpdate) =>
    api.put<BeautyService>(`/api/beauty/services/${id}`, data),

  deleteService: (id: number) =>
    api.delete(`/api/beauty/services/${id}`),

  // Stylists
  listStylists: () =>
    api.get<Stylist[]>('/api/beauty/stylists'),

  getStylist: (id: number) =>
    api.get<Stylist>(`/api/beauty/stylists/${id}`),

  createStylist: (data: StylistCreate) =>
    api.post<Stylist>('/api/beauty/stylists', data),

  updateStylist: (id: number, data: StylistUpdate) =>
    api.put<Stylist>(`/api/beauty/stylists/${id}`, data),

  deleteStylist: (id: number) =>
    api.delete(`/api/beauty/stylists/${id}`),

  // Stylist services assignment
  updateStylistServices: (stylistId: number, serviceIds: number[]) =>
    api.put(`/api/beauty/stylists/${stylistId}/services`, { service_ids: serviceIds }),

  // Stylist availability
  getStylistAvailability: (stylistId: number) =>
    api.get<StylistAvailability[]>(`/api/beauty/stylists/${stylistId}/availability`),

  updateStylistAvailability: (stylistId: number, availability: Partial<StylistAvailability>[]) =>
    api.put(`/api/beauty/stylists/${stylistId}/availability`, availability),

  // Appointments
  listAppointments: (params?: { date_from?: string; date_to?: string; stylist_id?: number; status?: string }) =>
    api.get<Appointment[]>('/api/beauty/appointments', { params }),

  createAppointment: (data: AppointmentCreate) =>
    api.post<Appointment>('/api/beauty/appointments', data),

  updateAppointment: (id: number, data: AppointmentUpdate) =>
    api.put<Appointment>(`/api/beauty/appointments/${id}`, data),

  // Availability slots
  getAvailableSlots: (params: { service_id: number; appointment_date: string }) =>
    api.get<AvailableSlot[]>('/api/beauty/availability', { params }),
};
