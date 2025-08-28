import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { track } from '../utils/analytics';
import './CalendarModal.css';

interface CalendarModalProps {
  isVisible: boolean;
  onClose: () => void;
  orderDetails: {
    orderId: string;
    serviceName: string;
    scheduledDate?: string;
    scheduledTime?: string;
    estimatedDuration?: number;
  };
}

const CalendarModal: React.FC<CalendarModalProps> = ({
  isVisible,
  onClose,
  orderDetails
}) => {
  const { orderId, serviceName, scheduledDate, scheduledTime, estimatedDuration } = orderDetails;

  const generateCalendarEvent = () => {
    try {
      if (!scheduledDate || !scheduledTime) {
        toast.error('Scheduling information is not available for this order. Please contact support to add this to your calendar.');
        return;
      }

      const startDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const durationMinutes = estimatedDuration || 30;
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatICS = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
      
      const uid = `${orderId}@smb-loyalty`;
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SMB Loyalty//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICS(new Date())}`,
        `DTSTART:${formatICS(startDateTime)}`,
        `DTEND:${formatICS(endDateTime)}`,
        `SUMMARY:Car Wash - ${serviceName}`,
        `DESCRIPTION:Order ${orderId} at SMB Car Wash. Show QR/PIN on arrival.`,
        'END:VEVENT',
        'END:VCALENDAR'
      ];
      
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `car-wash-${orderId}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      track('cta_click', { label: 'Download Calendar Event', page: 'OrderConfirmation' });
      toast.success('Calendar event downloaded successfully!');
      onClose();
    } catch {
      toast.error('Could not create calendar event');
    }
  };

  const generateGoogleCalendarUrl = () => {
    if (!scheduledDate || !scheduledTime) {
      toast.error('Scheduling information is not available for this order. Please contact support to add this to your calendar.');
      return;
    }

    const startDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const durationMinutes = estimatedDuration || 30;
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Car Wash - ${serviceName}`,
      dates: `${formatGoogleDate(startDateTime)}/${formatGoogleDate(endDateTime)}`,
      details: `Order ${orderId} at SMB Car Wash. Show QR/PIN on arrival.`,
      location: 'SMB Car Wash'
    });
    
    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
    window.open(url, '_blank');
    
    track('cta_click', { label: 'Add to Google Calendar', page: 'OrderConfirmation' });
    onClose();
  };

  const generateOutlookUrl = () => {
    if (!scheduledDate || !scheduledTime) {
      toast.error('Scheduling information is not available for this order. Please contact support to add this to your calendar.');
      return;
    }

    const startDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const durationMinutes = estimatedDuration || 30;
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    
    const params = new URLSearchParams({
      subject: `Car Wash - ${serviceName}`,
      startdt: startDateTime.toISOString(),
      enddt: endDateTime.toISOString(),
      body: `Order ${orderId} at SMB Car Wash. Show QR/PIN on arrival.`,
      location: 'SMB Car Wash'
    });
    
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    window.open(url, '_blank');
    
    track('cta_click', { label: 'Add to Outlook Calendar', page: 'OrderConfirmation' });
    onClose();
  };

  if (!scheduledDate || !scheduledTime) {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="calendar-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="calendar-modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="calendar-modal-header">
                <h3>📅 Add to Your Calendar</h3>
                <button 
                  className="calendar-modal-close"
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              
              <div className="calendar-modal-body">
                <div className="calendar-event-details">
                  <h4>{serviceName}</h4>
                  <p className="calendar-info">
                    ℹ️ Scheduling information is not available for this order.
                  </p>
                  <p className="calendar-contact">
                    Please contact our support team to schedule your appointment and add it to your calendar.
                  </p>
                </div>
              </div>
              
              <div className="calendar-modal-footer">
                <button 
                  className="calendar-modal-cancel"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="calendar-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="calendar-modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calendar-modal-header">
              <h3>📅 Add to Your Calendar</h3>
              <button 
                className="calendar-modal-close"
                onClick={onClose}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            
            <div className="calendar-modal-body">
              <div className="calendar-event-details">
                <h4>{serviceName}</h4>
                <p className="calendar-date">
                  📅 {new Date(scheduledDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
                <p className="calendar-time">
                  🕐 {scheduledTime} ({estimatedDuration || 30} minutes)
                </p>
                <p className="calendar-location">📍 SMB Car Wash</p>
              </div>
              
              <div className="calendar-options">
                <button 
                  className="calendar-option-button google-calendar"
                  onClick={generateGoogleCalendarUrl}
                >
                  📅 Google Calendar
                </button>
                
                <button 
                  className="calendar-option-button outlook-calendar"
                  onClick={generateOutlookUrl}
                >
                  📅 Outlook Calendar
                </button>
                
                <button 
                  className="calendar-option-button download-calendar"
                  onClick={generateCalendarEvent}
                >
                  💾 Download .ics file
                </button>
              </div>
            </div>
            
            <div className="calendar-modal-footer">
              <button 
                className="calendar-modal-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CalendarModal;
