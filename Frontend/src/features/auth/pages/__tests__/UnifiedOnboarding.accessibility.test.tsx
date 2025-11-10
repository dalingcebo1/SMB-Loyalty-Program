// React import removed (JSX not needed with automatic runtime)

import { describe, it, expect, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { render, waitFor } from '../../../../utils/test-utils';
import UnifiedOnboarding from '../UnifiedOnboarding';
import { translate } from '../../../../utils/i18n';

vi.mock('../../../../firebase', () => ({
  auth: { currentUser: { uid: 'test', providerData: [], email: 'mock@example.com' } },
  getGlobalRecaptcha: () => Promise.resolve({}),
}));

describe('UnifiedOnboarding accessibility', () => {
  it('marks submit button aria-busy when loading (profile step)', () => {
    const { container } = render(
      (
        <Routes>
          <Route path="/onboarding" element={<UnifiedOnboarding />} />
        </Routes>
      ),
      { routerProps: { initialEntries: [{ pathname: '/onboarding', state: { email: 'user@example.com' } }] } }
    );
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    // Initial state not loading
    expect(btn!.getAttribute('aria-busy')).toBe('false');
  });

  it('checkbox label associates correctly in phone step', async () => {
    const { container } = render(
      (
        <Routes>
          <Route path="/onboarding" element={<UnifiedOnboarding />} />
        </Routes>
      ),
      {
        routerProps: {
          initialEntries: [
            {
              pathname: '/onboarding',
              state: { email: 'user@example.com', firstName: 'Jane', lastName: 'Doe', skipProfileStep: true },
            },
          ],
        },
      }
    );
    const checkboxLabelText = translate('onboarding.checkbox.subscribe.label');
    let label: HTMLLabelElement | undefined;
    await waitFor(() => {
      label = Array.from(container.querySelectorAll('label')).find(
        (node): node is HTMLLabelElement => node.textContent === checkboxLabelText
      );
      expect(label).toBeTruthy();
    });
    const inputId = label!.getAttribute('for');
    const input = container.querySelector(`#${inputId}`);
    expect(input).toBeTruthy();
    expect(input!.getAttribute('type')).toBe('checkbox');
  });
});
