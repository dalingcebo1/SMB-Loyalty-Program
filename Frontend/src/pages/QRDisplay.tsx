import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Navigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { useAuth } from '../auth/AuthProvider';

const QRDisplay: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, loading } = useAuth();
  const [qr, setQr]   = useState<string>('');

  useEffect(() => {
    axios.get(`http://localhost:8000/payments/qr/${orderId}`)
      .then(r => setQr(r.data.qr_code_base64));
  }, [orderId]);

  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  if (!qr) return <PageLayout loading loadingText="Fetching QR…">{null}</PageLayout>;

  return (
    <PageLayout>
      <div style={{ padding:20 }}>
       <h1>Your Wash Ticket</h1>
       <img src={qr} alt="Scan at the desk" />
       <p>Show this QR to staff when you arrive.</p>
      </div>
    </PageLayout>
  );
};

export default QRDisplay;