import React, { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import LoadingOverlay from "../components/LoadingOverlay";
import { useNavigate } from "react-router-dom";
import { notifyError } from '../utils/notifications';
import { FaReceipt, FaRedo } from "react-icons/fa";
import useFetch from "../hooks/useFetch";
import { Order, Extra } from "../types";
import api from "../api/api";
import { UserPage, UserHero, UserSection, UserCard } from "../components/user";
import { Button } from "../components/ui";
import { formatCents } from "../utils/format";
import "./PastOrders.css";

type StatusBadgeVariant = "completed" | "pending" | "cancelled";

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

interface OrderRowProps {
  order: Order;
  onViewOrder: (id: string) => void;
}

const OrderRow: React.FC<OrderRowProps> = ({ order, onViewOrder }) => (
  <li
    className="order-row"
    data-testid="order-row"
    role="button"
    tabIndex={0}
    onClick={() => onViewOrder(order.id)}
    onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onViewOrder(order.id);
      }
    }}
    aria-label={`Order ${order.id} placed ${formatOrderDate(order.created_at)} total ${formatCents(order.amount ?? 0)}`}
  >
    <div className="order-row__main">
      <div className="order-row__title">{getOrderSummary(order)}</div>
      <div className="order-row__meta">
        <span className="order-row__date">{formatOrderDate(order.created_at)}</span>
        <span className={`badge ${getStatusBadge(order.status)}`} aria-label={`Order status: ${order.status || 'pending'}`}>
          {(order.status || "pending").toUpperCase()}
        </span>
      </div>
    </div>
    <div className="order-row__amount" aria-label="Total paid">
      {formatCents(order.amount ?? 0)}
    </div>
    <button
      className="order-row__view"
      aria-label="View order details"
      onClick={(e) => {
        e.stopPropagation();
        onViewOrder(order.id);
      }}
    >
      <FaReceipt aria-hidden="true" />
    </button>
  </li>
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

  const orders = useMemo(() => orderData ?? [], [orderData]);
  const sortedOrders = useMemo(() => {
    if (orders.length === 0) {
      return [] as Order[];
    }

    return [...orders].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [orders]);

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
      notifyError("Failed to load order details");
    } finally {
      setModalLoading(false);
    }
  };

  const handleBookAgain = () => navigate("/order"); // retained for modal action only

  const hasOrders = sortedOrders.length > 0;
  const modalTitleId = modalOrder ? `order-modal-title-${modalOrder.id}` : undefined;
  const modalDescriptionId = modalOrder ? `order-modal-description-${modalOrder.id}` : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalOrder(null);
      }
    };

    const shouldLockScroll = modalLoading || Boolean(modalOrder);
    if (shouldLockScroll) {
      const previousOverflow = document.body.style.overflow;
      document.body.dataset.prevOverflow = previousOverflow;
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = document.body.dataset.prevOverflow || "";
        delete document.body.dataset.prevOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOrder, modalLoading]);

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
          <UserCard className="orders-loading" muted>
            {[1, 2, 3].map((index) => (
              <div key={index} className="skeleton-card">
                <div className="skeleton-header">
                  <div className="skeleton-circle" />
                  <div className="skeleton-lines">
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
        variant="compact"
        align="start"
      />
      <UserSection>
        <div className="orders-container">
          {error && (
            <UserCard className="no-orders" muted role="alert">
              <h3>Unable to load orders</h3>
              <p>{error}</p>
            </UserCard>
          )}

          {!error && !hasOrders && (
            <UserCard className="no-orders" muted>
              <h3>No Orders Yet</h3>
              <p>Your past orders will appear here once you've made a purchase.</p>
            </UserCard>
          )}

          {hasOrders && (
            <ul className="orders-list orders-list--compact" role="list">
              {sortedOrders.map((order) => (
                <OrderRow key={order.id} order={order} onViewOrder={loadOrderDetails} />
              ))}
            </ul>
          )}
        </div>
      </UserSection>

      {modalLoading && (
        <div className="order-modal" role="dialog" aria-modal="true" aria-live="polite">
          <div className="modal-content">
            <LoadingOverlay inline message="Loading order details..." />
          </div>
        </div>
      )}

      {modalOrder && !modalLoading && (
        <div
          className="order-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          aria-describedby={modalDescriptionId}
          onClick={() => setModalOrder(null)}
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <button className="modal-close" onClick={() => setModalOrder(null)} aria-label="Close dialog">
                ×
              </button>
              <h2 className="modal-title" id={modalTitleId}>{getOrderSummary(modalOrder)}</h2>
              <div className="modal-order-id" id={modalDescriptionId}>Order #{modalOrder.id}</div>
            </div>
            <div className="modal-body minimal">
              <div className="detail-table" data-testid="order-detail-table">
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
                    <span className={`badge ${getStatusBadge(modalOrder.status)}`} aria-label={`Order status: ${modalOrder.status || 'unknown'}`}>
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
                <div className="table-row">
                  <span className="label">PIN</span>
                  <span className="value">{modalOrder.payment_pin || "N/A"}</span>
                </div>
              </div>

              <div className="qr-container compact">
                <QRCode value={modalOrder.id || "unknown"} size={120} />
                <p className="qr-description">Show this QR or PIN for verification</p>
              </div>
            </div>

            <div className="modal-actions minimal">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setModalOrder(null);
                  handleBookAgain();
                }}
                leftIcon={<FaRedo />}
                isFullWidth
                className="modal-actions__button"
              >
                Book Again
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOrder(null)}
                isFullWidth
                className="modal-actions__button"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </UserPage>
  );
};

export default PastOrders;
