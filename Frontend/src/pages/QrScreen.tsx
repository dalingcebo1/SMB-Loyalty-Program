import React from "react";
import { Navigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../auth/AuthProvider";

export const QrScreen: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <PageLayout>
      <div>
        <h1>QrScreen</h1>
        {/* TODO: implement QrScreen */}
      </div>
    </PageLayout>
  );
};