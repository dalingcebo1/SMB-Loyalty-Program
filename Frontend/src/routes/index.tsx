// src/routes/index.tsx
import React, { Suspense, lazy, ComponentType } from 'react';
import { useRoutes, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { TenantConfigContext } from '../config/TenantConfigProvider';
import { getModuleFlags } from '../config/modules';
import { useAuth } from '../auth/AuthProvider';
import { useCapabilities } from '../features/admin/hooks/useCapabilities';
import LoadingFallback from '../components/LoadingFallback';

// Lazy loading with retry logic for production MIME type errors
function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch((error) => {
      console.error('Lazy loading failed, retrying...', error);
      // Retry once after a short delay
      return new Promise<{ default: T }>((resolve) => {
        setTimeout(() => {
          importFn()
            .then(resolve)
            .catch((retryError) => {
              console.error('Retry failed, reloading page...', retryError);
              // If retry fails, reload the page to get fresh chunks
              window.location.reload();
              // Return a dummy component to satisfy TypeScript (never actually used due to reload)
              return resolve({ default: (() => null) as unknown as T });
            });
        }, 1000);
      });
    })
  );
}

// Layouts are lazy-loaded to reduce initial bundle
const DashboardLayout = lazy(() => import('../components/DashboardLayout'));
const AdminLayout = lazy(() => import('../components/AdminLayout'));

// Dev admin area (developer portal)
const DeveloperAdminApp = lazy(() => import('../dev-admin/DeveloperAdminApp'));
const CreateTenant = lazy(() => import('../dev-admin/CreateTenant'));
const TenantList = lazy(() => import('../dev-admin/TenantList'));
const DevRequireDeveloper = lazy(() => import('../dev-admin/routeGuard').then(m => ({ default: m.RequireDeveloper })));

// Critical pages: Welcome, OrderForm, and Payment are eagerly imported for best UX
import Welcome from '../pages/Welcome';
import OrderForm from '../pages/OrderForm';
import Payment from '../features/order/pages/Payment';

