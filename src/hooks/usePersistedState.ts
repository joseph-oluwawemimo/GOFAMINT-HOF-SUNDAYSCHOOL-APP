import { useState, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * Persists component state into sessionStorage across tab switches and refreshes.
 * "Never make the user repeat work they have already done."
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved) as T;
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
          sessionStorage.setItem(key, JSON.stringify(nextValue));
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
