import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookingConfirmationProps {
  isVisible: boolean;
  onComplete: () => void;
  orderDetails: {
    id: string;
    serviceName: string;
    date: string;
    time: string;
    total: number;
    estimatedDuration?: number;
    bayNumber?: number;
  };
}

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  isVisible,
  onComplete,
  orderDetails
}) => {
  const [animationStage, setAnimationStage] = useState(0);
  const [showAddToCalendar, setShowAddToCalendar] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer1 = setTimeout(() => setAnimationStage(1), 500);
      const timer2 = setTimeout(() => setAnimationStage(2), 1500);
      const timer3 = setTimeout(() => setShowAddToCalendar(true), 2000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      setAnimationStage(0);
      setShowAddToCalendar(false);
    }
  }, [isVisible]);

  const generateCalendarUrl = () => {
    const startDate = new Date(`${orderDetails.date}T${orderDetails.time}`);
    const endDate = new Date(startDate.getTime() + (orderDetails.estimatedDuration || 30) * 60000);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Car Wash - ${orderDetails.serviceName}`,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: `Your car wash appointment at bay ${orderDetails.bayNumber || 'TBD'}. Order ID: ${orderDetails.id}`,
      location: 'Car Wash Facility'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const checkmarkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        pathLength: { duration: 0.5 },
        opacity: { duration: 0.2 }
      }
    }
  };

const containerVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.3
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.8,
    transition: { duration: 0.2 }
  }
};  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onComplete}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success Icon Animation */}
            <div className="relative mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 10 }}
                className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center"
              >
                <svg 
                  width="40" 
                  height="40" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  className="text-green-600"
                >
                  <motion.path
                    variants={checkmarkVariants}
                    initial="hidden"
                    animate={animationStage >= 1 ? "visible" : "hidden"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M20 6L9 17l-5-5"
                  />
                </svg>
              </motion.div>
              
              {/* Confetti effect */}
              {animationStage >= 1 && (
                <>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1, 0],
                        x: Math.cos(i * 30 * Math.PI / 180) * 60,
                        y: Math.sin(i * 30 * Math.PI / 180) * 60,
                      }}
                      transition={{
                        delay: 0.8 + i * 0.05,
                        duration: 0.6,
                        ease: "easeOut"
                      }}
                      className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-500 rounded-full"
                      style={{
                        backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][i % 5]
                      }}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Success Message */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="text-2xl font-bold text-gray-800 mb-2"
            >
              Booking Confirmed!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="text-gray-600 mb-6"
            >
              Your car wash has been successfully scheduled.
            </motion.p>

            {/* Booking Details */}
            <AnimatePresence>
              {animationStage >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-lg p-4 mb-6 text-left"
                >
                  <h3 className="font-semibold text-gray-800 mb-3">Booking Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service:</span>
                      <span className="font-medium">{orderDetails.serviceName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">
                        {new Date(orderDetails.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-medium">{orderDetails.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">R{orderDetails.total}</span>
                    </div>
                    {orderDetails.bayNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bay:</span>
                        <span className="font-medium">#{orderDetails.bayNumber}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next Steps */}
            <AnimatePresence>
              {showAddToCalendar && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Add to Calendar Button */}
                  <motion.a
                    href={generateCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                    </svg>
                    Add to Calendar
                  </motion.a>

                  {/* Continue Button */}
                  <motion.button
                    onClick={onComplete}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Continue
                  </motion.button>

                  {/* Helpful Tips */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-xs text-gray-500 pt-2"
                  >
                    💡 Tip: Arrive 5 minutes early and bring your order confirmation
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BookingConfirmation;
