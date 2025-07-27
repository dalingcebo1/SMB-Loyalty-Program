import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { useNavigate } from 'react-router-dom';

interface TenantInfo {
  id: string;
  name: string;
}

const DeveloperConsole: React.FC = () => {
  const [status, setStatus] = useState<'idle'|'ok'|'error'>('idle');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ status: string; tenants: TenantInfo[] }>('/dev/')
      .then(res => {
        setStatus(res.data.status as 'ok');
        setTenants(res.data.tenants);
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Error fetching status');
        setStatus('error');
      });
  }, []);

  const handleReset = () => {
    if (!window.confirm('Really reset the database? This will wipe all data.')) return;
    setResetting(true);
    api.post<{ message: string }>('/dev/reset-db')
      .then(res => {
        alert(res.data.message);
      })
      .catch(err => {
        alert('Reset failed: ' + (err.response?.data?.detail || 'Unknown error'));
      })
      .finally(() => setResetting(false));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Developer Console</h1>
      {/* Provision Tenant Wizard link */}
      <button
        onClick={() => navigate('/dev/provision')}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        Provision New Tenant
      </button>
      {status === 'idle' && <div>Loading status…</div>}
      {status === 'error' && <div className="text-red-500">{error}</div>}
      {status === 'ok' && (
        <>
          <div className="mb-4">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              {resetting ? 'Resetting…' : 'Reset Database'}
            </button>
          </div>
          <h2 className="text-xl font-semibold mb-2">Tenants</h2>
          <ul className="list-disc ml-6">
            {tenants.map(t => (
              <li key={t.id}>{t.id}: {t.name}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default DeveloperConsole;
