import React, { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
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
  FaStar,
} from "react-icons/fa";
import useFetch from "../hooks/useFetch";
import { Order, Extra } from "../types";
import api from "../api/api";
import { UserPage, UserHero, UserSection, UserCard } from "../components/user";
import { formatCents } from "../utils/format";
import "./PastOrders.css";

type StatusBadgeVariant = "completed" | "pending" | "cancelled";

type GroupedOrders = {
  today: Order[];
  thisWeek: Order[];
  thisMonth: Order[];
  earlier: Order[];
};

const getOrderSummary = (order: Order): string => {
  let summary = order.service_name || "Full wash";
  if (order.extras && order.extras.length > 0) {
    const firstExtra = order.extras[0]?.name || "Extra";
    summary += order.extras.length === 1 ? ` with ${firstExtra}` : ` with ${firstExtra} & Others`;
  }
  return summary;
};

const getStatusBadge = (status: string | undefined): StatusBadgeVariant => {
  switch (status?.toLowerCase()) {
    case "paid":
    case "completed":
      return "completed";
    case "cancelled":
    case "failed":
      return "cancelled";
    default:
      return "pending";
  }
};

const formatOrderDate = (dateString: string | undefined): string => {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const orderDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - orderDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today • ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) {
    return `Yesterday • ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays <= 7) {
    return `${diffDays} days ago • ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString("en-ZA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const groupOrdersByTime = (orders: Order[]): GroupedOrders => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groups: GroupedOrders = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  };

  orders.forEach((order) => {
    if (!order.created_at) return;
    const orderDate = new Date(order.created_at);
    const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

    if (orderDay.getTime() === today.getTime()) {
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

interface OrderCardProps {
  order: Order;
  onViewOrder: (id: string) => void;
  onBookAgain: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onViewOrder, onBookAgain }) => (
  <UserCard
    as="article"
    className="order-card"
    interactive
    onClick={() => onViewOrder(order.id)}
    role="button"
    tabIndex={0}
    aria-label={`Order from ${formatOrderDate(order.created_at)}, ${getOrderSummary(order)}, ${formatCents(order.amount ?? 0)}`}
    onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
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
            {(order.status || "pending").toUpperCase()}
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

type ExtraLike =
  | string
  | { id?: number; name?: string; title?: string; price_map?: Record<string, number> };

interface RawOrderResponse {
  id?: string | number;
  orderId?: string | number;
  service_id?: number;
  serviceId?: number;
  extras?: ExtraLike[];
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

const mapExtra = (extra: ExtraLike, index: number): Extra => {
  if (typeof extra === "string") {
    return { id: index, name: extra, price_map: {} };
  }
  return {
    id: extra.id ?? index,
    name: extra.name ?? extra.title ?? "Extra",
    price_map: extra.price_map ?? {},
  };
};

const PastOrders: React.FC = () => {
  const navigate = useNavigate();
  const { data: orderData, loading: dataLoading, error } = useFetch<Order[]>("/orders/my-past-orders");
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  const orders = useMemo(() => orderData ?? [], [orderData]);

  const filteredOrders = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return orders.filter((order) => {
      const matchesSearch =
        searchLower.length === 0 ||
        getOrderSummary(order).toLowerCase().includes(searchLower) ||
        String(order.id).toLowerCase().includes(searchLower);

      if (!matchesSearch) {
        return false;
      }

      if (!order.created_at) {
        return true;
      }

      const createdAt = new Date(order.created_at);
      if (Number.isNaN(createdAt.getTime())) {
        return true;
      }

      switch (timeFilter) {
        case "week":
          return createdAt >= weekAgo;
        case "month":
          return createdAt >= monthAgo;
        case "quarter":
          return createdAt >= quarterAgo;
        default:
          return true;
      }
    });
  }, [orders, searchTerm, timeFilter]);

  const groupedOrders = useMemo(() => groupOrdersByTime(filteredOrders), [filteredOrders]);

  const loadOrderDetails = async (id: string) => {
    setModalLoading(true);
    try {
      const { data } = await api.get<RawOrderResponse>(`/orders/${id}`);
      const normalized: Order = {
        id: String(data.id ?? data.orderId ?? id),
        service_id: data.service_id ?? data.serviceId ?? 0,
        extras: Array.isArray(data.extras) ? data.extras.map(mapExtra) : [],
        payment_pin: data.payment_pin ?? data.paymentPin ?? "",
        status: data.status ?? "unknown",
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
      console.error("[PastOrders] loadOrderDetails error", err);
      toast.error("Failed to load order details");
    } finally {
      setModalLoading(false);
    }
  };

  const handleBookAgain = () => navigate("/order");

  const hasAnyOrders = orders.length > 0;
  const hasFilteredOrders = filteredOrders.length > 0;

  if (dataLoading) {
    return (
      <UserPage className="past-orders-page" size="wide">
        <UserHero
          className="past-orders-hero"
          eyebrow="Orders"
          title="Past Orders"
          subtitle="View your car wash history and reorder your favorites."
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard className="orders-loading" muted>
            {[1, 2, 3].map((index) => (
              <div key={index} className="skeleton-card">
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
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  return (
    <UserPage className="past-orders-page" size="wide">
      <UserHero
        className="past-orders-hero"
        eyebrow="Orders"
        title="Order History"
        subtitle="Track your car wash orders and service history."
        variant="compact"
        align="start"
      />

      <UserSection>
        <UserCard className="orders-filters" padding="loose">
          <div className="orders-filters__group">
            <label className="orders-filters__label" htmlFor="order-time-filter">
              Timeframe
            </label>
            <select
              id="order-time-filter"
              className="filter-dropdown"
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value)}
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">Last 3 Months</option>
            </select>
          </div>
          <div className="orders-filters__group search-container">
            <label className="orders-filters__label" htmlFor="order-search">
              Search
            </label>
            <input
              id="order-search"
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <FaSearch className="search-icon" />
          </div>
        </UserCard>
      </UserSection>

      <UserSection>
        <div className="orders-container">
          {error && (
            <UserCard className="no-orders" muted role="alert">
              <h3>Unable to load orders</h3>
              <p>{error}</p>
            </UserCard>
          )}

          {!error && !hasAnyOrders && (
            <UserCard className="no-orders" muted>
              <h3>No Orders Yet</h3>
              <p>Your past orders will appear here once you've made a purchase.</p>
            </UserCard>
          )}

          {hasAnyOrders && !hasFilteredOrders && (
            <UserCard className="no-orders" muted>
              <h3>No matching orders</h3>
              <p>Try adjusting your filters or search to find a specific order.</p>
            </UserCard>
          )}

          {hasFilteredOrders && (
            <div className="orders-timeline">
              {groupedOrders.today.length > 0 && (
                <div className="time-section">
                  <div className="time-section__header">
                    <h2 className="section-title">Today</h2>
                    <span className="count">{groupedOrders.today.length}</span>
                  </div>
                  <div className="orders-grid">
                    {groupedOrders.today.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onViewOrder={loadOrderDetails}
                        onBookAgain={handleBookAgain}
                      />
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
                      <OrderCard
                        key={order.id}
                        order={order}
                        onViewOrder={loadOrderDetails}
                        onBookAgain={handleBookAgain}
                      />
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
                      <OrderCard
                        key={order.id}
                        order={order}
                        onViewOrder={loadOrderDetails}
                        onBookAgain={handleBookAgain}
                      />
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
                      <OrderCard
                        key={order.id}
                        order={order}
                        onViewOrder={loadOrderDetails}
                        onBookAgain={handleBookAgain}
                      />
                    ))}
                  </div>
                  {!showAll && groupedOrders.earlier.length > 3 && (
                    <div className="orders-more">
                      <button className="btn btn--ghost" onClick={() => setShowAll(true)}>
                        View more orders
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </UserSection>

      {modalLoading && (
        <div className="order-modal">
          <div className="modal-content">
            <div className="loading">
              <div className="loading-spinner" />
              <p>Loading order details...</p>
            </div>
          </div>
        </div>
      )}

      {modalOrder && !modalLoading && (
        <div className="order-modal" onClick={() => setModalOrder(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <button className="modal-close" onClick={() => setModalOrder(null)} aria-label="Close dialog">
                ×
              </button>
              <h2 className="modal-title">{getOrderSummary(modalOrder)}</h2>
              <div className="modal-order-id">Order #{modalOrder.id}</div>
            </div>

            <div className="modal-body">
              <div className="order-timeline">
                <div className="timeline-container">
                  <div className="timeline-step completed">
                    <div className="step-icon">
                      <FaCheckCircle />
                    </div>
                    <div className="step-content">
                      <h4>Order Placed</h4>
                      <p>Your order was received and confirmed</p>
                      <div className="step-time">{formatOrderDate(modalOrder.created_at)}</div>
                    </div>
                  </div>
                  <div className="timeline-connector completed" />

                  <div className="timeline-step completed">
                    <div className="step-icon">
                      <FaCarSide />
                    </div>
                    <div className="step-content">
                      <h4>Service Assigned</h4>
                      <p>Wash bay assigned and service preparation started</p>
                      <div className="step-time">Ready for service</div>
                    </div>
                  </div>
                  <div className="timeline-connector completed" />

                  <div className="timeline-step completed">
                    <div className="step-icon">
                      <FaSprayCan />
                    </div>
                    <div className="step-content">
                      <h4>Service Completed</h4>
                      <p>Car wash service has been finished successfully</p>
                      <div className="step-time">Service complete</div>
                    </div>
                  </div>
                  <div className="timeline-connector completed" />

                  <div className="timeline-step completed">
                    <div className="step-icon">
                      <FaCreditCard />
                    </div>
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
                    <span className="value">{modalOrder.service_name || "Full Wash"}</span>
                  </div>
                  <div className="table-row">
                    <span className="label">Order ID</span>
                    <span className="value">#{modalOrder.id}</span>
                  </div>
                  <div className="table-row">
                    <span className="label">Status</span>
                    <span className="value">
                      <span className={`badge ${getStatusBadge(modalOrder.status)}`}>
                        {(modalOrder.status || "").toUpperCase()}
                      </span>
                    </span>
                  </div>
                  {modalOrder.extras && modalOrder.extras.length > 0 && (
                    <div className="table-row">
                      <span className="label">Extras</span>
                      <span className="value">{modalOrder.extras.map((extra) => extra.name).join(", ")}</span>
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
                    <QRCode value={modalOrder.id || "unknown"} size={160} />
                  </div>
                  <h4 className="qr-title">Payment Verification</h4>
                  <p className="qr-description">
                    PIN: <strong>{modalOrder.payment_pin || "N/A"}</strong>
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
                      <div className="progress-bar" style={{ width: "70%" }} />
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
    </UserPage>
  );
};

export default PastOrders;
