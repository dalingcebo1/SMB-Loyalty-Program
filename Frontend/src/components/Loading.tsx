import React from 'react';

<<<<<<< HEAD
const Loading: React.FC<{ text?: string }> = ({ text = 'Loading…' }) => (
  <div className="flex items-center justify-center min-h-[40vh]">
=======
export interface LoadingProps {
  text?: string;
}

const Loading: React.FC<LoadingProps> = ({ text }) => (
  <div className="flex flex-col items-center justify-center h-full p-4">
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
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
<<<<<<< HEAD
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      ></path>
    </svg>
    <span className="ml-2 text-gray-600 text-lg">{text}</span>
=======
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
    {text && <p className="mt-2 text-gray-600">{text}</p>}
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
  </div>
);

export default Loading;
