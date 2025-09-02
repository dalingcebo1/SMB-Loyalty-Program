// Lightweight lazy wrapper for EnhancedAnalytics to enable code-splitting (Phase 4)
// Keeps the large analytics bundle out of the initial dashboard/page load.
import React, { Suspense, lazy } from 'react';

// Dynamic import creates a separate chunk
const EnhancedAnalytics = lazy(() => import('./EnhancedAnalytics'));

// Small skeleton fallback kept intentionally minimal to avoid pulling in heavy styles/logic
const AnalyticsSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-purple-50 rounded-lg">
          <div className="w-5 h-5 bg-purple-200 rounded animate-pulse"></div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Business Analytics</h2>
          <p className="text-sm text-gray-500">Loading analytics module…</p>
        </div>
      </div>
    </div>
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const EnhancedAnalyticsLazy: React.FC = () => (
  <Suspense fallback={<AnalyticsSkeleton />}> 
    <EnhancedAnalytics />
  </Suspense>
);

export default EnhancedAnalyticsLazy;
