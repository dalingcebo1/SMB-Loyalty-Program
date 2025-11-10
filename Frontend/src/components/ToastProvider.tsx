import React from 'react';
import { ToastContainer, cssTransition } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/toast-overrides.css';

interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * Central toast host configured for gentle fade animations and limited concurrency.
 * Keeps a single ToastContainer mounted while exposing standard React children.
 */
const FadeTransition = cssTransition({
  enter: 'rt-fade-enter',
  exit: 'rt-fade-exit',
});

const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => (
  <>
    {children}
    <ToastContainer
      position="top-center"
      autoClose={3200}
      hideProgressBar
      newestOnTop
      closeOnClick
      draggable={false}
      pauseOnFocusLoss
      pauseOnHover
      limit={3}
      transition={FadeTransition}
      theme="light"
    />
  </>
);

export default ToastProvider;
