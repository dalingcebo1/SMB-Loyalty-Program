// src/App.tsx

import React from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";

import Signup            from "./pages/Signup";
import Login             from "./pages/Login";
import Onboarding        from "./pages/Onboarding";
import OTPVerify         from "./pages/OTPVerify";
import OrderForm         from "./pages/OrderForm";
import PaymentPage       from "./pages/PaymentPage";
import OrderConfirmation from "./pages/OrderConfirmation";

import DashboardLayout from "./components/DashboardLayout";

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    // not logged in → send to /login, remember where they were going
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // logged in & onboarded → render the protected routes
  return <Outlet />;
}

const App: React.FC = () => (
  <Routes>
    {/* PUBLIC */}
    <Route path="/signup" element={<Signup />} />
    <Route path="/login" element={<Login />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/onboarding/verify" element={<OTPVerify />} />

    {/* PROTECTED: dashboard & order flows */}
    <Route element={<RequireAuth />}>
      <Route path="/" element={<DashboardLayout />} />

      {/* Order flow */}
      <Route path="order"            element={<OrderForm />} />
      <Route path="order/payment"    element={<PaymentPage />} />
      <Route
        path="order/confirmation"
        element={<OrderConfirmation />}
      />
    </Route>

    {/* FALLBACK */}
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;
