import { useContext } from 'react';
import { TenantConfigContext } from './TenantConfigProvider';

export const useTenantConfig = () => {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) throw new Error('useTenantConfig must be used within TenantConfigProvider');
  return ctx;
};
