// src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";

import OrderForm from "./pages/OrderForm";
import OrderConfirmation from "./pages/OrderConfirmation";
// … import any other pages you have

const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<OrderForm />} />
    <Route path="/order/confirmation" element={<OrderConfirmation />} />
    {/* add your other routes here */}
  </Routes>
);

export default App;
