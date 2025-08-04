import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../api/api";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "../auth/AuthProvider";
import PageLayout from "../components/PageLayout";
import StepIndicator from "../components/StepIndicator";
import { track } from '../utils/analytics';

interface Service {
  id: number;
  name: string;
  base_price: number;
}
interface Extra {
  id: number;
  name: string;
  price_map: Record<string, number>;
}

const OrderForm: React.FC = () => {
  const { user, loading } = useAuth();
  // Clear any previous pending order to avoid auto-redirect to payment skeleton
  useEffect(() => {
    localStorage.removeItem('pendingOrder');
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  // Check if user has a ready reward
  const [hasReadyReward, setHasReadyReward] = useState(false);
  const [useReward, setUseReward] = useState(false);

  // Analytics: page view of OrderForm
  useEffect(() => {
    track('page_view', { page: 'OrderForm' });
  }, []);
  useEffect(() => {
    // Only auto-redirect on the Order page itself, not on '/services'
    if (location.pathname === '/order' && !location.state) {
      const pending = localStorage.getItem('pendingOrder');
      if (pending) {
        const state = JSON.parse(pending);
        navigate('/order/payment', { state, replace: true });
      }
    }
  }, [location.pathname, location.state, navigate]);

  // Fetch catalog data
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: async (): Promise<Record<string, Service[]>> => {
      const { data } = await api.get("/catalog/services");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const extrasQuery = useQuery({
    queryKey: ["extras"],
    queryFn: async (): Promise<Extra[]> => {
      const { data: raw } = await api.get<Extra[]>("/catalog/extras");
      return Array.from(new Map(raw.map((e) => [e.id, e])).values());
    },
    staleTime: 1000 * 60 * 5,
  });

  // Error toast helpers
  useEffect(() => { if (servicesQuery.error) toast.error("Failed to load services"); },
    [servicesQuery.error]);
  useEffect(() => { if (extrasQuery.error) toast.error("Failed to load extras"); },
    [extrasQuery.error]);

  // Type-safe fall-backs
  const servicesByCategory = servicesQuery.data ?? {};
  const extras = extrasQuery.data ?? [];

  // UI state
  const [selectedCategory, setSelectedCategory] = useState(""); // will set default in useEffect
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [extraQuantities, setExtraQuantities] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default category to "Fullhouse" (case-insensitive) when services load
  useEffect(() => {
    const cats = Object.keys(servicesByCategory);
    if (cats.length) {
      // Try to find "Fullhouse" (case-insensitive)
      const fullhouseCat =
        cats.find((c) => c.trim().toLowerCase() === "fullhouse") ||
        cats.find((c) => c.trim().toLowerCase() === "full house");
      if (fullhouseCat) {
        setSelectedCategory(fullhouseCat);
      } else if (!selectedCategory || !cats.includes(selectedCategory)) {
        setSelectedCategory(cats[0]);
      }
    }
    // eslint-disable-next-line
  }, [servicesByCategory]);

  // Set default service when category changes
  useEffect(() => {
    if (
      selectedCategory &&
      servicesByCategory[selectedCategory]?.length
    ) {
      const serviceList = servicesByCategory[selectedCategory];
      // Try to find "FULL HOUSE" (case-insensitive)
      const fullHouseService = serviceList.find(
        (s) => s.name.trim().toLowerCase() === "full house"
      );
      if (
        selectedServiceId == null ||
        !serviceList.some((s) => s.id === selectedServiceId)
      ) {
        setSelectedServiceId(fullHouseService?.id ?? serviceList[0]?.id ?? null);
        setServiceQuantity(1);
      }
    }
    // eslint-disable-next-line
  }, [selectedCategory, servicesByCategory]);

  // Init extra counters
  useEffect(() => {
    const init: Record<number, number> = {};
    extras.forEach((e) => (init[e.id] = 0));
    setExtraQuantities(init);
  }, [extras]);

  // Increment/decrement helpers
  const incService = () => setServiceQuantity((q) => q + 1);
  const decService = () => setServiceQuantity((q) => Math.max(1, q - 1));
  const incExtra = (id: number) =>
    setExtraQuantities((q) => ({ ...q, [id]: (q[id] || 0) + 1 }));
  const decExtra = (id: number) =>
    setExtraQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }));

  // Re-calculate total
  const total = useMemo(() => {
    let sum = 0;
    if (selectedCategory && selectedServiceId != null) {
      const svc = servicesByCategory[selectedCategory].find(
        (s) => s.id === selectedServiceId
      );
      if (svc) sum += svc.base_price * serviceQuantity;
    }
    extras.forEach((e) => {
      const qty = extraQuantities[e.id] || 0;
      if (qty > 0 && selectedCategory) {
        sum += (e.price_map[selectedCategory] ?? 0) * qty;
      }
    });
    return sum;
  }, [
    selectedCategory,
    selectedServiceId,
    serviceQuantity,
    extraQuantities,
    servicesByCategory,
    extras,
  ]);

  // Compute a human-readable order summary for payment and confirmation
  const orderSummary = useMemo(() => {
    const lines: string[] = [];
    // Service line
    if (selectedServiceId && selectedCategory) {
      const svc = servicesByCategory[selectedCategory]?.find(s => s.id === selectedServiceId);
      if (svc) {
        lines.push(`${svc.name} × ${serviceQuantity}`);
      }
    }
    // Extras lines
    extras.forEach(e => {
      const qty = extraQuantities[e.id] || 0;
      if (qty > 0) {
        const name = e.name || `Extra ${e.id}`;
        lines.push(`${name} × ${qty}`);
      }
    });
    return lines;
  }, [selectedCategory, selectedServiceId, serviceQuantity, extras, extraQuantities, servicesByCategory]);

  // Submit order
  const handleSubmit = () => {
    // Validate before submit
    if (!selectedServiceId) {
      toast.warning("Please select a service");
      return;
    }
    if (serviceQuantity < 1) {
      toast.warning("Service quantity must be at least 1");
      return;
    }

    // Analytics: CTA click
    track('cta_click', { label: 'Confirm & Pay', page: 'OrderForm' });
    setIsSubmitting(true);

    const payload = {
      email: user!.email,
      service_id: selectedServiceId,
      quantity: serviceQuantity,
      extras: Object.entries(extraQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ id: Number(id), quantity: qty })),
    };

    api
      .post("/orders/create", payload)
      .then((res) => {
        const { order_id, qr_data } = res.data;
        const paymentState: any = {
          orderId: order_id,
          qrData: qr_data,
          total: total * 100,
          summary: orderSummary,
          timestamp: Date.now(),
        };
        localStorage.setItem('pendingOrder', JSON.stringify(paymentState));
        toast.success("Order placed!");
        navigate("/order/payment", { state: paymentState });
      })
      .catch((err: any) => {
        toast.error(err.response?.data?.detail || "Failed to place order");
      })
      .finally(() => setIsSubmitting(false));
  };

  // Show auth loading and block anonymous users
  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

