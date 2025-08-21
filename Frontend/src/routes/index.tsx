// src/routes/index.tsx
import React, { Suspense, lazy } from 'react';
import { useRoutes, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { moduleFlags } from '../config/modules';
import { useAuth } from '../auth/AuthProvider';
import LoadingFallback from '../components/LoadingFallback';

// Auth pages
const Signup = lazy(() => import('../features/auth/pages/Signup'));
const Login = lazy(() => import('../features/auth/pages/Login'));
const Onboarding = lazy(() => import('../features/auth/pages/Onboarding'));
const OTPVerify = lazy(() => import('../features/auth/pages/OTPVerify'));
const ForgotPassword = lazy(() => import('../features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../features/auth/pages/ResetPassword'));  

// User pages
const Welcome = lazy(() => import('../pages/Welcome'));
const MyLoyalty = lazy(() => import('../features/loyalty/pages/MyLoyalty'));
const OrderForm = lazy(() => import('../features/order/pages/OrderForm'));
const Payment = lazy(() => import('../features/order/pages/Payment'));
const OrderConfirmation = lazy(() => import('../features/order/pages/OrderConfirmation'));
const PastOrders = lazy(() => import('../features/order/pages/PastOrders'));
const Account = lazy(() => import('../pages/Account'));

// Staff pages
const PaymentVerification = lazy(() => import('../features/staff/pages/PaymentVerification'));
const ManualVisitLogger = lazy(() => import('../features/staff/pages/ManualVisitLogger'));
const VehicleManager = lazy(() => import('../features/staff/pages/VehicleManager'));
const CarWashDashboard = lazy(() => import('../features/staff/pages/CarWashDashboard'));

// Layouts
const DashboardLayout = lazy(() => import('../components/DashboardLayout'));
const AdminLayout = lazy(() => import('../components/AdminLayout'));

// Admin pages
const AdminWelcome = lazy(() => import('../pages/admin/AdminWelcome'));
const UsersList = lazy(() => import('../pages/admin/UsersList'));
const StaffRegisterForm = lazy(() => import('../pages/admin/StaffRegisterForm'));  
const ModuleSettings = lazy(() => import('../pages/admin/ModuleSettings'));
const AdminUserEdit = lazy(() => import('../pages/AdminUserEdit'));
const TenantsList = lazy(() => import('../pages/admin/TenantsList'));
const TenantEdit = lazy(() => import('../pages/admin/TenantEdit'));

// Route guards
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback message="Loading user…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireDeveloper() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback message="Loading…" />;
  if (!user || (user.role !== 'developer' && user.role !== 'admin')) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

const AppRoutes: React.FC = () => {
  // Feature flags
  const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

  const routes = [
    // PUBLIC
    { path: '/signup', element: <Signup /> },
    { path: '/login', element: <Login /> },
    { path: '/onboarding', element: <Onboarding /> },
    { path: '/onboarding/verify', element: <OTPVerify /> },
    { path: '/onboarding/invite', element: <Onboarding /> },
    { path: '/forgot-password', element: <ForgotPassword /> },
    { path: '/reset-password', element: <ResetPassword /> },

    // USER ROUTES
    {
      element: <RequireAuth />,
      children: [
        {
          element: <DashboardLayout />,
          children: [
            { path: '/', element: <Welcome /> },
            enableLoyalty && { path: '/myloyalty', element: <MyLoyalty /> },
            enableOrders && { path: '/order', element: <OrderForm /> },
            enablePayments && { path: '/order/payment', element: <Payment /> },
            enableOrders && { path: '/order/confirmation', element: <OrderConfirmation /> },
            enableUsers && { path: '/account', element: <Account /> },
            enableOrders && { path: '/past-orders', element: <PastOrders /> },
            enablePayments && { path: '/staff', element: <PaymentVerification /> },
            { path: '/staff/manual-visit', element: <ManualVisitLogger /> },
            { path: '/staff/vehicle-manager', element: <VehicleManager /> },
            { path: '/staff/dashboard', element: <CarWashDashboard /> },
          ].filter(Boolean),
        },
      ],
    },

    // ADMIN ROUTES
    {
      path: '/admin',
      element: <RequireDeveloper />,
      children: [
        {
          element: <AdminLayout />,
          children: [
            { index: true, element: <AdminWelcome /> },
            { path: 'users', element: <UsersList /> },
            { path: 'register-staff', element: <StaffRegisterForm /> },
            { path: 'users/:userId/edit', element: <AdminUserEdit /> },
            { path: 'modules', element: <ModuleSettings /> },
            { path: 'tenants', element: <TenantsList /> },
            { path: 'tenants/:tenantId/edit', element: <TenantEdit /> },
          ],
        },
      ],
    },

    // catch-all
    { path: '*', element: <Navigate to='/' replace /> },
  ];

  // Filter out falsy routes
  const filtered = routes.map(r => r).filter(Boolean) as RouteObject[];
  const element = useRoutes(filtered);
  return <Suspense fallback={<LoadingFallback message="Loading…" />}>{element}</Suspense>;
};

export default AppRoutes;
