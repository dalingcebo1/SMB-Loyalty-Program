// Frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Onboarding from './pages/Onboarding';
import { Services } from './pages/Services';
import Cart from './pages/Cart';
import Payment from './pages/Payment';
import QrDisplay from './pages/QRDisplay';
import StaffDashboard from './pages/StaffDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding" />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/services" element={<Services />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/qr" element={<QrDisplay />} />
        <Route path="/staff" element={<StaffDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
