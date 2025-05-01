import React from "react";
import { usePaystackPayment, PaystackProps } from "react-paystack";

interface PaystackPaymentProps {
  email:   string;
  amount:  number;   // in kobo
  orderId: number;
}

const PaystackPayment: React.FC<PaystackPaymentProps> = ({
  email,
  amount,
  orderId,
}) => {
  const publicKey = import.meta.env
    .VITE_PAYSTACK_PUBLIC_KEY as string;

  const config: PaystackProps = {
    reference: orderId.toString(),
    email,
    amount,
    publicKey,
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (reference: any) => {
    console.log("Payment successful:", reference);
    // TODO: maybe hit your backend to mark paid
  };

  const onClose = () => {
    console.log("Payment dialog closed");
  };

  return (
    <button
      onClick={() =>
        initializePayment({ onSuccess, onClose })
      }
      style={{
        marginTop: "1rem",
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        cursor: "pointer",
      }}
    >
      Pay Now
    </button>
  );
};

export default PaystackPayment;
