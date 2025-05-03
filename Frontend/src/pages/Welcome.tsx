import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const Welcome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // fallback if somehow no name
  const name = user?.firstName + (user?.lastName ? ` ${user.lastName}` : "");

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 px-4">
      <h1 className="text-3xl font-bold text-center">Welcome, {name}!</h1>
      <p className="text-center text-gray-700 max-w-md">
        Thank you for registering—welcome to your full-service car-wash application.
      </p>

      {/* you could pull visits from your profile if you have it in context */}
      <div className="border-2 border-gray-300 rounded-full w-24 h-24 flex items-center justify-center text-xl font-medium">
        {/* placeholder count: 0/5 */}
        0/5
      </div>

      <p className="text-center text-gray-700 max-w-md">
        At Sparkle Car Wash, we like to acknowledge your continued support; that’s why we’re giving you the 6th full wash on us.
      </p>

      <div className="flex space-x-4">
        <button
          onClick={() => navigate("/rewards")}
          className="px-6 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
        >
          View My Loyalty
        </button>
        <button
          onClick={() => navigate("/order")}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          View Services
        </button>
      </div>
    </div>
  );
};

export default Welcome;
