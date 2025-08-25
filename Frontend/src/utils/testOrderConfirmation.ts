// Test utility for OrderConfirmation page
// Navigate to: /order/confirmation/test-order-123

export const createTestOrderConfirmationData = () => {
  const testData = {
    orderId: "test-order-123",
    qrData: "test-payment-ref-456",
    qrCodeBase64: undefined, // Will use QRCode component
    amount: 15000, // R150.00 in cents
    paymentPin: "1234",
    summary: ["Premium Wash", "Wax Protection", "Interior Clean"],
    timestamp: Date.now(),
    serviceName: "Premium Wash",
    loyaltyEligible: true,
    status: "paid"
  };

  // Store in localStorage for testing
  localStorage.setItem("lastOrderConfirmation", JSON.stringify(testData));
  
  return testData;
};

// Quick test function to simulate successful payment flow
export const simulateSuccessfulPayment = () => {
  const testData = createTestOrderConfirmationData();
  
  // Simulate navigation to confirmation with state
  window.history.pushState(testData, '', '/order/confirmation/test-order-123');
  
  console.log('Test order confirmation data created:', testData);
  console.log('Navigate to /order/confirmation/test-order-123 to see the page');
  
  return testData;
};

// Usage: 
// 1. Call createTestOrderConfirmationData() in browser console
// 2. Navigate to /order/confirmation/test-order-123
// 3. Page will load with test data

// OR use simulateSuccessfulPayment() to simulate the full flow
