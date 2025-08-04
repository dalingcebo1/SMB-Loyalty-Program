import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Navigate } from "react-router-dom";
import api from "../api/api";
import PageLayout from "../components/PageLayout";

const Account: React.FC = () => {
  const { user, refreshUser, loading } = useAuth();
  if (loading) return <PageLayout loading>{null}</PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditing(true);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setError(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.put("/auth/me", {
        first_name: firstName,
        last_name: lastName,
      });
      await refreshUser();
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Error updating name");
    }
  };

  return (
    <PageLayout error={error || undefined}>
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Account Details</h1>
        <div className="divide-y divide-gray-200">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-gray-500 text-sm">Name</div>
              {editing ? (
                <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                  <input
                    className="border rounded px-2 py-1 mr-2"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    placeholder="First Name"
                  />
                  <input
                    className="border rounded px-2 py-1 mr-2"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last Name"
                  />
                  <div className="flex gap-2 mt-2 sm:mt-0">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-1 rounded"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="bg-gray-300 px-4 py-1 rounded"
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center mt-1">
                  <span className="font-medium">{user.firstName} {user.lastName}</span>
                  <button
                    className="ml-4 bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    onClick={handleEdit}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              )}
              {error && <div className="text-red-500 mt-2">{error}</div>}
            </div>
          </div>
          <div className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-gray-500 text-sm">Email</div>
              <div className="font-medium mt-1">{user.email}</div>
            </div>
          </div>
          <div className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-gray-500 text-sm">Phone</div>
              <div className="font-medium mt-1">{user.phone}</div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Account;