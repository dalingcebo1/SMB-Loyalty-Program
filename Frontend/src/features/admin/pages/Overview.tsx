import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/AuthProvider';
import api from '../../../api/api';

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="p-4 rounded-lg bg-white shadow-sm border flex flex-col gap-1">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-xl font-semibold text-gray-800">{value}</div>
  </div>
);

interface MetricsSnapshot {
  uptime_seconds: number;
  rate_limit_overrides: number;
  active_bans: number;
  jobs: Record<string, unknown>;
}

const Overview: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
  api.get('/admin/metrics')
      .then(res => { if (mounted) setMetrics(res.data); })
      .catch(err => { if (mounted) setError(err?.response?.data?.detail || 'Failed to load metrics'); });
    return () => { mounted = false; };
  }, []);
  const version: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APP_VERSION || 'dev';
  const tenantId: string | undefined = user?.tenant_id;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Quick operational snapshot & shortcuts.</p>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Environment" value={import.meta.env.MODE} />
        <Stat label="Role" value={user?.role || '—'} />
  <Stat label="Tenant" value={tenantId || 'default'} />
  <Stat label="Version" value={version} />
  <Stat label="Uptime (s)" value={metrics ? metrics.uptime_seconds : '…'} />
  <Stat label="Rate Overrides" value={metrics ? metrics.rate_limit_overrides : '…'} />
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="p-4 bg-white border rounded-lg shadow-sm">
          <h2 className="font-medium mb-2">Recent Activity</h2>
          <p className="text-sm text-gray-500">(Placeholder) Display latest staff actions / system events.</p>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-sm">
          <h2 className="font-medium mb-2">Alerts</h2>
          <p className="text-sm text-gray-500">(Placeholder) Surface rate limit bans, failed jobs, payment verification spikes.</p>
        </div>
  {error && <div className="p-2 text-xs text-red-600 bg-red-50 rounded border border-red-200">{error}</div>}
      </section>
    </div>
  );
};

export default Overview;
