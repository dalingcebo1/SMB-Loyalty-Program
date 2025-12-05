import React from 'react';
import { ExtensionComponentProps } from '../types';

export const RetailPostRedemption: React.FC<ExtensionComponentProps> = ({ action, onComplete }) => {
  return (
    <div className="text-center">
      <h3 className="text-lg font-bold text-green-600 mb-2">Retail Redemption Complete</h3>
      <p className="mb-4">Please hand over the item to the customer.</p>
      <div className="bg-gray-100 p-3 rounded mb-4">
        <pre className="text-xs text-left overflow-auto">
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      </div>
      <button 
        onClick={onComplete}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );
};
