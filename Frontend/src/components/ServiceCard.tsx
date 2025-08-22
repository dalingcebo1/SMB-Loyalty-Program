import React from 'react';
import { motion } from 'framer-motion';

interface Service {
  id: number;
  name: string;
  base_price: number;
  description?: string;
  duration?: number;
  loyalty_points?: number;
}

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  onSelect: (service: Service) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  isSelected,
  onSelect,
  quantity,
  onQuantityChange
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      }`}
      onClick={() => onSelect(service)}
    >
      {/* Service Icon/Image placeholder */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-800 mb-1">
            {service.name}
          </h3>
          {service.description && (
            <p className="text-gray-600 text-sm mb-2">
              {service.description}
            </p>
          )}
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold text-blue-600">
              R{service.base_price}
            </div>
            {service.duration && (
              <div className="text-sm text-gray-500">
                ~{service.duration} min
              </div>
            )}
          </div>
          {service.loyalty_points && (
            <div className="text-sm text-green-600 mt-1">
              +{service.loyalty_points} loyalty points
            </div>
          )}
        </div>
        
        {/* Selection indicator */}
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
        }`}>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-3 h-3 bg-white rounded-full"
            />
          )}
        </div>
      </div>

      {/* Quantity selector - only show when selected */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-blue-200 pt-3 mt-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Quantity:</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuantityChange(Math.max(1, quantity - 1));
                  }}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 font-medium"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuantityChange(quantity + 1);
                  }}
                  className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white font-medium"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ServiceCard;
