import React from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => (
  <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded shadow z-50">
    {message}
    <button className="ml-4 text-white font-bold" onClick={onClose}>
      &times;
    </button>
  </div>
);

export default Toast;
