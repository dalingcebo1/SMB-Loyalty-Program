/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface StaffSectionContextValue {
  section: string; // e.g., 'dashboard', 'history'
}

export const StaffSectionContext = createContext<StaffSectionContextValue>({ section: 'dashboard' });

export const StaffSectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const section = useMemo(() => {
    // Support both /staff/* and /admin/staff/* embedding (admin reuses staff feature pages)
    if (!(pathname.startsWith('/staff') || pathname.startsWith('/admin/staff'))) return 'dashboard';
    const parts = pathname.split('/').filter(Boolean); // e.g. ['staff','xyz'] OR ['admin','staff','xyz']
    if (parts[0] === 'admin') {
      return parts[2] || 'dashboard';
    }
    return parts[1] || 'dashboard';
  }, [pathname]);
  return (
    <StaffSectionContext.Provider value={{ section }}>
      {children}
    </StaffSectionContext.Provider>
  );
};

// Hook moved to useStaffSection.ts to satisfy fast refresh constraints
