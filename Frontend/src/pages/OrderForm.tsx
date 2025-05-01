// src/pages/OrderForm.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [categories, setCategories] = useState<string[]>([]);
  const [servicesByCategory, setServicesByCategory] = useState<Record<string,Service[]>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<number|null>(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [extraQuantities, setExtraQuantities] = useState<Record<number,number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // fetch services & extras
  useEffect(() => {
    api.get("/catalog/services")
      .then(res => {
        const data = res.data as Record<string,Service[]>;
        setServicesByCategory(data);
        const cats = Object.keys(data);
        setCategories(cats);
        if (cats.length) {
          setSelectedCategory(cats[0]);
          setSelectedServiceId(data[cats[0]][0]?.id ?? null);
        }
      })
      .catch(console.error);

    api.get("/catalog/extras")
      .then(res => {
        const raw = res.data as Extra[];
        // dedupe by id
        const unique = Array.from(new Map(raw.map(e => [e.id, e])).values());
        setExtras(unique);
        const init: Record<number,number> = {};
        unique.forEach(e => { init[e.id] = 0; });
        setExtraQuantities(init);
      })
      .catch(console.error);
  }, []);

  // reset service & qty when category changes
  useEffect(() => {
    if (selectedCategory && servicesByCategory[selectedCategory]?.length) {
      setSelectedServiceId(servicesByCategory[selectedCategory][0].id);
      setServiceQuantity(1);
    }
  }, [selectedCategory, servicesByCategory]);

  const incService = () => setServiceQuantity(q => q + 1);
  const decService = () => setServiceQuantity(q => Math.max(1, q - 1));
  const incExtra   = (id: number) => setExtraQuantities(q => ({ ...q, [id]: q[id] + 1 }));
  const decExtra   = (id: number) => setExtraQuantities(q => ({ ...q, [id]: Math.max(0, q[id] - 1) }));

  const total = (() => {
    let sum = 0;
    if (selectedCategory && selectedServiceId != null) {
      const svc = servicesByCategory[selectedCategory]?.find(s => s.id === selectedServiceId);
      if (svc) sum += svc.base_price * serviceQuantity;
    }
    extras.forEach(e => {
      const qty = extraQuantities[e.id] || 0;
      if (qty > 0 && selectedCategory) {
        sum += (e.price_map[selectedCategory] ?? 0) * qty;
      }
    });
    return sum;
  })();

  const handleSubmit = () => {
    if (selectedServiceId == null) {
      alert("Please select a service.");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      service_id: selectedServiceId,
      quantity: serviceQuantity,
      extras: Object.entries(extraQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ id: Number(id), quantity: qty }))
    };

    api.post("/orders/create", payload)
      .then(res => {
        const { order_id, qr_data } = res.data;
        navigate("/order/confirmation", {
          state: { orderId: order_id, qrData: qr_data }
        });
      })
      .catch(err => {
        console.error("Order creation failed:", err);
        const msg = err?.response?.data?.detail
          ?? err?.response?.data
          ?? err.message
          ?? "Unknown server error";
        alert(msg);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Book a Service</h1>

      <section>
        <h2>1. Pick a Category</h2>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2>2. Pick a Service</h2>
        <div style={{ display: "flex", alignItems: "center" }}>
          <select
            value={selectedServiceId ?? undefined}
            onChange={e => setSelectedServiceId(Number(e.target.value))}
          >
            {selectedCategory && servicesByCategory[selectedCategory].map(s =>
              <option key={s.id} value={s.id}>
                {s.name} — R{s.base_price}
              </option>
            )}
          </select>
          <button onClick={decService} style={{ margin: "0 8px" }}>−</button>
          <span>{serviceQuantity}</span>
          <button onClick={incService} style={{ margin: "0 8px" }}>+</button>
        </div>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2>3. Extras</h2>
        {extras.map(e =>
          <div key={e.id} style={{ display: "flex", alignItems: "center", margin: "0.5rem 0" }}>
            <div style={{ flex: 1 }}>
              {e.name} — R{e.price_map[selectedCategory] ?? 0}
            </div>
            <button onClick={() => decExtra(e.id)}>−</button>
            <span style={{ margin: "0 8px" }}>{extraQuantities[e.id] || 0}</span>
            <button onClick={() => incExtra(e.id)}>+</button>
          </div>
        )}
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
          cursor: isSubmitting ? "not-allowed" : "pointer"
        }}
      >
        {isSubmitting ? "Submitting…" : "Submit Order"}
      </button>
    </div>
  );
};

export default OrderForm;
