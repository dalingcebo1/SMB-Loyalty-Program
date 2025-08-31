// src/App.tsx

// React import not required for JSX automatic runtime
// import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { Routes, Route } from 'react-router-dom';
import { RequireDeveloper } from './dev-admin/routeGuard';
import DeveloperAdminApp from './dev-admin/DeveloperAdminApp';
import CreateTenant from './dev-admin/CreateTenant';
import TenantList from './dev-admin/TenantList';
import AppRoutes from './routes';
import { useIdlePrefetch } from './prefetch';

export default function App() {
  useIdlePrefetch(); // schedule background chunk/data prefetches based on route heuristics
  return (
    <>
      <ToastContainer position="top-center" />
      <Routes>
        <AppRoutes />
        <Route path="/dev-admin" element={
          <RequireDeveloper>
            <DeveloperAdminApp />
          </RequireDeveloper>
        }>
          <Route path="tenants" element={<TenantList />} />
          <Route path="create" element={<CreateTenant />} />
        </Route>
      </Routes>
    </>
  );
}
