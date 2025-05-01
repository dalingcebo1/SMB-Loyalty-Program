// src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from './pages/Login';
//import Signup from './pages/Signup';
//import Claimed from './pages/Claimed';
import OrderForm from "./pages/OrderForm";
import PaystackPayment from "./pages/PaystackPayment";
import OrderConfirmation from "./pages/OrderConfirmation";
// … any other pages

const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    {/* <Route path="/signup" element={<Signup />} /> */}
    {/* <Route path="/claimed" element={<Claimed />} /> */}
    {/* Add your other routes here */}    
    <Route path="/" element={<OrderForm />} />
    <Route path="/payment" element={<PaystackPayment />} />
    <Route path="/order/confirmation" element={<OrderConfirmation />} />
    {/* add your other routes here */}
  </Routes>
);

export default App;
