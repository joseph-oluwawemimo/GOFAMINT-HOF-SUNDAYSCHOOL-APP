import { useEffect, useRef } from 'react';

/**
 * Intercepts hardware / browser Back button when a modal is open,
 * closing the modal safely instead of exiting the application.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  modalId: string
) {
  const isPushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (isPushedRef.current) {
        isPushedRef.current = false;
        if (window.location.hash === `#${modalId}`) {
          window.history.back();
        }
      }
      return;
    }

    // Modal just opened: push history entry
    window.history.pushState({ gofamintModal: modalId }, '', `#${modalId}`);
    isPushedRef.current = true;

    const handlePopState = () => {
      isPushedRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (isPushedRef.current && window.location.hash === `#${modalId}`) {
        isPushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen, onClose, modalId]);
}
