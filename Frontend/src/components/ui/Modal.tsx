// src/components/ui/Modal.tsx
import React from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return createPortal(
    <FocusTrap
      focusTrapOptions={{ onDeactivate: onClose, clickOutsideDeactivates: true, escapeDeactivates: true }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Overlay */}
        <div
          data-testid="modal-overlay"
          className="fixed inset-0 bg-black opacity-50"
          onClick={onClose}
        />

        {/* Dialog panel */}
        <div className="bg-white rounded-md shadow-lg z-60 max-w-lg w-full p-lg relative">
          {title && (
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-sm right-sm text-gray700"
          >
            <span aria-hidden>×</span>
          </button>

          <div className="mt-md">{children}</div>
        </div>
      </div>
    </FocusTrap>,
    document.body
  );
};
// Memoize Modal to optimize rendering
export default React.memo(Modal);

