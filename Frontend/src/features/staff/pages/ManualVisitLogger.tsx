import React, { useState } from "react";
import api from "../../../api/api";
import { toast } from 'react-toastify';
import StaffPageContainer from '../components/StaffPageContainer';

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

  const isValidCell = /^0\d{9}$/.test(cell);

  const logVisit = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/visits/manual", { cellphone: cell });
      const data: VisitResponse = res.data;
      setStatus(`Visit logged for ${data.name} (${normalizePhone(data.phone)})`);
      setLastVisit(data);
      setNextMilestone(data.nextMilestone);
      setHistory(prev => [
        {
          timestamp: new Date().toISOString(),
          phone: data.phone,
          name: data.name,
          count: data.count
        },
        ...prev.slice(0, 4)
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

  const handleStartWash = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await api.post("/payments/start-manual-wash", { phone: normalizePhone(lastVisit?.phone || "") });
      toast.success("Wash started for POS client!");
      setStatus(null);
    } catch {
      setStatus("Could not start wash for POS client.");
    }
    setLoading(false);
  };

  return (
    <div className="manual-visit-logger space-y-8">
      <StaffPageContainer
        as="div"
        surface="glass"
        width="xl"
        padding="relaxed"
        className="relative overflow-hidden text-white"
      >
        <div className="relative z-10 space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Manual Visit Logging</h1>
          <p className="text-sm sm:text-base text-blue-100">Record loyalty visits & start washes for POS customers without QR codes</p>
        </div>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
      </StaffPageContainer>

      <StaffPageContainer as="div" surface="plain" width="xl" padding="default" className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100">
                <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Log a Visit</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Client Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="0731234567"
                  aria-label="Client cellphone number"
                  value={cell}
                  onChange={event => setCell(event.target.value.replace(/[^0-9]/g, ""))}
                  disabled={loading}
                  maxLength={10}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {cell && !isValidCell && (
                  <p className="mt-1 text-xs text-red-600">Please enter a valid 10-digit number starting with 0</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmAndLog}
                  disabled={!isValidCell || loading}
                  className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                        Starting…
                      </span>
                    ) : (
                      'Start Wash'
                    )}
                  </button>
                )}
              </div>

              {status && (
                <div
                  className={`rounded-lg border p-4 ${
                    status.toLowerCase().includes('could not') || status.toLowerCase().includes('invalid')
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <div className="text-sm font-medium">{status}</div>
                </div>
              )}

              {lastVisit && status?.startsWith("Visit logged") && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="font-semibold text-green-900">Visit Recorded</h3>
                  </div>
                  <p className="font-medium text-green-800">{lastVisit.name} ({normalizePhone(lastVisit.phone)})</p>
                  <div className="mt-2 text-sm text-green-700">
                    <div>Total visits: <span className="font-medium">{lastVisit.count}</span></div>
                    {nextMilestone !== null && (
                      <div className="mt-1 inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium">
                        {nextMilestone - lastVisit.count} visits to next reward
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="font-medium text-gray-700">No visits logged yet</div>
                <div className="mt-1 text-sm text-gray-500">Recent activity will appear here</div>
              </div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {history.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {log.name} ({normalizePhone(log.phone)})
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="ml-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {log.count} visits
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </StaffPageContainer>
    </div>
  );
};

export default ManualVisitLogger;