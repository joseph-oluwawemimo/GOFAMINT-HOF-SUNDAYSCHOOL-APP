/**
 * Background State & Draft Preservation Manager
 * Ensures that app state, active views, and entered score drafts survive
 * mobile OS backgrounding, tab suspension, and accidental browser reload.
 */

const DRAFT_PREFIX = 'gofamint_draft_';
const APP_STATE_KEY = 'gofamint_background_app_state';

export interface PreservedAppState {
  activePortal?: string;
  activeTab?: string;
  selectedWeek?: number;
  selectedQuarter?: number;
  classId?: string;
  workerId?: string;
  scrollPosition?: number;
  lastActiveTimestamp: number;
}

export interface ScoreDraftItem {
  memberId: string;
  weekNumber: number;
  classId: string;
  punctuality: number;
  memoryVerse: number;
  classParticipation: number;
  attendance: string;
  timestamp: number;
}

class BackgroundStateManager {
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Listen to lifecycle events for backgrounding
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveCurrentAppStateSnapshot();
      }
    });

    window.addEventListener('pagehide', () => {
      this.saveCurrentAppStateSnapshot();
    });

    window.addEventListener('beforeunload', () => {
      this.saveCurrentAppStateSnapshot();
    });
  }

  /**
   * Save general navigation & session position to localStorage so it survives tab suspension.
   */
  public saveAppState(state: Partial<PreservedAppState>) {
    if (typeof localStorage === 'undefined') return;
    try {
      const existing = this.getAppState() || { lastActiveTimestamp: Date.now() };
      const merged: PreservedAppState = {
        ...existing,
        ...state,
        lastActiveTimestamp: Date.now()
      };
      localStorage.setItem(APP_STATE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn('[BackgroundStateManager] Could not save app state snapshot:', e);
    }
  }

  public getAppState(): PreservedAppState | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const data = localStorage.getItem(APP_STATE_KEY);
      if (data) return JSON.parse(data) as PreservedAppState;
    } catch (e) {
      console.warn('[BackgroundStateManager] Could not parse app state snapshot:', e);
    }
    return null;
  }

  /**
   * Save an in-progress score draft (e.g. 15, 15, 15) so backgrounding never loses entered marks.
   */
  public saveScoreDraft(
    classId: string,
    weekNumber: number,
    memberId: string,
    draft: Partial<ScoreDraftItem>
  ) {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = `${DRAFT_PREFIX}scores_${classId}_w${weekNumber}`;
      const existingStr = localStorage.getItem(key);
      const existingMap: Record<string, Partial<ScoreDraftItem>> = existingStr ? JSON.parse(existingStr) : {};
      existingMap[memberId] = {
        ...(existingMap[memberId] || {}),
        ...draft,
        memberId,
        classId,
        weekNumber,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(existingMap));
    } catch (e) {
      console.warn('[BackgroundStateManager] Could not save score draft:', e);
    }
  }

  /**
   * Retrieve all saved score drafts for a class and week.
   */
  public getScoreDrafts(classId: string, weekNumber: number): Record<string, Partial<ScoreDraftItem>> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const key = `${DRAFT_PREFIX}scores_${classId}_w${weekNumber}`;
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('[BackgroundStateManager] Could not load score drafts:', e);
    }
    return {};
  }

  /**
   * Clear score draft once it is successfully committed to the database.
   */
  public clearScoreDraft(classId: string, weekNumber: number, memberId?: string) {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = `${DRAFT_PREFIX}scores_${classId}_w${weekNumber}`;
      if (!memberId) {
        localStorage.removeItem(key);
      } else {
        const existingStr = localStorage.getItem(key);
        if (existingStr) {
          const map = JSON.parse(existingStr);
          delete map[memberId];
          if (Object.keys(map).length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(map));
          }
        }
      }
    } catch (e) {
      console.warn('[BackgroundStateManager] Could not clear score draft:', e);
    }
  }

  private saveCurrentAppStateSnapshot() {
    try {
      const activePortal = sessionStorage.getItem('gofamint_active_portal') || localStorage.getItem('gofamint_active_portal') || undefined;
      const classId = sessionStorage.getItem('gofamint_unlocked_class_id') || localStorage.getItem('gofamint_unlocked_class_id') || undefined;
      const activeTab = sessionStorage.getItem('gofamint_active_tab') || localStorage.getItem('gofamint_active_tab') || undefined;
      const workersTab = sessionStorage.getItem('gofamint_workers_active_tab') || localStorage.getItem('gofamint_workers_active_tab') || undefined;
      const scrollPos = typeof window !== 'undefined' ? window.scrollY : 0;
      this.saveAppState({
        activePortal,
        activeTab: workersTab || activeTab,
        classId,
        scrollPosition: scrollPos,
        lastActiveTimestamp: Date.now()
      });
    } catch (error) {
      console.error('[BackgroundStateManager] Could not capture the background app state:', error);
      window.dispatchEvent(new CustomEvent('gofamint:persistence-error', {
        detail: {
          operation: 'background-snapshot',
          key: APP_STATE_KEY,
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }
}

export const backgroundStateManager = new BackgroundStateManager();
