import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Signup            from "./pages/Signup";
import Login             from "./pages/Login";
import Onboarding        from "./pages/Onboarding";
import OTPVerify         from "./pages/OTPVerify";
import OrderForm         from "./pages/OrderForm";
import PaymentPage       from "./pages/PaymentPage";
import OrderConfirmation from "./pages/OrderConfirmation";
// import RewardsPage     from "./pages/RewardsPage";
// import ClaimedPage     from "./pages/ClaimedPage";
// import HistoryPage     from "./pages/HistoryPage";

import DashboardLayout   from "./components/DashboardLayout";

const App: React.FC = () => (
  <Routes>
    {/* Public */}
    <Route path="/signup"  element={<Signup />} />
    <Route path="/login"   element={<Login  />} />
    <Route path="/onboarding"        element={<Onboarding />} />
    <Route path="/onboarding/verify" element={<OTPVerify  />} />

    {/* Protected dashboard & order flows */}
    <Route path="/" element={<DashboardLayout />}>
      {/* Dashboard tabs (enable when ready) */}
      {/* <Route index           element={<RewardsPage />} /> */}
      {/* <Route path="rewards"  element={<RewardsPage />} /> */}
      {/* <Route path="claimed"  element={<ClaimedPage />} /> */}
      {/* <Route path="history"  element={<HistoryPage />} /> */}

      {/* Order → Payment → Confirmation */}
      <Route path="order"            element={<OrderForm         />} />
      <Route path="order/payment"    element={<PaymentPage       />} />
      <Route path="order/confirmation" element={<OrderConfirmation />} />

      {/* Fallback inside dashboard */}
      <Route path="*" element={<Navigate to="" replace />} />
    </Route>

    {/* Global fallback */}
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;
