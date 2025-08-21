// src/routes/index.tsx
import { Suspense, lazy } from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import { moduleFlags } from '../config/modules';
import { useAuth } from '../auth/AuthProvider';
import LoadingFallback from '../components/LoadingFallback';
import DashboardLayout from '../components/DashboardLayout';

// Lazy-loaded pages
const Signup = lazy(() => import('../features/auth/pages/Signup'));
const Login = lazy(() => import('../features/auth/pages/Login'));
const Onboarding = lazy(() => import('../features/auth/pages/Onboarding'));
const OTPVerify = lazy(() => import('../features/auth/pages/OTPVerify'));
const ForgotPassword = lazy(() => import('../features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../features/auth/pages/ResetPassword'));
const Welcome = lazy(() => import('../pages/Welcome'));
const MyLoyalty = lazy(() => import('../features/loyalty/pages/MyLoyalty'));
const OrderForm = lazy(() => import('../features/order/pages/OrderForm'));
const Payment = lazy(() => import('../features/order/pages/Payment'));
const OrderConfirmation = lazy(() => import('../features/order/pages/OrderConfirmation'));
const PastOrders = lazy(() => import('../features/order/pages/PastOrders'));
const Account = lazy(() => import('../pages/Account'));
const PaymentVerification = lazy(() => import('../features/staff/pages/PaymentVerification'));
const ManualVisitLogger = lazy(() => import('../features/staff/pages/ManualVisitLogger'));
const VehicleManager = lazy(() => import('../features/staff/pages/VehicleManager'));
const CarWashDashboard = lazy(() => import('../features/staff/pages/CarWashDashboard'));
const AdminLayout = lazy(() => import('../components/AdminLayout'));
const AdminWelcome = lazy(() => import('../pages/admin/AdminWelcome'));
const UsersList = lazy(() => import('../pages/admin/UsersList'));
const StaffRegisterForm = lazy(() => import('../pages/admin/StaffRegisterForm'));
const AdminUserEdit = lazy(() => import('../pages/AdminUserEdit'));
const ModuleSettings = lazy(() => import('../pages/admin/ModuleSettings'));
const AnalyticsLayout = lazy(() => import('../pages/admin/AnalyticsLayout'));
const AnalyticsOverview = lazy(() => import('../pages/admin/AnalyticsOverview'));
const DeveloperConsole = lazy(() => import('../pages/dev/DeveloperConsole'));
const ProvisionWizard = lazy(() => import('../pages/dev/ProvisionWizard'));

// Route guards
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback message="Loading…" />;
  return user ? children : <Navigate to="/login" replace />;
}
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback message="Loading…" />;
  return user && user.role === 'admin' ? children : <Navigate to="/" replace />;
}
function RequireDeveloper({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback message="Loading…" />;
  return user && (user.role === 'developer' || user.role === 'admin')
    ? children
    : <Navigate to="/" replace />;
}

// Centralized route definitions
const routes = [
  // Public
  { path: '/signup', element: <Signup /> },
  { path: '/login', element: <Login /> },
  { path: '/onboarding', element: <Onboarding /> },
  { path: '/onboarding/verify', element: <OTPVerify /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },

  // Protected user routes
  {
    element: <RequireAuth><DashboardLayout /></RequireAuth>,
    children: [
      { path: '/', element: <Welcome /> },
      ...(moduleFlags.enableLoyalty ? [{ path: 'myloyalty', element: <MyLoyalty /> }] : []),
      ...(moduleFlags.enableOrders ? [{ path: 'order', element: <OrderForm /> }] : []),
      ...(moduleFlags.enablePayments ? [{ path: 'order/payment', element: <Payment /> }] : []),
      ...(moduleFlags.enableOrders ? [{ path: 'order/confirmation', element: <OrderConfirmation /> }] : []),
      ...(moduleFlags.enableUsers ? [{ path: 'account', element: <Account /> }] : []),
      ...(moduleFlags.enableOrders ? [{ path: 'past-orders', element: <PastOrders /> }] : []),
      ...(moduleFlags.enablePayments ? [{ path: 'staff', element: <PaymentVerification /> }] : []),
      { path: 'staff/manual-visit', element: <ManualVisitLogger /> },
      { path: 'staff/vehicle-manager', element: <VehicleManager /> },
      { path: 'staff/dashboard', element: <CarWashDashboard /> },
    ],
  },

  // Admin routes
  {
    path: '/admin',
    element: <RequireAdmin>
      <Suspense fallback={<LoadingFallback message="Loading admin…" />}><AdminLayout /></Suspense>
    </RequireAdmin>,
    children: [
      { index: true, element: <Suspense fallback={<LoadingFallback message="Loading welcome…" />}><AdminWelcome /></Suspense> },
      { path: 'users', element: <Suspense fallback={<LoadingFallback message="Loading users…" />}><UsersList /></Suspense> },
      { path: 'register-staff', element: <Suspense fallback={<LoadingFallback message="Loading staff register…" />}><StaffRegisterForm /></Suspense> },
      { path: 'users/:userId/edit', element: <Suspense fallback={<LoadingFallback message="Loading editor…" />}><AdminUserEdit /></Suspense> },
      { path: 'modules', element: <Suspense fallback={<LoadingFallback message="Loading modules…" />}><ModuleSettings /></Suspense> },
      {
        path: 'analytics',
        element: <Suspense fallback={<LoadingFallback message="Loading analytics…" />}><AnalyticsLayout /></Suspense>,
        children: [
          { index: true, element: <Suspense fallback={<LoadingFallback message="Loading overview…" />}><AnalyticsOverview /></Suspense> },
        ],
      },
    ],
  },

  // Developer tools
  { path: '/dev', element: <RequireDeveloper><DeveloperConsole /></RequireDeveloper> },
  { path: '/provision', element: <RequireDeveloper><ProvisionWizard /></RequireDeveloper> },

    // Fallback
    { path: '*', element: <Navigate to="/" replace /> },
  ];
  // AppRoutes component renders the routes
  export default function AppRoutes() {
    return useRoutes(routes);
  }

