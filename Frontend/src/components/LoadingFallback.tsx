import React from 'react';
import Spinner from './Spinner';

interface LoadingFallbackProps {
  message?: string;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center h-full p-4">
    <Spinner />
    {message && <span className="ml-2 text-gray-700">{message}</span>}
  </div>
);

export default LoadingFallback;
