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
  QuarterStatus
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
  saveAdminComment,
  deleteAdminComment,
  performLocalFactoryReset,
  getSundaySchoolYear,
  archiveQuarterForRegister
} from './db/indexedDB';
import { getSystemStatus } from './services/adminUserApi';
import { GOFAMINT_HOF_12_LESSONS } from './data/mockQuarterLessons';
import { pushSyncToServer, pullSyncFromServer } from './services/api';
import { getConsecutiveAbsences, getConsecutiveVisits } from './utils/calculations';
import { runFullCloudSyncCycle, getLastHydrationError, startRealtimeCloudSync, stopRealtimeCloudSync } from './services/cloudSyncManager';
import type { SyncScope } from './services/cloudSyncManager';

// Subcomponents
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { AuthModal } from './components/AuthModal';
import { OpeningFlowView } from './components/OpeningFlowView';
import { QuarterSelectorBar } from './components/QuarterSelectorBar';
import { GradingMatrixView } from './components/GradingMatrixView';
import { RosterManagementView } from './components/RosterManagementView';
import { WelfareFollowUpView } from './components/WelfareFollowUpView';
import { AbsenceCareView } from './components/AbsenceCareView';
import { QuarterAnalysisView } from './components/QuarterAnalysisView';
import { Week12AnalyticsView } from './components/Week12AnalyticsView';
import { ClassDiscussionView } from './components/ClassDiscussionView';
import { QRPortalView } from './components/QRPortalView';
import { AIAssistantView } from './components/AIAssistantView';
import { SyncSettingsView } from './components/SyncSettingsView';
import { AdminPortalRoot } from './components/AdminPortal/AdminPortalRoot';
import { WorkersModuleView } from './components/WorkersModule/WorkersModuleView';
import { QuarterTransitionModal } from './components/QuarterTransitionModal';
import { CloudLoginGate } from './components/CloudLoginGate';
import { LockScreen } from './components/LockScreen';
import { OversightBanner } from './components/OversightBanner';
import { watchAuthState, signOutUser, getCurrentUser } from './services/authService';
import { logOversightAccess } from './services/adminUserApi';
import { loadCurrentProfile, type ApplicationProfile } from './services/profileService';
import type { User } from '@supabase/supabase-js';

