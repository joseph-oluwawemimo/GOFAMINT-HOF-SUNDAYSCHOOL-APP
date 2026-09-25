import { useState, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * Persists component state into both sessionStorage AND localStorage across tab switches,
 * mobile screen-off interruptions, tab discards, and refreshes.
 * "Never make the user repeat work they have already done."
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      // 1. Check sessionStorage first (current active tab session)
      if (typeof sessionStorage !== 'undefined') {
        const sessionSaved = sessionStorage.getItem(key);
        if (sessionSaved !== null) {
          return JSON.parse(sessionSaved) as T;
        }
      }
      // 2. Check localStorage fallback (survives phone screen-off, battery death, and tab discard)
      if (typeof localStorage !== 'undefined') {
        const localSaved = localStorage.getItem(key);
        if (localSaved !== null) {
          return JSON.parse(localSaved) as T;
        }
      }
    } catch (err) {
      console.warn(`Could not parse persisted state for ${key}:`, err);
    }
    return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
  });

  const setPersistedState: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      setState((prev) => {
        const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        try {
          const serialized = JSON.stringify(nextValue);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(key, serialized);
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, serialized);
          }
        } catch (err) {
          console.warn(`Could not save persisted state for ${key}:`, err);
        }
        return nextValue;
      });
    },
    [key]
  );

  return [state, setPersistedState];
}

