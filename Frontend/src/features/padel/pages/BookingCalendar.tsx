import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaCheck,
  FaTimes,
  FaEye,
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaShoppingCart,
  FaCoins,
} from 'react-icons/fa';
import api from '../../../api/api';
import { useTenant } from '../../../config/TenantConfigProvider';
import { formatCents, formatDate } from '../../../utils/format';

interface Court {
  id: number;
  court_number: string;
  court_type: string;
  active: boolean;
}

interface Booking {
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
  equipment_rentals: Array<{
    equipment_id: number;
    equipment_name: string;
    quantity: number;
    price_cents: number;
  }>;
}

type ViewMode = 'day' | 'week' | 'month';

const STATUS_COLORS: Record<Booking['status'], { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  in_progress: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
  completed: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  no_show: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
};

const STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export default function BookingCalendar() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedCourt, setSelectedCourt] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [staffNotes, setStaffNotes] = useState('');

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'day') {
      // Single day
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
      };
    } else if (viewMode === 'week') {
      // Start of week (Monday)
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
      };
    } else {
      // Month
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
      };
    }
  }, [currentDate, viewMode]);

  // Fetch courts
  const { data: courts = [] } = useQuery({
    queryKey: ['padel', 'courts', tenantId],
    queryFn: async () => {
      const response = await api.get('/api/padel/courts');
      return response.data as Court[];
    },
    enabled: !!tenantId,
  });

  // Fetch bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['padel', 'bookings', tenantId, dateRange, selectedCourt, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        from_date: dateRange.from,
        to_date: dateRange.to,
      });
      if (selectedCourt) {
        params.append('court_id', selectedCourt.toString());
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      const response = await api.get(`/api/padel/bookings?${params.toString()}`);
      return response.data as Booking[];
    },
    enabled: !!tenantId && !!dateRange.from && !!dateRange.to,
  });

  // Update booking mutation
  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Booking> }) =>
      api.put(`/api/padel/bookings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'bookings'] });
      setShowDetails(false);
      setSelectedBooking(null);
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

  const handleStatusChange = (bookingId: number, newStatus: Booking['status']) => {
    updateBookingMutation.mutate({
      id: bookingId,
      data: { status: newStatus },
    });
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setStaffNotes(booking.staff_notes || '');
    setShowDetails(true);
  };

  const handleSaveNotes = () => {
    if (selectedBooking) {
      updateBookingMutation.mutate({
        id: selectedBooking.id,
        data: { staff_notes: staffNotes },
      });
    }
  };

  const handleMarkPaid = (bookingId: number) => {
    updateBookingMutation.mutate({
      id: bookingId,
      data: { paid: true },
    });
  };

  // Group bookings by date and time
  const groupedBookings = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    bookings.forEach((booking) => {
      const key = `${booking.booking_date}_${booking.start_time}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(booking);
    });
    return groups;
  }, [bookings]);

  // Generate time slots for day/week view (6 AM - 11 PM, 30-min intervals)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 6; hour < 23; hour++) {
      for (let minute of [0, 30]) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  // Generate dates for week view
  const weekDates = useMemo(() => {
    if (viewMode !== 'week') return [];
    const dates: Date[] = [];
    const start = new Date(dateRange.from);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [viewMode, dateRange]);

  const getDateLabel = () => {
    if (viewMode === 'day') {
      return formatDate(currentDate.toISOString().split('T')[0]);
    } else if (viewMode === 'week') {
      const start = new Date(dateRange.from);
      const end = new Date(dateRange.to);
      return `${formatDate(start.toISOString().split('T')[0])} - ${formatDate(end.toISOString().split('T')[0])}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const calculateLoyaltyPoints = (totalCents: number) => {
    return Math.floor(totalCents / 1000); // 1 point per R10
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Booking Calendar</h1>
          <p className="text-gray-600 text-sm mt-1">Manage court bookings and schedules</p>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="text-gray-500" />
          <span className="font-semibold text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Court</label>
            <select
              value={selectedCourt || ''}
              onChange={(e) => setSelectedCourt(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courts</option>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  Court {court.court_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedCourt(null);
                setSelectedStatus('all');
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">{getDateLabel()}</h2>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={handleNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode === 'month' ? (
        // Month View - List of bookings grouped by date
        <div className="bg-white rounded-lg shadow">
          {bookings.length === 0 ? (
            <div className="text-center py-12">
              <FaCalendarAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No bookings found for this period</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {Object.entries(
                bookings.reduce((acc, booking) => {
                  const date = booking.booking_date;
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(booking);
                  return acc;
                }, {} as Record<string, Booking[]>)
              )
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, dayBookings]) => (
                  <div key={date} className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">{formatDate(date)}</h3>
                    <div className="space-y-2">
                      {dayBookings
                        .sort((a, b) => a.start_time.localeCompare(b.start_time))
                        .map((booking) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            onViewDetails={handleViewDetails}
                            onStatusChange={handleStatusChange}
                            onMarkPaid={handleMarkPaid}
                          />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : viewMode === 'week' ? (
        // Week View - Grid with days and times
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header Row */}
            <div className="grid grid-cols-8 border-b border-gray-200">
              <div className="p-2 bg-gray-50 font-medium text-gray-700 text-sm">Time</div>
              {weekDates.map((date) => (
                <div key={date.toISOString()} className="p-2 bg-gray-50 text-center border-l border-gray-200">
                  <div className="font-medium text-gray-700 text-sm">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-xs text-gray-500">{date.getDate()}</div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-8 border-b border-gray-200">
                <div className="p-2 bg-gray-50 text-xs text-gray-600">{time}</div>
                {weekDates.map((date) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const key = `${dateStr}_${time}`;
                  const slotBookings = groupedBookings[key] || [];

                  return (
                    <div key={dateStr} className="p-1 border-l border-gray-200 min-h-[60px]">
                      {slotBookings.map((booking) => (
                        <button
                          key={booking.id}
                          onClick={() => handleViewDetails(booking)}
                          className={`w-full text-left p-1 rounded text-xs mb-1 ${
                            STATUS_COLORS[booking.status].bg
                          } ${STATUS_COLORS[booking.status].border} border hover:shadow-md transition-shadow`}
                        >
                          <div className="font-medium truncate">Court {booking.court_number}</div>
                          <div className="text-gray-600 truncate">{booking.duration_minutes}min</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Day View - Timeline with courts
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header Row */}
            <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: '100px repeat(auto-fit, minmax(150px, 1fr))' }}>
              <div className="p-2 bg-gray-50 font-medium text-gray-700 text-sm">Time</div>
              {courts
                .filter((c) => !selectedCourt || c.id === selectedCourt)
                .map((court) => (
                  <div key={court.id} className="p-2 bg-gray-50 text-center border-l border-gray-200">
                    <div className="font-medium text-gray-700 text-sm">Court {court.court_number}</div>
                    <div className="text-xs text-gray-500 capitalize">{court.court_type}</div>
                  </div>
                ))}
            </div>

            {/* Time Slots */}
            {timeSlots.map((time) => (
              <div key={time} className="grid border-b border-gray-200" style={{ gridTemplateColumns: '100px repeat(auto-fit, minmax(150px, 1fr))' }}>
                <div className="p-2 bg-gray-50 text-xs text-gray-600">{time}</div>
                {courts
                  .filter((c) => !selectedCourt || c.id === selectedCourt)
                  .map((court) => {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const key = `${dateStr}_${time}`;
                    const slotBookings = (groupedBookings[key] || []).filter(
                      (b) => b.court_id === court.id
                    );

                    return (
                      <div key={court.id} className="p-1 border-l border-gray-200 min-h-[60px]">
                        {slotBookings.map((booking) => (
                          <button
                            key={booking.id}
                            onClick={() => handleViewDetails(booking)}
                            className={`w-full text-left p-2 rounded text-xs ${
                              STATUS_COLORS[booking.status].bg
                            } ${STATUS_COLORS[booking.status].border} border hover:shadow-md transition-shadow`}
                          >
                            <div className="font-medium">{booking.duration_minutes}min</div>
                            <div className="text-gray-600">{booking.player_count} players</div>
                            {!booking.paid && (
                              <div className="text-red-600 font-semibold">Unpaid</div>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-700 mb-3">Status Legend</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded border-2 ${
                  STATUS_COLORS[status as Booking['status']].bg
                } ${STATUS_COLORS[status as Booking['status']].border}`}
              />
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Details Modal */}
      {showDetails && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">Booking Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    STATUS_COLORS[selectedBooking.status].bg
                  } ${STATUS_COLORS[selectedBooking.status].text}`}
                >
                  {STATUS_LABELS[selectedBooking.status]}
                </span>
                {!selectedBooking.paid && (
                  <span className="px-4 py-2 rounded-lg font-semibold bg-red-100 text-red-700">
                    Unpaid
                  </span>
                )}
              </div>

              {/* Booking Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-gray-800 font-semibold">
                    {formatDate(selectedBooking.booking_date)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Court</label>
                  <p className="text-gray-800 font-semibold">Court {selectedBooking.court_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Time</label>
                  <p className="text-gray-800 font-semibold">
                    {selectedBooking.start_time} - {selectedBooking.end_time}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duration</label>
                  <p className="text-gray-800 font-semibold">{selectedBooking.duration_minutes} minutes</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Players</label>
                  <p className="text-gray-800 font-semibold">{selectedBooking.player_count}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Method</label>
                  <p className="text-gray-800 font-semibold capitalize">
                    {selectedBooking.payment_method || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Player Names */}
              {selectedBooking.player_names && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Player Names</label>
                  <p className="text-gray-800">{selectedBooking.player_names}</p>
                </div>
              )}

              {/* Pricing Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Pricing</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Court Fee</span>
                    <span className="font-semibold">{formatCents(selectedBooking.court_price_cents)}</span>
                  </div>
                  {selectedBooking.equipment_price_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Equipment Rental</span>
                      <span className="font-semibold">
                        {formatCents(selectedBooking.equipment_price_cents)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 flex justify-between">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCents(selectedBooking.total_price_cents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Equipment Rentals */}
              {selectedBooking.equipment_rentals.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FaShoppingCart className="w-4 h-4" />
                    Equipment Rentals
                  </h3>
                  <div className="space-y-2">
                    {selectedBooking.equipment_rentals.map((rental, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-800">{rental.equipment_name}</div>
                          <div className="text-sm text-gray-600">Quantity: {rental.quantity}</div>
                        </div>
                        <div className="font-semibold text-gray-800">
                          {formatCents(rental.price_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loyalty Points */}
              {selectedBooking.status === 'completed' && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FaCoins className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Loyalty Points Earned</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {calculateLoyaltyPoints(selectedBooking.total_price_cents)} points
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Customer earned 1 point per R10 spent
                  </p>
                </div>
              )}

              {/* Customer Notes */}
              {selectedBooking.customer_notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Customer Notes</label>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded-lg mt-1">
                    {selectedBooking.customer_notes}
                  </p>
                </div>
              )}

              {/* Staff Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Staff Notes</label>
                <textarea
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add internal notes about this booking..."
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={updateBookingMutation.isPending}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Save Notes
                </button>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedBooking.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'confirmed')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FaCheck className="w-4 h-4" />
                      Confirm Booking
                    </button>
                  )}
                  {selectedBooking.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'in_progress')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <FaClock className="w-4 h-4" />
                      Mark In Progress
                    </button>
                  )}
                  {selectedBooking.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'completed')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <FaCheck className="w-4 h-4" />
                      Mark Completed
                    </button>
                  )}
                  {!selectedBooking.paid &&
                    ['pending', 'confirmed', 'in_progress'].includes(selectedBooking.status) && (
                      <button
                        onClick={() => handleMarkPaid(selectedBooking.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <FaCheck className="w-4 h-4" />
                        Mark as Paid
                      </button>
                    )}
                  {['pending', 'confirmed'].includes(selectedBooking.status) && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'cancelled')}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                      Cancel Booking
                    </button>
                  )}
                  {selectedBooking.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'no_show')}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                      Mark No Show
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Booking Card Component for Month View
interface BookingCardProps {
  booking: Booking;
  onViewDetails: (booking: Booking) => void;
  onStatusChange: (id: number, status: Booking['status']) => void;
  onMarkPaid: (id: number) => void;
}

function BookingCard({ booking, onViewDetails, onStatusChange, onMarkPaid }: BookingCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border-2 ${STATUS_COLORS[booking.status].bg} ${
        STATUS_COLORS[booking.status].border
      } hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-gray-800">Court {booking.court_number}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[booking.status].bg} ${
                STATUS_COLORS[booking.status].text
              }`}
            >
              {STATUS_LABELS[booking.status]}
            </span>
            {!booking.paid && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Unpaid</span>
            )}
          </div>
          <div className="text-sm text-gray-600 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <FaClock className="w-3 h-3" />
              {booking.start_time} - {booking.end_time}
            </span>
            <span className="flex items-center gap-1">
              <FaUsers className="w-3 h-3" />
              {booking.player_count} players
            </span>
          </div>
          {booking.player_names && (
            <div className="text-xs text-gray-500 mt-1 truncate">{booking.player_names}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold text-blue-600">{formatCents(booking.total_price_cents)}</div>
          {booking.equipment_rentals.length > 0 && (
            <div className="text-xs text-gray-500">
              <FaShoppingCart className="inline w-3 h-3 mr-1" />
              {booking.equipment_rentals.length} items
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onViewDetails(booking)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
        >
          <FaEye className="w-3 h-3" />
          Details
        </button>
        {booking.status === 'pending' && (
          <button
            onClick={() => onStatusChange(booking.id, 'confirmed')}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Confirm
          </button>
        )}
        {booking.status === 'in_progress' && (
          <button
            onClick={() => onStatusChange(booking.id, 'completed')}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Complete
          </button>
        )}
        {!booking.paid && ['pending', 'confirmed', 'in_progress'].includes(booking.status) && (
          <button
            onClick={() => onMarkPaid(booking.id)}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Paid
          </button>
        )}
      </div>
    </div>
  );
}
