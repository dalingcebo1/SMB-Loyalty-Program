import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

// Types for vehicles and users
interface Vehicle {
  id: number;
  reg: string;
  make: string;
  model: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
}

const PAGE_SIZE = 5;

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded shadow z-50">
      {message}
      <button className="ml-4 text-white font-bold" onClick={onClose}>&times;</button>
    </div>
  );
};

const normalizePhone = (input: string) => {
  const trimmed = input.replace(/\D/g, "");
  if (/^0\d{9}$/.test(trimmed)) {
    return "+27" + trimmed.slice(1);
  }
  if (trimmed.startsWith("27") && trimmed.length === 11) {
    return "+" + trimmed;
  }
  if (trimmed.startsWith("+27") && trimmed.length === 12) {
    return trimmed;
  }
  return input;
};

const localPhone = (input: string) => {
  // Always return as 073... (South African local format)
  if (input.startsWith("+27")) {
    return "0" + input.slice(3);
  }
  if (input.startsWith("27")) {
    return "0" + input.slice(2);
  }
  return input;
};

const VehicleManager: React.FC = () => {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reg, setReg] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const token = localStorage.getItem("token");
  const axiosAuth = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Live search effect with pagination
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setError(null);
      setCurrentPage(1);
      return;
    }
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      handleSearch();
    }, 350);
    // eslint-disable-next-line
  }, [search]);

  const handleSearch = async () => {
    setError(null);
    let query = search.trim();
    if (/^0\d{9}$/.test(query)) {
      query = normalizePhone(query);
    }
    try {
      const res = await axiosAuth.get(`/api/auth/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(res.data);
      setCurrentPage(1);
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
  };

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearch("");
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const res = await axiosAuth.get(`/api/auth/users/${user.id}/vehicles`);
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
    setStatus(null);
    setError(null);
    const confirmed = window.confirm(
      `Add vehicle ${reg} (${make} ${model}) for ${selectedUser.first_name} ${selectedUser.last_name}?`
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await axiosAuth.post(`/api/auth/users/${selectedUser.id}/vehicles`, {
        plate: reg,
        make,
        model,
      });
      const res = await axiosAuth.get(`/api/auth/users/${selectedUser.id}/vehicles`);
      setVehicles(res.data);
      setReg("");
      setMake("");
      setModel("");
      setToast("Vehicle added successfully!");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Not authenticated. Please log in again.");
      } else {
        setError("Failed to add vehicle.");
      }
    }
    setLoading(false);
  };

  const deleteVehicle = async (vehicleId: number) => {
    if (!selectedUser) return;
    const confirmed = window.confirm("Are you sure you want to delete this vehicle?");
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      await axiosAuth.delete(`/api/auth/users/${selectedUser.id}/vehicles/${vehicleId}`);
      const res = await axiosAuth.get(`/api/auth/users/${selectedUser.id}/vehicles`);
      setVehicles(res.data);
      setToast("Vehicle deleted.");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Not authenticated. Please log in again.");
      } else {
        setError("Failed to delete vehicle.");
      }
    }
    setLoading(false);
  };

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editReg, setEditReg] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");

  const startEdit = (v: Vehicle, idx: number) => {
    setEditIdx(idx);
    setEditReg(v.reg);
    setEditMake(v.make);
    setEditModel(v.model);
    setStatus(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setEditReg("");
    setEditMake("");
    setEditModel("");
  };

  const saveEdit = async (vehicleId: number) => {
    if (!selectedUser) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      await axiosAuth.patch(`/api/auth/users/${selectedUser.id}/vehicles/${vehicleId}`, {
        reg: editReg,
        make: editMake,
        model: editModel,
      });
      const res = await axiosAuth.get(`/api/auth/users/${selectedUser.id}/vehicles`);
      setVehicles(res.data);
      setToast("Vehicle updated.");
      cancelEdit();
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Not authenticated. Please log in again.");
      } else {
        setError("Failed to update vehicle.");
      }
    }
    setLoading(false);
  };

  // Pagination logic
  const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);
  const paginatedResults = searchResults.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <section style={{ margin: "32px auto", maxWidth: 600, padding: 24, background: "#fafbfc", borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <h2 className="text-2xl font-bold mb-6 text-center">Vehicle Manager</h2>
      {error && (
        <div style={{ color: "red", marginBottom: 16 }}>{error}</div>
      )}
      {status && (
        <div style={{ color: "green", marginBottom: 16 }}>{status}</div>
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
            {search.trim() && paginatedResults.length === 0 && (
              <li style={{ color: "#888", marginBottom: 8 }}>No users found.</li>
            )}
            {paginatedResults.map((user, idx) => (
              <li key={user.id || idx} style={{ marginBottom: 8, background: "#f1f1f1", padding: 8, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>
                  <strong>{user.first_name} {user.last_name}</strong> ({localPhone(user.phone)})
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
          {totalPages > 1 && (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {selectedUser && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <strong>User:</strong>
            <span>{selectedUser.first_name} {selectedUser.last_name} ({localPhone(selectedUser.phone)})</span>
            <button
              onClick={() => { setSelectedUser(null); setVehicles([]); setError(null); setStatus(null); }}
              style={{ marginLeft: "auto", padding: "4px 12px" }}
            >
              Change User
            </button>
          </div>
          <div className="w-full mt-4 bg-blue-50 p-4 rounded shadow text-center" style={{ marginBottom: 24 }}>
            <h4 className="font-semibold text-lg mb-2">Add Vehicle</h4>
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
                  <li key={v.id || idx} style={{ background: "#e9ecef", marginBottom: 6, padding: 8, borderRadius: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    {editIdx === idx ? (
                      <>
                        <input
                          value={editReg}
                          onChange={e => setEditReg(e.target.value)}
                          style={{ width: 80, padding: 4, borderRadius: 4, border: "1px solid #ccc" }}
                        />
                        <input
                          value={editMake}
                          onChange={e => setEditMake(e.target.value)}
                          style={{ width: 80, padding: 4, borderRadius: 4, border: "1px solid #ccc" }}
                        />
                        <input
                          value={editModel}
                          onChange={e => setEditModel(e.target.value)}
                          style={{ width: 80, padding: 4, borderRadius: 4, border: "1px solid #ccc" }}
                        />
                        <button onClick={() => saveEdit(v.id)} disabled={loading || !editReg || !editMake || !editModel} style={{ padding: "4px 10px" }}>
                          Save
                        </button>
                        <button onClick={cancelEdit} style={{ padding: "4px 10px" }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <strong>{v.reg}</strong> - {v.make} {v.model}
                        <button onClick={() => startEdit(v, idx)} style={{ marginLeft: 8, padding: "4px 10px" }}>
                          Edit
                        </button>
                        <button onClick={() => deleteVehicle(v.id)} style={{ marginLeft: 8, padding: "4px 10px", color: "red" }}>
                          Delete
                        </button>
                      </>
                    )}
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