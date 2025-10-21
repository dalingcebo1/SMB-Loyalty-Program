// src/App.tsx

// React import not required for JSX automatic runtime
// import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// App shell just mounts the unified route config handled by useRoutes in routes/index.tsx
import AppRoutes from './routes';
import { useIdlePrefetch } from './prefetch';

export default function App() {
  useIdlePrefetch(); // schedule background chunk/data prefetches based on route heuristics
  return (
    <div className="app-shell">
      <ToastContainer position="top-center" />
      <AppRoutes />
    </div>
  );
}
