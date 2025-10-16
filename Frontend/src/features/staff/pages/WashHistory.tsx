// src/features/staff/pages/WashHistory.tsx
import React, { Suspense, lazy } from 'react';
import StaffPageContainer from '../components/StaffPageContainer';
import StaffEligibilityGate from '../components/StaffEligibilityGate';
// Phase 4: code-splitting heavy history analytics component
const EnhancedWashHistory = lazy(() => import('../components/EnhancedWashHistory'));

const WashHistoryContent: React.FC = () => {
  return (
    <StaffPageContainer surface="plain" width="xl" padding="default" className="space-y-8">
      <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading wash history…</div>}>
        <EnhancedWashHistory />
      </Suspense>
    </StaffPageContainer>
  );
};

const WashHistory: React.FC = () => (
  <StaffEligibilityGate required={['orders.view']}>
    <WashHistoryContent />
  </StaffEligibilityGate>
);

export default WashHistory;
