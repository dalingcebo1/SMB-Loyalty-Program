import React, { useState } from "react";
import axios from "axios";

const PaymentVerification: React.FC = () => {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const verify = async () => {
    setStatus("");
    setLoading(true);
    try {
      await axiosAuth.get(`/api/payments/verify/${ref}`);
      setStatus("✅ Payment OK—start the wash!");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setStatus("❌ Not authenticated. Please log in again.");
      } else {
        setStatus("❌ Invalid or unpaid reference");
      }
    }
    setLoading(false);
  };

  return (
    <section style={{ marginBottom: 32, maxWidth: 400, padding: 24, background: "#fafbfc", borderRadius: 8 }}>
      <h2>Verify Payment</h2>
      <input
        placeholder="Payment reference"
        value={ref}
        onChange={e => setRef(e.target.value)}
        style={{ marginRight: 8, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        disabled={loading}
      />
      <button onClick={verify} disabled={!ref.trim() || loading} style={{ padding: "8px 16px" }}>
        {loading ? "Verifying..." : "Verify Payment"}
      </button>
      <p style={{ color: status.startsWith("✅") ? "green" : "red", marginTop: 8 }}>{status}</p>
    </section>
  );
};

export default PaymentVerification;