<<<<<<< HEAD
  // Handle loading and errors for catalog data
  if (servicesQuery.isLoading || extrasQuery.isLoading) {
    return <Loading text="Loading order form..." />;
  }
  if (servicesQuery.error || extrasQuery.error) {
    return <ErrorMessage message="Failed to load order form data." onRetry={() => window.location.reload()} />;
=======
  // Loading skeleton for form structure
  if (servicesQuery.isLoading || extrasQuery.isLoading) {
    return (
      <PageLayout>
        <StepIndicator currentStep={1} />
        <div className="min-h-screen bg-gray-100 flex flex-col items-center px-0 py-4 w-full overflow-x-hidden">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-8 animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-300 rounded w-full mb-6" />
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded w-full" />
              <div className="h-4 bg-gray-300 rounded w-full" />
              <div className="h-4 bg-gray-300 rounded w-full" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
  }

  // Render actual form
  return (
    <PageLayout>
      <StepIndicator currentStep={1} />
      <div className="min-h-screen bg-gray-100 flex flex-col items-center px-0 py-4 w-full overflow-x-hidden">
        <ToastContainer position="top-right" />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-2 sm:p-4 mb-8">
          <h1 className="text-lg font-bold mb-2 text-gray-800 text-center">Book a Service</h1>
          <p className="text-gray-600 mb-4 text-center text-xs">
            Select your service and extras below to book your next car wash.
          </p>

          {/* 1. Pick a Category */}
          <section className="mb-3">
            <label className="block text-gray-700 font-medium mb-1 text-xs">1. Category</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm bg-gray-50"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {Object.keys(servicesByCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </section>

          {/* 2. Pick a Service */}
          <section className="mb-3">
            <label className="block text-gray-700 font-medium mb-1 text-xs">2. Service</label>
            <div className="flex items-center space-x-2 w-full">
              <select
                className="flex-1 border rounded px-2 py-1 text-sm bg-gray-50"
                value={selectedServiceId ?? undefined}
                onChange={(e) => setSelectedServiceId(Number(e.target.value))}
              >
                {servicesByCategory[selectedCategory]?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — R{s.base_price}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={decService}
                className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-base"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{serviceQuantity}</span>
              <button
                type="button"
                onClick={incService}
                className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-base"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </section>

          {/* 3. Extras */}
          <section className="mb-3">
            <label className="block text-gray-700 font-medium mb-1 text-xs">3. Extras</label>
            <div>
              {extras.length === 0 && (
                <div className="text-gray-400 text-xs">No extras available for this category.</div>
              )}
              {extras.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="text-sm break-words pr-2">
                    {e.name} — R{e.price_map[selectedCategory] ?? 0}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => decExtra(e.id)}
                      className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-base"
                      aria-label={`Decrease ${e.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{extraQuantities[e.id]}</span>
                    <button
                      type="button"
                      onClick={() => incExtra(e.id)}
                      className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-base"
                      aria-label={`Increase ${e.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Reward checkbox */}
          {hasReadyReward && (
           <div className="mb-4 flex items-center">
             <input
               id="useReward"
               type="checkbox"
               checked={useReward}
               onChange={() => setUseReward(!useReward)}
               className="mr-2"
             />
             <label htmlFor="useReward" className="text-sm text-gray-700">
               Use reward on next eligible order
             </label>
           </div>
          )}

          {/* 4.  Live total & submit */}
          <div className="mt-4 font-bold text-base text-center">
            Total: R {total}
          </div>

          {/* Order summary preview */}
          {orderSummary.length > 0 && (
            <div className="mb-6 bg-gray-100 p-4 rounded">
              <h3 className="font-semibold text-gray-700 mb-2">Your Order</h3>
              <ul className="list-disc list-inside text-gray-600">
                {orderSummary.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full mt-3 py-2 rounded text-white font-semibold transition text-base ${
              isSubmitting
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Submitting…" : "Confirm & Pay"}
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default OrderForm;
