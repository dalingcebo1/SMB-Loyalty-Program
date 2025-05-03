// src/App.tsx

import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";

import Signup            from "./pages/Signup";
import Login             from "./pages/Login";
import Onboarding        from "./pages/Onboarding";
import OTPVerify         from "./pages/OTPVerify";
import OrderForm         from "./pages/OrderForm";
import PaymentPage       from "./pages/PaymentPage";
import OrderConfirmation from "./pages/OrderConfirmation";
import MyLoyalty         from "./pages/MyLoyalty";
import DashboardLayout   from "./components/DashboardLayout";

function RequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading…</p>
      </div>
    );
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/onboarding/verify" element={<OTPVerify />} />

      {/* PROTECTED */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<DashboardLayout />}>
          {/* default dashboard view */}
          <Route index element={<MyLoyalty />} />

          {/* nested flows */}
          <Route path="order"              element={<OrderForm />} />
          <Route path="order/payment"      element={<PaymentPage />} />
          <Route path="order/confirmation" element={<OrderConfirmation />} />
        </Route>
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
