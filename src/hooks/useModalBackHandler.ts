import { useEffect, useRef } from 'react';

/**
 * Intercepts hardware / browser Back button when a modal is open,
 * closing the modal safely instead of exiting the application or resetting the route.
 *
 * CRITICAL STABILITY RULE:
 * `onClose` is held in a ref so keystrokes / parent re-renders never trigger
 * effect cleanup or unexpected history.back() operations during editing.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  modalId: string
) {
  const isPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      if (isPushedRef.current) {
        isPushedRef.current = false;
        if (typeof window !== 'undefined' && window.location.hash === `#${modalId}`) {
          window.history.back();
        }
      }
      return;
    }

    // Modal just opened: push history entry
    if (typeof window !== 'undefined') {
      window.history.pushState({ gofamintModal: modalId }, '', `#${modalId}`);
      isPushedRef.current = true;

      const handlePopState = (e: PopStateEvent) => {
        isPushedRef.current = false;
        onCloseRef.current();
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (isPushedRef.current && window.location.hash === `#${modalId}`) {
          isPushedRef.current = false;
          window.history.back();
        }
      };
    }
  }, [isOpen, modalId]);
}
