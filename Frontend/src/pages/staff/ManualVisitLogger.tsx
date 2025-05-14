import React, { useState } from "react";
import axios from "axios";

const ManualVisitLogger: React.FC = () => {
  const [cell, setCell] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const isValidCell = /^0\d{9}$/.test(cell);

  const logVisit = async () => {
    setStatus(null);
    if (!isValidCell) {
      setStatus("❌ Invalid cellphone number");
      return;
    }
    setLoading(true);
    try {
      await axiosAuth.post("/api/auth/visits/manual", { cellphone: cell });
      setStatus("✅ Visit logged!");
      setCell("");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setStatus("❌ Not authenticated. Please log in again.");
      } else if (err.response?.data?.message) {
        setStatus(`❌ ${err.response.data.message}`);
      } else {
        setStatus("❌ Could not log visit");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ marginBottom: 32, maxWidth: 400, padding: 24, background: "#fafbfc", borderRadius: 8 }}>
      <h2>Manual Visit Logging (POS)</h2>
      <input
        placeholder="Client Cellphone"
        value={cell}
        onChange={e => setCell(e.target.value)}
        style={{ marginRight: 8, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        disabled={loading}
        maxLength={10}
        inputMode="numeric"
      />
      <button onClick={logVisit} disabled={!isValidCell || loading} style={{ padding: "8px 16px" }}>
        {loading ? "Logging..." : "Log Visit"}
      </button>
      {status && (
        <p style={{ color: status.startsWith("✅") ? "green" : "red", marginTop: 8 }}>
          {status}
        </p>
      )}
    </section>
  );
};

export default ManualVisitLogger;