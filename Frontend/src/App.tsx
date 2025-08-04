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
import { moduleFlags } from "./config/modules";
import { Suspense, lazy } from "react";

// Lazy-load admin bundle:
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const UsersList = lazy(() => import("./pages/admin/UsersList"));
const StaffRegisterForm = lazy(() => import("./pages/admin/StaffRegisterForm"));
const ModuleSettings = lazy(() => import("./pages/admin/ModuleSettings"));
// Edit-user page
const AdminUserEdit = lazy(() => import("./pages/AdminUserEdit"));
// Tenants pages
const TenantsList = lazy(() => import("./pages/admin/TenantsList"));
const TenantEdit = lazy(() => import("./pages/admin/TenantEdit"));
// Developer console bundle
const DeveloperConsole = lazy(() => import("./pages/dev/DeveloperConsole"));
const ProvisionWizard = lazy(() => import("./pages/dev/ProvisionWizard"));

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
// Removed static StaffRegisterForm import in favor of lazy-loaded version
import PaymentVerification from "./pages/staff/PaymentVerification";
import ManualVisitLogger from "./pages/staff/ManualVisitLogger";
import VehicleManager from "./pages/staff/VehicleManager";
import PastOrders from "./pages/PastOrders";
import Account from "./pages/Account"; // <-- Add this import
import AutoLogin from './pages/AutoLogin';

// Feature flags
 const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

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
// Guard for admin-only pages
function RequireAdmin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><p>Loading…</p></div>;
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
// Guard for developer-only pages
function RequireDeveloper() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><p>Loading…</p></div>;
  if (!user || (user.role !== "developer" && user.role !== "admin")) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Auto-login via token query (e.g., /autologin?token=...) */}
            {/* /services route removed; use /order for booking */}

        {/* PUBLIC */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/onboarding/verify" element={<OTPVerify />} />
        <Route path="/onboarding/invite" element={<Onboarding />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* PROTECTED USER ROUTES */}
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Welcome />} />
            {enableLoyalty && <Route path="/myloyalty" element={<MyLoyalty />} />}
            {enableOrders && <Route path="/order" element={<OrderForm />} />}
            {/* Removed standalone Services page; use OrderForm for service booking */}
            {enablePayments && <Route path="/order/payment" element={<Payment />} />}
            {enableOrders && <Route path="/order/confirmation" element={<OrderConfirmation />} />}
            {enableUsers && <Route path="/account" element={<Account />} />}
            {enableOrders && <Route path="/past-orders" element={<PastOrders />} />}
            {/* STAFF PAGES */}
            {enablePayments && <Route path="/staff" element={<PaymentVerification />} />}
            <Route path="/staff/manual-visit" element={<ManualVisitLogger />} />
            <Route path="/staff/vehicle-manager" element={<VehicleManager />} />
          </Route>
        </Route>

        {/* PROTECTED ADMIN ROUTES */}
        <Route element={<RequireAdmin />}>
          <Route
            path="/admin"
            element={
              <Suspense fallback={<div>Loading admin UI…</div>}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<div>Loading users…</div>}>
                  <UsersList />
                </Suspense>
              }
            />
            <Route
              path="users"
              element={
                <Suspense fallback={<div>Loading users…</div>}>
                  <UsersList />
                </Suspense>
              }
            />
            <Route
              path="register-staff"
              element={
                <Suspense fallback={<div>Loading staff register…</div>}>
                  <StaffRegisterForm />
                </Suspense>
              }
            />
            <Route
              path="users/:userId/edit"
              element={
                <Suspense fallback={<div>Loading editor…</div>}>
                  <AdminUserEdit />
                </Suspense>
              }
            />
            <Route
              path="modules"
              element={
                <Suspense fallback={<div>Loading modules…</div>}>
                  <ModuleSettings />
                </Suspense>
              }
            />
          </Route>
        </Route>

        {/* PROTECTED DEVELOPER ROUTES */}
        <Route element={<RequireDeveloper />}>
          <Route path="/dev" element={<Outlet />}>
            <Route
              index
              element={
                <Suspense fallback={<div>Loading dev console…</div>}>
                  <DeveloperConsole />
                </Suspense>
              }
            />
            <Route
              path="provision"
              element={
                <Suspense fallback={<div>Loading provision wizard…</div>}>
                  <ProvisionWizard />
                </Suspense>
              }
            />
            <Route
              path="tenants"
              element={
                <Suspense fallback={<div>Loading tenants…</div>}>
                  <TenantsList />
                </Suspense>
              }
            />
            <Route
              path="tenants/:tenantId"
              element={
                <Suspense fallback={<div>Loading tenant…</div>}>
                  <TenantEdit />
                </Suspense>
              }
            />
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer position="top-center" />
    </>
  );
}
