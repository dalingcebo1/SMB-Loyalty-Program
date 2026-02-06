import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import api from '../../../api/api';
import { useTenant } from '../../../config/TenantConfigProvider';
import { useAuth } from '../../../auth/AuthProvider';
import { formatCents, formatDate } from '../../../utils/format';

interface Equipment {
  id: number;
  name: string;
  equipment_type: string;
  description?: string;
  quantity_available: number;
  rental_price_cents: number;
  active: boolean;
}

interface AvailableSlot {
  court_id: number;
  court_number: string;
  start_time: string;
  duration_minutes: number;
  price_cents: number;
}

interface EquipmentRental {
  equipment_id: number;
  quantity: number;
}

interface BookingData {
  customer_id: number;
  court_id: number;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  player_count: number;
  player_names?: string;
  equipment_rentals: EquipmentRental[];
  customer_notes?: string;
}

const DURATIONS = [
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export default function CustomerBooking() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '', '']);
  const [equipmentRentals, setEquipmentRentals] = useState<Record<number, number>>({});
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Fetch available slots
  const { data: availableSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['padel', 'availability', tenantId, selectedDate, selectedDuration],
    queryFn: async () => {
      const response = await api.post('/api/padel/availability', {
        date: selectedDate,
        duration_minutes: selectedDuration,
      });
      return response.data as AvailableSlot[];
    },
    enabled: !!tenantId && !!selectedDate && !!selectedDuration && step === 2,
  });

  // Fetch equipment
  const { data: equipment = [] } = useQuery({
    queryKey: ['padel', 'equipment', tenantId],
    queryFn: async () => {
      const response = await api.get('/api/padel/equipment');
      return response.data as Equipment[];
    },
    enabled: !!tenantId && step === 3,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: (data: BookingData) => api.post('/api/padel/bookings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['padel', 'bookings'] });
      setStep(5); // Success step
    },
  });

  // Update player names array when count changes
  useEffect(() => {
    const newNames = [...playerNames];
    if (playerCount > playerNames.length) {
      for (let i = playerNames.length; i < playerCount; i++) {
        newNames.push('');
      }
    } else if (playerCount < playerNames.length) {
      newNames.splice(playerCount);
    }
    setPlayerNames(newNames);
  }, [playerCount]);

  const calculateTotal = () => {
    let total = selectedSlot?.price_cents || 0;
    
    Object.entries(equipmentRentals).forEach(([id, quantity]) => {
      const item = equipment.find((e: Equipment) => e.id === parseInt(id));
      if (item && quantity > 0) {
        total += item.rental_price_cents * quantity;
      }
    });
    
    return total;
  };

  const handleSubmitBooking = () => {
    if (!selectedSlot || !user) return;

    const bookingData: BookingData = {
      customer_id: user.id,
      court_id: selectedSlot.court_id,
      booking_date: selectedDate,
      start_time: selectedSlot.start_time,
      duration_minutes: selectedDuration,
      player_count: playerCount,
      player_names: playerNames.filter((n) => n.trim()).join(', '),
      equipment_rentals: Object.entries(equipmentRentals)
        .filter(([, quantity]) => quantity > 0)
        .map(([equipment_id, quantity]) => ({
          equipment_id: parseInt(equipment_id),
          quantity,
        })),
      customer_notes: customerNotes,
    };

    createBookingMutation.mutate(bookingData);
  };

  const handleNext = () => {
    if (step === 1 && selectedDate && selectedDuration) {
      setStep(2);
    } else if (step === 2 && selectedSlot) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const resetBooking = () => {
    setStep(1);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedDuration(60);
    setSelectedSlot(null);
    setPlayerCount(4);
    setPlayerNames(['', '', '', '']);
    setEquipmentRentals({});
    setCustomerNotes('');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Book a Padel Court</h1>
        <p className="text-gray-600">Reserve your court in just a few simple steps</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Date & Time' },
            { num: 2, label: 'Select Court' },
            { num: 3, label: 'Add Equipment' },
            { num: 4, label: 'Review' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                    step > s.num
                      ? 'bg-green-500 text-white'
                      : step === s.num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > s.num ? <FaCheck /> : s.num}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    step >= s.num ? 'text-gray-800' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < 3 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-colors ${
                    step > s.num + 1 ? 'bg-green-500' : step === s.num + 1 ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Choose Date and Duration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaCalendarAlt className="inline mr-2" />
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaClock className="inline mr-2" />
                Select Duration
              </label>
              <div className="grid grid-cols-3 gap-4">
                {DURATIONS.map((duration) => (
                  <button
                    key={duration.value}
                    onClick={() => setSelectedDuration(duration.value)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      selectedDuration === duration.value
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {duration.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaUsers className="inline mr-2" />
                Number of Players
              </label>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setPlayerCount(count)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      playerCount === count
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {count} {count === 1 ? 'Player' : 'Players'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Select Available Court</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <FaCalendarAlt />
              <span>{formatDate(selectedDate)}</span>
              <span>•</span>
              <FaClock />
              <span>{DURATIONS.find((d) => d.value === selectedDuration)?.label}</span>
            </div>

            {loadingSlots ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-20 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No courts available for the selected date and time</p>
                <button
                  onClick={() => setStep(1)}
                  className="text-blue-600 hover:underline"
                >
                  Try different date/time
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {availableSlots.map((slot: AvailableSlot, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedSlot?.court_id === slot.court_id &&
                      selectedSlot?.start_time === slot.start_time
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-gray-800 text-lg">Court {slot.court_number}</div>
                        <div className="text-gray-600 text-sm mt-1">
                          <FaClock className="inline mr-1" />
                          {slot.start_time}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCents(slot.price_cents)}
                        </div>
                        <div className="text-xs text-gray-500">for {selectedDuration} min</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add Equipment Rentals</h2>
            <p className="text-gray-600 text-sm mb-4">Select equipment you'd like to rent (optional)</p>

            {equipment.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No equipment available for rental</p>
            ) : (
              <div className="space-y-4">
                {equipment.map((item: Equipment) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">
                        {formatCents(item.rental_price_cents)} each • {item.quantity_available} available
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setEquipmentRentals({
                            ...equipmentRentals,
                            [item.id]: Math.max(0, (equipmentRentals[item.id] || 0) - 1),
                          })
                        }
                        disabled={!equipmentRentals[item.id] || equipmentRentals[item.id] === 0}
                        className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold">
                        {equipmentRentals[item.id] || 0}
                      </span>
                      <button
                        onClick={() =>
                          setEquipmentRentals({
                            ...equipmentRentals,
                            [item.id]: Math.min(
                              item.quantity_available,
                              (equipmentRentals[item.id] || 0) + 1
                            ),
                          })
                        }
                        disabled={equipmentRentals[item.id] >= item.quantity_available}
                        className="w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Review Your Booking</h2>

            {/* Booking Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-semibold">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-semibold">{selectedSlot?.start_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-semibold">
                  {DURATIONS.find((d) => d.value === selectedDuration)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Court:</span>
                <span className="font-semibold">Court {selectedSlot?.court_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Players:</span>
                <span className="font-semibold">{playerCount}</span>
              </div>
              <div className="border-t border-gray-300 pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Court Fee:</span>
                  <span className="font-semibold">{formatCents(selectedSlot?.price_cents || 0)}</span>
                </div>
              </div>
            </div>

            {/* Player Names */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Player Names (Optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {playerNames.map((name, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const newNames = [...playerNames];
                      newNames[idx] = e.target.value;
                      setPlayerNames(newNames);
                    }}
                    placeholder={`Player ${idx + 1}`}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ))}
              </div>
            </div>

            {/* Equipment Summary */}
            {Object.keys(equipmentRentals).some((id) => equipmentRentals[parseInt(id)] > 0) && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Equipment Rentals</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {Object.entries(equipmentRentals)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([id, quantity]) => {
                      const item = equipment.find((e: Equipment) => e.id === parseInt(id));
                      return (
                        <div key={id} className="flex justify-between">
                          <span className="text-gray-700">
                            {item?.name} x{quantity}
                          </span>
                          <span className="font-semibold">
                            {formatCents((item?.rental_price_cents || 0) * quantity)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Any special requests or notes..."
              />
            </div>

            {/* Total */}
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">Total Amount:</span>
                <span className="text-3xl font-bold text-blue-600">{formatCents(calculateTotal())}</span>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-6">
              Your court has been reserved. See you on {formatDate(selectedDate)} at {selectedSlot?.start_time}!
            </p>
            <button
              onClick={resetBooking}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Book Another Court
            </button>
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 5 && (
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FaChevronLeft />
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 1 && (!selectedDate || !selectedDuration)) ||
                  (step === 2 && !selectedSlot)
                }
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <FaChevronRight />
              </button>
            ) : (
              <button
                onClick={handleSubmitBooking}
                disabled={createBookingMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <FaCheck />
                Confirm Booking
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
