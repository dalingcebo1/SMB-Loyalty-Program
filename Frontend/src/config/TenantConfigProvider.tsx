import React, { createContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/api';
import { ModuleFlags, getModuleFlags } from './modules';
import { applyFeatureDefaults } from './features';

type Vertical = 'carwash' | 'dispensary' | 'padel' | 'flowershop' | 'beauty';

interface FeatureMap { [key: string]: boolean | undefined }
interface BrandingMap { [key: string]: unknown }

interface TenantMetaResponse {
  tenant_id: string;
  vertical: Vertical;
  features: FeatureMap;
  branding: BrandingMap;
  name: string;
  loyalty_type: string;
}

interface TenantConfigContextValue {
  loading: boolean;
  error?: string;
  tenantId?: string;
  vertical: Vertical;
  moduleFlags: ModuleFlags;
  branding: BrandingMap;
  refresh: () => void;
}

const TenantConfigContext = createContext<TenantConfigContextValue | undefined>(undefined);

// Vertical -> default module overrides (applied atop base ENV flags)
const VERTICAL_FLAG_OVERRIDES: Partial<Record<Vertical, Partial<ModuleFlags>>> = {
  carwash: { enableCarWash: true },
  dispensary: { enableCarWash: false },
  padel: { enableCarWash: false },
  flowershop: { enableCarWash: false },
  beauty: { enableCarWash: false },
};

const TENANT_META_QUERY_KEY = ['tenant-meta'];

async function fetchTenantMeta(): Promise<TenantMetaResponse> {
  const { data } = await api.get<TenantMetaResponse>('/public/tenant-meta', {
    withCredentials: true,
  });
  return data;
}

export const TenantConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: meta, error, isLoading, refetch } = useQuery({
    queryKey: TENANT_META_QUERY_KEY,
    queryFn: fetchTenantMeta,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Apply branding (CSS vars) when meta changes
  useEffect(() => {
    if (!meta) return;
    const branding = meta.branding || {};
    const root = document.documentElement;
    if (branding.primaryColor) root.style.setProperty('--brand-primary', String(branding.primaryColor));
    if (branding.secondaryColor) root.style.setProperty('--brand-secondary', String(branding.secondaryColor));
    if (branding.textColor) root.style.setProperty('--brand-text', String(branding.textColor));
  }, [meta]);

  const moduleFlags = useMemo(() => {
    const base = getModuleFlags();
    const vertical = meta?.vertical || 'carwash';
    const overrides = VERTICAL_FLAG_OVERRIDES[vertical] || {};
    const mergedFeatureFlags = applyFeatureDefaults(meta?.features || {});
    return { ...base, ...overrides, ...mergedFeatureFlags } as ModuleFlags;
  }, [meta]);

  const value: TenantConfigContextValue = {
    loading: isLoading,
    error: error instanceof Error ? error.message : undefined,
    tenantId: meta?.tenant_id,
    vertical: meta?.vertical || 'carwash',
    moduleFlags,
    branding: meta?.branding || {},
    refresh: () => { refetch(); },
  };

  // Simple loading & error UI wrapper
  if (isLoading) {
    return (
      <div style={{padding:'2rem', textAlign:'center', fontFamily:'sans-serif'}}>
        <div className="tenant-loading-spinner" style={{marginBottom:'1rem'}} />
        <div>Loading tenant configuration…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{padding:'2rem', textAlign:'center', color:'var(--brand-text,#b00)'}}>
        <p style={{marginBottom:'1rem'}}>Failed to load tenant configuration.</p>
        <button onClick={() => refetch()} style={{padding:'0.5rem 1rem', background:'var(--brand-primary,#333)', color:'#fff', borderRadius:4}}>Retry</button>
      </div>
    );
  }

  return (
    <TenantConfigContext.Provider value={value}>
      {children}
    </TenantConfigContext.Provider>
  );
};

// Hook moved to separate file to satisfy fast-refresh constraint.
export { TenantConfigContext };
