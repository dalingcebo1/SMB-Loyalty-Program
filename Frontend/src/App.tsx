// src/App.tsx

import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";

import Signup            from "./pages/Signup";
import Login             from "./pages/Login";
import Onboarding        from "./pages/Onboarding";
import OTPVerify         from "./pages/OTPVerify";
import OrderForm         from "./pages/OrderForm";
import PaymentPage       from "./pages/PaymentPage";
import OrderConfirmation from "./pages/OrderConfirmation";
import { SocialLogin }   from "./pages/SocialLogin";
// import RewardsPage     from "./pages/RewardsPage";
// import ClaimedPage     from "./pages/ClaimedPage";
// import HistoryPage     from "./pages/HistoryPage";

import DashboardLayout   from "./components/DashboardLayout";
import api               from "./api/api";


// ——— Protects dashboard & order routes ————————————————
function RequireProfile() {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (!user) {
        // not signed in → redirect to login
        navigate("/login", { replace: true });
        setChecking(false);
        return;
      }

      try {
        // check if user is onboarded
        const { data } = await api.get<{ exists: boolean }>(
          `/users/${user.uid}/exists`
        );

        if (!data.exists) {
          // no backend record → sign out and restart at signup
          await firebaseSignOut(auth);
          navigate("/signup", { replace: true });
        }
      } catch (err) {
        console.error("Profile-check failed:", err);
        // on error, clear session and back to login
        await firebaseSignOut(auth);
        navigate("/login", { replace: true });
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  // when done checking, render nested protected routes
  return <Outlet />;
}


// ——— App & Routes ————————————————————————————————
const App: React.FC = () => (
  <Routes>
    {/* PUBLIC */}
    <Route path="/signup"             element={<Signup />} />
    <Route path="/login"              element={<Login  />} />
    <Route path="/social-login"       element={<SocialLogin />} />
    <Route path="/onboarding"         element={<Onboarding />} />
    <Route path="/onboarding/verify"  element={<OTPVerify  />} />

    {/* PROTECTED: dashboard & order flows */}
    <Route element={<RequireProfile />}>
      <Route path="/"                  element={<DashboardLayout />} />

      {/* Dashboard tabs (uncomment when ready) */}
      {/* <Route path="rewards"   element={<RewardsPage />} /> */}
      {/* <Route path="claimed"   element={<ClaimedPage />} /> */}
      {/* <Route path="history"   element={<HistoryPage />} /> */}

      {/* Order flow */}
      <Route path="order"              element={<OrderForm         />} />
      <Route path="order/payment"      element={<PaymentPage       />} />
      <Route path="order/confirmation" element={<OrderConfirmation />} />
    </Route>

    {/* FALLBACK */}
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;
