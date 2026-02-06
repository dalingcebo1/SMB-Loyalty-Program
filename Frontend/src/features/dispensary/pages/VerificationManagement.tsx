/**
 * Dispensary Verification Management - Admin Page
 * Manage customer age and medical card verifications
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaSearch, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { useTenant } from '../../../config/TenantConfigProvider';
import '../../../styles/admin-modern.css';

interface Verification {
  id: number;
  customer_id: number;
  customer_name?: string;
  age_verified: boolean;
  has_medical_card: boolean;
  medical_card_number?: string;
  medical_card_expiry?: string;
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired';
  verified_by?: number;
  verification_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface VerificationFormData {
  customer_id: string;
  age_verified: boolean;
  has_medical_card: boolean;
  medical_card_number: string;
  medical_card_expiry: string;
  verification_status: string;
  notes: string;
}

const VerificationManagement: React.FC = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingVerification, setEditingVerification] = useState<Verification | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const initialFormData: VerificationFormData = {
    customer_id: '',
    age_verified: false,
    has_medical_card: false,
    medical_card_number: '',
    medical_card_expiry: '',
    verification_status: 'pending',
    notes: '',
  };

  const [formData, setFormData] = useState<VerificationFormData>(initialFormData);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Fetch all verifications (you may need to add this endpoint to backend)
  const { data: verifications = [], isLoading } = useQuery<Verification[]>({
    queryKey: ['dispensary-verifications-admin', tenantId],
    queryFn: async () => {
      // Note: This endpoint might need to be added to the backend
      // For now, this is a placeholder that will fetch all verifications
      const response = await fetch(`${API_BASE}/api/dispensary/verifications`, {
        headers: { 'X-Tenant-ID': tenantId || '' }
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch verifications');
      }
      return response.json();
    },
    enabled: !!tenantId
  });

  // Update verification mutation
  const updateVerificationMutation = useMutation({
    mutationFn: async ({ customerId, data }: { customerId: number; data: any }) => {
      const response = await fetch(`${API_BASE}/api/dispensary/verifications/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || ''
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update verification');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary-verifications-admin'] });
      setShowEditModal(false);
      setEditingVerification(null);
      alert('Verification updated successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Filter verifications
  const filteredVerifications = useMemo(() => {
    return verifications.filter(verification => {
      const matchesSearch = 
        verification.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        verification.medical_card_number?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !filterStatus || verification.verification_status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [verifications, searchTerm, filterStatus]);

  const handleEdit = (verification: Verification) => {
    setEditingVerification(verification);
    setFormData({
      customer_id: verification.customer_id.toString(),
      age_verified: verification.age_verified,
      has_medical_card: verification.has_medical_card,
      medical_card_number: verification.medical_card_number || '',
      medical_card_expiry: verification.medical_card_expiry || '',
      verification_status: verification.verification_status,
      notes: verification.notes || '',
    });
    setShowEditModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVerification) return;

    const verificationData = {
      age_verified: formData.age_verified,
      has_medical_card: formData.has_medical_card,
      medical_card_number: formData.medical_card_number || undefined,
      medical_card_expiry: formData.medical_card_expiry || undefined,
      verification_status: formData.verification_status,
      notes: formData.notes || undefined,
    };

    updateVerificationMutation.mutate({
      customerId: editingVerification.customer_id,
      data: verificationData,
    });
  };

  const handleClose = () => {
    setShowEditModal(false);
    setEditingVerification(null);
    setFormData(initialFormData);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      verified: <span className="badge badge-success"><FaCheckCircle /> Verified</span>,
      pending: <span className="badge badge-warning"><FaClock /> Pending</span>,
      rejected: <span className="badge badge-danger"><FaTimesCircle /> Rejected</span>,
      expired: <span className="badge badge-secondary"><FaExclamationTriangle /> Expired</span>,
    };
    return badges[status as keyof typeof badges] || <span className="badge badge-secondary">{status}</span>;
  };

  const getStats = () => {
    const total = verifications.length;
    const verified = verifications.filter(v => v.verification_status === 'verified').length;
    const pending = verifications.filter(v => v.verification_status === 'pending').length;
    const withMedicalCard = verifications.filter(v => v.has_medical_card).length;

    return { total, verified, pending, withMedicalCard };
  };

  const stats = getStats();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>
            <FaCheckCircle style={{ marginRight: '0.5rem' }} />
            Verification Management
          </h1>
          <p>Manage customer age and medical card verifications</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row" style={{ marginBottom: '2rem' }}>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#2196f3' }}>{stats.total}</h3>
            <p style={{ margin: 0, color: '#666' }}>Total Verifications</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#4caf50' }}>{stats.verified}</h3>
            <p style={{ margin: 0, color: '#666' }}>Verified</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#ff9800' }}>{stats.pending}</h3>
            <p style={{ margin: 0, color: '#666' }}>Pending</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="admin-card">
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#9c27b0' }}>{stats.withMedicalCard}</h3>
            <p style={{ margin: 0, color: '#666' }}>Medical Cards</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div className="row">
          <div className="col-md-8">
            <div className="form-group">
              <div className="input-group">
                <span className="input-group-text"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by customer name or medical card number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <select
              className="form-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Verifications List */}
      <div className="admin-card">
        <h3>Verifications ({filteredVerifications.length})</h3>
        
        {isLoading ? (
          <p>Loading verifications...</p>
        ) : filteredVerifications.length === 0 ? (
          <p>No verifications found</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Age Verified</th>
                  <th>Medical Card</th>
                  <th>Card Number</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Verified Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVerifications.map(verification => (
                  <tr key={verification.id}>
                    <td>
                      <strong>{verification.customer_name || `Customer #${verification.customer_id}`}</strong>
                    </td>
                    <td>
                      {verification.age_verified ? (
                        <FaCheckCircle style={{ color: '#4caf50' }} />
                      ) : (
                        <FaTimesCircle style={{ color: '#f44336' }} />
                      )}
                    </td>
                    <td>
                      {verification.has_medical_card ? (
                        <FaCheckCircle style={{ color: '#4caf50' }} />
                      ) : (
                        <FaTimesCircle style={{ color: '#999' }} />
                      )}
                    </td>
                    <td>{verification.medical_card_number || '-'}</td>
                    <td>
                      {verification.medical_card_expiry ? (
                        new Date(verification.medical_card_expiry) < new Date() ? (
                          <span style={{ color: '#f44336' }}>
                            {new Date(verification.medical_card_expiry).toLocaleDateString()} (Expired)
                          </span>
                        ) : (
                          new Date(verification.medical_card_expiry).toLocaleDateString()
                        )
                      ) : '-'}
                    </td>
                    <td>{getStatusBadge(verification.verification_status)}</td>
                    <td>
                      {verification.verification_date
                        ? new Date(verification.verification_date).toLocaleDateString()
                        : '-'}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleEdit(verification)}
                      >
                        <FaEdit /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingVerification && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Edit Verification</h3>
              <button className="modal-close" onClick={handleClose}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Customer</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingVerification.customer_name || `Customer #${editingVerification.customer_id}`}
                    disabled
                  />
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.age_verified}
                          onChange={(e) => setFormData({ ...formData, age_verified: e.target.checked })}
                        />
                        {' '}Age Verified
                      </label>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.has_medical_card}
                          onChange={(e) => setFormData({ ...formData, has_medical_card: e.target.checked })}
                        />
                        {' '}Has Medical Card
                      </label>
                    </div>
                  </div>
                </div>

                {formData.has_medical_card && (
                  <>
                    <div className="form-group">
                      <label>Medical Card Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.medical_card_number}
                        onChange={(e) => setFormData({ ...formData, medical_card_number: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Medical Card Expiry</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.medical_card_expiry}
                        onChange={(e) => setFormData({ ...formData, medical_card_expiry: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Verification Status</label>
                  <select
                    className="form-control"
                    value={formData.verification_status}
                    onChange={(e) => setFormData({ ...formData, verification_status: e.target.value })}
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    className="form-control"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any notes about this verification..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  <FaTimes /> Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <FaSave /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationManagement;
