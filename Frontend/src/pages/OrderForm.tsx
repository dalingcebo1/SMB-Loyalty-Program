// src/pages/OrderForm.tsx
import React, { useState, useEffect } from "react";
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
  // Catalog state
  const [byCategory, setByCategory] = useState<Record<string, Service[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Service & quantity
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | "">("");
  const [serviceQuantity, setServiceQuantity] = useState<number>(1);

  // Extras & quantities
  const [allExtras, setAllExtras] = useState<Extra[]>([]);
  const [extraQuantities, setExtraQuantities] = useState<Record<number, number>>({});

  const navigate = useNavigate();

  // Fetch catalog on mount
  useEffect(() => {
    api.get("/catalog/services").then((res) => {
      const data: Record<string, Service[]> = res.data;
      setByCategory(data);
      const cats = Object.keys(data);
      setCategories(cats);
      if (cats.length) {
        setSelectedCategory(cats[0]);
        setServices(data[cats[0]]);
      }
    });
    api.get("/catalog/extras").then((res) => {
      setAllExtras(res.data);
    });
  }, []);

  // When category changes
  useEffect(() => {
    if (selectedCategory) {
      setServices(byCategory[selectedCategory] || []);
      setSelectedServiceId("");
      setServiceQuantity(1);
      // reset extras for this category
      const ids = (allExtras || [])
        .filter((e) => e.price_map[selectedCategory] != null)
        .map((e) => e.id);
      setExtraQuantities(ids.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}));
    }
  }, [selectedCategory, byCategory, allExtras]);

  const filteredExtras = allExtras.filter((e) =>
    e.price_map[selectedCategory] != null
  );

  // Stepper helpers
  const incService = () => setServiceQuantity((q) => q + 1);
  const decService = () => setServiceQuantity((q) => Math.max(1, q - 1));

  const incExtra = (id: number) =>
    setExtraQuantities((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const decExtra = (id: number) =>
    setExtraQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) - 1),
    }));

  // Total calculation
  const total = (() => {
    const svc = services.find((s) => s.id === selectedServiceId);
    const svcTotal = svc ? svc.base_price * serviceQuantity : 0;
    const extrasTotal = filteredExtras.reduce(
      (sum, ex) =>
        sum + (ex.price_map[selectedCategory] || 0) * (extraQuantities[ex.id] || 0),
      0
    );
    return svcTotal + extrasTotal;
  })();

  // --- Updated submission handler ----
  const handleSubmit = async () => {
    if (!selectedServiceId) {
      return alert("Please pick a service");
    }

    try {
      const response = await api.post("/orders/create", {
        service_id: selectedServiceId,
        quantity: serviceQuantity,
        extras: Object.entries(extraQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => ({ id: Number(id), quantity: qty })),
      });

      // Expect { order_id: string, qr_data: string }
      const { order_id, qr_data } = response.data;

      // Navigate to confirmation, passing the payload
      navigate("/order/confirmation", {
        state: { orderId: order_id, qrData: qr_data },
      });
    } catch (err: any) {
      console.error("Order creation failed:", err);
      alert("Something went wrong. Please try again.");
    }
  };
  // -----------------------------------

  return (
    <div
      style={{
        height: "100vh",
        overflowY: "auto",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <h1>Book a Service</h1>

      {/* Category */}
      <section>
        <h2>1. Pick a Category</h2>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </section>

      {/* Service + quantity inline */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2>2. Pick a Service</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(Number(e.target.value))}
            style={{ flexGrow: 1 }}
          >
            <option value="">-- select a service --</option>
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name} — R{svc.base_price}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button onClick={decService} disabled={serviceQuantity <= 1}>
              –
            </button>
            <span>{serviceQuantity}</span>
            <button onClick={incService}>+</button>
          </div>
        </div>
      </section>

      {/* Extras with steppers */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2>3. Extras</h2>
        {filteredExtras.length === 0 ? (
          <p>No extras for this category.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {filteredExtras.map((ext) => (
              <li
                key={ext.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                }}
              >
                <span>
                  {ext.name} — R{ext.price_map[selectedCategory]}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <button
                    onClick={() => decExtra(ext.id)}
                    disabled={(extraQuantities[ext.id] || 0) <= 0}
                  >
                    –
                  </button>
                  <span>{extraQuantities[ext.id] || 0}</span>
                  <button onClick={() => incExtra(ext.id)}>+</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Total & Submit */}
      <section
        style={{
          marginTop: "2rem",
          borderTop: "1px solid #ddd",
          paddingTop: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Total:</strong>
        <strong>R{total}</strong>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <button onClick={handleSubmit}>Submit Order</button>
      </section>
    </div>
  );
};

export default OrderForm;
