// Minimal wrapper page delegating to the enhanced component.
import React from 'react';
import EnhancedPaymentVerification from '../components/EnhancedPaymentVerification';
import StaffPageContainer from '../components/StaffPageContainer';

const PaymentVerification: React.FC = () => (
  <StaffPageContainer surface="plain" width="wide" padding="none" className="space-y-8">
    <EnhancedPaymentVerification />
  </StaffPageContainer>
);

export default PaymentVerification;