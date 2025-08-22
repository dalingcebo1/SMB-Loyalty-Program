import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeSlot {
  time: string;
  available: boolean;
  capacity: number;
  booked: number;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
  capacity: number;
  booked: number;
}

interface DateTimePickerProps {
  selectedDate?: string;
  selectedTime?: string;
  onDateTimeChange: (date: string, time: string) => void;
  className?: string;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  selectedDate,
  selectedTime,
  onDateTimeChange,
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedDateAvailability, setSelectedDateAvailability] = useState<DayAvailability | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate mock availability data (replace with API call)
  const generateMockAvailability = (startDate: Date, days: number = 14): DayAvailability[] => {
    const data: DayAvailability[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Skip past dates
      if (date < new Date(new Date().setHours(0, 0, 0, 0))) continue;
      
      const dateStr = date.toISOString().split('T')[0];
      const slots: TimeSlot[] = [];
      
      // Generate time slots from 8 AM to 6 PM
      for (let hour = 8; hour < 18; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const capacity = 5; // Max 5 bookings per slot
          const booked = Math.floor(Math.random() * 6); // Random bookings 0-5
          
          slots.push({
            time: timeStr,
            available: booked < capacity,
            capacity,
            booked
          });
        }
      }
      
      const totalBooked = slots.reduce((sum, slot) => sum + slot.booked, 0);
      const totalCapacity = slots.length * 5;
      
      data.push({
        date: dateStr,
        slots,
        capacity: totalCapacity,
        booked: totalBooked
      });
    }
    
    return data;
  };

  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const mockData = generateMockAvailability(startOfMonth, 42);
      setAvailability(mockData);
      setLoading(false);
    }, 300);
  }, [currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      const dayData = availability.find(day => day.date === selectedDate);
      setSelectedDateAvailability(dayData || null);
    }
  }, [selectedDate, availability]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getAvailabilityColor = (utilization: number) => {
    if (utilization < 0.3) return 'bg-green-200 text-green-800';
    if (utilization < 0.6) return 'bg-yellow-200 text-yellow-800';
    if (utilization < 0.9) return 'bg-orange-200 text-orange-800';
    return 'bg-red-200 text-red-800';
  };

  const getTimeSlotColor = (slot: TimeSlot) => {
    if (!slot.available) return 'bg-gray-200 text-gray-400 cursor-not-allowed';
    const utilization = slot.booked / slot.capacity;
    if (utilization < 0.5) return 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer';
    if (utilization < 0.8) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer';
    return 'bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer';
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Select Date & Time</h3>
        <p className="text-sm text-gray-600">
          Choose your preferred date and time slot. Colors indicate availability.
        </p>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          ←
        </button>
        <h4 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h4>
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
            {day}
          </div>
        ))}
        
        {loading ? (
          // Loading skeleton
          Array.from({ length: 42 }).map((_, index) => (
            <div key={index} className="aspect-square bg-gray-100 rounded animate-pulse" />
          ))
        ) : (
          days.map((day, index) => {
            const dateStr = day.toISOString().split('T')[0];
            const dayData = availability.find(d => d.date === dateStr);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isPast = dateStr < today;
            const isSelected = selectedDate === dateStr;
            const utilization = dayData ? dayData.booked / dayData.capacity : 0;

            return (
              <motion.button
                key={index}
                whileHover={!isPast && isCurrentMonth ? { scale: 1.05 } : {}}
                whileTap={!isPast && isCurrentMonth ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (!isPast && isCurrentMonth && dayData) {
                    onDateTimeChange(dateStr, '');
                  }
                }}
                disabled={isPast || !isCurrentMonth || !dayData}
                className={`
                  aspect-square p-1 rounded text-sm font-medium transition-all
                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                  ${isPast ? 'text-gray-400 cursor-not-allowed' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500' : ''}
                  ${dayData && isCurrentMonth && !isPast ? getAvailabilityColor(utilization) : 'hover:bg-gray-100'}
                  ${!dayData && isCurrentMonth && !isPast ? 'bg-gray-100 text-gray-400' : ''}
                `}
              >
                <div className="w-full h-full flex items-center justify-center">
                  {day.getDate()}
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Availability Legend */}
      <div className="flex items-center justify-center gap-4 text-xs mb-6">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-200 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-200 rounded"></div>
          <span>Busy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-200 rounded"></div>
          <span>Almost Full</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-200 rounded"></div>
          <span>Full</span>
        </div>
      </div>

      {/* Time Slots */}
      <AnimatePresence>
        {selectedDateAvailability && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t pt-6"
          >
            <h4 className="font-semibold text-gray-800 mb-3">
              Available Times for {new Date(selectedDate!).toLocaleDateString()}
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {selectedDateAvailability.slots.map((slot, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  whileHover={slot.available ? { scale: 1.05 } : {}}
                  whileTap={slot.available ? { scale: 0.95 } : {}}
                  onClick={() => {
                    if (slot.available) {
                      onDateTimeChange(selectedDate!, slot.time);
                    }
                  }}
                  disabled={!slot.available}
                  className={`
                    p-2 rounded text-xs font-medium transition-all
                    ${selectedTime === slot.time ? 'ring-2 ring-blue-500' : ''}
                    ${getTimeSlotColor(slot)}
                  `}
                >
                  <div>{slot.time}</div>
                  <div className="text-xs opacity-75">
                    {slot.capacity - slot.booked} left
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateTimePicker;
