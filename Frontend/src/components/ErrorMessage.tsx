import React from 'react';

<<<<<<< HEAD
interface ErrorMessageProps {
=======
export interface ErrorMessageProps {
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => (
<<<<<<< HEAD
  <div className="flex flex-col items-center justify-center p-6 bg-red-50 rounded">
    <p className="text-red-600 text-center mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
=======
  <div className="flex flex-col items-center justify-center h-full p-4">
    <p className="text-red-600 mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
      >
        Retry
      </button>
    )}
  </div>
);

export default ErrorMessage;
