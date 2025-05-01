import React from "react";
import { usePaystackPayment, PaystackPaymentInitializeOptions } from "react-paystack";

/**
 * Props:
 *  - email: customer’s email
 *  - amount: numeric amount in kobo (e.g. R100 → 10000)
 *  - orderId: your internal order id, used for reference / reconcile
 */
interface PaystackPaymentProps {
  email: string;
  amount: number;
  orderId: number;
}

/**
 * Once payment succeeds, we call your backend to verify & capture.
 * Adjust the endpoint & payload to match your server.
 */
async function verifyPaymentOnServer(reference: string, orderId: number) {
  await fetch("/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, order_id: orderId }),
  });
}

const PaystackPayment: React.FC<PaystackPaymentProps> = ({
  email,
  amount,
  orderId,
}) => {
  // pull in your public key from VITE env
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string;

  const config: PaystackPaymentInitializeOptions = {
    publicKey,
    email,
    amount,
    reference: `${orderId}-${Date.now()}`,
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: { reference: string }) => {
    try {
      // send to your backend for verification / fulfillment
      await verifyPaymentOnServer(reference.reference, orderId);
      // then navigate or toast success
      alert("Payment successful! 🎉");
    } catch (err) {
      console.error("Verification failed:", err);
      alert("Payment succeeded but verification failed. Check server logs.");
    }
  };

  const onClose = () => {
    // user closed the modal
    console.log("Paystack payment dialog closed");
  };

  return (
    <button
      onClick={() => initializePayment(onSuccess, onClose)}
      style={{
        marginTop: "1rem",
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        cursor: "pointer",
      }}
    >
      Pay R{(amount / 100).toFixed(2)}
    </button>
  );
};

export default PaystackPayment;
