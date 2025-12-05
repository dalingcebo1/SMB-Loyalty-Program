import React from 'react';
import { ExtensionComponentProps } from '../types';

export const CarwashPinDisplay: React.FC<ExtensionComponentProps> = ({ action, onComplete }) => {
  const { pin, reward_name, instructions } = action.payload;

  return (
    <div className="text-center p-4">
      <div className="mb-4">
        <span className="inline-block p-3 rounded-full bg-blue-100 text-blue-600">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.536 19.464a1.5 1.5 0 01-2.122 0l-.354-.354a1.5 1.5 0 010-2.122l.172-.172a1.5 1.5 0 012.122 0l.172.172 3.182-3.182A6 6 0 0121 9zM7 9a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 mb-1">Redemption Successful</h3>
      <p className="text-sm text-gray-500 mb-6">{reward_name}</p>

      <div className="bg-gray-50 rounded-xl p-6 mb-6 border-2 border-dashed border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Verification PIN</p>
        <div className="text-4xl font-mono font-bold text-gray-900 tracking-widest">
          {pin}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-6 bg-blue-50 p-3 rounded-lg">
        {instructions}
      </p>

      <button 
        onClick={onComplete}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
      >
        Close & Continue
      </button>
    </div>
  );
};
