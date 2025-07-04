import React, { useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthProvider";
import { toast } from "react-toastify";

const StaffRegisterForm: React.FC = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    tenantId: "default",
  });
  const [loading, setLoading] = useState(false);

  if (!user || user.role !== "admin") {
    return <div>Only admins can register staff.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(
        "/auth/register-staff",
        {
          email: form.email,
          password: form.password,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          tenant_id: form.tenantId,
        }
      );
      toast.success("Staff registered successfully!");
      setForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phone: "",
        tenantId: "default",
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to register staff"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Register Staff Member</h2>
      <input
        name="email"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        required
        className="block w-full mb-2 p-2 border rounded"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        required
        className="block w-full mb-2 p-2 border rounded"
      />
      <input
        name="firstName"
        placeholder="First Name"
        value={form.firstName}
        onChange={handleChange}
        className="block w-full mb-2 p-2 border rounded"
      />
      <input
        name="lastName"
        placeholder="Last Name"
        value={form.lastName}
        onChange={handleChange}
        className="block w-full mb-2 p-2 border rounded"
      />
      <input
        name="phone"
        placeholder="Phone"
        value={form.phone}
        onChange={handleChange}
        className="block w-full mb-2 p-2 border rounded"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded font-semibold"
      >
        {loading ? "Registering..." : "Register Staff"}
      </button>
    </form>
  );
};

export default StaffRegisterForm;