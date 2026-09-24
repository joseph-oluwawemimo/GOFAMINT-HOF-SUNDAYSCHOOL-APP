import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActiveTab,
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  SyncQueueItem,
  SyncPayload,
  LessonInfo,
  AdminComment,
  SundaySchoolYear,
  QuarterNumber,
  QuarterStatus,
  ExitReviewOutcome
} from './types';
import {
  initDB,
  putInStore,
  getClassProfile,
  saveClassProfile,
  getAllMembers,
  getMembersByClass,
  saveMemberToDB,
  saveBulkMembersToDB,
  deleteMemberFromDB,
  getAllGrades,
  getGradesByClassAndQuarter,
  saveGradeToDB,
  getAllOfferings,
  getOfferingsByClassAndQuarter,
  saveOfferingToDB,
  getAllAbsenceLogs,
  getAbsenceLogsByClassAndQuarter,
  saveAbsenceLogToDB,
  getSyncQueue,
  addToSyncQueue,
  clearSyncQueue,
  getAllLessons,
  saveLessonTopic,
  clearAllDatabaseData,
  getAllAdminComments,
  getAllClassesDirectory,
  saveAdminComment,
  deleteAdminComment,
  performLocalFactoryReset,
  getSundaySchoolYear
} from './db/indexedDB';
import { getSystemStatus } from './services/adminUserApi';
import { GOFAMINT_HOF_12_LESSONS } from './data/mockQuarterLessons';
import { pushSyncToServer, pullSyncFromServer } from './services/api';
import { checkVisitorQualification, getConsecutiveAbsences, getConsecutiveVisits } from './utils/calculations';
import { runFullCloudSyncCycle, getLastHydrationError, startRealtimeCloudSync, stopRealtimeCloudSync } from './services/cloudSyncManager';
import type { SyncScope } from './services/cloudSyncManager';

// Subcomponents
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { OpeningFlowView } from './components/OpeningFlowView';
import { GradingMatrixView } from './components/GradingMatrixView';
import { RosterManagementView } from './components/RosterManagementView';
import { WelfareFollowUpView } from './components/WelfareFollowUpView';
import { AbsenceCareView } from './components/AbsenceCareView';
import { QuarterAnalysisView } from './components/QuarterAnalysisView';
import { Week12AnalyticsView } from './components/Week12AnalyticsView';
import { ClassDiscussionView } from './components/ClassDiscussionView';
import { QRPortalView } from './components/QRPortalView';
import { VisitorReportCardView } from './components/VisitorReportCardView';
import { AIAssistantView } from './components/AIAssistantView';
import { SyncSettingsView } from './components/SyncSettingsView';
import { AdminPortalRoot } from './components/AdminPortal/AdminPortalRoot';
import { WorkersModuleView } from './components/WorkersModule/WorkersModuleView';
import { SibPortalRoot } from './sib/components/SibPortalRoot';
import { QuarterTransitionModal } from './components/QuarterTransitionModal';
import { CloudLoginGate } from './components/CloudLoginGate';
import { LockScreen } from './components/LockScreen';
import { OversightBanner } from './components/OversightBanner';
import { watchAuthState, signOutUser, getCurrentUser } from './services/authService';
import { logOversightAccess } from './services/adminUserApi';
import { loadCurrentProfile, type ApplicationProfile } from './services/profileService';
import { initAppUpdateChecker } from './services/appUpdateChecker';
import type { User } from '@supabase/supabase-js';
import { isApprovedClassStatus, isExactClassAssignment } from './utils/accessControl';
import { usePersistedState } from './hooks/usePersistedState';
import { getCurrentCalendarWeek, getLatestCompletedSundayWeek } from './utils/quarterScheduleUtils';
import { VisitorProfileCompletionView } from './views/VisitorProfileCompletionView';
import { StandaloneReportCardView } from './views/StandaloneReportCardView';
import { backgroundStateManager } from './utils/backgroundStateManager';

const getVisitorTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const hashMatch = hash.match(/#\/?visitor-profile\/([a-zA-Z0-9_-]+)/);
  if (hashMatch && hashMatch[1]) return hashMatch[1];
  const search = window.location.search || '';
  const params = new URLSearchParams(search);
  const paramToken = params.get('visitor_token');
  if (paramToken) return paramToken;
  return null;
};

const getReportCardTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const hashMatch = hash.match(/#\/?report-card\/([a-zA-Z0-9_-]+)/);
  if (hashMatch && hashMatch[1]) return hashMatch[1];
  const search = window.location.search || '';
  const params = new URLSearchParams(search);
  const paramToken = params.get('report_card_token');
  if (paramToken) return paramToken;
  return null;
};

