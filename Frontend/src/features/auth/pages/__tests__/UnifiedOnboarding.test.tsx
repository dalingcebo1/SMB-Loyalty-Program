import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { waitFor, render } from '@testing-library/react';
import UnifiedOnboarding from '../UnifiedOnboarding';
import { translate } from '../../../../utils/i18n';

// Mock firebase module before importing component logic that uses it
vi.mock('../../../../firebase', () => ({
  auth: { currentUser: { uid: 'test', providerData: [], email: 'mock@example.com' } },
  getGlobalRecaptcha: () => Promise.resolve({}),
}));

describe('UnifiedOnboarding page', () => {
  it('renders profile step with continue button using shared Button component', () => {
    const ui = (
      <MemoryRouter initialEntries={[{ pathname: '/onboarding', state: { email: 'user@example.com' } }]}> 
        <Routes>
          <Route path="/onboarding" element={<UnifiedOnboarding />} />
        </Routes>
      </MemoryRouter>
    );
  const { container } = render(ui);
    const continueBtn = container.querySelector('button');
    expect(continueBtn).toBeTruthy();
    expect(continueBtn!.textContent).toBe(translate('onboarding.button.continuePhone'));
    // Subscription checkbox should not appear yet (only in phone step)
    expect(container.textContent).not.toContain(translate('onboarding.checkbox.subscribe.label'));
  });

  it('renders phone step with subscription checkbox and send code button', async () => {
    const ui = (
      <MemoryRouter initialEntries={[{ pathname: '/onboarding', state: { email: 'user@example.com', firstName: 'Jane', lastName: 'Doe', skipProfileStep: true } }]}> 
        <Routes>
          <Route path="/onboarding" element={<UnifiedOnboarding />} />
        </Routes>
      </MemoryRouter>
    );
  const { container } = render(ui);
    await waitFor(() => {
      // Wait until checkbox label appears
      expect(container.textContent).toContain(translate('onboarding.checkbox.subscribe.label'));
    });
    const checkboxLabel = translate('onboarding.checkbox.subscribe.label');
    expect(container.textContent).toContain(checkboxLabel);
    const buttons = Array.from(container.querySelectorAll('button'));
    const sendBtn = buttons.find(b => b.textContent === translate('onboarding.button.sendCode'));
    expect(sendBtn).toBeTruthy();
  });
});

// Removed custom render helper; using testing-library render directly.
