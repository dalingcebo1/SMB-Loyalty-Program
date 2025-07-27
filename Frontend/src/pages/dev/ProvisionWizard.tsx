import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

interface TenantCreatePayload {
  id: string;
  name: string;
  loyalty_type: string;
  subdomain?: string;
  logo_url?: string;
  theme_color?: string;
}

const ProvisionWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState<TenantCreatePayload>({ id: '', name: '', loyalty_type: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<{ token: string; expires_at: string } | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    setError('');
    try {
      await api.post('/tenants/', payload);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create tenant');
    }
  };

  const handleInvite = async () => {
    setError('');
    try {
      const res = await api.post(`/tenants/${payload.id}/invite`, { email: inviteEmail });
      setInviteResult(res.data);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send invite');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Provision Tenant Wizard</h1>
      {error && <div className="text-red-500 mb-2">{error}</div>}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block font-medium">Tenant ID</label>
            <input className="border p-2 w-full" value={payload.id} onChange={e => setPayload({...payload, id: e.target.value})} />
          </div>
          <div>
            <label className="block font-medium">Name</label>
            <input className="border p-2 w-full" value={payload.name} onChange={e => setPayload({...payload, name: e.target.value})} />
          </div>
          <div>
            <label className="block font-medium">Loyalty Type</label>
            <input className="border p-2 w-full" value={payload.loyalty_type} onChange={e => setPayload({...payload, loyalty_type: e.target.value})} />
          </div>
          <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded">Next</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <label className="block font-medium">Client Admin Email</label>
          <input className="border p-2 w-full" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          <button onClick={handleInvite} className="bg-green-600 text-white px-4 py-2 rounded">Send Invite</button>
        </div>
      )}

      {step === 3 && inviteResult && (
        <div className="space-y-4">
          <p className="text-green-700">Invite sent! Token: {inviteResult.token}</p>
          <p>Expires at: {new Date(inviteResult.expires_at).toLocaleString()}</p>
          <button onClick={() => navigate('/dev')} className="bg-gray-500 text-white px-4 py-2 rounded">Done</button>
        </div>
      )}
    </div>
  );
};

export default ProvisionWizard;
