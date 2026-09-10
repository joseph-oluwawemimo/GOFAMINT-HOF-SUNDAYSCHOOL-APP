import { useEffect, useRef } from 'react';

/** Re-run a view's local database query when relevant local or realtime data changes. */
export function useDatabaseSync(
  refresh: () => void | Promise<void>,
  relevantStores?: readonly string[],
  debounceMs = 80
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const storesRef = useRef(relevantStores);
  storesRef.current = relevantStores;

  useEffect(() => {
    let timer: number | undefined;
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const stores: string[] = Array.isArray(detail?.stores)
        ? detail.stores
        : detail?.store
          ? [detail.store]
          : [];
      const relevant = storesRef.current;
      if (relevant?.length && stores.length && !stores.some(store => relevant.includes(store))) return;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        Promise.resolve(refreshRef.current()).catch(error => {
          console.error('A database-backed view could not apply a live update:', error);
        });
      }, debounceMs);
    };

    window.addEventListener('gofamint:sync-update', handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('gofamint:sync-update', handleUpdate);
    };
  }, [debounceMs]);
}
