import { useEffect, useRef } from 'react';

/**
 * Preserves and restores scroll position for specific screens and lists.
 * Prevents returning users from being dumped back at the top of long rosters.
 */
export function useScrollRestoration(key: string) {
  const scrollKey = `gofamint_scroll_${key}`;
  const isRestored = useRef(false);

  useEffect(() => {
    const savedPos = sessionStorage.getItem(scrollKey);
    if (savedPos !== null) {
      const top = parseInt(savedPos, 10);
      if (!isNaN(top) && top > 0) {
        // Allow DOM elements to measure and render before restoring
        const timer = setTimeout(() => {
          window.scrollTo({ top, behavior: 'instant' });
        }, 30);
        return () => clearTimeout(timer);
      }
    }
    isRestored.current = true;

    let debounceTimer: any = null;
    const handleScroll = () => {
      if (isRestored.current) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          sessionStorage.setItem(scrollKey, String(window.scrollY));
        }, 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrollKey]);
}
