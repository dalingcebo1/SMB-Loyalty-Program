// src/features/staff/pages/Analytics.tsx
import React from 'react';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';
import StaffPageContainer from '../components/StaffPageContainer';

const Analytics: React.FC = () => {
  return (
    <StaffPageContainer surface="plain" width="wide" padding="default" className="space-y-8">
      <EnhancedAnalyticsLazy />
    </StaffPageContainer>
  );
};

export default Analytics;
