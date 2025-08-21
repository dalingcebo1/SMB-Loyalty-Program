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
import LoadingFallback from "./components/LoadingFallback";

// Lazy-load admin bundle:
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const AdminWelcome = lazy(() => import("./pages/admin/AdminWelcome"));
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

import { 
  Signup,
  Login,
  Onboarding,
  OTPVerify,
  ForgotPassword,
  ResetPassword
} from "./features/auth";
import { 
  OrderForm,
  OrderConfirmation,
  PastOrders,
  Payment
} from "./features/order";
import { MyLoyalty } from "./features/loyalty";
import { 
  PaymentVerification,
  ManualVisitLogger,
  VehicleManager,
  CarWashDashboard
} from "./features/staff";
import DashboardLayout   from "./components/DashboardLayout";
import Welcome           from "./pages/Welcome";
import Account from "./pages/Account"; // <-- Add this import
const AnalyticsLayout = lazy(() => import("./pages/admin/AnalyticsLayout"));
const AnalyticsOverview = lazy(() => import("./pages/admin/AnalyticsOverview"));

// Feature flags
 const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;
 // Analytics detail pages (lazy-loaded)
const UsersMetrics = lazy(() => import("./pages/admin/UsersMetrics"));
const TransactionsMetrics = lazy(() => import("./pages/admin/TransactionsMetrics"));
const PointsMetrics = lazy(() => import("./pages/admin/PointsMetrics"));
const RedemptionsMetrics = lazy(() => import("./pages/admin/RedemptionsMetrics"));
const VisitsMetrics = lazy(() => import("./pages/admin/VisitsMetrics"));
const LoyaltyMetrics = lazy(() => import("./pages/admin/LoyaltyMetrics"));
const TopClientsMetrics = lazy(() => import("./pages/admin/TopClients"));
const EngagementMetrics = lazy(() => import("./pages/admin/EngagementMetrics"));
const FinancialMetrics = lazy(() => import("./pages/admin/FinancialMetrics"));

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
     <ToastContainer position="top-center" />
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
            <Route path="/staff/dashboard" element={<CarWashDashboard />} />
          </Route>
        </Route>

        {/* PROTECTED ADMIN ROUTES */}
        <Route
          path="/admin"
          element={
            <Suspense fallback={<LoadingFallback message="Loading admin UI…" />}>
              <AdminLayout />
            </Suspense>
          }
        >
            <Route
              index
              element={
                <Suspense fallback={<div>Loading welcome…</div>}>
                  <AdminWelcome />
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
            {/* Analytics drill-down routes */}
            <Route
              path="analytics"
              element={
                <Suspense fallback={<LoadingFallback message="Loading analytics…" />}>
                  <AnalyticsLayout />
                </Suspense>
              }
            >
              {/* Analytics overview at index */}
              <Route
                index
                element={
                  <Suspense fallback={<div>Loading overview…</div>}>
                    <AnalyticsOverview />
                  </Suspense>
                }
              />
              {/* persistent summary grid + details */}
              <Route
                path="users"
                element={<Suspense fallback={<div>Loading user metrics…</div>}><UsersMetrics /></Suspense>}
              />
              <Route
                path="transactions"
                element={<Suspense fallback={<div>Loading transaction metrics…</div>}><TransactionsMetrics /></Suspense>}
              />
              <Route
                path="points"
                element={<Suspense fallback={<div>Loading points metrics…</div>}><PointsMetrics /></Suspense>}
              />
              <Route
                path="redemptions"
                element={<Suspense fallback={<div>Loading redemptions metrics…</div>}><RedemptionsMetrics /></Suspense>}
              />
              <Route
                path="visits"
                element={<Suspense fallback={<div>Loading visit metrics…</div>}><VisitsMetrics /></Suspense>}
              />
              <Route
                path="loyalty"
                element={<Suspense fallback={<div>Loading loyalty metrics…</div>}><LoyaltyMetrics /></Suspense>}
              />
              <Route
                path="top-clients"
                element={<Suspense fallback={<div>Loading top clients…</div>}><TopClientsMetrics /></Suspense>}
              />
              <Route
                path="engagement"
                element={<Suspense fallback={<div>Loading engagement metrics…</div>}><EngagementMetrics /></Suspense>}
              />
              <Route
                path="financial"
                element={<Suspense fallback={<div>Loading financial metrics…</div>}><FinancialMetrics /></Suspense>}
              />
            </Route>  {/* closes analytics */}
          </Route>    {/* closes /admin */}

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
    </>
  );
}
