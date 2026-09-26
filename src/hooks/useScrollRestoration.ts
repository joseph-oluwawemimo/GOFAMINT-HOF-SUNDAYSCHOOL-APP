import { useEffect, useRef } from 'react';

/**
 * Preserves and restores scroll position for specific screens and lists.
 * Prevents returning users from being dumped back at the top of long rosters.
 */
export function useScrollRestoration(key: string) {
  const scrollKey = `gofamint_scroll_${key}`;
  const isRestored = useRef(false);

  useEffect(() => {
    isRestored.current = false;
    const savedPos = sessionStorage.getItem(scrollKey) ?? localStorage.getItem(scrollKey);
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    if (savedPos !== null) {
      const top = parseInt(savedPos, 10);
      if (!isNaN(top) && top > 0) {
        // Allow DOM elements to measure and render before restoring
        restoreTimer = setTimeout(() => {
          window.scrollTo({ top, behavior: 'instant' });
          isRestored.current = true;
        }, 30);
      } else {
        isRestored.current = true;
      }
    } else {
      isRestored.current = true;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const persistPosition = () => {
      const position = String(window.scrollY);
      sessionStorage.setItem(scrollKey, position);
      localStorage.setItem(scrollKey, position);
    };
    const handleScroll = () => {
      if (isRestored.current) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          persistPosition();
        }, 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (isRestored.current) persistPosition();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrollKey]);
}
