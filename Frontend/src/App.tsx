import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Onboarding } from "./pages/Onboarding";
import { Services }   from "./pages/Services";
import { Cart }       from "./pages/Cart";
import { Payment }    from "./pages/Payment";
import { QrScreen }   from "./pages/QrScreen";
import { StaffDashboard } from "./pages/StaffDashboard";

export const App: React.FC = () => (
  <BrowserRouter>
    <Header />
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/services" element={<Services />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/qr" element={<QrScreen />} />
      <Route path="/staff" element={<StaffDashboard />} />
    </Routes>
  </BrowserRouter>
);
export default App;
