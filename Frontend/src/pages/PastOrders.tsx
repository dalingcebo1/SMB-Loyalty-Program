<<<<<<< HEAD
import React, { useState } from "react";
import QRCode from "react-qr-code";
import useFetch from "../hooks/useFetch";
import { Order } from "../types";
import PageLayout from "../components/PageLayout";

const PastOrders: React.FC = () => {
  const { data: orderData, loading, error } = useFetch<Order[]>("/orders/my-past-orders");
  const orders: Order[] = orderData ?? [];
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [showAll, setShowAll] = useState(false);

=======
import React, { useEffect, useState } from "react";
import FocusTrap from 'focus-trap-react';
import api from "../api/api";
import QRCode from "react-qr-code";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";

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
  const { user, loading: authLoading } = useAuth();
  // Auth loading and redirect
  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user) return <Navigate to="/login" replace />;
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    setDataLoading(true);
    api
      .get("/orders/my-past-orders")
      .then((res) => setOrders(res.data))
      .catch(() => setError("Failed to load past orders"))
      .finally(() => setDataLoading(false));
  }, []);
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)

  // fetch a single order on “View”
  const loadOrderDetails = async (id: string) => {
    setModalLoading(true);
    try {
      const { data } = await api.get<Order>(`/orders/${id}`);
      setModalOrder(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load order details");
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

  const [showAll, setShowAll] = useState(false);

  // Limit to 3 orders unless showAll is true
  const visibleOrders = showAll ? orders : orders.slice(0, 3);

  // Show skeleton loader while fetching past orders
  if (dataLoading) {
    return (
      <PageLayout>
        <div className="max-w-xl mx-auto py-8 space-y-6 animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/2 mx-auto" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 p-4 rounded flex space-x-4">
              <div className="h-8 w-8 bg-gray-300 rounded-full" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-300 rounded w-3/4" />
                <div className="h-4 bg-gray-300 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </PageLayout>
    );
  }
  return (
    <PageLayout
<<<<<<< HEAD
      loading={loading}
      error={error}
      onRetry={() => window.location.reload()}
      loadingText="Loading past orders..."
=======
      error={error}
      onRetry={() => window.location.reload()}
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
    >
      <div className="max-w-xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Past Orders</h1>
        {orders.length === 0 ? (
          <div className="text-center text-gray-500">No past orders found.</div>
        ) : (
<<<<<<< HEAD
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
=======
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
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
                    </div>
                  </div>
                  <button
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded font-medium"
                    onClick={() => loadOrderDetails(order.id)}
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

      {/* full‐screen loader while fetching the single order */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded p-6">Loading order…</div>
        </div>
      )}

      {/* once loaded, show the modal */}
      {modalOrder && !modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <FocusTrap focusTrapOptions={{ onDeactivate: () => setModalOrder(null), clickOutsideDeactivates: true, escapeDeactivates: true }}>
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full flex flex-col items-center relative">
              <button
                autoFocus
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setModalOrder(null)}
                aria-label="Close dialog"
              >
                &times;
              </button>
              <h2 id="order-details-title" className="text-xl font-bold mb-2 text-center">
                {getOrderSummary(modalOrder)}
              </h2>
              <QRCode value={modalOrder.id} size={180} className="mb-4" />
              <div className="mt-2 text-base text-gray-600 text-center">
                Payment PIN: <span className="font-mono font-bold text-blue-600">{modalOrder.payment_pin}</span>
              </div>
              {typeof modalOrder.amount === "number" && (
                <div className="mt-2 text-base text-gray-600 text-center">
                  Amount Paid: <span className="font-semibold">R{(modalOrder.amount / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="mt-4 text-base text-gray-600 text-center">
                Status:{' '}
                <span className={modalOrder.status === "paid" ? "text-green-600" : "text-gray-600"}>
                  {modalOrder.status.charAt(0).toUpperCase() + modalOrder.status.slice(1)}
                </span>
              </div>
              <div className="mt-2 text-base text-gray-600 text-center">
                {modalOrder.order_redeemed_at ? (
                  <span className="text-green-700 font-semibold">
                    Redeemed {new Date(modalOrder.order_redeemed_at!).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">Not redeemed</span>
                )}
              </div>
              <p id="order-details-desc" className="mt-2 text-gray-500 text-center">
                Show this QR or PIN to staff.
              </p>
              <button
                className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setModalOrder(null)}
              >
                Close
              </button>
            </div>
          </FocusTrap>
        </div>
      )}
    </PageLayout>
  );
};

export default PastOrders;