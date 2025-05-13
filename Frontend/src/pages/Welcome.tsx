import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

const VISIT_MILESTONE = 5;

const Welcome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState(0);

  useEffect(() => {
    if (user?.phone) {
      api
        .get("/loyalty/me", { params: { phone: user.phone } })
        .then((res) => setVisits(res.data.visits || 0))
        .catch(() => setVisits(0));
    }
  }, [user]);

  const name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || "";

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 px-4">
      <h1 className="text-3xl font-bold text-center mt-6">
        Welcome,<br />
        {name}!
      </h1>
      <p className="text-center text-gray-700 max-w-md mt-2">
        Thank you for registering, welcome to your full—<br />
        service loyalty program.
      </p>
      <div className="flex flex-col items-center mt-4">
        <div className="border-2 border-gray-400 rounded-full w-36 h-36 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold">{visits}/{VISIT_MILESTONE}</span>
          <span className="text-lg mt-1">Visits</span>
        </div>
        <p className="text-center text-gray-700 max-w-md mt-4">
          You’re just {VISIT_MILESTONE - visits} visits away from gaining a free full wash on us
        </p>
      </div>
      <div className="flex flex-col space-y-4 w-full mt-6">
        <button
          onClick={() => navigate("/myloyalty")}
          className="w-full px-6 py-3 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-lg font-semibold"
        >
          View Rewards
        </button>
        <button
          onClick={() => navigate("/order")}
          className="w-full px-6 py-3 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-lg font-semibold"
        >
          View Services
        </button>
      </div>
    </div>
  );
};

export default Welcome;
