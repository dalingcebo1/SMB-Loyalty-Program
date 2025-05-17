import React, { useEffect, useState } from "react";
import api from "../api/api";
import QRCode from "react-qr-code";
import { useAuth } from "../auth/AuthProvider";

interface PastOrder {
  orderId: string;
  serviceName: string;
  extras: string[];
  qrData: string;
  amount: number;
  paymentPin?: string;
  createdAt: string;
  status: string;
  redeemed: boolean;
  category?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const LOCAL_KEY = "smb_last_orders";

const PastOrders: React.FC = () => {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<PastOrder[]>(() => {
    // Load from localStorage on first render
    const cached = localStorage.getItem(LOCAL_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const [modalOrder, setModalOrder] = useState<PastOrder | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      api.get("/orders/my-past-orders")
        .then(res => {
          const sorted = [...res.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(sorted);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(sorted));
        })
        .catch(() => setError("Failed to fetch orders. Please try again later."));
    }
  }, [user, loading]);

  const openOrderModal = async (orderId: string) => {
    setModalLoading(true);
    setModalOrder(null);
    try {
      // Fetch full order details (adjust endpoint as needed)
      const res = await api.get(`/orders/${orderId}`);
      // Merge with summary info if needed
      setModalOrder({
        ...orders.find(o => o.orderId === orderId)!,
        ...res.data,
      });
    } catch {
      setModalOrder(null);
      setError("Failed to fetch order details.");
    }
    setModalLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-center">
        <h1 className="text-xl font-semibold mb-2">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button
          className="btn bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section style={{ maxWidth: 600, margin: "32px auto", padding: 24 }}>
      <h2>Past Orders</h2>
      {orders.length === 0 && <div>No past orders found.</div>}
      <ul>
        {orders.map(order => {
          const extras = Array.isArray(order.extras) ? order.extras : [];
          return (
            <li key={order.orderId} style={{ margin: "16px 0", borderBottom: "1px solid #eee", paddingBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>
                {order.serviceName}
                {extras.length > 0 && (
                  <> with {extras.join(", ")}</>
                )}{" "}
                <b>R{(order.amount / 100).toFixed(2)}</b> :{" "}
                {formatDate(order.createdAt)}
              </span>
              <button
                style={{ marginLeft: 16, padding: "4px 12px", borderRadius: 4, background: "#007bff", color: "#fff", border: "none" }}
                onClick={() => openOrderModal(order.orderId)}
              >
                View
              </button>
            </li>
          );
        })}
      </ul>
      {(modalLoading || modalOrder) && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "#fff", padding: 32, borderRadius: 8, minWidth: 320, maxWidth: 360, textAlign: "center" }}>
            {modalLoading ? (
              <div>Loading...</div>
            ) : modalOrder && (
              <>
                <h3 style={{ marginBottom: 16 }}>
                  {modalOrder.serviceName}
                  {modalOrder.extras && modalOrder.extras.length > 0 ? ` with ${modalOrder.extras.join(", ")}` : ""}
                </h3>
                <QRCode value={modalOrder.qrData} size={200} />
                {modalOrder.paymentPin && (
                  <div style={{ margin: "16px 0", fontWeight: "bold", fontSize: 20, background: "#f4f4f4", borderRadius: 8, padding: 8 }}>
                    Payment PIN: <span style={{ color: "#007bff" }}>{modalOrder.paymentPin}</span>
                  </div>
                )}
                <div style={{ marginTop: 12, textAlign: "left" }}>
                  <div>Status: <b>{modalOrder.status}</b></div>
                  <div>
                    Created: {new Date(modalOrder.createdAt).toLocaleString("en-ZA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div>
                    Redeemed:{" "}
                    {modalOrder.redeemed ? (
                      <span style={{ color: "green" }}>Yes</span>
                    ) : (
                      <span style={{ color: "orange" }}>No</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    Amount Paid: <b>R{(modalOrder.amount / 100).toFixed(2)}</b>
                  </div>
                </div>
                <button onClick={() => setModalOrder(null)} style={{ marginTop: 24, padding: "6px 24px", borderRadius: 4, background: "#007bff", color: "#fff", border: "none" }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PastOrders;