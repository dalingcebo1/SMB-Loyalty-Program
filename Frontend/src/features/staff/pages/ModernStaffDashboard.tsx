// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import { FaChartLine } from 'react-icons/fa';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';
import StaffPageContainer from '../components/StaffPageContainer';
import StaffEligibilityGate from '../components/StaffEligibilityGate';
import '../pages/ModernStaffDashboard.css';

const ModernStaffDashboardContent: React.FC = () => {
  return (
    <div className="modern-staff-dashboard space-y-6">
      <StaffPageContainer surface="solid" width="xl" className="relative overflow-hidden text-white bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600" padding="relaxed">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">Staff dashboard</h1>
            <p className="text-sm sm:text-base text-blue-50">Monitor and manage car wash operations in real-time</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />
            <span>System online</span>
          </div>
        </div>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.5),transparent_60%)]" aria-hidden />
      </StaffPageContainer>

      <StaffPageContainer surface="plain" width="xl" padding="default">
        <DashboardOverview />
      </StaffPageContainer>

      <StaffPageContainer surface="solid" width="xl">
        <ActiveWashesManager />
      </StaffPageContainer>

      <StaffPageContainer surface="solid" width="xl" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100">
            <FaChartLine className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Quick analytics</h2>
            <p className="text-sm text-slate-500 sm:text-base">Today's performance at a glance</p>
          </div>
        </div>
        <div className="pt-4">
          <EnhancedAnalyticsLazy />
        </div>
      </StaffPageContainer>
    </div>
  );
};

const ModernStaffDashboard: React.FC = () => (
  <StaffEligibilityGate required={['orders.view']}>
    <ModernStaffDashboardContent />
  </StaffEligibilityGate>
);

export default ModernStaffDashboard;
