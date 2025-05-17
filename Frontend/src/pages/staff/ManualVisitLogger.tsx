import React, { useState } from "react";
import axios from "axios";

// Types for backend response and log history
interface VisitResponse {
  message: string;
  phone: string;
  name: string;
  count: number;
}

interface VisitLog {
  timestamp: string;
  phone: string;
  name: string;
  count: number;
}

const ManualVisitLogger: React.FC = () => {
  const [cell, setCell] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastVisit, setLastVisit] = useState<VisitResponse | null>(null);
  const [history, setHistory] = useState<VisitLog[]>([]);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const isValidCell = /^0\d{9}$/.test(cell);

  // Confirmation dialog before logging
  const confirmAndLog = async () => {
    setStatus(null);
    if (!isValidCell) {
      setStatus("❌ Invalid cellphone number");
      return;
    }
    const confirmed = window.confirm(
      `Log a visit for ${cell}? This action cannot be undone.`
    );
    if (!confirmed) return;
    await logVisit();
  };

  const logVisit = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const res = await axiosAuth.post("/api/auth/visits/manual", { cellphone: cell });
      // Expecting backend to return: { message, phone, name, count }
      const data: VisitResponse = res.data;
      setStatus(`✅ ${data.message}`);
      setLastVisit(data);
      setHistory(prev => [
        {
          timestamp: new Date().toISOString(),
          phone: data.phone,
          name: data.name,
          count: data.count,
        },
        ...prev.slice(0, 4), // Keep last 5 logs
      ]);
      setCell("");
    } catch (err: any) {
      setLastVisit(null);
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
      <button onClick={confirmAndLog} disabled={!isValidCell || loading} style={{ padding: "8px 16px" }}>
        {loading ? "Logging..." : "Log Visit"}
      </button>
      {status && (
        <p style={{ color: status.startsWith("✅") ? "green" : "red", marginTop: 8 }}>
          {status}
        </p>
      )}
      {lastVisit && status?.startsWith("✅") && (
        <div style={{ marginTop: 12, background: "#e6f7e6", padding: 12, borderRadius: 6 }}>
          <strong>Client:</strong> {lastVisit.name} <br />
          <strong>Phone:</strong> {lastVisit.phone} <br />
          <strong>Total Visits:</strong> {lastVisit.count}
          <button
            style={{
              marginTop: 12,
              padding: "8px 16px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
            onClick={async () => {
              setLoading(true);
              try {
                await axiosAuth.post(`/api/payments/start-wash/manual/${lastVisit.phone}`);
                setStatus("🚗 Wash started for POS client!");
              } catch {
                setStatus("❌ Could not start wash for POS client.");
              }
              setLoading(false);
            }}
          >
            Start Wash
          </button>
        </div>
      )}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 8 }}>Recent Visit Logs</h4>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {history.map((log, idx) => (
              <li key={idx} style={{ background: "#f6f8fa", marginBottom: 6, padding: 8, borderRadius: 4, fontSize: 14 }}>
                <span style={{ color: "#888" }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                {" — "}
                <strong>{log.name}</strong> ({log.phone}) — Visits: {log.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default ManualVisitLogger;