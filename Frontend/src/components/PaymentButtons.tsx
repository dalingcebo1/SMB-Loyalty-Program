import React from "react";

export const PaymentButtons: React.FC<{
  onGooglePay: () => void;
  onApplePay: () => void;
}> = ({ onGooglePay, onApplePay }) => (
  <div>
    <button onClick={onGooglePay}>Google Pay</button>
    <button onClick={onApplePay}>Apple Pay</button>
  </div>
);
