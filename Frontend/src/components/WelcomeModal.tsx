import { FC, useRef, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';

interface WelcomeModalProps {
  name: string;
  onClose: () => void;
}

const WelcomeModal: FC<WelcomeModalProps> = ({ name, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Focus the dialog for screen readers, then move to the CTA button
    containerRef.current?.focus();
    setTimeout(() => buttonRef.current?.focus(), 100);
  }, []);
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="welcome-dialog-title"
      aria-describedby="welcome-dialog-desc"
      aria-live="assertive"
      tabIndex={-1}
    >
      <FocusTrap
        focusTrapOptions={{
          onDeactivate: onClose,
          clickOutsideDeactivates: true,
          escapeDeactivates: true,
        }}
      >
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h2 id="welcome-dialog-title" className="text-2xl font-semibold mb-4">
            Welcome, {name}!
          </h2>
          <p id="welcome-dialog-desc" className="mb-4">
            Thank you for registering. Enjoy your loyalty rewards!
          </p>
          <button
            ref={buttonRef}
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Get Started
          </button>
        </div>
      </FocusTrap>
    </div>
  );
};

export default WelcomeModal;
