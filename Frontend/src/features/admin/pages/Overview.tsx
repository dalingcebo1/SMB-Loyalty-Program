import React from 'react';
import { useAuth } from '../../../auth/AuthProvider';
import api from '../../../api/api';
import { AdminPageContainer, AdminSection, AdminGrid } from '../components/AdminGrid';
import { StatCard, AdminCard } from '../components/AdminCard';
import { useQuery } from '@tanstack/react-query';

interface MetricsSnapshot {
  uptime_seconds: number;
  rate_limit_overrides: number;
  active_bans: number;
  jobs: Record<string, unknown>;
}

interface AuditEvent {
  id: number;
  user_id?: number;
  action: string;
  created_at: string;
  details: Record<string, unknown>;
}

interface JobsSnapshot {
  queue: Record<string, unknown>;
  recent: Array<{ id: string; name: string; status?: string }>;
  dead: Array<{ id: string; name: string; attempts?: number }>;
}

interface RateLimitState {
  bans: string[];
}

const Overview: React.FC = () => {
  const { user } = useAuth();

  // Fetch metrics
  const { data: metrics, error } = useQuery<MetricsSnapshot>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const res = await api.get('/admin/metrics');
      return res.data;
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch recent audit activity (limit 5)
  const { data: auditData } = useQuery<{ events: AuditEvent[] }>({
    queryKey: ['admin-audit-recent'],
    queryFn: async () => {
      const res = await api.get('/admin/audit?limit=5');
      return res.data;
    },
    staleTime: 30000,
  });
  const recentActivity = auditData?.events || [];

  // Fetch job stats
  const { data: jobs } = useQuery<JobsSnapshot>({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const res = await api.get('/admin/jobs');
      return res.data;
    },
    staleTime: 30000,
  });

  // Fetch rate limit bans
  const { data: rateLimitData } = useQuery<{ overrides: Record<string, unknown>; bans: string[] }>({
    queryKey: ['admin-rate-limits'],
    queryFn: async () => {
      const res = await api.get('/admin/rate-limits');
      return res.data;
    },
    staleTime: 30000,
  });
  const rateLimits: RateLimitState | null = rateLimitData ? { bans: rateLimitData.bans || [] } : null;

  const version: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APP_VERSION || 'dev';
  const tenantId: string | undefined = user?.tenant_id;

  // Basic admin access is needed to view this page
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'developer')) {
    return (
      <AdminPageContainer title="Access Denied" description="">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Access Denied</div>
          <div className="text-sm text-red-500 mt-1">Admin access required</div>
        </div>
      </AdminPageContainer>
    );
  }

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
            {recentActivity.length === 0 ? (
              <p className="text-gray-500" style={{ fontSize: 'var(--font-size-sm)' }}>
                No recent activity
              </p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{event.action}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                    {event.user_id && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">User {event.user_id}</span>
                    )}
                  </div>
                ))}
                <a 
                  href="/admin/audit" 
                  className="inline-block text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                >
                  View all audit logs →
                </a>
              </div>
            )}
          </AdminCard>
          <AdminCard title="Alerts" padding="base">
            <div className="space-y-3">
              {/* Failed Jobs Alert */}
              {jobs && jobs.dead && jobs.dead.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-800">{jobs.dead.length} failed job(s)</div>
                    <a href="/admin/jobs" className="text-xs text-red-600 hover:text-red-700 font-medium">
                      View &amp; retry →
                    </a>
                  </div>
                </div>
              )}
              
              {/* Rate Limit Bans Alert */}
              {rateLimits && rateLimits.bans && rateLimits.bans.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-800">{rateLimits.bans.length} active IP ban(s)</div>
                    <a href="/admin/rate-limits" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                      Manage bans →
                    </a>
                  </div>
                </div>
              )}
              
              {/* All Clear */}
              {(!jobs || jobs.dead.length === 0) && (!rateLimits || rateLimits.bans.length === 0) && (
                <div className="flex items-center gap-2 text-green-600 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">All systems operational</span>
                </div>
              )}
            </div>
          </AdminCard>
        </AdminGrid>
      </AdminSection>

      {error && (
        <div className="p-3 text-red-700 bg-red-50 rounded-lg border border-red-200" style={{ fontSize: 'var(--font-size-sm)' }}>
          {error instanceof Error ? error.message : 'Failed to load metrics'}
        </div>
      )}
    </AdminPageContainer>
  );
};

export default Overview;
