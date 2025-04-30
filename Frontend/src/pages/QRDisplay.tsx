import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const QRDisplay: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [qr, setQr]   = useState<string>('');

  useEffect(() => {
    axios.get(`http://localhost:8000/payments/qr/${orderId}`)
      .then(r => setQr(r.data.qr_code_base64));
  }, [orderId]);

  if (!qr) return <div>Fetching QR…</div>;

  return (
    <div style={{ padding:20 }}>
      <h1>Your Wash Ticket</h1>
      <img src={qr} alt="Scan at the desk" />
      <p>Show this QR to staff when you arrive.</p>
    </div>
  );
};

export default QRDisplay;