// Secondary pages are lazy-loaded to reduce initial bundle size
const MyLoyalty = lazy(() => import('../features/loyalty/pages/MyLoyalty'));
const OrderConfirmation = lazy(() => import('../pages/OrderConfirmation'));
const PastOrders = lazy(() => import('../pages/PastOrders'));
const Account = lazy(() => import('../pages/Account'));
const EnhancedProfile = lazy(() => import('../pages/EnhancedProfile'));

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
const Marketplace = lazy(() => import('../pages/admin/Marketplace'));
const LoyaltyProgramSettings = lazy(() => import('../pages/admin/LoyaltyProgramSettings'));
const AdminUserEdit = lazy(() => import('../pages/AdminUserEdit'));
const TenantsList = lazy(() => import('../pages/admin/TenantsList'));
const TenantEdit = lazy(() => import('../pages/admin/TenantEdit'));
const OrganizationSettings = lazy(() => import('../pages/admin/OrganizationSettings'));
// Expanded new admin feature scaffold pages
const AdminOverview = lazyWithRetry(() => import('../features/admin/pages/Overview'));
const AdminUsers = lazyWithRetry(() => import('../features/admin/pages/UsersAdmin'));
const InventoryPage = lazyWithRetry(() => import('../pages/admin/InventoryPage'));
const AdminAuditLogs = lazyWithRetry(() => import('../features/admin/pages/AuditLogs'));
const AdminJobsMonitor = lazyWithRetry(() => import('../features/admin/pages/JobsMonitor'));
const AdminRateLimitEditor = lazyWithRetry(() => import('../features/admin/pages/RateLimitEditor'));
const TransactionsAdmin = lazyWithRetry(() => import('../features/admin/pages/TransactionsAdmin'));
const TransactionDetail = lazy(() => import('../features/admin/pages/TransactionDetail'));
// New admin pages for MVP
const CustomersAdmin = lazy(() => import('../features/admin/pages/CustomersAdmin'));
const CustomerDetailPage = lazy(() => import('../features/admin/pages/CustomerDetailPage'));
const ReportsAdmin = lazy(() => import('../features/admin/pages/ReportsAdmin'));
const AnalyticsAdmin = lazy(() => import('../features/admin/pages/AnalyticsAdmin'));
const NotificationsAdmin = lazy(() => import('../features/admin/pages/NotificationsAdmin'));
// New subscription management stub (replaces removed usage page)
const SubscriptionManagePage = lazy(() => import('../pages/admin/SubscriptionManagePageNew'));
// Billing and usage page
const BillingSettings = lazy(() => import('../features/admin/pages/BillingSettings'));
// Financial admin pages
const FinancialDashboard = lazyWithRetry(() => import('../features/admin/pages/FinancialDashboard'));
const InvoicesPage = lazyWithRetry(() => import('../features/admin/pages/InvoicesPage'));
const ExpensesPage = lazyWithRetry(() => import('../features/admin/pages/ExpensesPage'));
const ProfitLossReport = lazyWithRetry(() => import('../features/admin/pages/ProfitLossReport'));
// Onboarding wizard
const OnboardingWizard = lazyWithRetry(() => import('../features/admin/pages/OnboardingWizard'));
// Retail vertical pages
const RetailInventoryDashboard = lazy(() => import('../features/retail/pages/InventoryDashboard'));
const POSTerminal = lazy(() => import('../features/retail/pages/POSTerminal'));
const RetailSalesReports = lazy(() => import('../features/retail/pages/SalesReports'));
// Dispensary vertical pages
const DispensaryProductManagement = lazy(() => import('../features/dispensary/pages/ProductManagement'));
const DispensaryCategoryManagement = lazy(() => import('../features/dispensary/pages/CategoryManagement'));
const DispensaryVerificationManagement = lazy(() => import('../features/dispensary/pages/VerificationManagement'));
const DispensarySalesReports = lazy(() => import('../features/dispensary/pages/SalesReports'));
const DispensaryProductCatalog = lazy(() => import('../features/dispensary/pages/ProductCatalog'));
// Padel vertical pages
const PadelCourtManagement = lazy(() => import('../features/padel/pages/CourtManagement'));
const PadelBookingCalendar = lazy(() => import('../features/padel/pages/BookingCalendar'));
const PadelCustomerBooking = lazy(() => import('../features/padel/pages/CustomerBooking'));
// Beauty vertical pages
const BeautyServiceManagement = lazy(() => import('../features/beauty/pages/ServiceManagement'));
const BeautyStylistManagement = lazy(() => import('../features/beauty/pages/StylistManagement'));
const BeautyAppointmentCalendar = lazy(() => import('../features/beauty/pages/AppointmentCalendar'));
const BeautyCustomerBooking = lazy(() => import('../features/beauty/pages/CustomerBooking'));
// Flowershop vertical pages
const FlowershopProductCatalog = lazy(() => import('../features/flowershop/pages/ProductCatalog'));
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
  const tenantConfig = React.useContext(TenantConfigContext);
  const moduleFlags = tenantConfig?.moduleFlags || getModuleFlags();
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
            // Vertical-specific customer pages
            { path: '/dispensary', element: <DispensaryProductCatalog /> },
            { path: '/padel/book', element: <PadelCustomerBooking /> },
            { path: '/beauty/book', element: <BeautyCustomerBooking /> },
            { path: '/flowershop', element: <FlowershopProductCatalog /> },
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
            { path: 'onboarding', element: <OnboardingWizard /> },
            { path: 'overview', element: <AdminOverview /> },
            { path: 'users-admin', element: <AdminUsers /> },
            { path: 'branding', element: <Navigate to="/admin/settings" replace /> },
            { path: 'inventory', element: <InventoryPage /> },
            { path: 'transactions', element: <TransactionsAdmin /> },
            { path: 'transactions/:id', element: <TransactionDetail /> },
            { path: 'audit', element: <AdminAuditLogs /> },
            { path: 'jobs', element: <AdminJobsMonitor /> },
            { path: 'rate-limits', element: <AdminRateLimitEditor /> },
            { path: 'register-staff', element: <Navigate to='users-admin?registerStaff=1' replace /> },
            { path: 'users/:userId/edit', element: <AdminUserEdit /> },
            { path: 'modules', element: <Marketplace /> },
            { path: 'loyalty-settings', element: <LoyaltyProgramSettings /> },
            { path: 'customers', element: <CustomersAdmin /> },
            { path: 'customers/:id', element: <CustomerDetailPage /> },
            { path: 'reports', element: <ReportsAdmin /> },
            { path: 'analytics', element: <AnalyticsAdmin /> },
            { path: 'notifications', element: <NotificationsAdmin /> },
            { path: 'settings', element: <OrganizationSettings /> },
            { path: 'billing', element: <BillingSettings /> },
            // Financial routes
            { path: 'financial', element: <FinancialDashboard /> },
            { path: 'financial/invoices', element: <InvoicesPage /> },
            { path: 'financial/expenses', element: <ExpensesPage /> },
            { path: 'financial/profit-loss', element: <ProfitLossReport /> },
            { path: 'tenants', element: <TenantsList /> },
            { path: 'tenants/:tenantId/edit', element: <TenantEdit /> },
            { path: 'subscription', element: moduleFlags.enableSubscription ? <SubscriptionManagePage /> : <Navigate to='/admin' replace /> },
            // Retail vertical routes
            { path: 'retail/inventory', element: <RetailInventoryDashboard /> },
            { path: 'retail/pos', element: <POSTerminal /> },
            { path: 'retail/sales', element: <RetailSalesReports /> },
            // Dispensary vertical routes
            { path: 'dispensary/products', element: <DispensaryProductManagement /> },
            { path: 'dispensary/categories', element: <DispensaryCategoryManagement /> },
            { path: 'dispensary/verifications', element: <DispensaryVerificationManagement /> },
            { path: 'dispensary/sales', element: <DispensarySalesReports /> },
            // Padel vertical routes
            { path: 'padel/courts', element: <PadelCourtManagement /> },
            { path: 'padel/bookings', element: <PadelBookingCalendar /> },
            // Beauty vertical routes
            { path: 'beauty/services', element: <BeautyServiceManagement /> },
            { path: 'beauty/stylists', element: <BeautyStylistManagement /> },
            { path: 'beauty/appointments', element: <BeautyAppointmentCalendar /> },
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
