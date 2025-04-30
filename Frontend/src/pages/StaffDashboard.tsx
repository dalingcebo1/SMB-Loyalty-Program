import React, { useState } from 'react';
import axios from 'axios';

const StaffDashboard: React.FC = () => {
  const [ref, setRef] = useState('');
  const [status, setStatus] = useState('');

  const verify = async () => {
    try {
      await axios.get(`http://localhost:8000/payments/verify/${ref}`);
      setStatus('✅ Payment OK—start the wash!');
    } catch {
      setStatus('❌ Invalid or unpaid reference');
    }
  };

  return (
    <div style={{ padding:20 }}>
      <h1>Staff Dashboard</h1>
      <p>Scan customer’s QR code or enter reference:</p>
      <input
        placeholder="Payment reference"
        value={ref}
        onChange={e => setRef(e.target.value)}
      />
      <button onClick={verify}>Verify Payment</button>
      <p>{status}</p>
      <hr/>
      <p>Use the “Assign vehicle” and “Start wash” APIs in this dashboard as needed.</p>
    </div>
  );
};

export default StaffDashboard;