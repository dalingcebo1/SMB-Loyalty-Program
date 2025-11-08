// src/routes/index.tsx
import React, { Suspense, lazy } from 'react';
import { useRoutes, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { moduleFlags } from '../config/modules';
import { useAuth } from '../auth/AuthProvider';
import { useCapabilities } from '../features/admin/hooks/useCapabilities';
import LoadingFallback from '../components/LoadingFallback';
import DashboardLayout from '../components/DashboardLayout';
import AdminLayout from '../components/AdminLayout';
// Dev admin area (developer portal)
import DeveloperAdminApp from '../dev-admin/DeveloperAdminApp';
import CreateTenant from '../dev-admin/CreateTenant';
import TenantList from '../dev-admin/TenantList';
import { RequireDeveloper as DevRequireDeveloper } from '../dev-admin/routeGuard';

// Critical user experience pages are eagerly imported to ensure they are always
// available even if the CDN temporarily misses a chunk. This avoids runtime
// failures like the production 404s observed for OrderForm.
import Welcome from '../pages/Welcome';
import MyLoyalty from '../features/loyalty/pages/MyLoyalty';
import OrderForm from '../pages/OrderForm';
import Payment from '../features/order/pages/Payment';
import OrderConfirmation from '../pages/OrderConfirmation';
import PastOrders from '../pages/PastOrders';
import Account from '../pages/Account';
import EnhancedProfile from '../pages/EnhancedProfile';

// Auth pages (using unified onboarding flow)
const Signup = lazy(() => import('../features/auth/pages/Signup'));
const Login = lazy(() => import('../features/auth/pages/Login'));
const UnifiedOnboarding = lazy(() => import('../features/auth/pages/UnifiedOnboarding'));
const OTPVerify = lazy(() => import('../pages/OTPVerify'));
const ForgotPassword = lazy(() => import('../features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../features/auth/pages/ResetPassword'));  

// Debug pages
const FirebaseTest = lazy(() => import('../debug/FirebaseTest'));  
const GoogleLoginTest = lazy(() => import('../debug/GoogleLoginTest'));
const GoogleRedirectTest = lazy(() => import('../debug/GoogleRedirectTest'));
const GoogleLoginDebug = lazy(() => import('../pages/GoogleLoginDebug'));  

// Staff pages
const PaymentVerification = lazy(() => import('../features/staff/pages/PaymentVerification'));
const ManualVisitLogger = lazy(() => import('../features/staff/pages/ManualVisitLogger'));
const VehicleManager = lazy(() => import('../features/staff/pages/VehicleManager'));
const ModernStaffDashboard = lazy(() => import('../features/staff/pages/ModernStaffDashboard'));
const WashHistory = lazy(() => import('../features/staff/pages/WashHistory'));
const Analytics = lazy(() => import('../features/staff/pages/Analytics'));
const CustomerAnalytics = lazy(() => import('../features/staff/pages/CustomerAnalytics'));
const StaffLayout = lazy(() => import('../features/staff/components/StaffLayout'));
// Staff guard (strict staff only)
const RequireStaff = lazy(() => import('../components/RequireStaff'));

// Admin pages
const AdminWelcome = lazy(() => import('../pages/admin/AdminWelcome'));
const ModuleSettings = lazy(() => import('../pages/admin/ModuleSettings'));
const AdminUserEdit = lazy(() => import('../pages/AdminUserEdit'));
const TenantsList = lazy(() => import('../pages/admin/TenantsList'));
const TenantEdit = lazy(() => import('../pages/admin/TenantEdit'));
// Expanded new admin feature scaffold pages
const AdminOverview = lazy(() => import('../features/admin/pages/Overview'));
const AdminUsers = lazy(() => import('../features/admin/pages/UsersAdmin'));
const BrandingPage = lazy(() => import('../pages/admin/BrandingPage'));
const InventoryPage = lazy(() => import('../pages/admin/InventoryPage'));
const AdminAuditLogs = lazy(() => import('../features/admin/pages/AuditLogs'));
const AdminJobsMonitor = lazy(() => import('../features/admin/pages/JobsMonitor'));
const AdminRateLimitEditor = lazy(() => import('../features/admin/pages/RateLimitEditor'));
const TransactionsAdmin = lazy(() => import('../features/admin/pages/TransactionsAdmin'));
// New admin pages for MVP
const CustomersAdmin = lazy(() => import('../features/admin/pages/CustomersAdmin'));
const CustomerDetailPage = lazy(() => import('../features/admin/pages/CustomerDetailPage'));
const ReportsAdmin = lazy(() => import('../features/admin/pages/ReportsAdmin'));
const NotificationsAdmin = lazy(() => import('../features/admin/pages/NotificationsAdmin'));
// New subscription management stub (replaces removed usage page)
const SubscriptionManagePage = lazy(() => import('../pages/admin/SubscriptionManagePageNew'));
// Enhanced user profile

// Route guards
function RequireAuth() {
  const { user, loading } = useAuth();
  const hasToken = typeof window !== 'undefined' ? Boolean(localStorage.getItem('token')) : false;
  if (loading || (!user && hasToken)) {
    return <LoadingFallback message="Restoring your session…" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user, loading } = useAuth();
  const { has } = useCapabilities();
  if (loading) return <LoadingFallback message="Loading…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!has('tenant.edit')) return <Navigate to="/" replace />;
  return <Outlet />;
}

const AppRoutes: React.FC = () => {
  // Feature flags
  const { enableLoyalty, enableOrders, enablePayments, enableUsers } = moduleFlags;

  const routes = [
    // PUBLIC
    { path: '/signup', element: <Signup /> },
    { path: '/login', element: <Login /> },
    { path: '/onboarding', element: <UnifiedOnboarding /> },
    { path: '/onboarding/verify', element: <OTPVerify /> },
    { path: '/onboarding/invite', element: <UnifiedOnboarding /> },
    { path: '/forgot-password', element: <ForgotPassword /> },
    { path: '/reset-password', element: <ResetPassword /> },
    { path: '/debug/firebase', element: <FirebaseTest /> },
    { path: '/debug/google-login', element: <GoogleLoginTest /> },
    { path: '/debug/google-redirect', element: <GoogleRedirectTest /> },
    { path: '/debug/google-auth', element: <GoogleLoginDebug /> },

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
            enableOrders && { path: '/order/confirmation/:orderId?', element: <OrderConfirmation /> },
            enableUsers && { path: '/account', element: <Account /> },
            enableUsers && { path: '/profile', element: <EnhancedProfile /> },
            enableOrders && { path: '/past-orders', element: <PastOrders /> },
          ].filter(Boolean),
        },
        // Staff Routes: now strictly staff only; admins redirected to /admin
        {
          path: '/staff',
          element: <RequireStaff><StaffLayout /></RequireStaff>,
          children: [
            { path: 'dashboard', element: <ModernStaffDashboard /> },
            { path: 'vehicle-manager', element: <VehicleManager /> },
            { path: 'wash-history', element: <WashHistory /> },
            enablePayments && { path: 'payment', element: <PaymentVerification /> },
            { path: 'analytics', element: <Analytics /> },
            { path: 'customer-analytics', element: <CustomerAnalytics /> },
            { path: 'manual-visit', element: <ManualVisitLogger /> },
          ].filter(Boolean),
        },
      ],
    },

    // ADMIN ROUTES
    {
      path: '/admin',
      element: <RequireAdmin />,
      children: [
        {
          element: <AdminLayout />,
          children: [
            { index: true, element: <AdminWelcome /> },
            { path: 'overview', element: <AdminOverview /> },
            { path: 'users-admin', element: <AdminUsers /> },
            { path: 'branding', element: <BrandingPage /> },
            { path: 'inventory', element: <InventoryPage /> },
            { path: 'transactions', element: <TransactionsAdmin /> },
            { path: 'audit', element: <AdminAuditLogs /> },
            { path: 'jobs', element: <AdminJobsMonitor /> },
            { path: 'rate-limits', element: <AdminRateLimitEditor /> },
            { path: 'register-staff', element: <Navigate to='users-admin?registerStaff=1' replace /> },
            { path: 'users/:userId/edit', element: <AdminUserEdit /> },
            { path: 'modules', element: <ModuleSettings /> },
            { path: 'customers', element: <CustomersAdmin /> },
            { path: 'customers/:id', element: <CustomerDetailPage /> },
            { path: 'reports', element: <ReportsAdmin /> },
            { path: 'notifications', element: <NotificationsAdmin /> },
            { path: 'tenants', element: <TenantsList /> },
            { path: 'tenants/:tenantId/edit', element: <TenantEdit /> },
            { path: 'subscription', element: moduleFlags.enableSubscription ? <SubscriptionManagePage /> : <Navigate to='/admin' replace /> },
            // Embed staff feature pages under /admin/staff/* so admins can access unified UI superset
            { path: 'staff/dashboard', element: <ModernStaffDashboard /> },
            { path: 'staff/vehicle-manager', element: <VehicleManager /> },
            { path: 'staff/wash-history', element: <WashHistory /> },
            enablePayments && { path: 'staff/payment', element: <PaymentVerification /> },
            { path: 'staff/analytics', element: <Analytics /> },
            { path: 'staff/customer-analytics', element: <CustomerAnalytics /> },
            { path: 'staff/manual-visit', element: <ManualVisitLogger /> },
          ],
        },
      ],
    },

    // DEVELOPER ADMIN PORTAL (separate from standard /admin)
    {
      path: '/dev-admin',
  element: <DevRequireDeveloper><Outlet /></DevRequireDeveloper>,
      children: [
        {
          element: <DeveloperAdminApp />, // provides its own layout + <Outlet/>
          children: [
            { path: 'tenants', element: <TenantList /> },
            { path: 'create', element: <CreateTenant /> },
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
