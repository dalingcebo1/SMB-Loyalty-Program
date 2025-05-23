import React, { useEffect, useState } from "react";
import api from "../api/api";
import QRCode from "react-qr-code";

interface Extra {
  id: number;
  quantity: number;
  name?: string; // If your backend can provide extra names, use them
}

interface Order {
  id: string;
  service_id: number;
  extras: Extra[];
  payment_pin: string;
  status: string;
  user_id: number;
  created_at: string;
  redeemed: boolean;
  started_at: string | null;
  ended_at: string | null;
  amount?: number;
  service_name?: string; // If your backend can provide service name, use it
  order_redeemed_at?: string | null; // <-- Add this line
}

const PastOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get("/orders/my-past-orders")
      .then((res) => setOrders(res.data))
      .catch(() => setError("Failed to load past orders"))
      .finally(() => setLoading(false));
  }, []);

  // Helper to get a user-friendly order summary
  const getOrderSummary = (order: Order) => {
    // Prefer service_name if available, else fallback
    let summary = order.service_name || "Full House";
    if (order.extras && order.extras.length > 0) {
      const extrasList = order.extras
        .slice(0, 2)
        .map(
          (ex) =>
            ex.name ||
            (ex.id === 8
              ? "Vacuum"
              : ex.id === 9
              ? "Tire clean"
              : `Extra ${ex.id}`)
        );
      summary += " with " + extrasList.join(" and ");
    }
    return summary;
  };

  // Limit to 3 orders unless showAll is true
  const visibleOrders = showAll ? orders : orders.slice(0, 3);

  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Past Orders</h1>
      {loading && <div className="text-center text-gray-500">Loading…</div>}
      {error && <div className="text-center text-red-500">{error}</div>}
      {!loading && !error && (
        <div>
          {orders.length === 0 ? (
            <div className="text-center text-gray-500">No past orders found.</div>
          ) : (
            <>
              {visibleOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded shadow p-4 mb-6 flex flex-col"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold mb-1 text-gray-900">
                        {getOrderSummary(order)}
                      </div>
                      <div className="text-base text-gray-600 mb-1">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString()
                          : ""}
                      </div>
                    </div>
                    <button
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded font-medium"
                      onClick={() => setModalOrder(order)}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
              {!showAll && orders.length > 3 && (
                <div className="flex justify-center">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium"
                    onClick={() => setShowAll(true)}
                  >
                    View More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal for order details */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full flex flex-col items-center relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setModalOrder(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-2 text-center">
              {getOrderSummary(modalOrder)}
            </h2>
            <div className="mb-4">
              <QRCode value={modalOrder.id} size={180} />
            </div>
            <div
              style={{
                marginTop: 8,
                padding: "12px 24px",
                background: "#e9ecef",
                borderRadius: 6,
                fontSize: 22,
                fontWeight: "bold",
                letterSpacing: 4,
                color: "#333",
                textAlign: "center",
              }}
            >
              Payment PIN:{" "}
              <span style={{ color: "#2563eb" }}>{modalOrder.payment_pin}</span>
            </div>
            {typeof modalOrder.amount === "number" && (
              <div style={{ marginTop: 12, fontSize: 18, color: "#222" }}>
                Amount Paid:{" "}
                <span style={{ fontWeight: "bold" }}>
                  R{(modalOrder.amount / 100).toFixed(2)}
                </span>
              </div>
            )}
            <div className="mt-4 text-base text-gray-600 text-center">
              Status:{" "}
              <span
                className={
                  modalOrder.status === "paid"
                    ? "text-green-600"
                    : "text-gray-600"
                }
              >
                {modalOrder.status.charAt(0).toUpperCase() +
                  modalOrder.status.slice(1)}
              </span>
            </div>
            {/* Redeemed by staff info */}
            <div className="mt-2 text-base text-gray-600 text-center">
              {modalOrder.order_redeemed_at ? (
                <>
                  <span className="text-green-700 font-semibold">
                    Redeemed{" "}
                    {new Date(modalOrder.order_redeemed_at).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </>
              ) : (
                <span className="text-red-600 font-semibold">Not redeemed</span>
              )}
            </div>
            <div className="mt-2 text-gray-500 text-center">
              Show this QR code or pin to staff to verify your payment.
            </div>
            <button
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
              onClick={() => setModalOrder(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PastOrders;