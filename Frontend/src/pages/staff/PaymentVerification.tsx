import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { QrReader } from "react-qr-reader";

// Types for user and vehicle
interface Vehicle {
  id: number;
  reg: string;
  make: string;
  model: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
}

interface Wash {
  order_id: string;
  user?: User;
  vehicle?: Vehicle;
  payment_pin?: string;
  started_at: string;
  ended_at?: string;
  status: "started" | "ended";
  service_name?: string; // Wash type
  extras?: string[];     // Extras selected
}

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded shadow z-50">
    {message}
    <button className="ml-4 text-white font-bold" onClick={onClose}>&times;</button>
  </div>
);

const PaymentVerification: React.FC = () => {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<{ order_id: string; user?: User; payment_pin?: string } | null>(null);
  const [washStarted, setWashStarted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [activeWashes, setActiveWashes] = useState<Wash[]>([]);
  const [confirmEndWash, setConfirmEndWash] = useState<string | null>(null); // order_id to confirm

  // Use a ref for hasScanned to prevent race conditions
  const hasScannedRef = useRef(false);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Fetch active washes for today
  const fetchActiveWashes = async () => {
    try {
      const res = await axiosAuth.get("/api/payments/active-washes");
      setActiveWashes(res.data);
    } catch {
      setActiveWashes([]);
    }
  };

  useEffect(() => {
    fetchActiveWashes();
    // Optionally poll every minute
    const interval = setInterval(fetchActiveWashes, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  // Fetch user and vehicles by order_id (after verify)
  const fetchUserAndVehicles = async (order_id: string) => {
    try {
      const res = await axiosAuth.get(`/api/payments/order-user/${order_id}`);
      setUser(res.data.user);
      setVehicles(res.data.vehicles || []);
      setSelectedVehicle(res.data.vehicles?.[0] || null);
    } catch {
      setUser(null);
      setVehicles([]);
      setSelectedVehicle(null);
    }
  };

  const verify = async (referenceOrPin: string) => {
    setStatus("");
    setLoading(true);
    setVerifiedOrder(null);
    setUser(null);
    setVehicles([]);
    setSelectedVehicle(null);
    try {
      const res = await axiosAuth.get(`/api/payments/verify/${referenceOrPin}`);
      if (res.data.status === "ok") {
        setStatus("✅ Payment OK—start the wash!");
        setVerifiedOrder({
          order_id: res.data.order_id,
          payment_pin: res.data.payment_pin,
        });
        // Fetch user and vehicles for this order
        fetchUserAndVehicles(res.data.order_id);
      } else if (res.data.status === "already_redeemed") {
        setStatus("❌ This payment has already been redeemed.");
      } else {
        setStatus("❌ Invalid or unpaid reference");
      }
    } catch (err: any) {
      setStatus("❌ Invalid or unpaid reference");
    }
    setLoading(false);
  };

  const handleManualVerify = () => {
    if (ref.length === 4 && /^\d{4}$/.test(ref)) {
      verify(ref);
    } else {
      setStatus("❌ Please enter a valid 4-digit PIN.");
    }
  };

  const handleStartWash = async () => {
    if (!verifiedOrder) return;
    if (!selectedVehicle) {
      setStatus("❌ Please select a vehicle before starting the wash.");
      return;
    }
    setLoading(true);
    try {
      await axiosAuth.post(`/api/payments/start-wash/${verifiedOrder.order_id}`, {
        vehicle_id: selectedVehicle.id,
      });
      setWashStarted(true);
      setStatus("🚗 Wash started!");
      setToast("Wash started!");
      fetchActiveWashes();
    } catch {
      setStatus("❌ Could not start wash.");
    }
    setLoading(false);
  };

  // Remove End Wash button from main section, but keep it in active washes list

  const handleOpenScanner = () => {
    hasScannedRef.current = false;
    setRef(""); // Clear last scanned value
    setStatus(""); // Clear status
    setVerifiedOrder(null); // Clear previous order
    setUser(null);
    setVehicles([]);
    setSelectedVehicle(null);
    setShowScanner((prev) => !prev);
  };

  // End wash from active washes list, with confirmation
  const handleEndWashFromList = async (order_id: string) => {
    setConfirmEndWash(order_id);
  };

  const confirmEndWashAction = async () => {
    if (!confirmEndWash) return;
    setLoading(true);
    try {
      await axiosAuth.post(`/api/payments/end-wash/${confirmEndWash}`);
      setToast("Wash ended!");
      fetchActiveWashes();
    } catch {
      setToast("❌ Could not end wash.");
    }
    setLoading(false);
    setConfirmEndWash(null);
  };

  // Prompt to add vehicle if none found
  const handleAddVehicle = () => {
    window.open("/staff/vehiclemanager", "_blank");
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Confirm End Wash Modal */}
      {confirmEndWash && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">Are you sure?</h3>
            <p className="mb-4">Do you want to end this wash? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => setConfirmEndWash(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded"
                onClick={confirmEndWashAction}
                disabled={loading}
              >
                Yes, End Wash
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Payment Verification</h1>
        <div className="flex flex-col items-center">
          <button
            onClick={handleOpenScanner}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
          >
            {showScanner ? "Close QR Scanner" : "Scan QR Code"}
          </button>
          {showScanner && (
            <div className="mb-4 w-full flex justify-center">
              <div className="w-72 max-w-full">
                <QrReader
                  constraints={{ facingMode: { exact: "environment" } }}
                  onResult={(result: any) => {
                    if (!hasScannedRef.current && result?.getText) {
                      hasScannedRef.current = true; // Prevent further scans
                      setShowScanner(false);
                      const text = result.getText();
                      setRef(text); // This is just for display, not for logic
                      verify(text); // Always call verify, even if text === ref
                    }
                  }}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-col items-center">
            <input
              placeholder="Enter 4-digit payment PIN"
              value={ref}
              onChange={e => setRef(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mb-2 px-4 py-2 border border-gray-300 rounded w-48 text-center"
              disabled={loading}
              maxLength={4}
              inputMode="numeric"
            />
            <button
              onClick={handleManualVerify}
              disabled={loading || ref.length !== 4}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
            >
              {loading ? "Verifying..." : "Verify PIN"}
            </button>
          </div>

          <div className="mb-4 text-center">
            <span className={`text-base font-medium ${status.startsWith("✅") || status.startsWith("🚗") ? "text-green-600" : status.startsWith("❌") ? "text-red-600" : "text-gray-700"}`}>
              {status}
            </span>
          </div>

          {/* User and vehicle selection */}
          {verifiedOrder && user && (
            <div className="mb-4 w-full">
              <div className="mb-2">
                <span className="font-semibold">User:</span>{" "}
                {user.first_name} {user.last_name} ({user.phone})
              </div>
              <div className="mb-2">
                <span className="font-semibold">Select Vehicle:</span>{" "}
                {vehicles.length > 0 ? (
                  <select
                    value={selectedVehicle?.id || ""}
                    onChange={e => {
                      const v = vehicles.find(v => v.id === Number(e.target.value));
                      setSelectedVehicle(v || null);
                    }}
                    className="border border-gray-300 rounded px-2 py-1"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} {v.reg}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>
                    <button
                      onClick={handleAddVehicle}
                      className="ml-2 px-3 py-1 bg-yellow-500 text-white rounded"
                    >
                      Add Vehicle
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleStartWash}
              disabled={!verifiedOrder || washStarted || !selectedVehicle}
              className={`px-4 py-2 rounded font-medium text-base min-w-[120px] ${verifiedOrder && !washStarted && selectedVehicle ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
            >
              Start Wash
            </button>
          </div>
        </div>
      </div>

      {/* Active washes for today */}
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Active Washes Today</h2>
        {activeWashes.length === 0 ? (
          <div className="text-gray-500">No active washes for today.</div>
        ) : (
          <ul>
            {activeWashes.map(wash => (
              <li key={wash.order_id} className="mb-4 border-b pb-2">
                <div>
                  <span className="font-semibold">{wash.user?.first_name} {wash.user?.last_name}</span>
                  {wash.vehicle && (
                    <>: {wash.vehicle.make} {wash.vehicle.model} {wash.vehicle.reg}</>
                  )}
                  {wash.payment_pin && (
                    <> <span className="bg-gray-200 px-2 py-1 rounded text-xs ml-2">{wash.payment_pin}</span></>
                  )}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Wash Type:</span>{" "}
                  {wash.service_name || <span className="text-gray-400">N/A</span>}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Extras:</span>{" "}
                  {wash.extras && wash.extras.length > 0
                    ? wash.extras.join(", ")
                    : <span className="text-gray-400">None</span>}
                </div>
                <div className="mt-1">
                  Status:{" "}
                  <span className={wash.status === "started" ? "text-blue-600" : "text-green-600"}>
                    {wash.status === "started" ? "Wash started" : "Wash ended"}
                  </span>
                  {wash.status === "started" && (
                    <button
                      onClick={() => handleEndWashFromList(wash.order_id)}
                      className="ml-4 px-3 py-1 bg-green-600 text-white rounded"
                    >
                      End Wash
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PaymentVerification;