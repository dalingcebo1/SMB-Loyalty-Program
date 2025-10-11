// src/features/staff/pages/ModernStaffDashboard.tsx
import React from 'react';
import { FaChartLine } from 'react-icons/fa';
import DashboardOverview from '../components/DashboardOverview';
import ActiveWashesManager from '../components/ActiveWashesManager';
import EnhancedAnalyticsLazy from '../components/EnhancedAnalyticsLazy';
import StaffPageContainer from '../components/StaffPageContainer';
import '../pages/ModernStaffDashboard.css';

const ModernStaffDashboard: React.FC = () => {
  return (
    <div className="modern-staff-dashboard space-y-6">
      <StaffPageContainer surface="glass" width="wide" className="relative overflow-hidden text-white" padding="relaxed">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Staff dashboard</h1>
            <p className="mt-1 text-sm text-blue-100 sm:text-base">Monitor and manage car wash operations in real-time</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 backdrop-blur-lg">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-300" aria-hidden />
            <span className="text-sm font-medium">System online</span>
          </div>
        </div>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" aria-hidden />
      </StaffPageContainer>

      <StaffPageContainer surface="plain" width="wide" padding="none">
        <DashboardOverview />
      </StaffPageContainer>

      <StaffPageContainer surface="solid" width="wide">
        <ActiveWashesManager />
      </StaffPageContainer>

      <StaffPageContainer surface="glass" width="wide" className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/20 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100">
            <FaChartLine className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Quick analytics</h2>
            <p className="text-sm text-slate-500">Today's performance at a glance</p>
          </div>
        </div>
        <div className="pt-4">
          <EnhancedAnalyticsLazy />
        </div>
      </StaffPageContainer>
    </div>
  );
};

export default ModernStaffDashboard;
