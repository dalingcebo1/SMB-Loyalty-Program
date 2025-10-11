// src/features/staff/pages/VehicleManager.tsx
import React from 'react';
import StaffPageContainer from '../components/StaffPageContainer';
import EnhancedVehicleManager from '../components/EnhancedVehicleManager';

const VehicleManager: React.FC = () => {
  return (
    <StaffPageContainer surface="plain" width="wide" padding="none" className="space-y-8">
      <EnhancedVehicleManager />
    </StaffPageContainer>
  );
};

export default VehicleManager;