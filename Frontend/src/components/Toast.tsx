import React from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', handleKey); };
  }, [onClose]);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded shadow z-50 flex items-center"
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        aria-label="Close notification"
        className="ml-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-white rounded"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
