import React, { useState } from "react";
import axios from "axios";
// You need to install react-qr-scanner: npm install react-qr-scanner
import QrScanner from "react-qr-scanner";

const PaymentVerification: React.FC = () => {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const verify = async (referenceOrPin: string) => {
    setStatus("");
    setLoading(true);
    try {
      await axiosAuth.get(`/api/payments/verify/${referenceOrPin}`);
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

  const handleScan = (result: any) => {
    if (result && result.text) {
      setShowScanner(false);
      setRef(result.text);
      verify(result.text);
    }
  };

  const handleError = () => {
    setStatus("❌ QR scan failed. Try again or enter PIN manually.");
    setShowScanner(false);
  };

  const handleManualVerify = () => {
    if (ref.length === 4 && /^\d{4}$/.test(ref)) {
      verify(ref);
    } else {
      setStatus("❌ Please enter a valid 4-digit PIN.");
    }
  };

  return (
    <section style={{ marginBottom: 32, maxWidth: 400, padding: 24, background: "#fafbfc", borderRadius: 8 }}>
      <h2>Verify Payment</h2>

      <button
        onClick={() => setShowScanner((s) => !s)}
        style={{ marginBottom: 16, padding: "8px 16px" }}
      >
        {showScanner ? "Close QR Scanner" : "Scan QR Code"}
      </button>

      {showScanner && (
        <div style={{ marginBottom: 16 }}>
          <QrScanner
            delay={300}
            onError={handleError}
            onScan={handleScan}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Enter 4-digit payment PIN"
          value={ref}
          onChange={e => setRef(e.target.value.replace(/\D/g, "").slice(0, 4))}
          style={{ marginRight: 8, padding: 8, borderRadius: 4, border: "1px solid #ccc", width: 120 }}
          disabled={loading}
          maxLength={4}
          inputMode="numeric"
        />
        <button
          onClick={handleManualVerify}
          disabled={loading || ref.length !== 4}
          style={{ padding: "8px 16px" }}
        >
          {loading ? "Verifying..." : "Verify PIN"}
        </button>
      </div>

      <p style={{ color: status.startsWith("✅") ? "green" : "red", marginTop: 8 }}>{status}</p>
    </section>
  );
};

export default PaymentVerification;