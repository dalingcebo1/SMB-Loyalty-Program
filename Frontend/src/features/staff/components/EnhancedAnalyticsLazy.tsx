// Lightweight lazy wrapper for EnhancedAnalytics to enable code-splitting (Phase 4)
// Keeps the large analytics bundle out of the initial dashboard/page load.
import React, { Suspense, lazy } from 'react';

// Dynamic import creates a separate chunk
const EnhancedAnalytics = lazy(() => import('./EnhancedAnalytics'));

// Small skeleton fallback kept intentionally minimal to avoid pulling in heavy styles/logic
const AnalyticsSkeleton: React.FC = () => (
  <div className="enhanced-analytics" style={{ opacity: 0.6 }}>
    <div className="analytics-header">
      <div className="header-content">
        <h2>Business Analytics</h2>
        <p>Loading analytics module…</p>
      </div>
    </div>
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: 110, borderRadius: 12, background: 'linear-gradient(135deg,#e5e7eb,#f3f4f6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.7) 50%,rgba(255,255,255,0) 100%)', animation: 'pulse 1.4s infinite' }} />
        </div>
      ))}
    </div>
  </div>
);

const EnhancedAnalyticsLazy: React.FC = () => (
  <Suspense fallback={<AnalyticsSkeleton />}> 
    <EnhancedAnalytics />
  </Suspense>
);

export default EnhancedAnalyticsLazy;
