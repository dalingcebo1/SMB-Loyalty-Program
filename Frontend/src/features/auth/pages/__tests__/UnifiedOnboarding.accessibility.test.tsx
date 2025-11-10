// React import removed (JSX not needed with automatic runtime)

import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import UnifiedOnboarding from '../UnifiedOnboarding';
import { translate } from '../../../../utils/i18n';

vi.mock('../../../../firebase', () => ({
  auth: { currentUser: { uid: 'test', providerData: [], email: 'mock@example.com' } },
  getGlobalRecaptcha: () => Promise.resolve({}),
}));

describe('UnifiedOnboarding accessibility', () => {
  it('marks submit button aria-busy when loading (profile step)', () => {
    const ui = (
      <MemoryRouter initialEntries={[{ pathname: '/onboarding', state: { email: 'user@example.com' } }]}> 
        <Routes>
          <Route path="/onboarding" element={<UnifiedOnboarding />} />
        </Routes>
      </MemoryRouter>
    );
    const { container } = render(ui);
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    // Initial state not loading
    expect(btn!.getAttribute('aria-busy')).toBe('false');
  });

  it('checkbox label associates correctly in phone step', async () => {
    const ui = (
      <MemoryRouter initialEntries={[{ pathname: '/onboarding', state: { email: 'user@example.com', firstName: 'Jane', lastName: 'Doe', skipProfileStep: true } }]}> 
        <Routes>
          <Route path="/onboarding" element={<UnifiedOnboarding />} />
        </Routes>
      </MemoryRouter>
    );
    const { container } = render(ui);
    await Promise.resolve();
    const checkboxLabelText = translate('onboarding.checkbox.subscribe.label');
    const label = Array.from(container.querySelectorAll('label')).find(l => l.textContent === checkboxLabelText);
    expect(label).toBeTruthy();
    const inputId = label!.getAttribute('for');
    const input = container.querySelector(`#${inputId}`);
    expect(input).toBeTruthy();
    expect(input!.getAttribute('type')).toBe('checkbox');
  });
});
