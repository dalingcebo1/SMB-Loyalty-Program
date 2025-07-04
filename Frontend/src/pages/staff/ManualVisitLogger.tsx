import React, { useState, useEffect } from "react";
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

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded shadow z-50">
      {message}
      <button className="ml-4 text-white font-bold" onClick={onClose}>&times;</button>
    </div>
  );
};

const normalizePhone = (phone: string) => {
  // Always return as 073... (South African local format)
  if (phone.startsWith("+27")) {
    return "0" + phone.slice(3);
  }
  if (phone.startsWith("27")) {
    return "0" + phone.slice(2);
  }
  return phone;
};

const ManualVisitLogger: React.FC = () => {
  const [cell, setCell] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastVisit, setLastVisit] = useState<VisitResponse | null>(null);
  const [history, setHistory] = useState<VisitLog[]>([]);
  const [toast, setToast] = useState<string | null>(null);

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
      setStatus("Invalid cellphone number");
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
      const res = await axiosAuth.post("/auth/visits/manual", { cellphone: cell });
      // Expecting backend to return: { message, phone, name, count }
      const data: VisitResponse = res.data;
      setStatus(`Visit logged for ${data.name} (${normalizePhone(data.phone)})`);
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
      setToast("Visit logged! You can now start a wash for this client.");
    } catch (err: any) {
      setLastVisit(null);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setStatus("Not authenticated. Please log in again.");
      } else if (err.response?.data?.message) {
        setStatus(err.response.data.message);
      } else {
        setStatus("Could not log visit");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartWash = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await axiosAuth.post("/api/payments/start-manual-wash", { phone: normalizePhone(lastVisit?.phone || "") });
      setToast("Wash started for POS client!");
      setStatus(null);
    } catch {
      setStatus("Could not start wash for POS client.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow mt-10">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold mb-4 text-center">Manual Visit Logging</h1>
      <p className="text-gray-600 mb-6 text-center">
        For clients paying at the till (POS). Enter the customer's phone number to log a visit and start a wash. No payment or QR code required.
      </p>
      <div className="flex flex-col items-center gap-4">
        <input
          type="tel"
          placeholder="Client Cellphone (e.g. 0731234567)"
          value={cell}
          onChange={e => setCell(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-full px-4 py-2 border border-gray-300 rounded text-lg"
          disabled={loading}
          maxLength={10}
          inputMode="numeric"
        />
        <button
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium text-lg hover:bg-blue-700 transition"
          onClick={confirmAndLog}
          disabled={!isValidCell || loading}
        >
          {loading ? "Logging..." : "Log Visit"}
        </button>
        {status && (
          <div className="text-center text-base text-green-700">
            {status}
          </div>
        )}
        {lastVisit && status?.startsWith("Visit logged") && (
          <div className="w-full mt-4 bg-blue-50 p-4 rounded shadow text-center">
            <div className="font-semibold text-lg mb-2">Client: {lastVisit.name}</div>
            <div className="mb-1 text-base">Phone: {normalizePhone(lastVisit.phone)}</div>
            <div className="mb-2 text-base">Total Visits: {lastVisit.count}</div>
            <button
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded font-medium text-base hover:bg-green-700 transition"
              onClick={handleStartWash}
              disabled={loading}
            >
              {loading ? "Starting..." : "Start Wash"}
            </button>
          </div>
        )}
        {history.length > 0 && (
          <div className="w-full mt-8">
            <h4 className="font-semibold mb-2 text-center">Recent Visit Logs</h4>
            <ul className="space-y-2">
              {history.map((log, idx) => (
                <li
                  key={idx}
                  className="bg-gray-100 rounded px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between text-base"
                >
                  <span className="text-gray-500 mb-1 md:mb-0 md:mr-2" style={{ minWidth: 80 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="flex-1 text-center md:text-left">
                    <strong>{log.name}</strong> ({normalizePhone(log.phone)}) — Visits: {log.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualVisitLogger;