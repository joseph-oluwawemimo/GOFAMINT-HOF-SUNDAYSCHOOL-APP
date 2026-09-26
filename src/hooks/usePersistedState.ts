import { useState, useCallback, useEffect, useRef, Dispatch, SetStateAction } from 'react';

interface PersistedStateOptions<T> {
  validate?: (value: unknown) => value is T;
  legacyKeys?: string[];
}

export function decodePersistedValue<T>(
  rawValue: string,
  allowLegacyRawString: boolean,
  validate?: (value: unknown) => value is T
): T {
  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch (error) {
    // The former Workers Directorate implementation stored its active tab as
    // a plain string. Accept that format only while reading an explicitly
    // declared legacy key; current keys must remain valid JSON.
    if (!allowLegacyRawString) throw error;
    value = rawValue;
  }

  if (validate && !validate(value)) {
    throw new Error('Stored value did not match the expected state shape.');
  }
  return value as T;
}

function reportPersistenceError(operation: string, key: string, error: unknown) {
  console.error(`[PersistedState] ${operation} failed for ${key}:`, error);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gofamint:persistence-error', {
      detail: { operation, key, message: error instanceof Error ? error.message : String(error) },
    }));
  }
}

/**
 * Persists component state into both sessionStorage AND localStorage across tab switches,
 * mobile screen-off interruptions, tab discards, and refreshes.
 * "Never make the user repeat work they have already done."
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T | (() => T),
  options: PersistedStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const validateRef = useRef(options.validate);
  validateRef.current = options.validate;
  const legacyKeysSignature = (options.legacyKeys || []).join('\u0000');
  const resolveDefault = useCallback(
    () => typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue,
    [defaultValue]
  );

  const readPersistedValue = useCallback((): T => {
    const candidateKeys = [key, ...legacyKeysSignature.split('\u0000').filter(Boolean)];
    const storageTargets = [
      typeof sessionStorage !== 'undefined' ? sessionStorage : null,
      typeof localStorage !== 'undefined' ? localStorage : null,
    ].filter((storage): storage is Storage => storage !== null);

    for (const candidateKey of candidateKeys) {
      for (const storage of storageTargets) {
        const savedValue = storage.getItem(candidateKey);
        if (savedValue === null) continue;

        try {
          const value = decodePersistedValue<T>(savedValue, candidateKey !== key, validateRef.current);
          if (candidateKey !== key) {
            try {
              const serialized = JSON.stringify(value);
              storageTargets.forEach(target => target.setItem(key, serialized));
            } catch (error) {
              reportPersistenceError('legacy migration write', key, error);
            }
          }
          return value;
        } catch (error) {
          storage.removeItem(candidateKey);
          reportPersistenceError('read', candidateKey, error);
        }
      }
    }
    return resolveDefault();
  }, [key, legacyKeysSignature, resolveDefault]);

  const [state, setState] = useState<T>(() => readPersistedValue());

  // A sign-in or class change can change the scoped key without remounting the
  // application. Load the correct user's state immediately when that happens.
  useEffect(() => {
    setState(readPersistedValue());
  }, [readPersistedValue]);

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
          reportPersistenceError('write', key, err);
        }
        return nextValue;
      });
    },
    [key]
  );

  return [state, setPersistedState];
}
