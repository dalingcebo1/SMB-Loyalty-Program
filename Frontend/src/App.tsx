import React from "react";
import { Routes, Route } from "react-router-dom";

import OrderForm from "./pages/OrderForm";
import OrderConfirmation from "./pages/OrderConfirmation";
// … import your other “pages” here

const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<OrderForm />} />
    <Route path="/order/confirmation" element={<OrderConfirmation />} />
    {/* add your other routes */}
  </Routes>
);

export default App;
