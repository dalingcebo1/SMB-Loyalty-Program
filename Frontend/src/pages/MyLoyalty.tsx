// @ts-nocheck
import React from 'react';

/**
 * MyLoyalty page placeholder.
 */
const MyLoyalty: React.FC = () => (
  <div>MyLoyalty page under reconstruction.</div>
);

export default MyLoyalty;
// src/pages/MyLoyalty.tsx
import React from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import PageLayout from "../components/PageLayout";

const MyLoyalty: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLayout loading />;
  if (!user) return <Navigate to="/login" replace />;
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold">My Loyalty</h1>
        <p className="mt-4 text-gray-600">Page content cleaned up. Please re-add functionality.</p>
        <button
          onClick={() => navigate("/order")}
          className="mt-6 px-4 py-2 bg-purple-200 text-purple-800 rounded"
        >
          Book a Wash
        </button>
      </div>
    </PageLayout>
  );
};

// This page has been moved to src/features/loyalty/pages/MyLoyalty.tsx
