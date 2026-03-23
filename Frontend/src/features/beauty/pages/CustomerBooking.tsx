import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FiClock,
  FiUser,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiInfo,
} from 'react-icons/fi';
import { beautyApi } from '../../../api/verticals/beauty';
import type { BeautyService, AvailableSlot } from '../types';

interface User {
  id: number;
  name: string;
  email: string;
}

type BookingStep = 'service' | 'date' | 'stylist' | 'confirm';

export default function CustomerBooking() {
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<BeautyService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [bookingComplete, setBookingComplete] = useState(false);

  // Mock current user - in real app, this would come from auth context
  const currentUser: User = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
  };

  // Fetch services
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['beauty-services-public'],
    queryFn: async () => {
      const response = await beautyApi.listServices({ active_only: true });
      return (response.data as BeautyService[]).filter((s) => s.online_booking_enabled);
    },
  });

  // Fetch available slots when service and date are selected
  const { data: availableSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['available-slots', selectedService?.id, selectedDate],
    queryFn: async () => {
      if (!selectedService || !selectedDate) return [];
      const response = await beautyApi.getAvailableSlots({
        service_id: selectedService.id,
        appointment_date: selectedDate,
      });
      return response.data;
    },
    enabled: !!selectedService && !!selectedDate,
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: {
      customer_id: number;
      stylist_id: number;
      service_id: number;
      appointment_date: string;
      start_time: string;
      customer_notes?: string;
    }) => {
      const response = await beautyApi.createAppointment(data);
      return response.data;
    },
    onSuccess: () => {
      setBookingComplete(true);
    },
  });

  const handleServiceSelect = (service: BeautyService) => {
    setSelectedService(service);
    setCurrentStep('date');
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setCurrentStep('stylist');
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setCurrentStep('confirm');
  };

  const handleConfirmBooking = () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;

    createAppointmentMutation.mutate({
      customer_id: currentUser.id,
      stylist_id: selectedSlot.stylist_id,
      service_id: selectedService.id,
      appointment_date: selectedDate,
      start_time: selectedSlot.start_time,
      customer_notes: customerNotes || undefined,
    });
  };

  const handleStartOver = () => {
    setCurrentStep('service');
    setSelectedService(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setCustomerNotes('');
    setBookingComplete(false);
  };

  const handleBack = () => {
    if (currentStep === 'date') {
      setCurrentStep('service');
      setSelectedDate('');
      setSelectedSlot(null);
    } else if (currentStep === 'stylist') {
      setCurrentStep('date');
      setSelectedSlot(null);
    } else if (currentStep === 'confirm') {
      setCurrentStep('stylist');
    }
  };

  const formatPrice = (cents: number) => `R${(cents / 100).toFixed(2)}`;

  if (servicesLoading) {
    return <div className="p-6">Loading services...</div>;
  }

  if (bookingComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <FiCheck className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">
            Your appointment has been successfully booked. You'll receive a confirmation email
            shortly.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium">{selectedSlot?.start_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Stylist:</span>
                <span className="font-medium">{selectedSlot?.stylist_name}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-600">Total:</span>
                <span className="font-bold text-lg">
                  {selectedService && formatPrice(selectedService.price_cents)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleStartOver}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {[
              { key: 'service', label: 'Choose Service' },
              { key: 'date', label: 'Select Date' },
              { key: 'stylist', label: 'Pick Time' },
              { key: 'confirm', label: 'Confirm' },
            ].map((step, index, array) => (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep === step.key
                        ? 'bg-blue-600 text-white'
                        : index <
                          array.findIndex((s) => s.key === currentStep)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {index <
                    array.findIndex((s) => s.key === currentStep) ? (
                      <FiCheck />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="text-xs mt-2 text-gray-600">{step.label}</span>
                </div>
                {index < array.length - 1 && (
                  <div className="w-16 sm:w-24 h-1 mx-2 bg-gray-300 relative top-[-15px]" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Back Button */}
        {currentStep !== 'service' && (
          <button
            onClick={handleBack}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <FiChevronLeft /> Back
          </button>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Step 1: Select Service */}
          {currentStep === 'service' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose a Service</h2>
              
              {services.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  No services available for online booking at the moment.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((service: BeautyService) => (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {service.category}
                        </span>
                      </div>
                      {service.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <div>
                          <div className="text-lg font-bold text-gray-900">
                            {formatPrice(service.price_cents)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {service.duration_minutes} minutes
                          </div>
                        </div>
                        {service.points_multiplier > 1 && (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            {service.points_multiplier}x points
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Date */}
          {currentStep === 'date' && selectedService && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select a Date</h2>
              <p className="text-gray-600 mb-6">
                Booking: {selectedService.name} ({formatPrice(selectedService.price_cents)})
              </p>

              <DatePicker
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                minDate={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          {/* Step 3: Select Time Slot */}
          {currentStep === 'stylist' && selectedService && selectedDate && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a Time</h2>
              <p className="text-gray-600 mb-6">
                {selectedService.name} on{' '}
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-ZA', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>

              {slotsLoading ? (
                <div className="text-center py-12 text-gray-600">Loading available times...</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">
                    No available time slots for this date. Please try another date.
                  </p>
                  <button
                    onClick={() => setCurrentStep('date')}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Choose Different Date
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {availableSlots.map((slot: AvailableSlot, index: number) => (
                    <button
                      key={index}
                      onClick={() => handleSlotSelect(slot)}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FiClock className="text-blue-600" />
                        <span className="font-semibold text-gray-900">
                          {slot.start_time} - {slot.end_time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FiUser size={14} />
                        <span>{slot.stylist_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirm Booking */}
          {currentStep === 'confirm' && selectedService && selectedDate && selectedSlot && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Confirm Your Booking</h2>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Appointment Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service:</span>
                    <span className="font-medium text-gray-900">{selectedService.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-900">
                      {selectedService.duration_minutes} minutes
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-ZA', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium text-gray-900">
                      {selectedSlot.start_time} - {selectedSlot.end_time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stylist:</span>
                    <span className="font-medium text-gray-900">{selectedSlot.stylist_name}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-gray-600 font-medium">Total Price:</span>
                    <span className="font-bold text-xl text-gray-900">
                      {formatPrice(selectedService.price_cents)}
                    </span>
                  </div>
                  {selectedService.points_multiplier > 1 && (
                    <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                      <FiInfo className="text-purple-600" />
                      <span className="text-sm text-purple-900">
                        Earn {selectedService.points_multiplier}x loyalty points with this service!
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requests (Optional)
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any special requests or notes for your appointment..."
                />
              </div>

              {createAppointmentMutation.isError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {createAppointmentMutation.error?.message || 'Failed to book appointment'}
                </div>
              )}

              <button
                onClick={handleConfirmBooking}
                disabled={createAppointmentMutation.isPending}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createAppointmentMutation.isPending ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Date Picker Component
function DatePicker({
  selectedDate,
  onDateSelect,
  minDate,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  minDate: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const minDateObj = new Date(minDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date < minDateObj;
  };

  const formatDateStr = (day: number) => {
    return `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
          type="button"
        >
          <FiChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
          type="button"
        >
          <FiChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-sm font-medium text-gray-600 py-2">
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />;
          }

          const dateStr = formatDateStr(day);
          const isDisabled = isDateDisabled(day);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={day}
              type="button"
              onClick={() => !isDisabled && onDateSelect(dateStr)}
              disabled={isDisabled}
              className={`aspect-square rounded-lg text-sm font-medium ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'hover:bg-blue-100 text-gray-900'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
