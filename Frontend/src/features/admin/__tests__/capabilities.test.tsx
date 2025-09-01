import { describe, it, expect } from 'vitest';
import { ROLE_CAPABILITIES, hasCapability } from '../../admin/config/capabilities';

describe('capabilities map', () => {
  it('admin should include tenant.edit', () => {
    expect(ROLE_CAPABILITIES.admin).toContain('tenant.edit');
  });
  it('user role should not have admin capabilities', () => {
    expect(ROLE_CAPABILITIES.user).not.toContain('tenant.edit');
  });
  it('superadmin wildcard matches any cap', () => {
    expect(hasCapability('superadmin', 'anything.random')).toBe(true);
  });
});
