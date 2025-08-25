import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ServiceCard.css';

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
      className={`service-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(service)}
    >
      {/* Service Header */}
      <div className="service-card-header">
        <h3>{service.name}</h3>
        <div className="service-radio" />
      </div>

      {/* Service Description */}
      {service.description && (
        <p className="service-description">
          {service.description}
        </p>
      )}

      {/* Service Details */}
      <div className="service-details">
        <div className="service-price">
          <span className="currency">R</span>
          <span className="amount">{service.base_price}</span>
        </div>
        {service.duration && (
          <div className="service-duration">
            ~{service.duration} min
          </div>
        )}
      </div>

      {/* Loyalty Points */}
      {service.loyalty_points && (
        <div className="service-loyalty">
          ⭐ +{service.loyalty_points} points
        </div>
      )}

      {/* Quantity Selection */}
      {isSelected && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="quantity-section"
          >
            <span className="quantity-label">Quantity:</span>
            <div className="quantity-controls">
              <button
                className="quantity-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityChange(Math.max(1, quantity - 1));
                }}
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="quantity-display">{quantity}</span>
              <button
                className="quantity-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityChange(quantity + 1);
                }}
              >
                +
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
};

export default ServiceCard;
