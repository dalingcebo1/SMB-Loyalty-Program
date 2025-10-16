// src/features/staff/pages/Analytics.tsx
import React from 'react';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';
import StaffPageContainer from '../components/StaffPageContainer';
import StaffEligibilityGate from '../components/StaffEligibilityGate';

const AnalyticsContent: React.FC = () => {
  return (
    <StaffPageContainer surface="plain" width="xl" padding="default" className="space-y-8">
      <EnhancedAnalyticsLazy />
    </StaffPageContainer>
  );
};

const Analytics: React.FC = () => (
  <StaffEligibilityGate required={['loyalty.view']}>
    <AnalyticsContent />
  </StaffEligibilityGate>
);

export default Analytics;
