import React from 'react';
import { UserCard } from './index';
import { Order } from '../../types';
import { FaCar, FaReceipt, FaRedo, FaStar } from 'react-icons/fa';
import { formatCents } from '../../utils/format';

interface OrderCardProps {
  order: Order;
  onViewOrder: (id: string) => void;
  onBookAgain: () => void;
  getOrderSummary: (order: Order) => string;
  formatOrderDate: (dateString: string | undefined) => string;
  getStatusBadge: (status: string | undefined) => string;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onViewOrder, onBookAgain, getOrderSummary, formatOrderDate, getStatusBadge }) => {
  return (
    <UserCard
      as="article"
      className="order-card"
      interactive
      onClick={() => onViewOrder(order.id)}
      role="button"
      tabIndex={0}
      aria-label={`Order from ${formatOrderDate(order.created_at)}, ${getOrderSummary(order)}, ${formatCents(order.amount ?? 0)}`}
      onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewOrder(order.id);
        }
      }}
    >
      <div className="order-header">
        <div className="service-icon" aria-hidden="true">
          <FaCar className="icon" />
        </div>
        <div className="order-info">
          <h3>{getOrderSummary(order)}</h3>
          <div className="order-meta">
            <span className="date">{formatOrderDate(order.created_at)}</span>
            <span className={`badge ${getStatusBadge(order.status)}`}>
              {(order.status || 'pending').toUpperCase()}
            </span>
          </div>
        </div>
        <div className="order-price">
          <span className="currency">Total</span>
          <span>{formatCents(order.amount ?? 0)}</span>
        </div>
      </div>

      <div className="order-details">
        <div className="detail-row">
          <span className="label">Order ID</span>
          <span className="value">#{order.id}</span>
        </div>
        <div className="detail-row">
          <span className="label">Payment Method</span>
          <span className="value">Credit Card</span>
        </div>
        {order.payment_pin && (
          <div className="detail-row">
            <span className="label">PIN</span>
            <span className="value">{order.payment_pin}</span>
          </div>
        )}

        <div className="loyalty-earned">
          <FaStar className="loyalty-icon" aria-hidden="true" />
          <span>+1 visit progress earned</span>
        </div>
      </div>

      <div className="order-actions">
        <button
          className="action-button primary"
          onClick={(event) => {
            event.stopPropagation();
            onViewOrder(order.id);
          }}
          aria-label="View order details"
        >
          <FaReceipt aria-hidden="true" /> View Details
        </button>
        <button
          className="action-button secondary"
          onClick={(event) => {
            event.stopPropagation();
            onBookAgain();
          }}
          aria-label="Book this service again"
        >
          <FaRedo aria-hidden="true" /> Book Again
        </button>
      </div>
    </UserCard>
  );
};

export default OrderCard;
