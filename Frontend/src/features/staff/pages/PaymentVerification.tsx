// Minimal wrapper page delegating to the enhanced component.
import React from 'react';
import EnhancedPaymentVerification from '../components/EnhancedPaymentVerification';

const PaymentVerification: React.FC = () => <EnhancedPaymentVerification />;

export default PaymentVerification;