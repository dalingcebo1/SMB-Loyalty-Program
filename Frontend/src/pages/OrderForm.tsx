import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../api/api";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "../auth/AuthProvider";

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
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Submit order
  const handleSubmit = () => {
    if (!selectedServiceId) {
      toast.warning("Please select a service");
      return;
    }

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
        toast.success("Order placed!");
        navigate("/order/payment", {
          state: {
            orderId: order_id,
            qrData: qr_data,
            total: total * 100,
          },
        });
      })
      .catch((err: any) => {
        const msg =
          err?.response?.data?.detail ??
          err?.response?.data ??
          err.message ??
          "Server error";
        toast.error(msg);
      })
      .finally(() => setIsSubmitting(false));
  };

  // Block anonymous users
  if (!user) return <Navigate to="/login" replace />;

  // Handle loading and errors for catalog data
  if (servicesQuery.isLoading || extrasQuery.isLoading) {
    return <Loading text="Loading order form..." />;
  }
  if (servicesQuery.error || extrasQuery.error) {
    return <ErrorMessage message="Failed to load order form data." onRetry={() => window.location.reload()} />;
  }

  // Render
  return (
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

        {/* 4.  Live total & submit */}
        <div className="mt-4 font-bold text-base text-center">
          Total: R {total}
        </div>
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
  );
};

export default OrderForm;
