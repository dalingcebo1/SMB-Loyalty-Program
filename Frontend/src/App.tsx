import React from "react";
import { Routes, Route } from "react-router-dom";

import OrderForm        from "./pages/OrderForm";
import PaystackPayment  from "./pages/PaystackPayment";
import OrderConfirmation from "./pages/OrderConfirmation";

const App: React.FC = () => (
  <Routes>
    <Route path="/"                element={<OrderForm />} />
    <Route path="/order/payment"   element={<PaystackPayment />} />
    <Route path="/order/confirmation" element={<OrderConfirmation />} />
    {/* …any other routes you have… */}
  </Routes>
);

export default App;
