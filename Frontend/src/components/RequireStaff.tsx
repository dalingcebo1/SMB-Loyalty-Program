import React from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/api";

const RequireStaff: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });

  if (isLoading) return <div>Loading...</div>;
  if (!user || (user.role !== "staff" && user.role !== "admin")) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default RequireStaff;