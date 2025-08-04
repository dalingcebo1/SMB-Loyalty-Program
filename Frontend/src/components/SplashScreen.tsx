import React from 'react';

const SplashScreen: React.FC = () => (
  <div
    className="flex items-center justify-center h-screen bg-blue-600 text-white"
    role="status"
    aria-live="polite"
  >
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4">SMB Loyalty Program</h1>
      <p>Loading, please wait...</p>
    </div>
  </div>
);

export default SplashScreen;
