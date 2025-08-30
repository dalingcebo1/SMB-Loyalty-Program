// src/App.tsx

// React import not required for JSX automatic runtime
// import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AppRoutes from './routes';
import { useIdlePrefetch } from './prefetch';

export default function App() {
  useIdlePrefetch(); // schedule background chunk/data prefetches based on route heuristics
  return (
    <>
      <ToastContainer position="top-center" />
      <AppRoutes />
    </>
  );
}
