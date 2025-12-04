import React, { createContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  loyalty?: any;
}

interface TenantConfigContextValue {
  loading: boolean;
  error?: string;
  tenantId?: string;
  vertical: Vertical;
  loyaltyType?: string;
  loyalty?: any;
  moduleFlags: ModuleFlags;
  features: FeatureMap;
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
  const queryClient = useQueryClient();
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

  // Listen for branding updates from admin panel
  useEffect(() => {
    const handler = () => {
      console.log('[TenantConfigProvider] Received tenant-theme:refresh, invalidating cache and refetching...');
      // Invalidate cache to force a fresh fetch, bypassing staleTime
      queryClient.invalidateQueries({ queryKey: TENANT_META_QUERY_KEY });
    };
    window.addEventListener('tenant-theme:refresh', handler);
    return () => window.removeEventListener('tenant-theme:refresh', handler);
  }, [queryClient]);

  const moduleFlags = useMemo(() => {
    const base = getModuleFlags();
    const vertical = meta?.vertical || 'carwash';
    const overrides = VERTICAL_FLAG_OVERRIDES[vertical] || {};
    
    // Map backend features to frontend flags
    const backendFeatures = meta?.features || {};
    const mappedFeatures: Partial<ModuleFlags> = {};
    
    // Mapping logic: Backend Module Key -> Frontend Flag
    if (backendFeatures['loyalty']) mappedFeatures.enableLoyalty = true;
    if (backendFeatures['orders']) mappedFeatures.enableOrders = true;
    if (backendFeatures['billing']) mappedFeatures.enablePayments = true;
    // 'core' usually implies users/auth are active
    if (backendFeatures['core']) {
        mappedFeatures.enableUsers = true;
        mappedFeatures.usersAccount = true;
    }
    if (backendFeatures['inventory']) {
        // If inventory module is present, maybe enable catalog?
        mappedFeatures.enableCatalog = true;
    }
    
    // If we have backend features, we might want to disable things that are NOT present?
    // For now, let's just enable what is present, to avoid breaking existing setups that rely on defaults.
    // But strictly speaking, if 'loyalty' is missing, enableLoyalty should be false.
    
    // Let's try to be stricter if backend features are populated (length > 0)
    if (Object.keys(backendFeatures).length > 0) {
        mappedFeatures.enableLoyalty = !!backendFeatures['loyalty'];
        mappedFeatures.enableOrders = !!backendFeatures['orders'];
        mappedFeatures.enablePayments = !!backendFeatures['billing'];
        // ...
    }

    const mergedFeatureFlags = applyFeatureDefaults(meta?.features || {});
    return { ...base, ...overrides, ...mergedFeatureFlags, ...mappedFeatures } as ModuleFlags;
  }, [meta]);

  const value: TenantConfigContextValue = {
    loading: isLoading,
    error: error instanceof Error ? error.message : undefined,
    tenantId: meta?.tenant_id,
    vertical: meta?.vertical || 'carwash',
    loyaltyType: meta?.loyalty_type,
    loyalty: meta?.loyalty,
    moduleFlags,
    features: meta?.features || {},
    branding: meta?.branding || {},
    refresh: () => { refetch(); },
  };

  // Simple loading & error UI wrapper
  if (isLoading) {
    return (
      <div style={{padding:'2rem', textAlign:'center', fontFamily:'sans-serif'}}>
        <div className="tenant-loading-spinner" style={{marginBottom:'1rem'}} />
        <div>Loading tenant configuration…</div>
        <div style={{ marginTop: '0.75rem', fontSize: 12, color: '#666' }}>Build: {String((import.meta as any)?.env?.VITE_APP_VERSION || 'dev-local')}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{padding:'2rem', textAlign:'center', color:'var(--brand-text,#b00)'}}>
        <p style={{marginBottom:'1rem'}}>Failed to load tenant configuration.</p>
        <button onClick={() => refetch()} style={{padding:'0.5rem 1rem', background:'var(--brand-primary,#333)', color:'#fff', borderRadius:4}}>Retry</button>
        <div style={{ marginTop: '0.75rem', fontSize: 12, color: '#666' }}>Build: {String((import.meta as any)?.env?.VITE_APP_VERSION || 'dev-local')}</div>
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
