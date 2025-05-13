import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

const VISIT_MILESTONE = 5;

const Welcome: React.FC = () => {
  const { user } = useAuth();
  const [visits, setVisits] = useState(0);
  const [justOnboarded, setJustOnboarded] = useState(false);

  useEffect(() => {
    if (user?.phone) {
      api
        .get("/loyalty/me", { params: { phone: user.phone } })
        .then((res) => setVisits(res.data.visits || 0))
        .catch(() => setVisits(0));
    }
  }, [user]);

  useEffect(() => {
    if (localStorage.getItem("justOnboarded") === "true") {
      setJustOnboarded(true);
      localStorage.removeItem("justOnboarded");
    }
  }, []);

  const name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || "";

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-2 py-4">
      {/* Welcome message card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-4 mb-8 text-center">
        <div className="font-semibold text-base mb-1">
          Welcome {name}!
        </div>
        <div className="text-gray-600 text-sm">
          {justOnboarded
            ? "Thank you for registering, welcome to your full service car wash application."
            : "Glad to see you again. Check out your rewards or book a service!"}
        </div>
      </div>

      {/* Visit counter */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-40 h-40 rounded-full border-4 border-gray-300 flex flex-col items-center justify-center text-center bg-white shadow-inner mx-auto">
          <span className="text-2xl font-bold text-blue-700">{visits}/{VISIT_MILESTONE}</span>
          <span className="text-lg text-gray-600 mt-1">Visits</span>
        </div>
      </div>

      {/* Loyalty message card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-4 text-center mb-8">
        <div className="text-gray-700 text-sm">
          At x car wash, we like to acknowledge your continued support, that is why we are giving you the 6th Full Wash on us.
        </div>
      </div>
    </div>
  );
};

export default Welcome;


