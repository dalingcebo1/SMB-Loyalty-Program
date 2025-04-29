// Frontend/src/pages/Onboarding.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName]     = useState("");
  const [phone, setPhone]   = useState("");
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post("/api/loyalty/register", {
        name,
        phone,
        email: email || undefined,
      });
      // save JWT + user info
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // go to services page
      navigate("/services");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim() !== "" && phone.trim() !== "";

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Welcome to Your Car Wash App</h1>
      <p>Please enter your details to get started.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="John Doe"
          />
        </label>

        <label>
          Phone number
          <div style={{ display: "flex" }}>
            {/* Country code select, +27 always at top */}
            <select disabled style={{ marginRight: 4 }}>
              <option value="+27">+27</option>
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="712345678"
            />
          </div>
        </label>

        <label>
          Email (optional)
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            background: isValid ? "#0070f3" : "#ccc",
            color: "white",
            padding: "0.5rem 1rem",
            border: "none",
            opacity: loading ? 0.7 : 1,
            cursor: isValid && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Please wait…" : "Continue"}
        </button>
      </form>
    </div>
  );
};
