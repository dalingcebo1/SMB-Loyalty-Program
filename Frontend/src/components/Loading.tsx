import React from 'react';

const Loading: React.FC<{ text?: string }> = ({ text = 'Loading…' }) => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <svg
      className="animate-spin h-8 w-8 text-blue-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      ></path>
    </svg>
    <span className="ml-2 text-gray-600 text-lg">{text}</span>
  </div>
);

export default Loading;
