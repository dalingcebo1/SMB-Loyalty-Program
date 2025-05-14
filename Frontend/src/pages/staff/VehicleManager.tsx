import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const VehicleManager: React.FC = () => {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [reg, setReg] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const normalizePhone = (input: string) => {
    const trimmed = input.replace(/\D/g, "");
    if (/^0\d{9}$/.test(trimmed)) {
      return "+27" + trimmed.slice(1);
    }
    return input;
  };

  // Live search effect
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      handleSearch();
    }, 350);
    // eslint-disable-next-line
  }, [search]);

  const handleSearch = async () => {
    // Don't set loading to true here to avoid UI flicker or input jump
    setError(null);
    let query = search.trim();
    if (/^0\d{9}$/.test(query)) {
      query = normalizePhone(query);
    }
    try {
      const res = await axiosAuth.get(`/api/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(res.data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Not authenticated. Please log in again.");
        setSearchResults([]);
      } else if (err.response?.status === 404) {
        setSearchResults([]);
      } else {
        setError("Failed to search users.");
        setSearchResults([]);
      }
    }
    // Don't set loading to false here either
  };

  const selectUser = async (user: any) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearch("");
    setError(null);
    setLoading(true);
    try {
      const res = await axiosAuth.get(`/api/users/${user.id}/vehicles`);
      setVehicles(res.data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Not authenticated. Please log in again.");
      } else {
        setError("Could not fetch vehicles for this user.");
      }
      setVehicles([]);
    }
    setLoading(false);
  };

  const addVehicle = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setError(null);
    try {
      await axiosAuth.post(`/api/users/${selectedUser.id}/vehicles`, {
        reg,
        make,
        model,
      });
      const res = await axiosAuth.get(`/api/users/${selectedUser.id}/vehicles`);
      setVehicles(res.data);
      setReg("");
      setMake("");
      setModel("");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Not authenticated. Please log in again.");
      } else {
        setError("Failed to add vehicle.");
      }
    }
    setLoading(false);
  };

  return (
    <section style={{ margin: "32px auto", maxWidth: 600, padding: 24, background: "#fafbfc", borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
      <h2 style={{ marginBottom: 24 }}>Vehicle Manager</h2>
      {error && (
        <div style={{ color: "red", marginBottom: 16 }}>{error}</div>
      )}
      {!selectedUser && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Search by phone or first name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              autoFocus
            />
          </div>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {search.trim() && searchResults.length === 0 && (
              <li style={{ color: "#888", marginBottom: 8 }}>No users found.</li>
            )}
            {searchResults.map((user, idx) => (
              <li key={user.id || idx} style={{ marginBottom: 8, background: "#f1f1f1", padding: 8, borderRadius: 4 }}>
                <span>
                  <strong>{user.first_name} {user.last_name}</strong> ({user.phone})
                </span>
                <button
                  onClick={() => selectUser(user)}
                  style={{ marginLeft: 16, padding: "4px 12px" }}
                >
                  Select
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedUser && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <strong>User:</strong>
            <span>{selectedUser.first_name} {selectedUser.last_name} ({selectedUser.phone})</span>
            <button
              onClick={() => { setSelectedUser(null); setVehicles([]); setError(null); }}
              style={{ marginLeft: "auto", padding: "4px 12px" }}
            >
              Change User
            </button>
          </div>
          <div style={{ marginBottom: 24, background: "#f6f8fa", padding: 16, borderRadius: 6 }}>
            <h4 style={{ margin: "0 0 12px 0" }}>Add Vehicle</h4>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Registration"
                value={reg}
                onChange={e => setReg(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
              <input
                placeholder="Make"
                value={make}
                onChange={e => setMake(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
              <input
                placeholder="Model"
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              />
              <button onClick={addVehicle} disabled={loading || !reg || !make || !model} style={{ padding: "8px 16px" }}>
                {loading ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
          <div>
            <h4 style={{ marginBottom: 8 }}>Registered Vehicles</h4>
            {vehicles.length === 0 ? (
              <div style={{ color: "#888", marginBottom: 8 }}>
                No vehicles registered for this user.
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {vehicles.map((v, idx) => (
                  <li key={v.id || idx} style={{ background: "#e9ecef", marginBottom: 6, padding: 8, borderRadius: 4 }}>
                    <strong>{v.reg}</strong> - {v.make} {v.model}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default VehicleManager;