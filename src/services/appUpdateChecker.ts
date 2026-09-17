/**
 * App Update Checker Service
 * Automatically detects new server builds / deployments and updates the client
 * without requiring manual hard refreshes (Ctrl+F5).
 */

let initialVersion: string | null = null;
let isChecking = false;
let updateTriggered = false;
let disposeUpdateChecker: (() => void) | null = null;

export function initAppUpdateChecker(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (disposeUpdateChecker) return disposeUpdateChecker;

  void (async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.version) {
          initialVersion = String(data.version);
          console.log('[AppUpdateChecker] Initial client version baseline:', initialVersion);
        }
      }
    } catch (error) {
      // Non-blocking in offline or development mode, but still diagnosable.
      console.debug('[AppUpdateChecker] Initial version check skipped:', error);
    }
  })();

  // Check quietly in the background. Never reload merely because the user
  // returns to the browser; an operator may be entering attendance or finance data.
  const intervalId = window.setInterval(() => void checkForAppUpdate(), 5 * 60 * 1000);

  disposeUpdateChecker = () => {
    window.clearInterval(intervalId);
    disposeUpdateChecker = null;
  };
  return disposeUpdateChecker;
}

export async function checkForAppUpdate(): Promise<boolean> {
  if (isChecking || updateTriggered || typeof window === 'undefined') return false;
  if (!navigator.onLine) return false;

  isChecking = true;
  try {
    const res = await fetch(`/api/version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });

    if (!res.ok) return false;
    const data = await res.json();
    const currentServerVersion = String(data.version || '');

    if (!initialVersion) {
      initialVersion = currentServerVersion;
      return false;
    }

    if (currentServerVersion && initialVersion && currentServerVersion !== initialVersion) {
      console.info(`[AppUpdateChecker] New version detected (current: ${initialVersion}, server: ${currentServerVersion}). It will be applied on the next user-initiated refresh.`);
      updateTriggered = true;
      window.dispatchEvent(new CustomEvent('gofamint:update-available', {
        detail: { currentVersion: initialVersion, serverVersion: currentServerVersion }
      }));
      return true;
    }
  } catch (err) {
    console.debug('[AppUpdateChecker] Check skipped (network unreachable):', err);
  } finally {
    isChecking = false;
  }
  return false;
}

export async function purgeCachesAndReload() {
  try {
    // 1. Tell Service Worker to skip waiting and clear all cached assets
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PURGE_ALL_CACHES' });
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }

    // 2. Purge browser CacheStorage
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (err) {
    console.warn('[AppUpdateChecker] Error purging cache before reload:', err);
  }

  // 3. Hard reload window to fetch fresh HTML and script bundles
  window.location.reload();
}
