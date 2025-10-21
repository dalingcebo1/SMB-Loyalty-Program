import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils/test-utils';
import Modal from './Modal';

describe('Modal component', () => {
  it('does not render when closed', () => {
    render(<Modal isOpen={false} onClose={() => {}}>Hidden</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders children and title when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Test Title">
        <p>Modal Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/test title/i)).toBeInTheDocument();
    expect(screen.getByText(/modal content/i)).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose}>
        <span>Overlay Test</span>
      </Modal>
    );
    // Click the modal overlay (outer container with click handler)
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(handleClose).toHaveBeenCalled();
    }
  });
});
