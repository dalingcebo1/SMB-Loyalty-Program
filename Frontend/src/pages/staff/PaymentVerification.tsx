import React, { useState, useRef, useEffect } from "react";
import { useActiveWashes } from "../../features/staff/hooks/useActiveWashes";
import { useStartWash } from "../../features/staff/hooks/useStartWash";
import { useEndWash } from "../../features/staff/hooks/useEndWash";
import { useVerify, useOrderUser } from "../../api/queries";
import { QrReader } from "react-qr-reader";
import { toast } from 'react-toastify';
import ConfirmDialog from "../../components/ConfirmDialog";

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


// Alias QrReader to any to satisfy TS JSX component type
const Scanner = QrReader as any;
const PaymentVerification: React.FC = () => {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<{ order_id: string; user?: User; payment_pin?: string } | null>(null);
  const [washStarted, setWashStarted] = useState(false);
  // Notifications via react-toastify
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const { data: activeWashes = [], refetch: refetchActiveWashes } = useActiveWashes();
  const [confirmEndWash, setConfirmEndWash] = useState<string | null>(null); // order_id to confirm
  const [paymentType, setPaymentType] = useState<"payment" | "loyalty" | "pos">("payment");

  // Use a ref for hasScanned to prevent race conditions
  const hasScannedRef = useRef(false);


  // Mutations for starting and ending washes
  const startWashMutation = useStartWash();
  const endWashMutation = useEndWash();


  // React Query hooks for verify and fetching user+vehicles
  const verifyMutation = useVerify();
  const orderUserQuery = useOrderUser(verifiedOrder?.order_id);

  // Initialize selected vehicle when vehicles data loads
  useEffect(() => {
    if (orderUserQuery.data?.vehicles && !selectedVehicle) {
      setSelectedVehicle(orderUserQuery.data.vehicles[0] || null);
    }
  }, [orderUserQuery.data, selectedVehicle]);

  // Handle verify using React Query mutation
  const handleVerify = (inputRef?: string) => {
    const reference = inputRef || ref;
    setStatus("");
    setLoading(true);
    setVerifiedOrder(null);
    verifyMutation.mutate(
      { referenceOrPin: reference, paymentType },
      {
        onSuccess: data => {
          setLoading(false);
          const { order_id, payment_pin, type, status: st } = data;
          setStatus(
            st === 'ok'
              ? type === 'loyalty'
                ? '🎁 Loyalty reward redeemed! Start the wash.'
                : type === 'payment'
                ? '✅ Payment OK—start the wash!'
                : '✅ POS receipt verified! Start the wash.'
              : '❌ Invalid or unpaid reference'
          );
          setVerifiedOrder({ order_id, payment_pin });
        },
        onError: () => {
          setLoading(false);
          setStatus('❌ Invalid or unpaid reference');
        },
      }
    );
  };

  const handleManualVerify = () => {
    if (paymentType === "pos") {
      if (ref.length < 4) {
        setStatus("❌ Please enter a valid POS receipt number.");
        return;
      }
      handleVerify(ref);
    } else {
      if (/^[a-zA-Z0-9]{4,8}$/.test(ref) || ref.length > 8) {
        handleVerify(ref);
      } else {
        setStatus("❌ Please enter a valid payment or loyalty PIN/QR.");
      }
    }
  };

  const handleStartWash = async () => {
    if (!verifiedOrder) return;
    if (!selectedVehicle) {
      setStatus("❌ Please select a vehicle before starting the wash.");
      return;
    }
    setLoading(true);
    startWashMutation.mutate(
      { orderId: verifiedOrder!.order_id, vehicleId: selectedVehicle!.id },
      {
        onSuccess: () => {
              setWashStarted(true);
              setStatus("🚗 Wash started!");
              toast.success("Wash started!");
              refetchActiveWashes();
        },
        onError: () => setStatus("❌ Could not start wash."),
        onSettled: () => setLoading(false),
      }
    );
  };

  // Remove End Wash button from main section, but keep it in active washes list

  const handleOpenScanner = () => {
    hasScannedRef.current = false;
    setRef(""); // Clear last scanned value
    setStatus(""); // Clear status
    setVerifiedOrder(null); // Clear previous order
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
    endWashMutation.mutate(confirmEndWash!, {
      onSuccess: () => {
            toast.success("Wash ended!");
        refetchActiveWashes();
      },
  onError: () => toast.error("Could not end wash."),
      onSettled: () => {
        setLoading(false);
        setConfirmEndWash(null);
      },
    });
  };

  // Prompt to add vehicle if none found
  const handleAddVehicle = () => {
    window.open("/staff/vehiclemanager", "_blank");
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
  {/* toast notifications are displayed via ToastContainer */}
      <ConfirmDialog
        isOpen={!!confirmEndWash}
        title="Are you sure?"
        description="Do you want to end this wash? This action cannot be undone."
        confirmLabel="Yes, End Wash"
        onConfirm={confirmEndWashAction}
        onCancel={() => setConfirmEndWash(null)}
        loading={loading}
      />

      <div className="bg-white rounded shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Payment Verification</h1>
        <div className="flex flex-col items-center">
          {/* Payment type selector */}
          <div className="mb-4 flex gap-2">
            <button
              className={`px-3 py-1 rounded ${paymentType === "payment" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              onClick={() => setPaymentType("payment")}
              disabled={loading}
            >
              Yoco Payment
            </button>
            <button
              className={`px-3 py-1 rounded ${paymentType === "loyalty" ? "bg-purple-600 text-white" : "bg-gray-200"}`}
              onClick={() => setPaymentType("loyalty")}
              disabled={loading}
            >
              Loyalty Reward
            </button>
            <button
              className={`px-3 py-1 rounded ${paymentType === "pos" ? "bg-green-600 text-white" : "bg-gray-200"}`}
              onClick={() => setPaymentType("pos")}
              disabled={loading}
            >
              POS/Manual
            </button>
          </div>

          <button
            onClick={handleOpenScanner}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
          >
            {showScanner ? "Close QR Scanner" : "Scan QR Code"}
          </button>
          {showScanner && (
            <div className="mb-4 w-full flex justify-center">
              <div className="w-72 max-w-full">
                <Scanner
                  constraints={{ facingMode: { exact: "environment" } }}
                  containerStyle={{ width: "100%" }}
                  onResult={(result: any) => {
                    if (result && !hasScannedRef.current) {
                      hasScannedRef.current = true;
                      setShowScanner(false);
                      const text = result.getText();
                      setRef(text); // This is just for display, not for logic
                      handleVerify(text); // Always call handleVerify, even if text === ref
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-col items-center">
            <input
              placeholder={
                paymentType === "payment"
                  ? "Enter payment PIN or scan QR"
                  : paymentType === "loyalty"
                  ? "Enter loyalty PIN or scan QR"
                  : "Enter POS receipt number"
              }
              value={ref}
              onChange={e => setRef(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32))}
              className="mb-2 px-4 py-2 border border-gray-300 rounded w-64 text-center"
              disabled={loading}
              maxLength={32}
              inputMode="text"
              autoCapitalize="characters"
            />
            <button
              onClick={handleManualVerify}
              disabled={loading || ref.length < 4}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-base hover:bg-blue-700 min-w-[120px]"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </div>

          <div className="mb-4 text-center">
            <span className={`text-base font-medium ${status.startsWith("✅") || status.startsWith("🚗") || status.startsWith("🎁") ? "text-green-600" : status.startsWith("❌") ? "text-red-600" : "text-gray-700"}`}>
              {status}
            </span>
          </div>

          {/* User and vehicle selection */}
          {verifiedOrder && orderUserQuery.data?.user && (
            <div className="mb-4 w-full">
              <div className="mb-2">
                <span className="font-semibold">User:</span>{" "}
                {orderUserQuery.data.user.first_name} {orderUserQuery.data.user.last_name} ({orderUserQuery.data.user.phone})
              </div>
              <div className="mb-2">
                <span className="font-semibold">Select Vehicle:</span>{" "}
                {orderUserQuery.data.vehicles?.length ? (
                  <select
                    value={selectedVehicle?.id || ""}
                    onChange={e => {
                      const list = orderUserQuery.data.vehicles;
                      const found = list.find((vehicle: Vehicle) => vehicle.id === Number(e.target.value));
                      setSelectedVehicle(found || null);
                    }}
                    className="border border-gray-300 rounded px-2 py-1"
                  >
                    {orderUserQuery.data.vehicles.map((vehicle: Vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} {vehicle.reg}
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
            {activeWashes.map((wash: Wash) => (
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

// This page has been moved to src/features/staff/pages/PaymentVerification.tsx
export default PaymentVerification;