import React, { useState, useEffect } from 'react';
import PageLayout from '../../components/PageLayout';
import api from '../../api/api';
import { useAuth } from '../../auth/AuthProvider';
import { Navigate } from 'react-router-dom';

interface TenantInfo {
  id: string;
  name: string;
}

const DeveloperConsole: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  // Admin guard
  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to='/' replace />;
  // State for dev console
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch status and tenants
  const fetchStatus = () => {
    api.get<{ status: string; tenants: TenantInfo[] }>('/dev/')
      .then(res => {
        setStatus(res.data.status as 'ok');
        setTenants(res.data.tenants);
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Error fetching status');
        setStatus('error');
      });
  };
  useEffect(() => { fetchStatus(); }, []);
  // Loading and error states
  if (status === 'idle') return <PageLayout loading loadingText="Loading status…">{null}</PageLayout>;
  if (status === 'error') return <PageLayout error={error} onRetry={fetchStatus}>{null}</PageLayout>;
  // Status OK: main view
  const handleReset = async () => {
    setResetting(true);
    try {
      await api.post('/dev/reset');
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error resetting database');
      setStatus('error');
    } finally {
      setResetting(false);
    }
  };
  return (
    <PageLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Developer Console</h1>
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
      </div>
    </PageLayout>
  );
};

export default DeveloperConsole;
