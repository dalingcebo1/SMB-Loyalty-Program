import React, { useState, useMemo } from "react";
import QRCode from "react-qr-code";
import useFetch from "../hooks/useFetch";
import { Order } from "../types";
import api from "../api/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { 
  FaCar, 
  FaSearch, 
  FaReceipt, 
  FaRedo, 
  FaCheckCircle, 
  FaCarSide, 
  FaSprayCan, 
  FaCreditCard, 
  FaTrophy, 
  FaStar
} from 'react-icons/fa';
import './PastOrders.css';
import { formatCents } from "../utils/format";

// OrderCard component for enhanced order display
interface OrderCardProps {
  order: Order;
  onViewOrder: (id: string) => void;
  onBookAgain: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onViewOrder, onBookAgain }) => {
  const getOrderSummary = (order: Order) => {
    let summary = order.service_name || "Full wash";
    if (order.extras && order.extras.length > 0) {
      const firstExtra = order.extras[0]?.name || "Extra";
      if (order.extras.length === 1) {
        summary += ` with ${firstExtra}`;
      } else {
        summary += ` with ${firstExtra} & Others`;
      }
    }
    return summary;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'completed';
      case 'pending':
      case 'processing':
        return 'pending';
      case 'cancelled':
      case 'failed':
        return 'cancelled';
      default:
        return 'pending';
    }
  };

  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const orderDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return `Today • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays <= 7) return `${diffDays} days ago • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <article 
      className="order-card surface-card surface-card--interactive" 
      onClick={() => onViewOrder(order.id)}
      role="button"
      tabIndex={0}
      aria-label={`Order from ${formatOrderDate(order.created_at || '')}, ${getOrderSummary(order)}, ${formatCents(order.amount ?? 0)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
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
            <span className="date">{formatOrderDate(order.created_at || '')}</span>
            <span className={`badge ${getStatusBadge(order.status || '')}`}>
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
          onClick={(e) => { e.stopPropagation(); onViewOrder(order.id); }}
          aria-label="View order details"
        >
          <FaReceipt aria-hidden="true" /> View Details
        </button>
        <button 
          className="action-button secondary" 
          onClick={(e) => { e.stopPropagation(); onBookAgain(); }}
          aria-label="Book this service again"
        >
          <FaRedo aria-hidden="true" /> Book Again
        </button>
      </div>
    </article>
  );
};

const PastOrders: React.FC = () => {
  const navigate = useNavigate();
  const { data: orderData, loading: dataLoading, error } = useFetch<Order[]>("/orders/my-past-orders");
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  // Memoize orders array to prevent unnecessary recalculations
  const orders = useMemo(() => orderData ?? [], [orderData]);

  // fetch a single order on “View”
  type ExtraLike = string | { id?: number; name?: string; title?: string; price_map?: Record<string, number> };
  interface RawOrderResponse {
    id?: string | number;
    orderId?: string | number;
    service_id?: number;
    serviceId?: number;
  extras?: ExtraLike[]; // will normalize below
    payment_pin?: string;
    paymentPin?: string;
    status?: string;
    user_id?: number;
    userId?: number;
    created_at?: string;
    createdAt?: string;
    redeemed?: boolean;
    started_at?: string | null;
    startedAt?: string | null;
    ended_at?: string | null;
    endedAt?: string | null;
    amount?: number;
    service_name?: string;
    serviceName?: string;
    order_redeemed_at?: string | null;
    orderRedeemedAt?: string | null;
  }

  const loadOrderDetails = async (id: string) => {
    setModalLoading(true);
    try {
  const { data } = await api.get<RawOrderResponse>(`/orders/${id}`);
      // Normalize differing backend field styles (camelCase vs snake_case)
      const normalized: Order = {
        id: String(data.id ?? data.orderId ?? id),
        service_id: data.service_id ?? data.serviceId ?? 0,
        extras: Array.isArray(data.extras)
          ? data.extras.map((ex: ExtraLike, idx: number) =>
              typeof ex === 'string'
                ? { id: idx, name: ex, price_map: {} }
                : {
                    id: ex.id ?? idx,
                    name: ex.name ?? ex.title ?? 'Extra',
                    price_map: ex.price_map ?? {},
                  }
            )
          : [],
        payment_pin: data.payment_pin ?? data.paymentPin ?? '',
        status: data.status ?? 'unknown',
        user_id: data.user_id ?? data.userId ?? 0,
        created_at: data.created_at ?? data.createdAt ?? new Date().toISOString(),
        redeemed: Boolean(data.redeemed),
        started_at: data.started_at ?? data.startedAt ?? null,
        ended_at: data.ended_at ?? data.endedAt ?? null,
        amount: data.amount,
        service_name: data.service_name ?? data.serviceName,
        order_redeemed_at: data.order_redeemed_at ?? data.orderRedeemedAt ?? null,
      };
      setModalOrder(normalized);
    } catch (err) {
      console.error('[PastOrders] loadOrderDetails error', err);
      toast.error('Failed to load order details');
    } finally {
      setModalLoading(false);
    }
  };

  // Helper to get a user-friendly order summary
  const getOrderSummary = (order: Order) => {
    let summary = order.service_name || "Full wash";
    if (order.extras && order.extras.length > 0) {
      const firstExtra = order.extras[0]?.name || "Extra";
      if (order.extras.length === 1) {
        summary += ` with ${firstExtra}`;
      } else {
        summary += ` with ${firstExtra} & Others`;
      }
    }
    return summary;
  };

  // Helper to get status badge class
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'completed';
      case 'pending':
      case 'processing':
        return 'pending';
      case 'cancelled':
      case 'failed':
        return 'cancelled';
      default:
        return 'pending';
    }
  };

  // Helper to format date nicely
  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const orderDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return `Today • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays <= 7) return `${diffDays} days ago • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper to group orders by time periods
  const groupOrdersByTime = (orders: Order[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups = {
      today: [] as Order[],
      thisWeek: [] as Order[],
      thisMonth: [] as Order[],
      earlier: [] as Order[]
    };

    orders.forEach(order => {
      const orderDate = new Date(order.created_at || '');
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      
      if (orderDateOnly.getTime() === today.getTime()) {
        groups.today.push(order);
      } else if (orderDate >= weekAgo) {
        groups.thisWeek.push(order);
      } else if (orderDate >= monthAgo) {
        groups.thisMonth.push(order);
      } else {
        groups.earlier.push(order);
      }
    });

    return groups;
  };

  // Filter and group orders - memoized for performance
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchMatch = searchTerm === "" || 
        getOrderSummary(order).toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Time filter logic would go here
      return searchMatch;
    });
  }, [orders, searchTerm]);

  const groupedOrders = useMemo(() => groupOrdersByTime(filteredOrders), [filteredOrders]);
  const handleBookAgain = () => navigate('/order');

  // Show skeleton loader while fetching past orders
  if (dataLoading) {
    return (
      <div className="past-orders-page user-page user-page--wide">
        <section className="page-header user-hero user-hero--compact">
          <span className="user-hero__eyebrow">Orders</span>
          <h1 className="user-hero__title">Past Orders</h1>
          <p className="user-hero__subtitle">View your car wash history and reorder your favorites.</p>
        </section>
        <section className="user-page__section">
          <div className="surface-card surface-card--muted orders-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-header">
                  <div className="skeleton-circle" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line-short" />
                    <div className="skeleton-line-long" />
                  </div>
                </div>
                <div className="skeleton-body">
                  <div className="skeleton-line-full" />
                  <div className="skeleton-line-full" />
                </div>
                <div className="skeleton-actions">
                  <div className="skeleton-button" />
                  <div className="skeleton-button" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="past-orders-page user-page user-page--wide">
      <section className="page-header user-hero user-hero--compact">
        <span className="user-hero__eyebrow">Orders</span>
        <h1 className="user-hero__title">Order History</h1>
        <p className="user-hero__subtitle">Track your car wash orders and service history.</p>
      </section>

      <section className="user-page__section">
        <div className="surface-card orders-filters">
          <div className="orders-filters__group">
            <label className="orders-filters__label" htmlFor="order-time-filter">Timeframe</label>
            <select 
              id="order-time-filter"
              className="filter-dropdown"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">Last 3 Months</option>
            </select>
          </div>
          <div className="orders-filters__group search-container">
            <label className="orders-filters__label" htmlFor="order-search">Search</label>
            <input 
              id="order-search"
              type="text" 
              placeholder="Search orders..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FaSearch className="search-icon" />
          </div>
        </div>
      </section>

      <section className="user-page__section">
        <div className="orders-container">
        {error && (
          <div className="no-orders">
            <h3>Unable to load orders</h3>
            <p>{error}</p>
          </div>
        )}

        {dataLoading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading your orders...</p>
          </div>
        )}

        {!dataLoading && orders.length === 0 && !error && (
          <div className="no-orders">
            <h3>No Orders Yet</h3>
            <p>Your past orders will appear here once you've made a purchase.</p>
          </div>
        )}

        {!dataLoading && orders.length > 0 && (
          <div className="orders-timeline">
            {groupedOrders.today.length > 0 && (
              <div className="time-section">
                <div className="time-section__header">
                  <h2 className="section-title">Today</h2>
                  <span className="count">{groupedOrders.today.length}</span>
                </div>
                <div className="orders-grid">
                  {groupedOrders.today.map((order) => (
                    <OrderCard key={order.id} order={order} onViewOrder={loadOrderDetails} onBookAgain={handleBookAgain} />
                  ))}
                </div>
              </div>
            )}

            {groupedOrders.thisWeek.length > 0 && (
              <div className="time-section">
                <div className="time-section__header">
                  <h2 className="section-title">This Week</h2>
                  <span className="count">{groupedOrders.thisWeek.length}</span>
                </div>
                <div className="orders-grid">
                  {groupedOrders.thisWeek.map((order) => (
                    <OrderCard key={order.id} order={order} onViewOrder={loadOrderDetails} onBookAgain={handleBookAgain} />
                  ))}
                </div>
              </div>
            )}

            {groupedOrders.thisMonth.length > 0 && (
              <div className="time-section">
                <div className="time-section__header">
                  <h2 className="section-title">This Month</h2>
                  <span className="count">{groupedOrders.thisMonth.length}</span>
                </div>
                <div className="orders-grid">
                  {groupedOrders.thisMonth.map((order) => (
                    <OrderCard key={order.id} order={order} onViewOrder={loadOrderDetails} onBookAgain={handleBookAgain} />
                  ))}
                </div>
              </div>
            )}

            {groupedOrders.earlier.length > 0 && (
              <div className="time-section">
                <div className="time-section__header">
                  <h2 className="section-title">Older</h2>
                  <span className="count">{groupedOrders.earlier.length}</span>
                </div>
                <div className="orders-grid">
                  {groupedOrders.earlier.slice(0, showAll ? undefined : 3).map((order) => (
                    <OrderCard key={order.id} order={order} onViewOrder={loadOrderDetails} onBookAgain={handleBookAgain} />
                  ))}
                </div>
                {!showAll && groupedOrders.earlier.length > 3 && (
                  <div className="orders-more">
                    <button
                      className="btn btn--ghost"
                      onClick={() => setShowAll(true)}
                    >
                      View more orders
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      {/* Loading Modal */}
      {modalLoading && (
        <div className="order-modal">
          <div className="modal-content">
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Loading order details...</p>
            </div>
          </div>
        </div>
      )}

      {/* Modern Order Modal */}
      {modalOrder && !modalLoading && (
        <div className="order-modal" onClick={() => setModalOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <button
                className="modal-close"
                onClick={() => setModalOrder(null)}
                aria-label="Close dialog"
              >
                ×
              </button>
              <h2 className="modal-title">{getOrderSummary(modalOrder)}</h2>
              <div className="modal-order-id">Order #{modalOrder.id}</div>
            </div>

            <div className="modal-body">
              <div className="order-timeline">
                <div className="timeline-container">
                  <div className="timeline-step completed">
                    <div className="step-icon"><FaCheckCircle /></div>
                    <div className="step-content">
                      <h4>Order Placed</h4>
                      <p>Your order was received and confirmed</p>
                      <div className="step-time">{formatOrderDate(modalOrder.created_at || '')}</div>
                    </div>
                  </div>
                  <div className="timeline-connector completed"></div>
                  
                  <div className="timeline-step completed">
                    <div className="step-icon"><FaCarSide /></div>
                    <div className="step-content">
                      <h4>Service Assigned</h4>
                      <p>Wash bay assigned and service preparation started</p>
                      <div className="step-time">Ready for service</div>
                    </div>
                  </div>
                  <div className="timeline-connector completed"></div>
                  
                  <div className="timeline-step completed">
                    <div className="step-icon"><FaSprayCan /></div>
                    <div className="step-content">
                      <h4>Service Completed</h4>
                      <p>Car wash service has been finished successfully</p>
                      <div className="step-time">Service complete</div>
                    </div>
                  </div>
                  <div className="timeline-connector completed"></div>
                  
                  <div className="timeline-step completed">
                    <div className="step-icon"><FaCreditCard /></div>
                    <div className="step-content">
                      <h4>Payment Processed</h4>
                      <p>Payment confirmed and receipt generated</p>
                      <div className="step-time">{`${formatCents(modalOrder.amount ?? 0)} paid`}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="service-details">
                <h3>Service Information</h3>
                <div className="detail-table">
                  <div className="table-row">
                    <span className="label">Service</span>
                    <span className="value">{modalOrder.service_name || 'Full Wash'}</span>
                  </div>
                  <div className="table-row">
                    <span className="label">Order ID</span>
                    <span className="value">#{modalOrder.id}</span>
                  </div>
                  <div className="table-row">
                    <span className="label">Status</span>
                    <span className={`value`}>
                      <span className={`badge ${getStatusBadge(modalOrder.status || '')}`}>
                        {(modalOrder.status || '').toUpperCase()}
                      </span>
                    </span>
                  </div>
                  {modalOrder.extras && modalOrder.extras.length > 0 && (
                    <div className="table-row">
                      <span className="label">Extras</span>
                      <span className="value">
                        {modalOrder.extras.map(extra => extra.name).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="table-row">
                    <span className="label">Total Paid</span>
                    <span className="value">{formatCents(modalOrder.amount ?? 0)}</span>
                  </div>
                </div>
              </div>

              <div className="qr-section">
                <div className="qr-container">
                  <div className="qr-code">
                    <QRCode value={modalOrder.id || 'unknown'} size={160} />
                  </div>
                  <h4 className="qr-title">Payment Verification</h4>
                  <p className="qr-description">
                    PIN: <strong>{modalOrder.payment_pin}</strong>
                  </p>
                  <p className="qr-description">
                    Show this QR code or PIN to staff for verification
                  </p>
                </div>
              </div>

              <div className="loyalty-section">
                <div className="loyalty-card">
                  <FaTrophy className="loyalty-icon" />
                  <div className="loyalty-info">
                    <h4>Loyalty Progress</h4>
                    <p>You earned loyalty points from this order!</p>
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: '70%' }}></div>
                    </div>
                    <p className="progress-text">7 out of 10 visits to unlock free wash</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="modal-action-btn secondary">
                <FaReceipt /> Download Receipt
              </button>
              <button 
                className="modal-action-btn primary" 
                onClick={() => {
                  setModalOrder(null);
                  handleBookAgain();
                }}
              >
                <FaRedo /> Book Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// This page has been moved to src/features/order/pages/PastOrders.tsx
export default PastOrders;