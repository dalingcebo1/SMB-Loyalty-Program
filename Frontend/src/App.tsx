// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Onboarding from "./pages/Onboarding";
import Services from "./pages/Services";
// import Rewards   from "./pages/Rewards";
// import Claimed   from "./pages/Claimed";
// import History   from "./pages/History";
import OrderForm from "./pages/OrderForm";
import OrderConfirmation from "./pages/OrderConfirmation";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Redirect root to onboarding */}
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        {/* Redirect /Order form to order confirmation */}
        <Route path="/order/confirmation" element={<OrderConfirmation />} />

        {/* Onboarding flow */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Catalog / services picker */}
        <Route path="/services" element={<Services />} />

        {/* Catalog / Order form */}
        <Route path="/order" element={<OrderForm />} />

        {/*
          // add your other pages here, e.g.:
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/claimed" element={<Claimed />} />
          <Route path="/history" element={<History />} />
        */}
      </Routes>
    </Router>
  );
};

export default App;
