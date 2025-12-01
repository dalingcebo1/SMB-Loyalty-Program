import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/AuthProvider';
import api from '../../../api/api';
import { AdminPageContainer, AdminSection, AdminGrid } from '../components/AdminGrid';
import { StatCard, AdminCard } from '../components/AdminCard';

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
    <AdminPageContainer
      title="Admin Overview"
      description="Quick operational snapshot & shortcuts."
    >
      {/* System Metrics */}
      <AdminSection>
        <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }} gap="base">
          <StatCard label="Environment" value={import.meta.env.MODE} />
          <StatCard label="Role" value={user?.role || '—'} />
          <StatCard label="Tenant" value={tenantId || 'default'} />
          <StatCard label="Version" value={version} />
          <StatCard label="Uptime (s)" value={metrics ? metrics.uptime_seconds.toLocaleString() : '…'} />
          <StatCard label="Rate Overrides" value={metrics ? metrics.rate_limit_overrides : '…'} />
        </AdminGrid>
      </AdminSection>

      {/* Activity & Alerts */}
      <AdminSection>
        <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 2, xl: 2 }} gap="base">
          <AdminCard title="Recent Activity" padding="base">
            <p className="text-gray-500" style={{ fontSize: 'var(--font-size-sm)' }}>
              (Placeholder) Display latest staff actions / system events.
            </p>
          </AdminCard>
          <AdminCard title="Alerts" padding="base">
            <p className="text-gray-500" style={{ fontSize: 'var(--font-size-sm)' }}>
              (Placeholder) Surface rate limit bans, failed jobs, payment verification spikes.
            </p>
          </AdminCard>
        </AdminGrid>
      </AdminSection>

      {error && (
        <div className="p-3 text-red-700 bg-red-50 rounded-lg border border-red-200" style={{ fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}
    </AdminPageContainer>
  );
};

export default Overview;
