// src/pages/OrderForm.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../api/api";

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
  const navigate = useNavigate();

  //
  // 1) Fetch services by category (v5 single-arg style)
  //
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: async (): Promise<Record<string, Service[]>> => {
      const { data } = await api.get("/catalog/services");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  //
  // 2) Fetch extras & dedupe
  //
  const extrasQuery = useQuery({
    queryKey: ["extras"],
    queryFn: async (): Promise<Extra[]> => {
      const { data: raw } = await api.get<Extra[]>("/catalog/extras");
      return Array.from(new Map(raw.map((e: Extra) => [e.id, e])).values());
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (extrasQuery.error) toast.error("Failed to load extras");
  }, [extrasQuery.error]);

  useEffect(() => {
    if (servicesQuery.error) toast.error("Failed to load services");
  }, [servicesQuery.error]);

  //
  // TS-safe defaults so indexing/map works
  //
  const servicesByCategory: Record<string, Service[]> =
    servicesQuery.data ?? {};
  const extras: Extra[] = extrasQuery.data ?? [];

  //
  // 3) Local UI state
  //
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [extraQuantities, setExtraQuantities] = useState<
    Record<number, number>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  //
  // 4) When services load, pick first category + service (only once)
  //
  useEffect(() => {
    // guard: only if nothing selected yet
    if (selectedCategory) return;

    const cats = Object.keys(servicesByCategory);
    if (cats.length) {
      setSelectedCategory(cats[0]);
      setSelectedServiceId(servicesByCategory[cats[0]][0]?.id ?? null);
    }
  }, [servicesByCategory, selectedCategory]);

  //
  // 5) Zero-out extras when they load (only once)
  //
  useEffect(() => {
    // guard: only if we haven't initialized extras yet
    if (Object.keys(extraQuantities).length > 0) return;
    if (!extras.length) return;

    const init: Record<number, number> = {};
    extras.forEach((e) => {
      init[e.id] = 0;
    });
    setExtraQuantities(init);
  }, [extras, extraQuantities]);

  //
  // 6) When category changes, reset service qty & selection
  //
  useEffect(() => {
    if (
      selectedCategory &&
      servicesByCategory[selectedCategory]?.length
    ) {
      setServiceQuantity(1);
      setSelectedServiceId(servicesByCategory[selectedCategory][0].id);
    }
  }, [selectedCategory, servicesByCategory]);

  //
  // 7) Increment / decrement handlers
  //
  const incService = () => setServiceQuantity((q) => q + 1);
  const decService = () => setServiceQuantity((q) => Math.max(1, q - 1));
  const incExtra = (id: number) =>
    setExtraQuantities((q) => ({ ...q, [id]: (q[id] || 0) + 1 }));
  const decExtra = (id: number) =>
    setExtraQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }));

  //
  // 8) Compute total
  //
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

  //
  // 9) Submit order
  //
  const handleSubmit = () => {
    if (selectedServiceId == null) {
      toast.warning("Please select a service");
      return;
    }
    setIsSubmitting(true);

    const payload = {
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
        navigate("/order/confirmation", {
          state: { orderId: order_id, qrData: qr_data },
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

  //
  // 10) Loading skeleton
  //
  if (servicesQuery.isLoading || extrasQuery.isLoading) {
    return <div style={{ padding: "1rem", textAlign: "center" }}>Loading…</div>;
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <ToastContainer position="top-right" />

      <h1>Book a Service</h1>

      <section>
        <h2>1. Pick a Category</h2>
        <select
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

      <section style={{ marginTop: "1rem" }}>
        <h2>2. Pick a Service</h2>
        <div style={{ display: "flex", alignItems: "center" }}>
          <select
            value={selectedServiceId ?? undefined}
            onChange={(e) => setSelectedServiceId(Number(e.target.value))}
          >
            {servicesByCategory[selectedCategory]?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — R{s.base_price}
              </option>
            ))}
          </select>
          <button onClick={decService} style={{ margin: "0 8px" }}>
            −
          </button>
          <span>{serviceQuantity}</span>
          <button onClick={incService} style={{ margin: "0 8px" }}>
            +
          </button>
        </div>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2>3. Extras</h2>
        {extras.map((e) => (
          <div
            key={e.id}
            style={{
              display: "flex",
              alignItems: "center",
              margin: "0.5rem 0",
            }}
          >
            <div style={{ flex: 1 }}>
              {e.name} — R{e.price_map[selectedCategory] ?? 0}
            </div>
            <button onClick={() => decExtra(e.id)}>−</button>
            <span style={{ margin: "0 8px" }}>{extraQuantities[e.id]}</span>
            <button onClick={() => incExtra(e.id)}>+</button>
          </div>
        ))}
      </section>

      <div style={{ marginTop: "1rem", fontWeight: "bold" }}>
        Total: R {total}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          opacity: isSubmitting ? 0.6 : 1,
          cursor: isSubmitting ? "not-allowed" : "pointer",
        }}
      >
        {isSubmitting ? "Submitting…" : "Submit Order"}
      </button>
    </div>
  );
};

export default OrderForm;
