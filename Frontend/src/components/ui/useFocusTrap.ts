import { useEffect } from 'react';

interface UseFocusTrapOptions {
  active: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocus?: React.RefObject<HTMLElement | null>;
  onDeactivate?: () => void;
  escapeDeactivates?: boolean;
  clickOutsideDeactivates?: boolean;
}

// Lightweight focus trap hook (no external lib) for drawers/modals.
// Cycles focus within container when active; restores focus to previously focused element on deactivate.
export function useFocusTrap({
  active,
  containerRef,
  initialFocus,
  onDeactivate,
  escapeDeactivates = true,
  clickOutsideDeactivates = true,
}: UseFocusTrapOptions) {
  useEffect(() => {
    if (!active) return;
  const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const getFocusable = () => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors.join(',')))
        .filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
    };

    const focusables = getFocusable();
    if (initialFocus?.current) {
      initialFocus.current.focus();
    } else if (focusables.length > 0) {
      focusables[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const list = getFocusable();
        if (list.length === 0) {
          e.preventDefault();
          return;
        }
        const currentIndex = list.indexOf(document.activeElement as HTMLElement);
        let nextIndex = currentIndex;
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? list.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === list.length - 1 ? 0 : currentIndex + 1;
        }
        e.preventDefault();
        list[nextIndex].focus();
      } else if (escapeDeactivates && e.key === 'Escape') {
        e.preventDefault();
        onDeactivate?.();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!clickOutsideDeactivates) return;
      if (!container.contains(e.target as Node)) {
        onDeactivate?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClick);
      previouslyFocused?.focus();
    };
  }, [active, containerRef, initialFocus, onDeactivate, escapeDeactivates, clickOutsideDeactivates]);
}

export default useFocusTrap;