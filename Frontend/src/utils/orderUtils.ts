// src/utils/orderUtils.ts
import axios from "axios";

interface OrderPayload {
  [key: string]: unknown;
}

interface NavigateFunction {
  (to: string, options?: { state?: unknown }): void;
}

export const createOrder = async (orderPayload: OrderPayload, navigate: NavigateFunction) => {
  const response = await axios.post("/api/orders/create", orderPayload);
  const { order_id, qr_data, amount, payment_pin } = response.data;

  navigate("/order/payment", {
    state: {
      orderId: order_id,        // string (uuid)
      qrData: qr_data,          // string (could be order_id or payment.reference)
      total: amount,            // number (cents), renamed to 'total' for consistency
      paymentPin: payment_pin   // string (4-digit pin)
    }
  });
};
