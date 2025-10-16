// Minimal wrapper page delegating to the enhanced component.
import React from 'react';
import EnhancedPaymentVerification from '../components/EnhancedPaymentVerification';
import StaffPageContainer from '../components/StaffPageContainer';
import StaffEligibilityGate from '../components/StaffEligibilityGate';

const PaymentVerificationContent: React.FC = () => (
  <StaffPageContainer surface="plain" width="xl" padding="default" className="space-y-8">
    <EnhancedPaymentVerification />
  </StaffPageContainer>
);

const PaymentVerification: React.FC = () => (
  <StaffEligibilityGate required={['payments.verify']}>
    <PaymentVerificationContent />
  </StaffEligibilityGate>
);

export default PaymentVerification;