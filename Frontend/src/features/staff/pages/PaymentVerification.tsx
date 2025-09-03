// Minimal wrapper page delegating to the enhanced component.
import React from 'react';
import EnhancedPaymentVerification from '../components/EnhancedPaymentVerification';

const PaymentVerification: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
    <div className="max-w-7xl mx-auto px-4 py-8">
      <EnhancedPaymentVerification />
    </div>
  </div>
);

export default PaymentVerification;