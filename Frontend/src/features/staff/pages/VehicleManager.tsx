// src/features/staff/pages/VehicleManager.tsx
import React from 'react';
import StaffPageContainer from '../components/StaffPageContainer';
import EnhancedVehicleManager from '../components/EnhancedVehicleManager';
import StaffEligibilityGate from '../components/StaffEligibilityGate';

const VehicleManagerContent: React.FC = () => {
  return (
    <StaffPageContainer surface="plain" width="xl" padding="default" className="space-y-8">
      <EnhancedVehicleManager />
    </StaffPageContainer>
  );
};

const VehicleManager: React.FC = () => {
  return (
  <StaffEligibilityGate required={['vehicles.view']}>
      <VehicleManagerContent />
    </StaffEligibilityGate>
  );
};

export default VehicleManager;