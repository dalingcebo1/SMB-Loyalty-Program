import React, { useMemo, useState, useRef } from "react";
import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";
// Removed toast usage; will use inline StatusBanner for error messaging.
import {
  FaSearch,
  FaReceipt,
  FaRedo,
  FaCheckCircle,
  FaCarSide,
  FaSprayCan,
  FaCreditCard,
  FaTrophy,
} from "react-icons/fa";
import useFetch from "../hooks/useFetch";
import { Order, Extra } from "../types";
import api from "../api/api";
import { UserPage, UserHero, UserSection, UserCard } from "../components/user";
import OrderCard from '../components/user/OrderCard';
import StatusBanner from '../components/ui/StatusBanner';
import useFocusTrap from '../components/ui/useFocusTrap';
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

  const [banner, setBanner] = useState<{ type: 'error'; message: string } | null>(null);

  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerInitialFocusRef = useRef<HTMLButtonElement | null>(null);

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
      setBanner({ type: 'error', message: 'Failed to load order details' });
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
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard className="orders-loading" muted aria-busy="true">
            <div className="u-grid u-grid--cols-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-lines">
                  <div className="skeleton skeleton-text" style={{ width: '70%', height: '1rem' }} />
                  <div className="skeleton skeleton-text" style={{ width: '55%', height: '0.85rem' }} />
                  <div className="skeleton skeleton-text" style={{ width: '60%', height: '0.85rem' }} />
                </div>
              ))}
            </div>
            <p className="visually-hidden">Loading past orders, please wait.</p>
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
        variant="compact"
        align="start"
      />

      {banner && (
        <StatusBanner
          variant="error"
          title="Error"
          description={banner.message}
          dismissible
          onDismiss={() => setBanner(null)}
          role="alert"
          ariaLive="assertive"
        />
      )}
      <UserSection>
        <div className="orders-filters-wrapper">
        <UserCard className="orders-filters orders-filters--sticky" padding="loose">
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
        </div>
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
                        getOrderSummary={getOrderSummary}
                        formatOrderDate={formatOrderDate}
                        getStatusBadge={getStatusBadge}
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
                        getOrderSummary={getOrderSummary}
                        formatOrderDate={formatOrderDate}
                        getStatusBadge={getStatusBadge}
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
                        getOrderSummary={getOrderSummary}
                        formatOrderDate={formatOrderDate}
                        getStatusBadge={getStatusBadge}
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
                        getOrderSummary={getOrderSummary}
                        formatOrderDate={formatOrderDate}
                        getStatusBadge={getStatusBadge}
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

      {(modalLoading || modalOrder) && (
        <div className="order-drawer__backdrop" aria-hidden="true" onClick={() => !modalLoading && setModalOrder(null)} />
      )}

      {modalLoading && (
        <aside ref={drawerRef} className="order-drawer" role="dialog" aria-modal="true" aria-label="Loading order details">
          <div className="drawer-content" aria-busy="true">
            <div className="loading">
              <div className="loading-spinner" />
              <p>Loading order details...</p>
            </div>
          </div>
        </aside>
      )}

      {modalOrder && !modalLoading && (
        <aside ref={drawerRef} className="order-drawer" role="dialog" aria-modal="true" aria-label={`Order details for ${getOrderSummary(modalOrder)}`}>          
          <div className="drawer-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <button ref={drawerInitialFocusRef} className="modal-close" onClick={() => setModalOrder(null)} aria-label="Close dialog">
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
        </aside>
      )}
      {/* Focus trap activation side-effect */}
      <FocusTrapActivator active={Boolean(modalOrder) || modalLoading} drawerRef={drawerRef} initialFocusRef={drawerInitialFocusRef} onDeactivate={() => setModalOrder(null)} />
    </UserPage>
  );
};

// Helper component to invoke focus trap without rendering output
const FocusTrapActivator: React.FC<{ active: boolean; drawerRef: React.RefObject<HTMLElement | null>; initialFocusRef: React.RefObject<HTMLButtonElement | null>; onDeactivate: () => void; }> = ({ active, drawerRef, initialFocusRef, onDeactivate }) => {
  useFocusTrap({
    active,
    containerRef: drawerRef,
    initialFocus: initialFocusRef,
    onDeactivate,
    escapeDeactivates: true,
    clickOutsideDeactivates: true,
  });
  return null;
};

export default PastOrders;
