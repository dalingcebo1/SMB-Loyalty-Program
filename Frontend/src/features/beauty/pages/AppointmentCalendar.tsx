import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
} from 'react-icons/fi';
import { beautyApi } from '../../../api/verticals/beauty';
import type { Appointment, BeautyService } from '../types';

interface Stylist {
  id: number;
  name: string;
  active: boolean;
}

type ViewMode = 'day' | 'week' | 'month';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  no_show: 'bg-gray-100 text-gray-800 border-gray-300',
};

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export default function AppointmentCalendar() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedStylist, setSelectedStylist] = useState<number | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch stylists
  const { data: stylists = [] } = useQuery({
    queryKey: ['beauty-stylists'],
    queryFn: async () => {
      const response = await beautyApi.listStylists();
      return response.data;
    },
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['beauty-services-all'],
    queryFn: async () => {
      const response = await beautyApi.listServices({ active_only: false });
      return response.data;
    },
  });

  // Calculate date range based on view mode
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Fetch appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: [
      'beauty-appointments',
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      selectedStylist,
    ],
    queryFn: async () => {
      const params: { date_from?: string; date_to?: string; stylist_id?: number } = {
        date_from: startDate.toISOString().split('T')[0],
        date_to: endDate.toISOString().split('T')[0],
      };
      if (selectedStylist) {
        params.stylist_id = selectedStylist;
      }
      const response = await beautyApi.listAppointments(params);
      return response.data;
    },
  });

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { status?: Appointment['status']; staff_notes?: string };
    }) => {
      const response = await beautyApi.updateAppointment(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beauty-appointments'] });
      setShowDetailsModal(false);
      setSelectedAppointment(null);
    },
  });

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (viewMode === 'week') {
      const weekStart = new Date(startDate);
      const weekEnd = new Date(endDate);
      return `${weekStart.toLocaleDateString('en-ZA', {
        month: 'short',
        day: 'numeric',
      })} - ${weekEnd.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    }
  };

  const getStylistName = (stylistId: number) => {
    const stylist = stylists.find((s: Stylist) => s.id === stylistId);
    return stylist?.name || 'Unknown';
  };

  const getServiceName = (serviceId: number) => {
    const service = services.find((s: BeautyService) => s.id === serviceId);
    return service?.name || 'Unknown Service';
  };

  const getService = (serviceId: number) => {
    return services.find((s: BeautyService) => s.id === serviceId) || null;
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return <div className="p-6">Loading appointments...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointment Calendar</h1>
          <p className="text-gray-600 mt-1">View and manage appointments</p>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg capitalize ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Previous"
          >
            <FiChevronLeft size={20} />
          </button>
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Today
          </button>
          <button onClick={handleNext} className="p-2 hover:bg-gray-100 rounded-lg" title="Next">
            <FiChevronRight size={20} />
          </button>
          <div className="ml-4 font-semibold text-gray-900">{formatDateHeader()}</div>
        </div>

        {/* Stylist Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Filter by stylist:</label>
          <select
            value={selectedStylist || ''}
            onChange={(e) => setSelectedStylist(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stylists</option>
            {stylists.map((stylist: Stylist) => (
              <option key={stylist.id} value={stylist.id}>
                {stylist.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'day' && (
        <DayView
          appointments={appointments}
          getStylistName={getStylistName}
          getServiceName={getServiceName}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {viewMode === 'week' && (
        <WeekView
          appointments={appointments}
          startDate={startDate}
          getStylistName={getStylistName}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {viewMode === 'month' && (
        <MonthView
          appointments={appointments}
          currentDate={currentDate}
          getStylistName={getStylistName}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          service={getService(selectedAppointment.service_id)}
          getStylistName={getStylistName}
          getServiceName={getServiceName}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
          onUpdate={(data) => updateMutation.mutate({ id: selectedAppointment.id, data })}
          isUpdating={updateMutation.isPending}
        />
      )}

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Status Legend</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${STATUS_COLORS[key as keyof typeof STATUS_COLORS]}`} />
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Day View Component
function DayView({
  appointments,
  getStylistName,
  getServiceName,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  getStylistName: (id: number) => string;
  getServiceName: (id: number) => string;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[80px_1fr]">
        {/* Time column */}
        <div className="border-r border-gray-200">
          <div className="h-12 border-b border-gray-200 bg-gray-50" />
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-20 border-b border-gray-200 px-2 py-1 text-xs text-gray-600"
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Appointments column */}
        <div className="relative">
          <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center px-4 font-medium">
            Appointments
          </div>
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="h-20 border-b border-gray-200" />
            ))}
            {appointments.map((appointment) => {
              const [hours, minutes] = appointment.start_time.split(':').map(Number);
              const topOffset = (hours - 7) * 80 + (minutes / 60) * 80;
              const [endHours, endMinutes] = appointment.end_time.split(':').map(Number);
              const duration = (endHours * 60 + endMinutes - (hours * 60 + minutes)) / 60;
              const height = duration * 80;

              return (
                <button
                  key={appointment.id}
                  onClick={() => onAppointmentClick(appointment)}
                  className={`absolute left-1 right-1 border-l-4 rounded p-2 text-left overflow-hidden ${
                    STATUS_COLORS[appointment.status]
                  }`}
                  style={{
                    top: `${topOffset + 48}px`,
                    height: `${height}px`,
                    minHeight: '40px',
                  }}
                >
                  <div className="text-sm font-medium truncate">
                    {getServiceName(appointment.service_id)}
                  </div>
                  <div className="text-xs truncate">{getStylistName(appointment.stylist_id)}</div>
                  <div className="text-xs">
                    {appointment.start_time} - {appointment.end_time}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Week View Component
function WeekView({
  appointments,
  startDate,
  getStylistName,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  startDate: Date;
  getStylistName: (id: number) => string;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <div className="grid grid-cols-8 min-w-[800px]">
        {/* Header */}
        <div className="border-r border-b border-gray-200 bg-gray-50 p-2" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="border-r border-b border-gray-200 bg-gray-50 p-2 text-center"
          >
            <div className="text-xs text-gray-600">
              {day.toLocaleDateString('en-ZA', { weekday: 'short' })}
            </div>
            <div className="text-lg font-semibold">{day.getDate()}</div>
          </div>
        ))}

        {/* Content */}
        {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => (
          <React.Fragment key={hour}>
            <div className="border-r border-b border-gray-200 px-2 py-1 text-xs text-gray-600">
              {hour.toString().padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const dayAppointments = appointments.filter(
                (apt) => apt.appointment_date === day.toISOString().split('T')[0]
              );
              const hourAppointments = dayAppointments.filter((apt) => {
                const [h] = apt.start_time.split(':').map(Number);
                return h === hour;
              });

              return (
                <div key={day.toISOString()} className="border-r border-b border-gray-200 p-1">
                  {hourAppointments.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className={`w-full text-left text-xs p-1 mb-1 rounded border-l-2 ${
                        STATUS_COLORS[apt.status]
                      }`}
                    >
                      <div className="font-medium truncate">
                        {apt.start_time.slice(0, 5)}
                      </div>
                      <div className="truncate">{getStylistName(apt.stylist_id)}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Month View Component
function MonthView({
  appointments,
  currentDate,
  getStylistName,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  currentDate: Date;
  getStylistName: (id: number) => string;
  onAppointmentClick: (appointment: Appointment) => void;
}) {
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="border-r border-b border-gray-200 bg-gray-50 p-2 text-center text-sm font-medium"
          >
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          if (!day) {
            return (
              <div key={`empty-${index}`} className="border-r border-b border-gray-200 p-2 min-h-24 bg-gray-50" />
            );
          }

          const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
            .toString()
            .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          const dayAppointments = appointments.filter((apt) => apt.appointment_date === dateStr);

          return (
            <div
              key={day}
              className="border-r border-b border-gray-200 p-2 min-h-24 relative"
            >
              <div className="text-sm font-medium mb-1">{day}</div>
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => onAppointmentClick(apt)}
                    className={`w-full text-left text-xs p-1 rounded border-l-2 truncate ${
                      STATUS_COLORS[apt.status]
                    }`}
                  >
                    {apt.start_time.slice(0, 5)} {getStylistName(apt.stylist_id)}
                  </button>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-xs text-gray-500">+{dayAppointments.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Appointment Details Modal
function AppointmentDetailsModal({
  appointment,
  service,
  getStylistName,
  getServiceName,
  onClose,
  onUpdate,
  isUpdating,
}: {
  appointment: Appointment;
  service: BeautyService | null;
  getStylistName: (id: number) => string;
  getServiceName: (id: number) => string;
  onClose: () => void;
  onUpdate: (data: { status?: Appointment['status']; staff_notes?: string }) => void;
  isUpdating: boolean;
}) {
  const [status, setStatus] = useState(appointment.status);
  const [staffNotes, setStaffNotes] = useState(appointment.staff_notes || '');

  const handleSave = () => {
    onUpdate({ status, staff_notes: staffNotes });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Appointment Details</h2>
          <button onClick={onClose} className="p-1 text-gray-600 hover:text-gray-900">
            <FiX size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <div className="text-gray-900">{getServiceName(appointment.service_id)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stylist</label>
              <div className="text-gray-900">{getStylistName(appointment.stylist_id)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="text-gray-900">{appointment.appointment_date}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <div className="text-gray-900">
                {appointment.start_time} - {appointment.end_time}
              </div>
            </div>
          </div>

          {appointment.customer_notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Notes
              </label>
              <div className="p-3 bg-gray-50 rounded-lg text-gray-900">
                {appointment.customer_notes}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Notes</label>
            <textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Internal notes about this appointment..."
            />
          </div>

          {service && service.points_multiplier > 0 && status === 'completed' && appointment.status !== 'completed' && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-medium text-purple-900">Loyalty Points</span>
              </div>
              <p className="text-sm text-purple-700">
                Customer will earn <strong>{service.points_multiplier}x</strong> loyalty points when this appointment is marked as completed!
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
