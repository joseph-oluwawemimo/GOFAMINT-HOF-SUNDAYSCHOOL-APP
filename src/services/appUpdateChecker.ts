/**
 * App Update Checker Service
 * Automatically detects new server builds / deployments and updates the client
 * without requiring manual hard refreshes (Ctrl+F5).
 */

let initialVersion: string | null = null;
let isChecking = false;
let updateTriggered = false;

export async function initAppUpdateChecker() {
  if (typeof window === 'undefined') return;

  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        initialVersion = String(data.version);
        console.log('[AppUpdateChecker] Initial client version baseline:', initialVersion);
      }
    }
  } catch {
    // Non-blocking in offline or dev mode
  }

  // 1. Check on window focus (user switches tabs back to this app)
  window.addEventListener('focus', () => {
    checkForAppUpdate();
  });

  // 2. Check on visibility change (mobile browser wake up or tab foreground)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate();
    }
  });

  // 3. Periodic background check every 60 seconds
  setInterval(() => {
    checkForAppUpdate();
  }, 60 * 1000);
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
      console.log(`[AppUpdateChecker] New version detected! Current: ${initialVersion}, Server: ${currentServerVersion}. Enforcing auto-update...`);
      updateTriggered = true;
      await purgeCachesAndReload();
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
