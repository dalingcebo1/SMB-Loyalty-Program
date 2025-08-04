import React from "react";
import PaymentVerification from "./staff/PaymentVerification";
import VehicleManager from "./staff/VehicleManager";
import ManualVisitLogger from "./staff/ManualVisitLogger";
import PageLayout from "../components/PageLayout";

const StaffDashboard: React.FC = () => (
  <PageLayout>
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
      <h1>Staff Dashboard</h1>
      <PaymentVerification />
      <VehicleManager />
      <ManualVisitLogger />
    </div>
  </PageLayout>
);

export default StaffDashboard;