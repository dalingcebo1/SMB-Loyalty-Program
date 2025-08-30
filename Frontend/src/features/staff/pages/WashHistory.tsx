// src/features/staff/pages/WashHistory.tsx
import React, { Suspense, lazy } from 'react';
// Phase 4: code-splitting heavy history analytics component
const EnhancedWashHistory = lazy(() => import('../components/EnhancedWashHistory'));

const WashHistory: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading wash history…</div>}>
      <EnhancedWashHistory />
    </Suspense>
  );
};

export default WashHistory;
