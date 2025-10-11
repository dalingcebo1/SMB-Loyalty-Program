// src/features/staff/pages/WashHistory.tsx
import React, { Suspense, lazy } from 'react';
import StaffPageContainer from '../components/StaffPageContainer';
// Phase 4: code-splitting heavy history analytics component
const EnhancedWashHistory = lazy(() => import('../components/EnhancedWashHistory'));

const WashHistory: React.FC = () => {
  return (
    <StaffPageContainer surface="plain" width="wide" padding="default" className="space-y-8">
      <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading wash history…</div>}>
        <EnhancedWashHistory />
      </Suspense>
    </StaffPageContainer>
  );
};

export default WashHistory;
