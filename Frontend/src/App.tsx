// src/App.tsx

// React import not required for JSX automatic runtime
// import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AppRoutes from './routes';

export default function App() {
  return (
    <>
      <ToastContainer position="top-center" />
      <AppRoutes />
    </>
  );
}
