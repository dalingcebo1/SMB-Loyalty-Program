import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Onboarding from './pages/Onboarding';
import Services from './pages/Services';
import Cart from './pages/Cart';
import Payment from './pages/Payment';
import QRDisplay from './pages/QRDisplay';
import StaffDashboard from './pages/StaffDashboard';
import MyLoyalty from './pages/MyLoyalty';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/loyalty" element={<MyLoyalty />} />
        <Route path="/services" element={<Services />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/qr/:orderId" element={<QRDisplay />} />

        {/* staff */}
        <Route path="/staff" element={<StaffDashboard />} />

        {/* default → onboarding */}
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
