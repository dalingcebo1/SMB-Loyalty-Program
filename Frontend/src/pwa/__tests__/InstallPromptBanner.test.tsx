import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallPromptBanner } from '../InstallPromptBanner';

// We need to mock the useInstallPrompt hook
vi.mock('../useInstallPrompt', () => ({
  useInstallPrompt: vi.fn(),
}));

import { useInstallPrompt } from '../useInstallPrompt';

const mockUseInstallPrompt = vi.mocked(useInstallPrompt);

describe('InstallPromptBanner', () => {
  const defaultState = {
    canPrompt: false,
    isInstalled: false,
    promptInstall: vi.fn(),
    dismiss: vi.fn(),
  };

  beforeEach(() => {
    mockUseInstallPrompt.mockReturnValue({ ...defaultState });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when canPrompt is false', () => {
    const { container } = render(<InstallPromptBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the install banner when canPrompt is true', () => {
    mockUseInstallPrompt.mockReturnValue({ ...defaultState, canPrompt: true });
    render(<InstallPromptBanner />);
    expect(screen.getByText(/install our app/i)).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('calls promptInstall when Install button is clicked', () => {
    const promptInstall = vi.fn();
    mockUseInstallPrompt.mockReturnValue({ ...defaultState, canPrompt: true, promptInstall });
    render(<InstallPromptBanner />);
    fireEvent.click(screen.getByLabelText('Install'));
    expect(promptInstall).toHaveBeenCalledOnce();
  });

  it('calls dismiss when close button is clicked', () => {
    const dismiss = vi.fn();
    mockUseInstallPrompt.mockReturnValue({ ...defaultState, canPrompt: true, dismiss });
    render(<InstallPromptBanner />);
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
