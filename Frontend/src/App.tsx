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
import RequireStaff      from "./components/RequireStaff";
import StaffRegisterForm from "./pages/admin/StaffRegisterForm";
import RequireAdmin      from "./components/RequireAdmin";
import PaymentVerification from "./pages/staff/PaymentVerification";
import ManualVisitLogger from "./pages/staff/ManualVisitLogger";
import VehicleManager from "./pages/staff/VehicleManager";

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
            <Route path="/order" element={<OrderForm />} />
            <Route path="/services" element={<OrderForm />} />
            <Route path="/order/payment" element={<Payment />} />
            <Route path="/order/confirmation" element={<OrderConfirmation />} />
          </Route>
        </Route>

        {/* STAFF */}
        <Route
          path="/staff"
          element={
            <RequireStaff>
              <PaymentVerification />
            </RequireStaff>
          }
        />
        <Route
          path="/staff/manual-visit"
          element={
            <RequireStaff>
              <ManualVisitLogger />
            </RequireStaff>
          }
        />
        <Route
          path="/staff/vehicle-manager"
          element={
            <RequireStaff>
              <VehicleManager />
            </RequireStaff>
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin/register-staff"
          element={
            <RequireAdmin>
              <StaffRegisterForm />
            </RequireAdmin>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer position="top-center" />
    </>
  );
}