const ADMIN_PORTAL_ROLES = new Set([
  'GENERAL_SUPERINTENDENT',
  'DEPARTMENT_SUPERINTENDENT',
  'GENERAL_SECRETARY',
  'ASST_GENERAL_SECRETARY',
  'ASSISTANT_GENERAL_SECRETARY',
  'TREASURER',
  'RECORD_OFFICER',
  'ENROLLMENT_OFFICER',
  'SUPER_ADMIN',
]);
const WORKERS_MODULE_ROLES = new Set(['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'WORKER']);
const CLASS_PORTAL_ROLES = new Set(['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY']);

type ProfileResolutionState = 'idle' | 'loading' | 'ready' | 'missing' | 'unapproved' | 'invalid' | 'error';

export default function App() {
  const [visitorToken, setVisitorToken] = useState<string | null>(() => getVisitorTokenFromUrl());
  const [reportCardToken, setReportCardToken] = useState<string | null>(() => getReportCardTokenFromUrl());

  useEffect(() => {
    backgroundStateManager.init();
    const handleHashChange = () => {
      setVisitorToken(getVisitorTokenFromUrl());
      setReportCardToken(getReportCardTokenFromUrl());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Cloud Auth Gate — nothing below renders until a Supabase user is signed in
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<ApplicationProfile | null>(null);
  const [profileResolution, setProfileResolution] = useState<ProfileResolutionState>('idle');
  const [profileResolutionError, setProfileResolutionError] = useState<string | null>(null);
  const resolvingProfileUserRef = useRef<string | null>(null);

  // Profile Lock State (survives page refresh via sessionStorage, preserves Supabase session)
  const [isProfileLocked, setIsProfileLocked] = useState<boolean>(() => {
    return sessionStorage.getItem('gofamint_profile_locked') === 'true';
  });

  // General Superintendent Oversight State
  const [oversightTarget, setOversightTarget] = useState<{
    label: string;
    classId?: string;
    type: 'CLASS' | 'WORKERS';
  } | null>(null);

  const resolveAuthenticatedProfile = async (user: User) => {
    if (resolvingProfileUserRef.current === user.id) return;
    resolvingProfileUserRef.current = user.id;
    setProfileResolution('loading');
    setProfileResolutionError(null);
    setCurrentUserProfile(null);

    try {
      let profile = await loadCurrentProfile(user.id);
      if (!profile) {
        setProfileResolution('missing');
        setProfileResolutionError('Your signed-in account has not yet been provisioned with a Supabase application profile.');
        return;
      }

      const role = profile.role;
      const isRecognizedRole = ADMIN_PORTAL_ROLES.has(role) || WORKERS_MODULE_ROLES.has(role) || CLASS_PORTAL_ROLES.has(role);
      if (!isRecognizedRole) {
        setProfileResolution('invalid');
        setProfileResolutionError(`Your account has an unsupported role configuration${role ? ` (${role})` : ''}.`);
        return;
      }

      setCurrentUserProfile(profile);
      if (!profile.isApproved) {
        setProfileResolution('unapproved');
        setProfileResolutionError('Your account is awaiting approval from the Sunday School Directorate.');
        return;
      }
      setProfileResolution('ready');

      // Supabase profile identity takes priority over every legacy opening-flow state.
      // Retain active portal across hard refreshes (Ctrl + Shift + R) if an active session was already in progress
      const savedPortal = sessionStorage.getItem('gofamint_active_portal');
      const savedOversight = sessionStorage.getItem('gofamint_oversight_target');

      if (savedPortal === 'WORKERS' && role !== 'DEPARTMENT_SUPERINTENDENT' && (ADMIN_PORTAL_ROLES.has(role) || WORKERS_MODULE_ROLES.has(role))) {
        setShowWorkersModule(true);
        setShowAdminPortal(false);
        setShowOpeningPage(false);
        if (savedOversight) {
          try {
            setOversightTarget(JSON.parse(savedOversight));
          } catch (error) {
            console.warn('Discarding an invalid saved Workers oversight target:', error);
            sessionStorage.removeItem('gofamint_oversight_target');
            setOversightTarget({ type: 'WORKERS', label: 'Workers Directorate & Attendance Terminal' });
          }
        }
      } else if (savedPortal === 'ADMIN' && ADMIN_PORTAL_ROLES.has(role)) {
        setShowAdminPortal(true);
        setShowWorkersModule(false);
        setShowSibPortal(false);
        setShowOpeningPage(false);
      } else if (savedPortal === 'SIB') {
        setShowSibPortal(true);
        setShowAdminPortal(false);
        setShowWorkersModule(false);
        setShowOpeningPage(false);
      } else if (savedPortal === 'CLASS_REGISTER' && profile.classId) {
        const assignedClass = (await getAllClassesDirectory(true)).find(
          cls => isExactClassAssignment(profile.classId, cls.id)
        );
        if (!assignedClass || !isApprovedClassStatus(assignedClass.approvalStatus)) {
          sessionStorage.removeItem('gofamint_active_portal');
          sessionStorage.removeItem('gofamint_unlocked');
          sessionStorage.removeItem('gofamint_unlocked_class_id');
          setShowOpeningPage(true);
          setShowAdminPortal(false);
          setShowWorkersModule(false);
          setIsUnlocked(false);
          return;
        }
        await putInStore<ClassProfile>('classProfile', assignedClass, true);
        setClassProfile(assignedClass);
        setShowAdminPortal(false);
        setShowWorkersModule(false);
        setShowOpeningPage(false);
        setIsUnlocked(true);
        sessionStorage.setItem('gofamint_unlocked', 'true');
        sessionStorage.setItem('gofamint_unlocked_class_id', assignedClass.id);
        await loadClassQuarterData(assignedClass.id, selectedQuarter);
      } else {
        // Fresh sign-in or no active portal session: Always route through the official branded Welcome Screen & Portal Destination
        setShowOpeningPage(true);
        setShowAdminPortal(false);
        setShowWorkersModule(false);
        setShowSibPortal(false);
        setIsUnlocked(false);
      }
    } catch (err: any) {
      console.warn('Could not load Supabase user profile on auth:', err);
      setProfileResolution('error');
      setProfileResolutionError(err?.message || 'The account role could not be loaded. Check your connection and try again.');
    } finally {
      if (resolvingProfileUserRef.current === user.id) resolvingProfileUserRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const disposeUpdates = initAppUpdateChecker();

    // Check existing stored session immediately on mount
    getCurrentUser()
      .then((user) => {
        if (!isMounted) return;
        if (user) {
          setCloudUser(user);
          setIsCheckingAuth(false);
          void resolveAuthenticatedProfile(user);
        } else {
          setIsCheckingAuth(false);
        }
      })
      .catch((err) => {
        console.warn('Initial session check note:', err);
        if (isMounted) setIsCheckingAuth(false);
      });

    const unsubscribe = watchAuthState((user) => {
      if (!isMounted) return;
      setCloudUser(user);
      setIsCheckingAuth(false);
      if (user) {
        void resolveAuthenticatedProfile(user);
      } else {
        setCurrentUserProfile(null);
        setProfileResolution('idle');
        setProfileResolutionError(null);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
      disposeUpdates();
    };
  }, []);

  // Global App States
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean | null>(null);
  const [showOpeningPage, setShowOpeningPage] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showWorkersModule, setShowWorkersModule] = useState(false);
  const [showSibPortal, setShowSibPortal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegisteringNew, setIsRegisteringNew] = useState(false);
  const [isQuarterTransitionOpen, setIsQuarterTransitionOpen] = useState(false);

  const [activeTab, setActiveTab] = usePersistedState<ActiveTab>('gofamint_active_tab', 'GRADING_MATRIX');
  const [selectedWeek, setSelectedWeek] = usePersistedState<number>('gofamint_selected_week', 1);
  const [selectedQuarter, setSelectedQuarter] = usePersistedState<QuarterNumber>('gofamint_selected_quarter', 1);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('Local DB Ready');

  // Database Data States
  const [classProfile, setClassProfile] = useState<ClassProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [grades, setGrades] = useState<WeeklyGradeRecord[]>([]);
  const [offerings, setOfferings] = useState<WeeklyOfferingRecord[]>([]);
  const [absenceLogs, setAbsenceLogs] = useState<AbsenceLogRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [lessons, setLessons] = useState<LessonInfo[]>(GOFAMINT_HOF_12_LESSONS);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [sundaySchoolYear, setSundaySchoolYear] = useState<SundaySchoolYear | null>(null);

  // Modal / Transition Props
  const [preSelectedSponsorId, setPreSelectedSponsorId] = useState<string | null>(null);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [selectedReportMemberId, setSelectedReportMemberId] = useState<string>('');

  // Online / Offline Network Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hardware / Browser Back-Button Support (UX Audit Issue 1)
  useEffect(() => {
    const currentHash = showWorkersModule
      ? '#workers'
      : showAdminPortal
      ? '#admin'
      : showSibPortal
      ? '#sib'
      : showOpeningPage
      ? '#welcome'
      : `#class-${(activeTab || '').toLowerCase()}`;

    if (window.location.hash !== currentHash) {
      window.history.pushState({ hash: currentHash }, '', currentHash);
    }

    const handlePopState = (e: PopStateEvent) => {
      // If returning from a modal pop, do NOT change activeTab!
      if (e.state?.gofamintModal) {
        return;
      }
      if (isAuthModalOpen) {
        setIsAuthModalOpen(false);
        return;
      }
      if (isQuarterTransitionOpen) {
        setIsQuarterTransitionOpen(false);
        return;
      }
      if (oversightTarget) {
        handleExitOversight();
        return;
      }
      if (showAdminPortal || showWorkersModule || showSibPortal) {
        sessionStorage.removeItem('gofamint_active_portal');
        setShowAdminPortal(false);
        setShowWorkersModule(false);
        setShowSibPortal(false);
        setShowOpeningPage(true);
        return;
      }

      const hash = window.location.hash || '';
      if (hash.startsWith('#class-')) {
        const tabFromHash = hash.replace('#class-', '').toUpperCase() as ActiveTab;
        if (tabFromHash && tabFromHash !== activeTab) {
          setActiveTab(tabFromHash);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthModalOpen, isQuarterTransitionOpen, oversightTarget, showAdminPortal, showWorkersModule, showOpeningPage, activeTab]);

  // Protect in-progress form entry from an accidental browser refresh/close.
  // A successful durable database write emits sync-update and clears the guard;
  // a failed save leaves the warning active so the operator can retry.
  useEffect(() => {
    const draftStorageKey = 'gofamint_pending_form_draft_v1';
    type DraftValue = { value?: string; checked?: boolean };
    let hasUnsavedInput = false;
    let isRestoring = false;
    let pendingDraft: Record<string, DraftValue> = {};
    const restoredKeys = new Set<string>();
    try {
      pendingDraft = JSON.parse(sessionStorage.getItem(draftStorageKey) || '{}');
      hasUnsavedInput = Object.keys(pendingDraft).length > 0;
    } catch (error) {
      console.error('Could not read the pending form draft:', error);
      sessionStorage.removeItem(draftStorageKey);
    }

    const editableControls = () => Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))
      .filter(element => !element.disabled && !(element instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button', 'reset'].includes(element.type)));

    const draftKey = (target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string => {
      const type = target instanceof HTMLInputElement ? target.type : target.tagName.toLowerCase();
      const explicit = target.dataset.draftKey || target.id || target.getAttribute('name') || target.getAttribute('aria-label') || target.getAttribute('placeholder');
      const base = `${sessionStorage.getItem('gofamint_active_portal') || 'WELCOME'}|${target.tagName}|${type}|${explicit || 'control'}`;
      const peers = editableControls().filter(element => {
        const peerType = element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase();
        const peerExplicit = element.dataset.draftKey || element.id || element.getAttribute('name') || element.getAttribute('aria-label') || element.getAttribute('placeholder');
        return `${sessionStorage.getItem('gofamint_active_portal') || 'WELCOME'}|${element.tagName}|${peerType}|${peerExplicit || 'control'}` === base;
      });
      return `${base}|${Math.max(0, peers.indexOf(target))}`;
    };

    const persistDraft = () => {
      try {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(pendingDraft));
      } catch (error) {
        console.error('Could not preserve the pending form draft:', error);
      }
    };

    const markDirty = (event: Event) => {
      if (isRestoring) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        const isReadOnly = target instanceof HTMLSelectElement ? false : target.readOnly;
        if (target.disabled || isReadOnly || (target instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button', 'reset'].includes(target.type))) return;
        hasUnsavedInput = true;
        pendingDraft[draftKey(target)] = target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)
          ? { checked: target.checked }
          : { value: target.value };
        persistDraft();
      }
    };
    const markPersisted = (event: Event) => {
      if ((event as CustomEvent).detail?.source === 'local') {
        hasUnsavedInput = false;
        pendingDraft = {};
        sessionStorage.removeItem(draftStorageKey);
      }
    };
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedInput) return;
      event.preventDefault();
      event.returnValue = true;
    };

    const restoreDraft = () => {
      if (Object.keys(pendingDraft).length === 0) return;
      isRestoring = true;
      let restored = 0;
      try {
        for (const target of editableControls()) {
          const key = draftKey(target);
          const saved = pendingDraft[key];
          if (!saved || restoredKeys.has(key)) continue;
          if (target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            setter?.call(target, Boolean(saved.checked));
          } else {
            const prototype = target instanceof HTMLInputElement
              ? HTMLInputElement.prototype
              : target instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLSelectElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            setter?.call(target, saved.value || '');
          }
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          restoredKeys.add(key);
          restored++;
        }
      } finally {
        isRestoring = false;
      }
      if (restored > 0) {
        console.info(`Restored ${restored} unsaved form field${restored === 1 ? '' : 's'} after reload.`);
      }
    };

    const observer = new MutationObserver(restoreDraft);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    restoreDraft();

    document.addEventListener('input', markDirty, true);
    document.addEventListener('change', markDirty, true);
    window.addEventListener('gofamint:sync-update', markPersisted);
    window.addEventListener('beforeunload', guardUnload);
    return () => {
      document.removeEventListener('input', markDirty, true);
      document.removeEventListener('change', markDirty, true);
      window.removeEventListener('gofamint:sync-update', markPersisted);
      window.removeEventListener('beforeunload', guardUnload);
      observer.disconnect();
    };
  }, []);

  // Central isolated data loader for a specific class and quarter
  const loadClassQuarterData = async (targetClassId?: string, targetQuarterNum?: QuarterNumber) => {
    const currentId = targetClassId || classProfile?.id;
    const currentQ = targetQuarterNum || selectedQuarter;
    if (!currentId) {
      setMembers([]);
      setGrades([]);
      setOfferings([]);
      setAbsenceLogs([]);
      return;
    }

    try {
      const [classMems, classGrds, classOffs, classLogs] = await Promise.all([
        getMembersByClass(currentId, currentQ),
        getGradesByClassAndQuarter(currentId, currentQ),
        getOfferingsByClassAndQuarter(currentId, currentQ),
        getAbsenceLogsByClassAndQuarter(currentId, currentQ)
      ]);

      setMembers(classMems);
      setGrades(classGrds);
      setOfferings(classOffs);
      setAbsenceLogs(classLogs);
    } catch (e) {
      console.error('Error loading class quarter data:', e);
    }
  };

  // Re-reads every top-level data slice from local IndexedDB into React state.
  // Used both on first load and after pulling fresh data down from Cloud
  // Supabase (see syncWithCloud below), so the screen reflects whatever is
  // currently the authoritative state — including changes made on other devices.
  const refreshStateFromLocalDB = async () => {
    const profile = await getClassProfile();
    const loadedQueue = await getSyncQueue();
    const loadedLessons = await getAllLessons();
    const loadedComments = await getAllAdminComments();
    const loadedYear = await getSundaySchoolYear();

    setClassProfile(profile);
    setSyncQueue(loadedQueue);
    setLessons(loadedLessons);
    setComments(loadedComments);
    setSundaySchoolYear(loadedYear);

    const savedQ = sessionStorage.getItem('gofamint_selected_quarter');
    const activeQ = savedQ ? (JSON.parse(savedQ) as QuarterNumber) : (loadedYear?.activeQuarterNumber || profile?.quarter || 1);
    setSelectedQuarter(activeQ);

    const savedWk = sessionStorage.getItem('gofamint_selected_week');
    if (!savedWk && loadedYear) {
      const qData = loadedYear.quarters.find(q => q.quarterNumber === activeQ);
      const calWeek = getCurrentCalendarWeek(qData);
      setSelectedWeek(calWeek);
    }

    if (profile) {
      await loadClassQuarterData(profile.id, activeQ);
    } else {
      setMembers([]);
      setGrades([]);
      setOfferings([]);
      setAbsenceLogs([]);
    }

    return profile;
  };

  // Initialize IndexedDB and load whatever is in the local cache immediately
  // (works instantly, even offline, even before Supabase Auth has resolved).
  const loadAppData = async () => {
    // Check system initialization status from server
    try {
      const status = await getSystemStatus();
      setIsSystemInitialized(status.initialized);
    } catch (error) {
      // Never expose first-run bootstrap merely because the status service is
      // temporarily unreachable on an installation that may contain data.
      console.error('Could not verify system initialization; using the normal sign-in flow:', error);
      setIsSystemInitialized(true);
    }

    try {
      await initDB();
      const profile = await refreshStateFromLocalDB();

      // Check unlock status and active portal in session
      const sessionUnlocked = sessionStorage.getItem('gofamint_unlocked');
      const sessionClassId = sessionStorage.getItem('gofamint_unlocked_class_id');
      const activePortal = sessionStorage.getItem('gofamint_active_portal');

      if (activePortal === 'WORKERS') {
        setShowWorkersModule(true);
        setShowOpeningPage(false);
      } else if (activePortal === 'ADMIN') {
        setShowAdminPortal(true);
        setShowOpeningPage(false);
      } else if (sessionUnlocked === 'true' && profile && sessionClassId === profile.id) {
        setIsUnlocked(true);
        setShowOpeningPage(false);
      } else {
        setShowOpeningPage(true);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    loadAppData();
  }, []);

  // THE CROSS-DEVICE SYNC FIX: pulls the latest data down from the central
  // Supabase database and refreshes the screen with it. RLS requires an
  // authenticated user, so this only runs once
  // Supabase Auth has confirmed a signed-in user (cloudUser).
  const realtimeOversightPortal: SyncScope['targetOversightPortal'] = showWorkersModule
    ? 'WORKERS'
    : oversightTarget?.type === 'CLASS'
      ? 'CLASS_REGISTER'
      : oversightTarget?.type === 'WORKERS'
        ? 'WORKERS'
        : undefined;
  const realtimeOversightClassId = realtimeOversightPortal === 'CLASS_REGISTER'
    ? oversightTarget?.classId
    : undefined;

  const syncWithCloud = async (silent = true) => {
    if (!cloudUser || profileResolution !== 'ready' || !currentUserProfile?.role) {
      return { ok: false, error: 'An approved signed-in profile is required for cloud sync.', pendingRetries: 0 };
    }
    if (!silent) {
      setIsSyncing(true);
      setSyncStatusText('Syncing with central database…');
    }
    try {
      const scope: SyncScope = {
        roleType: currentUserProfile.role,
        classId: currentUserProfile.classId,
        targetOversightPortal: realtimeOversightPortal,
        targetOversightClassId: realtimeOversightClassId,
      };
      const result = await runFullCloudSyncCycle(scope);
      await refreshStateFromLocalDB();
      if (scope.targetOversightPortal === 'WORKERS' || ['WORKER', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'].includes(scope.roleType || '')) {
        window.dispatchEvent(new CustomEvent('gofamint:worker-sync', {
          detail: { stores: [], source: 'remote-hydration' }
        }));
      }
      if (result.ok) {
        setSyncStatusText(
          result.pendingRetries > 0
            ? `Synced — ${result.pendingRetries} change(s) still waiting to reach the cloud`
            : 'Synced with central database'
        );
      } else {
        setSyncStatusText(`Cloud sync issue: ${result.error || getLastHydrationError() || 'unknown error'}`);
      }
      return result;
    } catch (err: any) {
      console.error('Cloud sync cycle failed:', err);
      const message = err?.message || 'unknown error';
      setSyncStatusText(`Cloud sync issue: ${message}`);
      return { ok: false, error: message, pendingRetries: 0 };
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const selectedQuarterRef = useRef(selectedQuarter);
  selectedQuarterRef.current = selectedQuarter;

  // REAL-TIME MULTI-DEVICE CLOUD SYNC
  // As soon as a user signs in, attach Supabase Realtime listeners.
  // When another client inserts or updates data, the change event immediately
  // updates local storage and reactively re-renders all screens without a page reload.
  useEffect(() => {
    if (!cloudUser || profileResolution !== 'ready' || !currentUserProfile?.role) {
      stopRealtimeCloudSync();
      return;
    }

    // Initial hydration pass
    syncWithCloud(true);

    // Start live Supabase Realtime listeners
    const scope: SyncScope = {
      roleType: currentUserProfile.role,
      classId: currentUserProfile.classId,
      targetOversightPortal: realtimeOversightPortal,
      targetOversightClassId: realtimeOversightClassId,
    };
    const unsubscribeRealtime = startRealtimeCloudSync(scope, async () => {
      try {
        const freshProfile = await refreshStateFromLocalDB();
        const activeClassId = freshProfile?.id || classProfile?.id;
        const currentQ = selectedQuarterRef.current;
        if (activeClassId) {
          await loadClassQuarterData(activeClassId, currentQ);
        }
        setSyncStatusText('Synced (Real-time Live)');
      } catch (err) {
        console.error('Error handling realtime update:', err);
      }
    });

    // Same-tab writes do not need to wait for a Supabase round-trip before
    // every portal sees them. Coalesce rapid bulk writes, then reload React
    // state from the already-committed local database without navigating.
    let localRefreshTimer: number | undefined;
    const handleLocalStoreChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.source !== 'local') return;
      window.clearTimeout(localRefreshTimer);
      localRefreshTimer = window.setTimeout(() => {
        void refreshStateFromLocalDB().catch(error => {
          console.error('Could not render a locally saved database change:', error);
        });
      }, 50);
    };
    window.addEventListener('gofamint:sync-update', handleLocalStoreChange);

    // Throttled sync: Only sync on focus if at least 15 minutes have passed since last sync.
    // Realtime WebSocket listeners already keep the app updated in real-time without constant refetches.
    let lastFocusSyncTime = Date.now();
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSyncTime > 15 * 60 * 1000) {
        lastFocusSyncTime = now;
        syncWithCloud(true);
      }
    };
    const handleOnlineReconnect = () => syncWithCloud(true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnlineReconnect);

    return () => {
      unsubscribeRealtime();
      window.clearTimeout(localRefreshTimer);
      window.removeEventListener('gofamint:sync-update', handleLocalStoreChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnlineReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, currentUserProfile?.role, currentUserProfile?.classId, realtimeOversightPortal, realtimeOversightClassId, profileResolution]);

  // Compute status for selected quarter
  const selectedQuarterStatus: QuarterStatus = useMemo(() => {
    if (!sundaySchoolYear) return 'ACTIVE';
    const qData = sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarter);
    return qData?.status || (selectedQuarter === sundaySchoolYear.activeQuarterNumber ? 'ACTIVE' : 'UPCOMING');
  }, [sundaySchoolYear, selectedQuarter]);

  // Lessons for current active quarter
  const currentQuarterLessons: LessonInfo[] = useMemo(() => {
    const qData = sundaySchoolYear?.quarters.find(q => q.quarterNumber === selectedQuarter);
    if (qData && qData.lessons && qData.lessons.length > 0) {
      return qData.lessons.map(l => ({
        weekNumber: l.weekNumber,
        topic: l.topic,
        scriptureReading: l.scriptureReading || 'Scripture reading as assigned',
        memoryVerse: l.memoryVerse || '',
        memoryVerseRef: l.memoryVerseRef || '',
        aim: l.aim || (l.isSharingAdmonitionWeek ? 'Sharing & Admonition Week' : 'Lesson spiritual objective')
      }));
    }
    return lessons;
  }, [sundaySchoolYear, selectedQuarter, lessons]);

  // Quarter Switching Handler
  const handleQuarterChange = async (qNum: QuarterNumber) => {
    setSelectedQuarter(qNum);
    if (classProfile) {
      await loadClassQuarterData(classProfile.id, qNum);
    }
  };

  const handleSaveComment = async (comment: AdminComment) => {
    await saveAdminComment(comment);
    const updated = await getAllAdminComments();
    setComments(updated);
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteAdminComment(commentId);
    const updated = await getAllAdminComments();
    setComments(updated);
  };

  // Opening Page & Auth Navigation Handlers
  const handleEnterClassFromWelcome = async (selectedProfile?: ClassProfile) => {
    const target = selectedProfile || classProfile;
    if (
      target &&
      CLASS_PORTAL_ROLES.has(currentUserProfile?.role || '') &&
      !isExactClassAssignment(currentUserProfile?.classId, target.id)
    ) {
      alert('Access denied: this class is not assigned to your signed-in account.');
      return;
    }
    if (selectedProfile) {
      await putInStore<ClassProfile>('classProfile', selectedProfile, true);
      setClassProfile(selectedProfile);
    }
    if (!target) {
      setIsRegisteringNew(true);
      setIsAuthModalOpen(true);
    } else if (!isApprovedClassStatus(target.approvalStatus)) {
      alert(`Class "${target.className}" is not approved for register access. A General Secretary or General Superintendent must approve it first.`);
    } else {
      const currentUnlockedId = sessionStorage.getItem('gofamint_unlocked_class_id');
      if (isUnlocked && currentUnlockedId === target.id) {
        setShowOpeningPage(false);
        await loadClassQuarterData(target.id, selectedQuarter);
      } else {
        setIsUnlocked(false);
        sessionStorage.removeItem('gofamint_unlocked');
        setIsRegisteringNew(false);
        setIsAuthModalOpen(true);
      }
    }
  };

  const handleRegisterNewClassSubmit = async (newProfile: ClassProfile) => {
    setClassProfile(newProfile);

    // Clean data isolation: fresh class has zero members
    setMembers([]);
    setGrades([]);
    setOfferings([]);
    setAbsenceLogs([]);

    setIsUnlocked(false);
    sessionStorage.removeItem('gofamint_unlocked');
    sessionStorage.removeItem('gofamint_unlocked_class_id');

    await addToSyncQueue({
      id: `sync_profile_${Date.now()}`,
      action: 'UPDATE',
      entity: 'CLASS_PROFILE',
      data: newProfile,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());

    if (newProfile.approvalStatus === 'APPROVED') {
      setIsRegisteringNew(false);
      setIsAuthModalOpen(true);
    } else {
      setShowOpeningPage(true);
    }
  };

  const handleClearDataAndStartScratch = async () => {
    await clearAllDatabaseData(true);
    await performLocalFactoryReset();
    setClassProfile(null);
    setMembers([]);
    setGrades([]);
    setOfferings([]);
    setAbsenceLogs([]);
    setSyncQueue([]);
    setIsUnlocked(false);
    sessionStorage.removeItem('gofamint_unlocked');
    sessionStorage.removeItem('gofamint_unlocked_class_id');
    setShowOpeningPage(true);
  };

  // Auth / Unlock Handlers
  const handleCompleteFirstRunSetup = async (newProfile: ClassProfile) => {
    await saveClassProfile(newProfile);
    setClassProfile(newProfile);
    
    // Clean data isolation
    setMembers([]);
    setGrades([]);
    setOfferings([]);
    setAbsenceLogs([]);

    setIsUnlocked(false);
    sessionStorage.removeItem('gofamint_unlocked');
    sessionStorage.removeItem('gofamint_unlocked_class_id');

    if (newProfile.approvalStatus === 'APPROVED') {
      setIsRegisteringNew(false);
      setIsAuthModalOpen(true);
    } else {
      setIsAuthModalOpen(false);
      setShowOpeningPage(true);
      alert(`Class "${newProfile.className}" is registered and pending approval by the General Superintendent or General Secretary.`);
    }

    await addToSyncQueue({
      id: `sync_profile_${Date.now()}`,
      action: 'UPDATE',
      entity: 'CLASS_PROFILE',
      data: newProfile,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  const handleUnlockConsole = (inputPassword: string): boolean => {
    if (!classProfile || !isApprovedClassStatus(classProfile.approvalStatus)) {
      alert('This class is not approved for register access. Please ask a General Secretary or General Superintendent to approve it first.');
      return false;
    }
    if (
      CLASS_PORTAL_ROLES.has(currentUserProfile?.role || '') &&
      !isExactClassAssignment(currentUserProfile?.classId, classProfile.id)
    ) {
      alert('Access denied: this class is not assigned to your signed-in account.');
      return false;
    }

    setIsUnlocked(true);
    sessionStorage.setItem('gofamint_unlocked', 'true');
    if (classProfile) {
      sessionStorage.setItem('gofamint_unlocked_class_id', classProfile.id);
      loadClassQuarterData(classProfile.id, selectedQuarter);
    }
    setIsAuthModalOpen(false);
    setShowOpeningPage(false);
    setActiveTab('GRADING_MATRIX');
    setSelectedWeek(1);
    return true;
  };

  const handleLockConsole = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('gofamint_unlocked');
    sessionStorage.removeItem('gofamint_unlocked_class_id');
    setShowOpeningPage(true);
  };

  // Lesson Topic Handlers
  const handleUpdateLessonTopic = async (weekNumber: number, topic: string) => {
    const updatedLessons = await saveLessonTopic(weekNumber, topic);
    setLessons(updatedLessons);
  };

  // Quick Add Member from Grading Matrix
  const handleQuickAddMember = async (fullName: string, phone: string, memberType: 'STUDENT' | 'VISITOR') => {
    if (!classProfile) return;

    const newMember: Member = {
      id: `mem_${Date.now()}`,
      classId: classProfile.id,
      fullName,
      phone,
      address: '',
      occupation: memberType === 'STUDENT' ? 'Student' : 'Visitor',
      memberType,
      status: 'ACTIVE',
      prayerRequests: '',
      notes: '',
      firstLessonWeek: selectedWeek,
      evangelismReferralCount: 0,
      quarterEnrollments: {
        [selectedQuarter]: {
          quarterNumber: selectedQuarter,
          memberType,
          status: 'ACTIVE',
          firstLessonWeek: selectedWeek,
          enrolledDate: new Date().toISOString()
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveMemberToDB(newMember, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_mem_${newMember.id}_${Date.now()}`,
      action: 'CREATE',
      entity: 'MEMBER',
      data: newMember,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  // Member CRUD Handlers
  const handleSaveMember = async (memberToSave: Member) => {
    if (!classProfile) return;
    const withClass: Member = {
      ...memberToSave,
      classId: classProfile.id
    };
    await saveMemberToDB(withClass, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_mem_${memberToSave.id}_${Date.now()}`,
      action: members.some(m => m.id === memberToSave.id) ? 'UPDATE' : 'CREATE',
      entity: 'MEMBER',
      data: withClass,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  const handleSaveBulkMembers = async (membersList: Member[]) => {
    if (!classProfile) return;
    const withClass = membersList.map(m => ({
      ...m,
      classId: classProfile.id
    }));
    await saveBulkMembersToDB(withClass, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    for (const m of withClass) {
      await addToSyncQueue({
        id: `sync_mem_${m.id}_${Date.now()}`,
        action: 'CREATE',
        entity: 'MEMBER',
        data: m,
        createdAt: new Date().toISOString()
      });
    }
    setSyncQueue(await getSyncQueue());
  };

  const handleDeleteMember = async (id: string) => {
    if (!classProfile) return;
    await deleteMemberFromDB(id);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_del_${id}_${Date.now()}`,
      action: 'DELETE',
      entity: 'MEMBER',
      data: { id },
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  // Visitor to Student Conversion (Sets status to PENDING_APPROVAL for Enrollment Officer)
  const handleConvertVisitorToStudent = async (memberId: string) => {
    if (!classProfile) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const qualification = checkVisitorQualification(member, grades, selectedWeek);
    if (!qualification.isQualified) {
      throw new Error('This visitor is not yet eligible. Three consecutive attendances are required before a conversion request.');
    }

    const requested: Member = {
      ...member,
      conversionStatus: 'PENDING_APPROVAL',
      conversionRequestedAt: new Date().toISOString(),
      conversionRequestedBy: classProfile.secretaryName || classProfile.className,
      updatedAt: new Date().toISOString()
    };

    await saveMemberToDB(requested, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_convert_${memberId}_${Date.now()}`,
      action: 'UPDATE',
      entity: 'MEMBER',
      data: requested,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  // Grade & Offering Handlers
  const handleUpdateGrade = async (grade: WeeklyGradeRecord) => {
    if (!classProfile) return;
    const total = (grade.attendance === 'PRESENT')
      ? (grade.punctuality || 0) + (grade.memoryVerse || 0) + (grade.classParticipation || 0)
      : 0;

    const updatedGrade: WeeklyGradeRecord = {
      ...grade,
      classId: classProfile.id,
      quarterNumber: selectedQuarter,
      lessonTotal: total,
      updatedAt: new Date().toISOString()
    };

    await saveGradeToDB(updatedGrade);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_grade_${grade.id}_${Date.now()}`,
      action: 'UPDATE',
      entity: 'GRADE',
      data: updatedGrade,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  const handleUpdateOffering = async (offering: WeeklyOfferingRecord) => {
    if (!classProfile) return;
    const updatedOffering: WeeklyOfferingRecord = {
      ...offering,
      classId: classProfile.id,
      quarterNumber: selectedQuarter,
      updatedAt: new Date().toISOString()
    };

    await saveOfferingToDB(updatedOffering);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_offering_${offering.id}_${Date.now()}`,
      action: 'UPDATE',
      entity: 'OFFERING',
      data: updatedOffering,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  // Absence Log & Escalation Handlers
  const handleSaveAbsenceLog = async (log: AbsenceLogRecord) => {
    if (!classProfile) return;
    const updatedLog: AbsenceLogRecord = {
      ...log,
      classId: classProfile.id,
      quarterNumber: selectedQuarter
    };

    await saveAbsenceLogToDB(updatedLog);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_log_${log.id}_${Date.now()}`,
      action: 'CREATE',
      entity: 'ABSENCE_LOG',
      data: updatedLog,
      createdAt: new Date().toISOString()
    });
    setSyncQueue(await getSyncQueue());
  };

  const handleUpdateMemberStatus = async (memberId: string, status: any, exitNote?: string) => {
    if (!classProfile) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const updated: Member = {
      ...member,
      status,
      notes: exitNote ? `${member.notes || ''} [Exit Note: ${exitNote}]` : member.notes,
      updatedAt: new Date().toISOString()
    };

    await saveMemberToDB(updated, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);
  };

  const handleRelegateToVisitor = async (memberId: string) => {
    if (!classProfile) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const currentEnr = member.quarterEnrollments || {};
    currentEnr[selectedQuarter] = {
      ...(currentEnr[selectedQuarter] || { quarterNumber: selectedQuarter, status: 'ACTIVE', firstLessonWeek: 1 }),
      memberType: 'VISITOR'
    };

    const updated: Member = {
      ...member,
      memberType: 'VISITOR',
      quarterEnrollments: currentEnr,
      updatedAt: new Date().toISOString()
    };

    await saveMemberToDB(updated, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);
  };

  // Open Add Visitor with Referral from Student
  const handleOpenAddVisitorWithReferral = async (sponsorMemberId: string) => {
    if (!classProfile) return;
    const sponsor = members.find(m => m.id === sponsorMemberId);
    if (sponsor) {
      const updatedSponsor: Member = {
        ...sponsor,
        evangelismReferralCount: (sponsor.evangelismReferralCount || 0) + 1,
        updatedAt: new Date().toISOString()
      };
      await saveMemberToDB(updatedSponsor, selectedQuarter);
      await loadClassQuarterData(classProfile.id, selectedQuarter);
    }

    setPreSelectedSponsorId(sponsorMemberId);
    setActiveTab('ROSTER_MANAGEMENT');
  };

  // AI Prompt Transition from Absence Care
  const handleOpenAICompose = (member: Member, weeksAbsent: number) => {
    const prompt = `Draft a heartfelt, warm, and spiritually encouraging WhatsApp pastoral check-in message for ${member.fullName} who has been absent for ${weeksAbsent} consecutive Sunday School lessons. Their known prayer request is "${member.prayerRequests || 'God\'s peace and protection'}". Reference our current lesson topic and memory verse gently.`;
    setAiInitialPrompt(prompt);
    setActiveTab('AI_ASSISTANT');
  };

  // Sync Push & Pull Logic
  const handlePushSync = async () => {
    let hostError: Error | null = null;
    setIsSyncing(true);
    setSyncStatusText('Pushing mutations to Host Server...');
    try {
      const hostIp = localStorage.getItem('gofamint_host_ip') || 'http://192.168.1.150:5000';
      
      const payload: SyncPayload = {
        classProfile,
        members,
        grades,
        offerings,
        absenceLogs,
        referrals: [],
        timestamp: new Date().toISOString(),
        sourceClient: navigator.userAgent
      };

      const res = await pushSyncToServer(payload, hostIp);
      if (res.success) {
        await clearSyncQueue();
        setSyncQueue([]);
        setSyncStatusText('Synced with Host Laptop');
      } else {
        hostError = new Error(res.error || 'Host server rejected the sync request.');
        setSyncStatusText(`Host sync failed: ${hostError.message}`);
      }
    } catch (err: any) {
      hostError = err instanceof Error ? err : new Error(err?.message || 'Host sync failed.');
      console.warn('Sync push notification:', hostError.message);
      setSyncStatusText('Offline - Changes Queued');
    } finally {
      setIsSyncing(false);
    }
    // Always also retry/flush anything pending to the central Supabase database —
    // this is the sync path that actually reaches every other device, regardless
    // of whether the optional local-network Host Server above was reachable.
    const cloudResult = await syncWithCloud(false);
    if (hostError) {
      const cloudNote = cloudResult.ok ? ' Central Supabase sync succeeded.' : ` Central Supabase sync also failed: ${cloudResult.error}`;
      throw new Error(`${hostError.message}${cloudNote}`);
    }
  };

  const handleCompleteExitReview = async (
    memberId: string,
    outcome: ExitReviewOutcome,
    reason: string
  ) => {
    if (!classProfile) throw new Error('No class profile is active.');
    const member = members.find(m => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} was not found in the active class.`);

    const now = new Date().toISOString();
    const isPermanent = outcome === 'PERMANENT_EXIT';
    const nextStatus = isPermanent ? 'LEFT_CLASS' : 'ACTIVE';
    const enrollment = member.quarterEnrollments?.[selectedQuarter];
    const updated: Member = {
      ...member,
      status: nextStatus,
      exitReviewOutcome: outcome,
      exitReviewAt: now,
      temporaryExitSince: outcome === 'TEMPORARY_EXIT' ? now : undefined,
      departureDate: isPermanent ? now : undefined,
      departureQuarter: isPermanent ? selectedQuarter : undefined,
      departureWeek: isPermanent ? selectedWeek : undefined,
      departureReason: isPermanent ? reason : undefined,
      exitNote: isPermanent ? reason : member.exitNote,
      quarterEnrollments: {
        ...(member.quarterEnrollments || {}),
        [selectedQuarter]: {
          ...(enrollment || {
            quarterNumber: selectedQuarter,
            memberType: member.memberType,
            firstLessonWeek: member.firstLessonWeek || 1
          }),
          status: nextStatus,
          exitNote: isPermanent ? reason : undefined
        }
      },
      statusHistory: [
        ...(member.statusHistory || []),
        {
          fromStatus: member.status,
          toStatus: outcome,
          date: now,
          reason
        }
      ],
      updatedAt: now
    };

    await saveMemberToDB(updated, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);
  };

  const handlePullSync = async () => {
    let hostError: Error | null = null;
    setIsSyncing(true);
    setSyncStatusText('Pulling from Host Server...');
    try {
      const hostIp = localStorage.getItem('gofamint_host_ip') || 'http://192.168.1.150:5000';
      const result = await pullSyncFromServer(hostIp);

      if (result.success && result.payload) {
        const remoteData = result.payload;
        if (remoteData.classProfile) {
          await saveClassProfile(remoteData.classProfile);
          setClassProfile(remoteData.classProfile);
        }
        if (remoteData.members?.length) {
          for (const m of remoteData.members) await saveMemberToDB(m, selectedQuarter);
        }
        if (remoteData.grades?.length) {
          for (const g of remoteData.grades) await saveGradeToDB(g);
        }
        if (remoteData.offerings?.length) {
          for (const o of remoteData.offerings) await saveOfferingToDB(o);
        }
        if (remoteData.absenceLogs?.length) {
          for (const l of remoteData.absenceLogs) await saveAbsenceLogToDB(l);
        }
        if (classProfile) {
          await loadClassQuarterData(classProfile.id, selectedQuarter);
        }
        setSyncStatusText('Pulled Latest from Host');
      } else {
        hostError = new Error(result.error || 'Host server did not return a sync payload.');
        setSyncStatusText(`Host pull failed: ${hostError.message}`);
      }
    } catch (err: any) {
      hostError = err instanceof Error ? err : new Error(err?.message || 'Host pull failed.');
      console.warn('Sync pull notification:', hostError.message);
      setSyncStatusText('Offline Mode (Local IndexedDB)');
    } finally {
      setIsSyncing(false);
    }
    // Always also pull the latest state from the central Supabase database —
    // this is what actually picks up changes made on other devices, regardless
    // of whether the optional local-network Host Server above was reachable.
    const cloudResult = await syncWithCloud(false);
    if (hostError) {
      const cloudNote = cloudResult.ok ? ' Central Supabase refresh succeeded.' : ` Central Supabase refresh also failed: ${cloudResult.error}`;
      throw new Error(`${hostError.message}${cloudNote}`);
    }
  };

  // Full Backup Import
  const handleImportFullBackup = async (data: any) => {
    if (data.classProfile) {
      await saveClassProfile(data.classProfile);
      setClassProfile(data.classProfile);
    }
    if (data.members) {
      for (const m of data.members) await saveMemberToDB(m);
    }
    if (data.grades) {
      for (const g of data.grades) await saveGradeToDB(g);
    }
    if (data.offerings) {
      for (const o of data.offerings) await saveOfferingToDB(o);
    }
    if (data.absenceLogs) {
      for (const l of data.absenceLogs) await saveAbsenceLogToDB(l);
    }
    if (classProfile) {
      await loadClassQuarterData(classProfile.id, selectedQuarter);
    }
  };

  // Calculate Urgent Absence & Visitor Progression Badges
  const urgentAbsenceCount = members.filter(m => {
    const absences = getConsecutiveAbsences(m.id, selectedWeek, grades, m.firstLessonWeek || 1);
    return absences >= 2 && m.status !== 'LEFT_CLASS';
  }).length;

  const visitorConversionCount = members.filter(m => {
    if (m.memberType !== 'VISITOR' || m.status === 'LEFT_CLASS') return false;
    const consecutive = getConsecutiveVisits(m.id, selectedWeek, grades);
    return consecutive >= 3;
  }).length;

  // Oversight Handlers
  const handleEnterOversight = async (targetPortal: string, targetClassId?: string) => {
    try {
      await logOversightAccess({
        targetPortal,
        targetClassId,
        action: 'ENTER_OVERSIGHT',
      });
    } catch (e) {
      console.warn('Could not log oversight access:', e);
    }

    if (targetPortal === 'WORKERS') {
      const target = { type: 'WORKERS' as const, label: 'Workers Directorate & Attendance Terminal' };
      setOversightTarget(target);
      sessionStorage.setItem('gofamint_active_portal', 'WORKERS');
      sessionStorage.setItem('gofamint_oversight_target', JSON.stringify(target));
      setShowAdminPortal(false);
      setShowWorkersModule(true);
      setShowOpeningPage(false);
    } else if (targetPortal === 'CLASS_REGISTER' && targetClassId) {
      const target = {
        type: 'CLASS' as const,
        classId: targetClassId,
        label: `Class Register (${targetClassId})`,
      };
      setOversightTarget(target);
      sessionStorage.setItem('gofamint_active_portal', 'CLASS_REGISTER');
      sessionStorage.setItem('gofamint_oversight_target', JSON.stringify(target));
      await loadClassQuarterData(targetClassId, selectedQuarter);
      setShowAdminPortal(false);
      setShowWorkersModule(false);
      setShowOpeningPage(false);
      setIsUnlocked(true);
    }
  };

  const handleExitOversight = () => {
    setOversightTarget(null);
    sessionStorage.removeItem('gofamint_active_portal');
    sessionStorage.removeItem('gofamint_oversight_target');
    setShowWorkersModule(false);
    setShowOpeningPage(false);
    setShowAdminPortal(true);
  };

  if (visitorToken) {
    return (
      <VisitorProfileCompletionView
        token={visitorToken}
        onProfileCompleted={() => {
          window.location.hash = '';
          setVisitorToken(null);
        }}
      />
    );
  }

  if (reportCardToken) {
    return (
      <StandaloneReportCardView
        token={reportCardToken}
        onBack={() => {
          window.location.hash = '';
          setReportCardToken(null);
        }}
      />
    );
  }

  if (isCheckingAuth || isSystemInitialized === null) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center text-slate-300 p-4 text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-blue-200 mt-1">Loading Sunday School Portal...</p>
      </div>
    );
  }

  if (!cloudUser) {
    return <CloudLoginGate 
      onSignedIn={(user) => {
        setCloudUser(user);
        setIsCheckingAuth(false);
        void resolveAuthenticatedProfile(user);
      }} 
      isSystemInitialized={isSystemInitialized}
      onFirstRunComplete={() => setIsSystemInitialized(true)}
    />;
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center text-slate-300 p-4 text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold font-['Cinzel',serif] tracking-wide text-white">
          THE GOSPEL FAITH MISSION INTL
        </h2>
        <p className="text-xs text-blue-200 mt-1">Initializing Offline IndexedDB Sunday School Secretary Engine...</p>
      </div>
    );
  }

  // A Supabase session without a resolved application profile must never fall through
  // to the legacy OpeningFlow. That screen is only for the legacy class workflow.
  if (profileResolution !== 'ready') {
    const isLoadingProfile = profileResolution === 'idle' || profileResolution === 'loading';
    const title = isLoadingProfile
      ? 'Resolving your account access'
      : profileResolution === 'missing'
      ? 'Account provisioning required'
      : profileResolution === 'unapproved'
      ? 'Account pending approval'
      : profileResolution === 'invalid'
      ? 'Account role configuration required'
      : 'Unable to resolve account access';

    if (isLoadingProfile) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-amber-300 font-['Cinzel',serif] block">
                THE GOSPEL FAITH MISSION INTERNATIONAL
              </span>
              <p className="text-xs text-slate-300 font-medium">
                Loading Sunday School Portal...
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 rounded-2xl p-8 text-center shadow-2xl space-y-4 border border-amber-400/40">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-800 font-black text-xl">!</div>
          <h2 className="text-lg font-bold text-slate-900 font-['Cinzel',serif]">{title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {profileResolutionError || 'Your account could not be resolved.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void resolveAuthenticatedProfile(cloudUser)}
              className="px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl text-xs transition"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user entered the Workers Directorate Module
  if (showWorkersModule) {
    return (
      <>
        {isProfileLocked && (
          <LockScreen
            userEmail={cloudUser.email || ''}
            userRole={currentUserProfile?.role}
            onUnlocked={() => setIsProfileLocked(false)}
          />
        )}
        {oversightTarget && (
          <OversightBanner
            targetLabel={oversightTarget.label}
            onExitOversight={handleExitOversight}
          />
        )}
        <WorkersModuleView
          currentUserRole={currentUserProfile?.role}
          currentWorkerId={currentUserProfile?.workerId || undefined}
          isOversight={Boolean(oversightTarget)}
          onBackToWelcome={() => {
            sessionStorage.removeItem('gofamint_active_portal');
            sessionStorage.removeItem('gofamint_oversight_target');
            if (oversightTarget) {
              handleExitOversight();
            }
            setShowWorkersModule(false);
            setShowAdminPortal(false);
            setShowOpeningPage(true);
          }}
          onBack={() => {
            sessionStorage.removeItem('gofamint_active_portal');
            sessionStorage.removeItem('gofamint_oversight_target');
            if (oversightTarget) {
              handleExitOversight();
            } else {
              setShowWorkersModule(false);
              setShowOpeningPage(true);
            }
          }}
          onLockProfile={() => {
            sessionStorage.setItem('gofamint_profile_locked', 'true');
            setIsProfileLocked(true);
          }}
        />
      </>
    );
  }

  // If user entered the Admin Portal
  if (showAdminPortal) {
    return (
      <>
        {isProfileLocked && (
          <LockScreen
            userEmail={cloudUser.email || ''}
            userRole={currentUserProfile?.role}
            onUnlocked={() => setIsProfileLocked(false)}
          />
        )}
        <AdminPortalRoot
          authProfile={currentUserProfile}
          onBackToWelcome={() => {
            sessionStorage.removeItem('gofamint_active_portal');
            setShowAdminPortal(false);
            setShowWorkersModule(false);
            setShowOpeningPage(true);
          }}
          onBackToPortalSelect={() => {
            sessionStorage.removeItem('gofamint_active_portal');
            setShowAdminPortal(false);
            setShowOpeningPage(true);
          }}
          onEnterClassRegister={(targetClassId) => {
            if (currentUserProfile?.role === 'GENERAL_SUPERINTENDENT' || currentUserProfile?.role === 'SUPER_ADMIN') {
              handleEnterOversight('CLASS_REGISTER', targetClassId);
            } else {
              setShowAdminPortal(false);
              setShowWorkersModule(false);
              setIsUnlocked(false);
              sessionStorage.removeItem('gofamint_unlocked');
              setShowOpeningPage(true);
            }
          }}
          onEnterWorkersModule={['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'].includes(currentUserProfile?.role || '') ? () => {
            void handleEnterOversight('WORKERS');
          } : undefined}
          onLockProfile={() => {
            sessionStorage.setItem('gofamint_profile_locked', 'true');
            setIsProfileLocked(true);
          }}
          onEnterOversight={handleEnterOversight}
        />
      </>
    );
  }

  // If user entered SIB (School Intelligence Board - Fourth Portal)
  if (showSibPortal) {
    return (
      <>
        {isProfileLocked && (
          <LockScreen
            userEmail={cloudUser.email || ''}
            userRole={currentUserProfile?.role}
            onUnlocked={() => setIsProfileLocked(false)}
          />
        )}
        <SibPortalRoot
          authProfile={currentUserProfile}
          onBackToWelcome={() => {
            sessionStorage.removeItem('gofamint_active_portal');
            setShowSibPortal(false);
            setShowOpeningPage(true);
          }}
          onBackToPortalSelect={() => {
            sessionStorage.removeItem('gofamint_active_portal');
            setShowSibPortal(false);
            setShowOpeningPage(true);
          }}
          onNavigateToPortal={(targetPortal, context) => {
            setShowSibPortal(false);
            if (targetPortal === 'ADMIN') {
              sessionStorage.setItem('gofamint_active_portal', 'ADMIN');
              setShowAdminPortal(true);
            } else if (targetPortal === 'WORKERS') {
              sessionStorage.setItem('gofamint_active_portal', 'WORKERS');
              setShowWorkersModule(true);
            } else if (targetPortal === 'CLASS_REGISTER') {
              sessionStorage.setItem('gofamint_active_portal', 'CLASS_REGISTER');
              const classId = context?.classId as string | undefined;
              if (classId && (currentUserProfile?.role === 'GENERAL_SUPERINTENDENT' || currentUserProfile?.role === 'SUPER_ADMIN')) {
                handleEnterOversight('CLASS_REGISTER', classId);
              } else {
                setShowOpeningPage(true);
              }
            }
          }}
        />
      </>
    );
  }

  // If user is at the Opening Page
  if (showOpeningPage) {
    return (
      <>
        {isProfileLocked && (
          <LockScreen
            userEmail={cloudUser.email || ''}
            userRole={currentUserProfile?.role}
            onUnlocked={() => setIsProfileLocked(false)}
          />
        )}
        {oversightTarget && (
          <OversightBanner
            targetLabel={oversightTarget.label}
            onExitOversight={handleExitOversight}
          />
        )}
        <OpeningFlowView
          classProfile={classProfile}
          members={members}
          isUnlocked={isUnlocked}
          onEnterClass={(targetCls) => {
            sessionStorage.setItem('gofamint_active_portal', 'CLASS_REGISTER');
            handleEnterClassFromWelcome(targetCls);
          }}
          onEnterAdminPortal={() => {
            sessionStorage.setItem('gofamint_active_portal', 'ADMIN');
            setShowOpeningPage(false);
            setShowAdminPortal(true);
          }}
          onEnterWorkersModule={currentUserProfile?.role === 'DEPARTMENT_SUPERINTENDENT' ? undefined : () => {
            sessionStorage.setItem('gofamint_active_portal', 'WORKERS');
            setShowOpeningPage(false);
            setShowWorkersModule(true);
          }}
          onEnterSibPortal={() => {
            sessionStorage.setItem('gofamint_active_portal', 'SIB');
            setShowOpeningPage(false);
            setShowSibPortal(true);
          }}
          onRegisterNewClassSubmit={handleRegisterNewClassSubmit}
          onClearDataAndStartScratch={handleClearDataAndStartScratch}
          onDatabaseRestored={loadAppData}
          currentUserProfile={currentUserProfile}
          cloudUser={cloudUser}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          isFirstRun={isRegisteringNew || !classProfile?.isSetupComplete}
          existingClassProfile={isRegisteringNew ? null : classProfile}
          onCompleteSetup={handleCompleteFirstRunSetup}
          onUnlock={handleUnlockConsole}
          onCancel={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  const currencySymbol = classProfile?.currencySymbol || '₦';

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 flex flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] font-sans selection:bg-blue-600 selection:text-white sm:pb-0">
      {isProfileLocked && (
        <LockScreen
          userEmail={cloudUser.email || ''}
          userRole={currentUserProfile?.role}
          onUnlocked={() => setIsProfileLocked(false)}
        />
      )}
      {oversightTarget && (
        <OversightBanner
          targetLabel={oversightTarget.label}
          onExitOversight={handleExitOversight}
        />
      )}
      
      {/* App Header */}
      <Header
        classProfile={classProfile}
        currentWeek={selectedWeek}
        selectedQuarter={selectedQuarter}
        activeQuarterNumber={sundaySchoolYear?.activeQuarterNumber || classProfile?.quarter || 1}
        onQuarterChange={(q) => handleQuarterChange(q as QuarterNumber)}
        syncState={{
          isOnline,
          isSyncing,
          syncQueueCount: syncQueue.length,
          syncStatusText
        }}
        quarters={sundaySchoolYear?.quarters}
        onSyncClick={handlePushSync}
        onLockClick={() => {
          sessionStorage.setItem('gofamint_profile_locked', 'true');
          setIsProfileLocked(true);
        }}
        onOpenAI={() => setActiveTab('AI_ASSISTANT')}
        onOpenWelcome={() => {
          setShowWorkersModule(false);
          setShowAdminPortal(false);
          setShowOpeningPage(true);
        }}
        onOpenAdminPortal={() => {
          setShowWorkersModule(false);
          setShowOpeningPage(false);
          setShowAdminPortal(true);
        }}
        onOpenWorkersModule={() => {
          sessionStorage.setItem('gofamint_active_portal', 'WORKERS');
          setShowAdminPortal(false);
          setShowOpeningPage(false);
          setShowWorkersModule(true);
        }}
        totalStudents={members.filter(m => m.memberType === 'STUDENT' && m.status !== 'LEFT_CLASS').length}
        totalVisitors={members.filter(m => m.memberType === 'VISITOR' && m.status !== 'LEFT_CLASS').length}
      />

      {/* Navigation Tab Bar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        urgentAbsenceCount={urgentAbsenceCount}
        visitorConversionCount={visitorConversionCount}
        unreadCommentsCount={comments.filter(c => c.classId === classProfile?.id).length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {activeTab === 'GRADING_MATRIX' && (
          <GradingMatrixView
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
            members={members}
            grades={grades}
            offerings={offerings}
            lessons={currentQuarterLessons}
            classProfile={classProfile}
            adminComments={comments.filter(c => c.classId === classProfile?.id)}
            quarterStatus={selectedQuarterStatus}
            selectedQuarter={selectedQuarter}
            onUpdateGrade={handleUpdateGrade}
            onUpdateOffering={handleUpdateOffering}
            onUpdateLessonTopic={handleUpdateLessonTopic}
            onOpenAddVisitorWithReferral={handleOpenAddVisitorWithReferral}
            onQuickAddMember={handleQuickAddMember}
            onNavigateToRoster={() => setActiveTab('ROSTER_MANAGEMENT')}
            onOpenQuarterTransition={() => setIsQuarterTransitionOpen(true)}
            onUpdateMember={handleSaveMember}
            onSaveBulkMembers={handleSaveBulkMembers}
            currencySymbol={currencySymbol}
            sundaySchoolYear={sundaySchoolYear || undefined}
          />
        )}

        {activeTab === 'ROSTER_MANAGEMENT' && (
          <RosterManagementView
            members={members}
            grades={grades}
            currentWeek={selectedWeek}
            classProfile={classProfile}
            onSaveMember={handleSaveMember}
            onSaveBulkMembers={handleSaveBulkMembers}
            onDeleteMember={handleDeleteMember}
            onConvertVisitorToStudent={handleConvertVisitorToStudent}
            preSelectedSponsorId={preSelectedSponsorId}
            onClearPreSelectedSponsor={() => setPreSelectedSponsorId(null)}
          />
        )}

        {(activeTab === 'WELFARE_FOLLOW_UP' || (activeTab as any) === 'ABSENCE_CARE') && (
          <WelfareFollowUpView
            members={members}
            grades={grades}
            absenceLogs={absenceLogs}
            currentWeek={getLatestCompletedSundayWeek(
              sundaySchoolYear?.quarters?.find(q => q.quarterNumber === selectedQuarter),
              new Date()
            )}
            classProfile={classProfile}
            activeLessons={currentQuarterLessons}
            selectedQuarterNumber={selectedQuarter}
            onSaveAbsenceLog={handleSaveAbsenceLog}
            onCompleteExitReview={handleCompleteExitReview}
            onRelegateToVisitor={handleRelegateToVisitor}
            onRestoreToStudent={(id) => handleUpdateMemberStatus(id, 'ACTIVE')}
          />
        )}

        {(activeTab === 'QUARTER_ANALYSIS' || (activeTab as any) === 'WEEK_12_ANALYTICS') && (
          <QuarterAnalysisView
            members={members}
            grades={grades}
            offerings={offerings}
            absenceLogs={absenceLogs}
            classProfile={classProfile}
            quarterData={sundaySchoolYear?.quarters?.find(q => q.quarterNumber === selectedQuarter) || null}
            quarterNumber={selectedQuarter}
            currencySymbol={currencySymbol}
            onUpgradeVisitor={handleConvertVisitorToStudent}
            onExemptMember={(memberId, reason) => {
              handleUpdateMemberStatus(memberId, 'HIGH_PROBABILITY', reason);
            }}
            onExitMember={(memberId, reason) => {
              handleUpdateMemberStatus(memberId, 'LEFT_CLASS', reason);
            }}
            onOpenQuarterTransition={() => setIsQuarterTransitionOpen(true)}
          />
        )}

        {activeTab === 'CLASS_DISCUSSION' && (
          <ClassDiscussionView
            classProfile={classProfile}
            comments={comments}
            currentRole="Class Secretary"
            currentUserName={classProfile?.secretaryName || classProfile?.className || 'Class Secretary'}
            onSaveComment={handleSaveComment}
            onDeleteComment={handleDeleteComment}
          />
        )}

        {activeTab === 'QR_PORTAL' && (
          <QRPortalView
            members={members}
            grades={grades}
            classProfile={classProfile}
          />
        )}

        {/* SUNDAY SCHOOL REPORT CARD (Phases 16 & 17) */}
        {activeTab === 'REPORT_CARD' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in max-w-5xl mx-auto">
            <section aria-labelledby="report-card-heading" className="bg-gradient-to-br from-[#071b3d] via-[#173a77] to-[#3b1d59] rounded-2xl border border-blue-700/50 p-4 sm:p-6 shadow-xl shadow-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-950 bg-amber-400 px-2.5 py-1 rounded-lg">
                  Progress
                </span>
                <h2 id="report-card-heading" className="text-xl sm:text-3xl font-black text-white mt-2 tracking-tight">
                  Sunday School report card
                </h2>
                <p className="text-xs sm:text-sm text-blue-100/80 mt-1">
                  View attendance and scores for any class member.
                </p>
              </div>

              <label className="w-full sm:w-auto min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wider text-blue-100/70 mb-1.5">Member</span>
                <select
                  value={selectedReportMemberId || members[0]?.id || ''}
                  onChange={(e) => setSelectedReportMemberId(e.target.value)}
                  aria-label="Select report card member"
                  className="w-full sm:w-64 min-h-[44px] px-3 py-2 bg-white border border-white/30 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer shadow-sm"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.memberType})
                    </option>
                  ))}
                </select>
              </label>
            </section>

            {members.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
                <p className="text-sm font-bold">No registered members in this class yet.</p>
              </div>
            ) : (
              <VisitorReportCardView
                memberId={selectedReportMemberId || members[0]?.id}
                members={members}
                grades={grades}
                classProfile={classProfile}
                lessons={currentQuarterLessons}
              />
            )}
          </div>
        )}

        {activeTab === 'AI_ASSISTANT' && (
          <AIAssistantView
            members={members}
            grades={grades}
            currentWeek={selectedWeek}
            classProfile={classProfile}
            initialPrompt={aiInitialPrompt}
            onClearInitialPrompt={() => setAiInitialPrompt(undefined)}
          />
        )}

        {activeTab === 'DATABASE_SETTINGS' && (
          <SyncSettingsView
            classProfile={classProfile}
            members={members}
            grades={grades}
            offerings={offerings}
            absenceLogs={absenceLogs}
            syncQueue={syncQueue}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onPushSync={handlePushSync}
            onPullSync={handlePullSync}
            onUpdateClassProfile={async (p) => {
              await saveClassProfile(p);
              setClassProfile(p);
            }}
            onClearDatabase={handleClearDataAndStartScratch}
            onImportFullBackup={handleImportFullBackup}
            onDatabaseRestored={loadAppData}
          />
        )}
      </main>

      {/* Geometric Balance Telemetry Footer */}
      <footer className="bg-slate-200 p-2.5 px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold text-slate-600 border-t border-slate-300 gap-1 mt-auto">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>STATUS: DEVICE OFFLINE-READY | DATABASE ENCRYPTED</span>
        </div>
        <div className="flex items-center gap-3">
          <span>HOST SYNC: {isOnline ? 'ONLINE & SYNC ACTIVE' : 'OFFLINE LOCAL'}</span>
          <span>|</span>
          <span>GOFAMINT_HOF SS PWA v2.4</span>
        </div>
      </footer>

      {/* First-Run Setup & Lock Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        isFirstRun={isRegisteringNew || !classProfile?.isSetupComplete}
        existingClassProfile={isRegisteringNew ? null : classProfile}
        onCompleteSetup={handleCompleteFirstRunSetup}
        onUnlock={handleUnlockConsole}
        onCancel={() => setIsAuthModalOpen(false)}
      />

      {/* Intelligent Quarter Transition & Initialization Modal */}
      {isQuarterTransitionOpen && (
        <QuarterTransitionModal
          isOpen={isQuarterTransitionOpen}
          onClose={() => setIsQuarterTransitionOpen(false)}
          classProfile={classProfile}
          fromQuarter={(selectedQuarter > 1 ? (selectedQuarter - 1) : 1) as QuarterNumber}
          toQuarter={selectedQuarter}
          onTransitionComplete={async () => {
            setIsQuarterTransitionOpen(false);
            if (classProfile) {
              await loadClassQuarterData(classProfile.id, selectedQuarter);
            }
          }}
          sundaySchoolYear={sundaySchoolYear}
        />
      )}
    </div>
  );
}
