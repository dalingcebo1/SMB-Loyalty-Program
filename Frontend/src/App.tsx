// src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";

import OrderForm from "./pages/OrderForm";
import PaystackPayment from "./pages/PaystackPayment";
import OrderConfirmation from "./pages/OrderConfirmation";
// … any other pages

const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<OrderForm />} />
    <Route path="/payment" element={<PaystackPayment />} />
    <Route path="/order/confirmation" element={<OrderConfirmation />} />
    {/* add your other routes here */}
  </Routes>
);

export default App;