const ADMIN_PORTAL_ROLES = new Set([
  'GENERAL_SUPERINTENDENT',
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
  // Cloud Auth Gate — nothing below renders until a Supabase user is signed in
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<ApplicationProfile | null>(null);
  const [profileResolution, setProfileResolution] = useState<ProfileResolutionState>('idle');
  const [profileResolutionError, setProfileResolutionError] = useState<string | null>(null);

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

      // Supplementary resilience check: If profile is not marked approved, check local IndexedDB
      if (!profile.isApproved) {
        try {
          const { getAllAdminProfiles } = await import('./db/indexedDB');
          const localAdmins = await getAllAdminProfiles();
          const match = localAdmins.find(a =>
            a.id === user.id ||
            (user.email && a.username?.toLowerCase() === user.email.toLowerCase()) ||
            a.roleType === profile?.role
          );
          if (match && match.isApproved) {
            profile = {
              ...profile,
              isApproved: true,
              approvedBy: match.approvedBy || profile.approvedBy,
              approvedAt: match.approvedAt || profile.approvedAt,
            };
          }
        } catch {}
      }

      setCurrentUserProfile(profile);
      if (!profile.isApproved) {
        setProfileResolution('unapproved');
        setProfileResolutionError('Your account is awaiting approval from the Sunday School Directorate.');
        return;
      }
      setProfileResolution('ready');

      // Supabase profile identity takes priority over every legacy opening-flow state.
      // Retain active portal across hard refreshes (Ctrl + Shift + R) so users stay on their current page
      const savedPortal = sessionStorage.getItem('gofamint_active_portal');
      const savedOversight = sessionStorage.getItem('gofamint_oversight_target');

      if (savedPortal === 'WORKERS' && (ADMIN_PORTAL_ROLES.has(role) || WORKERS_MODULE_ROLES.has(role))) {
        setShowWorkersModule(true);
        setShowAdminPortal(false);
        setShowOpeningPage(false);
        if (savedOversight) {
          try {
            setOversightTarget(JSON.parse(savedOversight));
          } catch {
            setOversightTarget({ type: 'WORKERS', label: 'Workers Directorate & Attendance Terminal' });
          }
        }
      } else if (ADMIN_PORTAL_ROLES.has(role)) {
        setShowAdminPortal(true);
        setShowWorkersModule(false);
        setShowOpeningPage(false);
      } else if (WORKERS_MODULE_ROLES.has(role)) {
        setShowWorkersModule(true);
        setShowAdminPortal(false);
        setShowOpeningPage(false);
      } else {
        setShowAdminPortal(false);
        setShowWorkersModule(false);
        if (profile.classId) {
          const { getAllClassesDirectory } = await import('./db/indexedDB');
          const allCls = await getAllClassesDirectory();
          const targetCls = allCls.find(c => c.id === profile.classId);
          if (targetCls) {
            setClassProfile(targetCls);
            if (!targetCls.isSetupComplete || !targetCls.secretaryName) {
              setShowOpeningPage(true);
              setIsUnlocked(false);
            } else if (targetCls.approvalStatus === 'PENDING_APPROVAL') {
              setShowOpeningPage(true);
              setIsUnlocked(false);
            } else {
              setShowOpeningPage(false);
              setIsUnlocked(true);
              sessionStorage.setItem('gofamint_unlocked', 'true');
              sessionStorage.setItem('gofamint_unlocked_class_id', profile.classId);
              await loadClassQuarterData(profile.classId, selectedQuarter);
            }
          } else {
            setShowOpeningPage(true);
            setIsUnlocked(false);
          }
        } else {
          setShowOpeningPage(false);
          setIsUnlocked(true);
        }
      }
    } catch (err: any) {
      console.warn('Could not load Supabase user profile on auth:', err);
      setProfileResolution('error');
      setProfileResolutionError(err?.message || 'The account role could not be loaded. Check your connection and try again.');
    }
  };

  useEffect(() => {
    let isMounted = true;

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
    };
  }, []);

  // Global App States
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean | null>(null);
  const [showOpeningPage, setShowOpeningPage] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showWorkersModule, setShowWorkersModule] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegisteringNew, setIsRegisteringNew] = useState(false);
  const [isQuarterTransitionOpen, setIsQuarterTransitionOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('GRADING_MATRIX');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(1);
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

    const activeQ = loadedYear?.activeQuarterNumber || profile?.quarter || 1;
    setSelectedQuarter(activeQ);

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
    } catch {
      setIsSystemInitialized(false);
    }

    try {
      await initDB();
      const profile = await refreshStateFromLocalDB();

      // Check unlock status in session
      const sessionUnlocked = sessionStorage.getItem('gofamint_unlocked');
      const sessionClassId = sessionStorage.getItem('gofamint_unlocked_class_id');
      if (sessionUnlocked === 'true' && profile && sessionClassId === profile.id) {
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
  const syncWithCloud = async (silent = true) => {
    if (!cloudUser || profileResolution !== 'ready' || !currentUserProfile?.role) return;
    if (!silent) {
      setIsSyncing(true);
      setSyncStatusText('Syncing with central database…');
    }
    try {
      const scope: SyncScope = {
        roleType: currentUserProfile.role,
        classId: currentUserProfile.classId,
        targetOversightPortal: oversightTarget?.type === 'CLASS' ? 'CLASS_REGISTER' : oversightTarget?.type === 'WORKERS' ? 'WORKERS' : undefined,
        targetOversightClassId: oversightTarget?.classId,
      };
      const result = await runFullCloudSyncCycle(scope);
      await refreshStateFromLocalDB();
      if (result.ok) {
        setSyncStatusText(
          result.pendingRetries > 0
            ? `Synced — ${result.pendingRetries} change(s) still waiting to reach the cloud`
            : 'Synced with central database'
        );
      } else {
        setSyncStatusText(`Cloud sync issue: ${result.error || getLastHydrationError() || 'unknown error'}`);
      }
    } catch (err: any) {
      console.error('Cloud sync cycle failed:', err);
      setSyncStatusText(`Cloud sync issue: ${err?.message || 'unknown error'}`);
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
      targetOversightPortal: oversightTarget?.type === 'CLASS' ? 'CLASS_REGISTER' : oversightTarget?.type === 'WORKERS' ? 'WORKERS' : undefined,
      targetOversightClassId: oversightTarget?.classId,
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
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnlineReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser, currentUserProfile?.role, currentUserProfile?.classId, oversightTarget, profileResolution]);

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

  // Archive Quarter Handler
  const handleArchiveQuarter = async (qNum: QuarterNumber) => {
    const updatedYear = await archiveQuarterForRegister(qNum);
    setSundaySchoolYear(updatedYear);
    if (classProfile) {
      await loadClassQuarterData(classProfile.id, selectedQuarter);
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
    if (selectedProfile) {
      await putInStore<ClassProfile>('classProfile', selectedProfile, true);
      setClassProfile(selectedProfile);
    }
    if (!target) {
      setIsRegisteringNew(true);
      setIsAuthModalOpen(true);
    } else if (target.approvalStatus === 'PENDING_APPROVAL') {
      alert(`Class "${target.className}" is pending approval from the General Superintendent or General Secretary. Once approved in the Admin Portal, access will be granted.`);
    } else {
      const currentUnlockedId = sessionStorage.getItem('gofamint_unlocked_class_id');
      if (isUnlocked && currentUnlockedId === target.id) {
        setShowOpeningPage(false);
        setActiveTab('GRADING_MATRIX');
        setSelectedWeek(1);
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
    await saveClassProfile(newProfile);
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
    if (classProfile?.approvalStatus === 'PENDING_APPROVAL') {
      alert(`Class "${classProfile.className}" is pending authorization from the General Superintendent or General Secretary. Please have an administrator approve it in the Admin Portal first.`);
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

  // Visitor to Student Conversion
  const handleConvertVisitorToStudent = async (memberId: string) => {
    if (!classProfile) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const currentEnr = member.quarterEnrollments || {};
    currentEnr[selectedQuarter] = {
      ...(currentEnr[selectedQuarter] || { quarterNumber: selectedQuarter, status: 'ACTIVE', firstLessonWeek: 1 }),
      memberType: 'STUDENT'
    };

    const converted: Member = {
      ...member,
      memberType: 'STUDENT',
      quarterEnrollments: currentEnr,
      convertedFromVisitorAtLesson: selectedWeek,
      updatedAt: new Date().toISOString()
    };

    await saveMemberToDB(converted, selectedQuarter);
    await loadClassQuarterData(classProfile.id, selectedQuarter);

    await addToSyncQueue({
      id: `sync_convert_${memberId}_${Date.now()}`,
      action: 'UPDATE',
      entity: 'MEMBER',
      data: converted,
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
      }
    } catch (err: any) {
      console.warn('Sync push notification:', err.message);
      setSyncStatusText('Offline - Changes Queued');
    } finally {
      setIsSyncing(false);
    }
    // Always also retry/flush anything pending to the central Supabase database —
    // this is the sync path that actually reaches every other device, regardless
    // of whether the optional local-network Host Server above was reachable.
    await syncWithCloud(false);
  };

  const handlePullSync = async () => {
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
      }
    } catch (err: any) {
      console.warn('Sync pull notification:', err.message);
      setSyncStatusText('Offline Mode (Local IndexedDB)');
    } finally {
      setIsSyncing(false);
    }
    // Always also pull the latest state from the central Supabase database —
    // this is what actually picks up changes made on other devices, regardless
    // of whether the optional local-network Host Server above was reachable.
    await syncWithCloud(false);
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
    return consecutive >= 2;
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

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 rounded-2xl p-8 text-center shadow-2xl space-y-4 border border-amber-400/40">
          {isLoadingProfile ? (
            <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-800 font-black text-xl">!</div>
          )}
          <h2 className="text-lg font-bold text-slate-900 font-['Cinzel',serif]">{title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isLoadingProfile
              ? 'Confirming the application role assigned to your signed-in account…'
              : profileResolutionError || 'Your account could not be resolved.'}
          </p>
          {!isLoadingProfile && (
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
          )}
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
          onBackToPortalSelect={() => {
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
          onEnterWorkersModule={() => {
            void handleEnterOversight('WORKERS');
          }}
          onLockProfile={() => {
            sessionStorage.setItem('gofamint_profile_locked', 'true');
            setIsProfileLocked(true);
          }}
          onEnterOversight={handleEnterOversight}
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
          onEnterClass={handleEnterClassFromWelcome}
          onEnterAdminPortal={() => {
            setShowOpeningPage(false);
            setShowAdminPortal(true);
          }}
          onEnterWorkersModule={() => {
            setShowOpeningPage(false);
            setShowWorkersModule(true);
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* 4-Quarter Global Selector & Status Bar */}
        <QuarterSelectorBar
          selectedQuarter={selectedQuarter}
          activeQuarterNumber={sundaySchoolYear?.activeQuarterNumber || classProfile?.quarter || 1}
          sundaySchoolYear={sundaySchoolYear}
          onSelectQuarter={handleQuarterChange}
          onArchiveQuarter={handleArchiveQuarter}
        />

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
            currencySymbol={currencySymbol}
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
            currentWeek={selectedWeek}
            classProfile={classProfile}
            activeLessons={currentQuarterLessons}
            selectedQuarterNumber={selectedQuarter}
            onSaveAbsenceLog={handleSaveAbsenceLog}
            onUpdateMemberStatus={handleUpdateMemberStatus}
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
