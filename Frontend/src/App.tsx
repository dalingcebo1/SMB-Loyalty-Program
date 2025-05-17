// src/App.tsx

import {
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Signup            from "./pages/Signup";
import Login             from "./pages/Login";
import Onboarding        from "./pages/Onboarding";
import OTPVerify         from "./pages/OTPVerify";
import OrderForm         from "./pages/OrderForm";
import OrderConfirmation from "./pages/OrderConfirmation";
import MyLoyalty         from "./pages/MyLoyalty";
import DashboardLayout   from "./components/DashboardLayout";
import ForgotPassword    from "./pages/ForgotPassword";
import ResetPassword     from "./pages/ResetPassword";
import Welcome           from "./pages/Welcome";
import Payment           from "./pages/Payment";
import StaffRegisterForm from "./pages/admin/StaffRegisterForm";
import PaymentVerification from "./pages/staff/PaymentVerification";
import ManualVisitLogger from "./pages/staff/ManualVisitLogger";
import VehicleManager from "./pages/staff/VehicleManager";
import PastOrders from "./pages/PastOrders"; // <-- Add this import

function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <>
      <Routes>
        {/* PUBLIC */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/onboarding/verify" element={<OTPVerify />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* PROTECTED */}
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Welcome />} />
            <Route path="/myloyalty" element={<MyLoyalty />} />
            <Route path="/past-orders" element={<PastOrders />} />
            <Route path="/order" element={<OrderForm />} />
            <Route path="/services" element={<OrderForm />} />
            <Route path="/order/payment" element={<Payment />} />
            <Route path="/order/confirmation" element={<OrderConfirmation />} />

            {/* STAFF */}
            <Route path="/staff" element={<PaymentVerification />} />
            <Route path="/staff/manual-visit" element={<ManualVisitLogger />} />
            <Route path="/staff/vehicle-manager" element={<VehicleManager />} />

            {/* ADMIN */}
            <Route path="/admin/register-staff" element={<StaffRegisterForm />} />
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer position="top-center" />
    </>
  );
}
