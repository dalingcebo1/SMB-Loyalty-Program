import React, { useState } from "react";
import api from "../../../api/api";
import { toast } from 'react-toastify';

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

  // Shared API client attaches Authorization token and honors VITE_API_BASE_URL

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
  const res = await api.post("/api/auth/visits/manual", { cellphone: cell });
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
  await api.post("/api/payments/start-manual-wash", { phone: normalizePhone(lastVisit?.phone || "") });
  toast.success("Wash started for POS client!");
      setStatus(null);
    } catch {
      setStatus("Could not start wash for POS client.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight">Manual Visit Logging</h1>
            <p className="mt-1 text-teal-100">Record loyalty visits & start washes for POS customers without QR codes</p>
          </div>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Log a Visit</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="0731234567"
                  aria-label="Client cellphone number"
                  value={cell}
                  onChange={e => setCell(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={loading}
                  maxLength={10}
                  inputMode="numeric"
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {cell && !isValidCell && (
                  <p className="mt-1 text-xs text-red-600">Please enter a valid 10-digit number starting with 0</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmAndLog}
                  disabled={!isValidCell || loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Logging…
                    </span>
                  ) : (
                    'Log Visit'
                  )}
                </button>
                
                {lastVisit && status?.startsWith("Visit logged") && (
                  <button
                    onClick={handleStartWash}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-white border-2 border-teal-600 text-teal-600 hover:bg-teal-50 disabled:opacity-50 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                        Starting…
                      </span>
                    ) : (
                      'Start Wash'
                    )}
                  </button>
                )}
              </div>

              {status && (
                <div className={`p-4 rounded-lg ${
                  status.toLowerCase().includes('could not') || status.toLowerCase().includes('invalid') 
                    ? 'bg-red-50 border border-red-200 text-red-700' 
                    : 'bg-green-50 border border-green-200 text-green-700'
                }`}>
                  <div className="text-sm font-medium">{status}</div>
                </div>
              )}

              {lastVisit && status?.startsWith("Visit logged") && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="font-semibold text-green-900">Visit Recorded</h3>
                  </div>
                  <p className="text-green-800 font-medium">{lastVisit.name} ({normalizePhone(lastVisit.phone)})</p>
                  <div className="mt-2 text-sm text-green-700">
                    <div>Total visits: <span className="font-medium">{lastVisit.count}</span></div>
                    {nextMilestone !== null && (
                      <div className="mt-1 px-2 py-1 bg-green-100 rounded text-xs font-medium inline-block">
                        {nextMilestone - lastVisit.count} visits to next reward
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent History Card */}
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            
            {history.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="font-medium text-gray-700">No visits logged yet</div>
                <div className="text-sm text-gray-500 mt-1">Recent activity will appear here</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {history.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {log.name} ({normalizePhone(log.phone)})
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="ml-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {log.count} visits
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualVisitLogger;