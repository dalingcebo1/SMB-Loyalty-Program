import React, { useState } from "react";
import axios from "axios";
import { toast } from 'react-toastify';
import TableContainer from '../../../components/ui/TableContainer';
import './ManualVisitLogger.css';

// Types for backend response and log history
interface VisitResponse {
  message: string;
  phone: string;
  name: string;
  count: number;
  nextMilestone: number;
}

interface VisitLog {
  timestamp: string;
  phone: string;
  name: string;
  count: number;
}

interface ApiError {
  response?: {
    status: number;
    data?: {
      message?: string;
    };
  };
}


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
  const [nextMilestone, setNextMilestone] = useState<number | null>(null);
  const [history, setHistory] = useState<VisitLog[]>([]);
  // use react-toastify for notifications

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
      setNextMilestone(data.nextMilestone);
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
  toast.success("Visit logged! You can now start a wash for this client.");
  } catch (err: unknown) {
      setLastVisit(null);
      const error = err as ApiError;
      if (error.response?.status === 401 || error.response?.status === 403) {
        setStatus("Not authenticated. Please log in again.");
      } else if (error.response?.data?.message) {
        setStatus(error.response.data.message);
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
  toast.success("Wash started for POS client!");
      setStatus(null);
    } catch {
      setStatus("Could not start wash for POS client.");
    }
    setLoading(false);
  };

  return (
    <div className="manual-visit-page">
      {/* Hero / Intro */}
      <section className="manual-visit-hero">
        <h1>Manual Visit Logging</h1>
        <p>
          Record loyalty visits & start washes for POS / cash customers without QR codes.
          Enter their phone number (073…) to update loyalty and optionally initiate a wash.
        </p>
      </section>

      <div className="manual-visit-grid">
        {/* Form Card */}
        <div className="manual-visit-card">
          <h2><span className="emoji">📝</span> Log a Visit</h2>
          <div className="manual-visit-form">
            <input
              type="tel"
              placeholder="Client Cellphone (e.g. 0731234567)"
              aria-label="Client cellphone number"
              value={cell}
              onChange={e => setCell(e.target.value.replace(/[^0-9]/g, ""))}
              disabled={loading}
              maxLength={10}
              inputMode="numeric"
            />
          </div>
          <div className="manual-visit-actions">
            <button
              className="manual-visit-btn"
              onClick={confirmAndLog}
              disabled={!isValidCell || loading}
            >
              {loading ? "Logging…" : "Log Visit"}
            </button>
            {lastVisit && status?.startsWith("Visit logged") && (
              <button
                className="manual-visit-btn secondary"
                onClick={handleStartWash}
                disabled={loading}
              >
                {loading ? "Starting…" : "Start Wash"}
              </button>
            )}
          </div>
          {status && (
            <div
              className={`manual-visit-status ${status.toLowerCase().includes('could not') || status.toLowerCase().includes('invalid') ? 'error' : ''}`}
              role="status" aria-live="polite"
            >
              {status}
            </div>
          )}
          {lastVisit && status?.startsWith("Visit logged") && (
            <div className="manual-visit-summary">
              <h3>✅ Visit Recorded</h3>
              <p>{lastVisit.name} ({normalizePhone(lastVisit.phone)})</p>
              <div className="meta">Total Visits: {lastVisit.count}</div>
              {nextMilestone !== null && (
                <div className="manual-visit-tip">{nextMilestone - lastVisit.count} to free wash</div>
              )}
            </div>
          )}
        </div>

        {/* Recent History Card */}
        <div className="manual-visit-card">
            <h2><span className="emoji">🕒</span> Recent Logs</h2>
            <div className="manual-visit-divider" />
            {history.length === 0 && <p style={{opacity:.7,fontSize:'.85rem'}}>No visits this session yet.</p>}
            {history.length > 0 && (
              <div className="manual-visit-history">
                <TableContainer>
                  <ul>
                    {history.map((log, idx) => (
                      <li key={idx}>
                        <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="primary">{log.name} ({normalizePhone(log.phone)})</span>
                        <span className="manual-visit-badge">{log.count} visits</span>
                      </li>
                    ))}
                  </ul>
                </TableContainer>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ManualVisitLogger;