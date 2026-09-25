import {
  cloudGetClassProfile,
  cloudGetAllClasses,
  cloudSaveClassProfile,
  cloudDeleteClass,
  cloudGetAllMembers,
  cloudGetMember,
  cloudSaveMember,
  cloudSaveBulkMembers,
  cloudDeleteMember,
  cloudGetAllGrades,
  cloudSaveGrade,
  cloudSaveBulkGrades,
  cloudDeleteGrade,
  cloudGetAllOfferings,
  cloudSaveOffering,
  cloudSaveBulkOfferings,
  cloudDeleteOffering,
  cloudGetAllAbsenceLogs,
  cloudSaveAbsenceLog,
  cloudDeleteAbsenceLog,
  cloudGetAllReferrals,
  cloudSaveReferral,
  cloudDeleteReferral,
  cloudGetAllWorkers,
  cloudSaveWorker,
  cloudSaveBulkWorkers,
  cloudDeleteWorker,
  cloudGetAllWorkerAttendance,
  cloudSaveWorkerAttendance,
  cloudSaveBulkWorkerAttendance,
  cloudDeleteWorkerAttendance,
  cloudGetAllWorkerPrepAttendance,
  cloudSaveWorkerPrepAttendance,
  cloudSaveBulkWorkerPrepAttendance,
  cloudGetAllAdminProfiles,
  cloudSaveAdminProfile,
  cloudDeleteAdminProfile,
  cloudGetAllAdminComments,
  cloudSaveAdminComment,
  cloudDeleteAdminComment,
  cloudGetAllTreasuryExpenditures,
  cloudSaveTreasuryExpenditure,
  cloudDeleteTreasuryExpenditure,
  cloudGetSundaySchoolYear,
  cloudSaveSundaySchoolYear,
  cloudGetAllDepartments,
  cloudSaveDepartment,
  cloudDeleteDepartment,
  cloudGetClockInConfig,
  cloudSaveClockInConfig,
  cloudGetAllWorkerCategories,
  cloudSaveWorkerCategory,
  cloudDeleteWorkerCategory,
  cloudGetAllSpecialEvents,
  cloudDeleteSpecialEvent,
  cloudGetAllSpecialEventAttendance,
  cloudDeleteSpecialEventAttendance,
  cloudGetAllLessons,
  cloudSaveLesson,
  fetchCollection,
  fetchCollectionScoped,
} from './supabaseDatabase';
import {
  subscribeToCollection,
  subscribeToClassGrades,
  subscribeToClassMembers,
  subscribeToClassAbsenceLogs,
  subscribeToClassOfferings,
  subscribeToClassAdminComments,
} from './supabaseDatabase';
import {
  putInStore,
  deleteFromStore,
  getDB,
  replaceStoreContents,
  mergeStoreContents,
  retryFailedCloudPushes,
  getPendingCloudSyncFailures,
  getAllWorkers
} from '../db/indexedDB';
import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  EvangelismReferralRecord,
  AdminProfile,
  SundaySchoolYear,
  WorkerProfile,
  WorkerAttendanceRecord,
  WorkerPrepAttendanceRecord,
  ClockInConfig,
  WorkerCategoryDef,
  SpecialWorkersEvent,
  SpecialEventAttendanceRecord,
  AdminComment,
  TreasuryExpenditure,
  LessonInfo,
  QuarterNumber,
  EnrollmentCertificationRecord
} from '../types';
import { ScopedTaskCoordinator } from '../utils/scopedTaskCoordinator';

/**
 * SCOPED CLOUD SYNCHRONIZATION & REAL-TIME EVENT STREAMING
 * 
 * Optimized for production: downloads and streams ONLY the data legitimately
 * required by the current user's role, accessible modules, and class scope.
 * 
 * Preserves 100% of cross-role workflows without broad unneeded database reads.
 */

export interface SyncScope {
  roleType?: string;
  classId?: string;
  targetOversightPortal?: string;
  targetOversightClassId?: string;
}

let lastHydrationError: string | null = null;
const hydrationCoordinator = new ScopedTaskCoordinator<{ ok: boolean; error?: string }>();
let activeUnsubscribes: (() => void)[] = [];
let currentActiveScopeKey: string | null = null;
let syncDebounceTimer: number | null = null;
const pendingSyncStores = new Set<string>();

export function getLastHydrationError(): string | null {
  return lastHydrationError;
}

// Development diagnostics logger (non-invasive, no cloud reads/writes)
function logSyncDiagnostic(event: string, details?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
    console.log(`[SyncDiagnostics] ${event}`, details || {});
  }
}

// Auto-seed is intentionally disabled; local legacy data is never implicitly uploaded.
export async function seedCloudFromLocalIfEmpty(): Promise<void> {
  // SECURITY FIX: Never push local legacy data to the cloud automatically.
  return;
}

// -------------------------------------------------------------------------
// ROLE-SCOPED CLOUD -> LOCAL HYDRATION
// -------------------------------------------------------------------------

/**
 * Hydrates local IndexedDB from Supabase scoped strictly to the
 * authenticated user's role and classId.
 */
function getScopeKey(scope?: SyncScope): string {
  return [
    scope?.roleType || 'anon',
    scope?.classId || 'noclass',
    scope?.targetOversightPortal || 'no-oversight',
    scope?.targetOversightClassId || 'no-oversight-class',
  ].join(':');
}

export function hydrateLocalFromCloud(scope?: SyncScope): Promise<{ ok: boolean; error?: string }> {
  const scopeKey = getScopeKey(scope);
  return hydrationCoordinator.run(scopeKey, () => performHydration(scope, scopeKey));
}

async function performHydration(scope: SyncScope | undefined, scopeKey: string): Promise<{ ok: boolean; error?: string }> {
  const role = scope?.roleType || '';
  const classId = scope?.classId;
  const oversightPortal = scope?.targetOversightPortal;
  const oversightClassId = scope?.targetOversightClassId;

  logSyncDiagnostic('HYDRATION_START', { role, classId, oversightPortal, oversightClassId, scopeKey });

  try {
    // 1. Shared core configuration (Lightweight, common to all users)
    const [cloudYear, cloudDepts] = await Promise.all([
      fetchCollection<SundaySchoolYear>('sundaySchoolYear'),
      fetchCollection<{ id: string; name: string }>('departments')
    ]);

    await replaceStoreContents('sundaySchoolYear', cloudYear);
    await replaceStoreContents('departments', cloudDepts.map(d => ({ name: d.name || d.id })));

    // 2. Role-specific collection hydration
    const isTeacherRole = ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(role);
    const isTreasurerRole = role === 'TREASURER';
    const isRecordOfficerRole = role === 'RECORD_OFFICER';
    const isEnrollmentOfficerRole = role === 'ENROLLMENT_OFFICER';
    const isDepartmentSuperintendentRole = role === 'DEPARTMENT_SUPERINTENDENT';
    const isAsstGenSecRole = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'].includes(role);
    // The Assistant General Secretary can open the Workers Directorate, but
    // their ordinary admin dashboard must not download every worker record.
    // Only a personal worker login or an explicitly opened Workers portal gets
    // the heavy workers datasets.
    const isWorkersDirectorateScope = role === 'WORKER' || oversightPortal === 'WORKERS';
    const isGenSecRole = role === 'GENERAL_SECRETARY';
    const isSuperintendentRole = ['GENERAL_SUPERINTENDENT', 'SUPER_ADMIN'].includes(role);

    if (isWorkersDirectorateScope) {
      // Workers Directorate: workers, attendance, prep attendance, categories, events
      const [cloudWorkers, cloudCats, cloudAtt, cloudPrep, cloudCfg, cloudEvts, cloudEvtAtt, cloudProfiles, cloudClasses] = await Promise.all([
        fetchCollection<WorkerProfile>('workers'),
        fetchCollection<WorkerCategoryDef>('workerCategories'),
        fetchCollection<WorkerAttendanceRecord>('workerAttendance'),
        fetchCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance'),
        fetchCollection<ClockInConfig>('clockInConfig'),
        fetchCollection<SpecialWorkersEvent>('specialEvents'),
        fetchCollection<SpecialEventAttendanceRecord>('specialEventAttendance'),
        fetchCollection<AdminProfile>('adminProfiles'),
        fetchCollection<ClassProfile>('classes')
      ]);

      // Supabase is authoritative for event lifecycle state. An empty result
      // must clear stale browser copies after the final event is deleted.

      await Promise.all([
        replaceStoreContents('workers', cloudWorkers),
        replaceStoreContents('workerCategories', cloudCats),
        replaceStoreContents('workerAttendance', cloudAtt),
        replaceStoreContents('workerPrepAttendance', cloudPrep),
        replaceStoreContents('clockInConfig', cloudCfg),
        replaceStoreContents('specialEvents', cloudEvts),
        replaceStoreContents('specialEventAttendance', cloudEvtAtt),
        replaceStoreContents('adminProfiles', cloudProfiles),
        replaceStoreContents('allClasses', cloudClasses)
      ]);
    } else if (isTeacherRole && classId) {
      // Teacher / Class Secretary: strictly query their assigned class records
      const [clsMembers, clsGrades, clsOfferings, clsAbsence, clsComments, clsLessons, cloudClasses] = await Promise.all([
        fetchCollectionScoped<Member>('members', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<WeeklyGradeRecord>('grades', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<WeeklyOfferingRecord>('offerings', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<AbsenceLogRecord>('absenceLogs', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<AdminComment>('adminComments', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollection<LessonInfo>('lessons'),
        fetchCollection<ClassProfile>('classes'),
      ]);

      await Promise.all([
        replaceStoreContents('members', clsMembers),
        replaceStoreContents('grades', clsGrades),
        replaceStoreContents('offerings', clsOfferings),
        replaceStoreContents('absenceLogs', clsAbsence),
        replaceStoreContents('adminComments', clsComments),
        replaceStoreContents('lessons', clsLessons),
        replaceStoreContents('allClasses', cloudClasses),
      ]);

      const matchedProfile = cloudClasses.find(c => c.id === classId);
      if (matchedProfile) {
        await replaceStoreContents('classProfile', [matchedProfile]);
      }

      // Pre-populate workers directory via server endpoint so class setup & teacher selection are always populated
      await getAllWorkers(true);
    } else if (isDepartmentSuperintendentRole) {
      // Supabase RLS returns only rows belonging to the signed-in officer's department.
      // Replace (rather than merge) these stores so data cached by a previous login cannot leak.
      const [cloudClasses, cloudMembers, cloudGrades] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<Member>('members'),
        fetchCollection<WeeklyGradeRecord>('grades'),
      ]);
      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('members', cloudMembers),
        replaceStoreContents('grades', cloudGrades),
        replaceStoreContents('offerings', []),
        replaceStoreContents('workers', []),
      ]);
    } else if (isTreasurerRole) {
      // Treasurer: all class offerings across quarters and expenditures
      const [cloudOfferings, cloudExp, cloudClasses] = await Promise.all([
        fetchCollection<WeeklyOfferingRecord>('offerings'),
        fetchCollection<TreasuryExpenditure>('treasuryExpenditures'),
        fetchCollection<ClassProfile>('classes')
      ]);

      await Promise.all([
        replaceStoreContents('offerings', cloudOfferings),
        replaceStoreContents('treasuryExpenditures', cloudExp),
        replaceStoreContents('allClasses', cloudClasses)
      ]);
    } else if (isRecordOfficerRole) {
      // Record Officer: class directory, members, grades, offerings for overall attendance collation + workers directory
      const [cloudClasses, cloudMembers, cloudGrades, cloudOfferings, cloudWorkers, cloudAtt, cloudPrep, cloudCats, cloudEvts] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<Member>('members'),
        fetchCollection<WeeklyGradeRecord>('grades'),
        fetchCollection<WeeklyOfferingRecord>('offerings'),
        fetchCollection<WorkerProfile>('workers'),
        fetchCollection<WorkerAttendanceRecord>('workerAttendance'),
        fetchCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance'),
        fetchCollection<WorkerCategoryDef>('workerCategories'),
        fetchCollection<SpecialWorkersEvent>('specialEvents')
      ]);

      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('members', cloudMembers),
        replaceStoreContents('grades', cloudGrades),
        replaceStoreContents('offerings', cloudOfferings),
        replaceStoreContents('workers', cloudWorkers),
        replaceStoreContents('workerAttendance', cloudAtt),
        replaceStoreContents('workerPrepAttendance', cloudPrep),
        replaceStoreContents('workerCategories', cloudCats),
        replaceStoreContents('specialEvents', cloudEvts)
      ]);
    } else if (isEnrollmentOfficerRole) {
      // Enrollment Officer: class directory, members, grades for visitor progression & certification
      const [cloudClasses, cloudMembers, cloudGrades, cloudCertifications] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<Member>('members'),
        fetchCollection<WeeklyGradeRecord>('grades'),
        fetchCollection<EnrollmentCertificationRecord>('enrollmentCertifications')
      ]);

      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('members', cloudMembers),
        replaceStoreContents('grades', cloudGrades),
        replaceStoreContents('enrollmentCertifications', cloudCertifications)
      ]);
    } else if (isGenSecRole) {
      // General Secretary: classes, departments, admin profiles, comments, curriculum
      const [cloudClasses, cloudProfiles, cloudComments, cloudLessons] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<AdminProfile>('adminProfiles'),
        fetchCollection<AdminComment>('adminComments'),
        fetchCollection<LessonInfo>('lessons')
      ]);

      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('adminProfiles', cloudProfiles),
        replaceStoreContents('adminComments', cloudComments),
        replaceStoreContents('lessons', cloudLessons)
      ]);
    } else if (isSuperintendentRole) {
      // General Superintendent: lightweight executive summary and council data.
      // Workers data is loaded only after entering Workers oversight.
      const [cloudClasses, cloudProfiles, cloudComments] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<AdminProfile>('adminProfiles'),
        fetchCollection<AdminComment>('adminComments')
      ]);

      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('adminProfiles', cloudProfiles),
        replaceStoreContents('adminComments', cloudComments)
      ]);

      // If inspecting a specific class in Oversight Mode:
      if (oversightPortal === 'CLASS_REGISTER' && oversightClassId) {
        const [targetMems, targetGrades, targetOffs, targetAbs] = await Promise.all([
          fetchCollectionScoped<Member>('members', [{ field: 'classId', op: '==', value: oversightClassId }]),
          fetchCollectionScoped<WeeklyGradeRecord>('grades', [{ field: 'classId', op: '==', value: oversightClassId }]),
          fetchCollectionScoped<WeeklyOfferingRecord>('offerings', [{ field: 'classId', op: '==', value: oversightClassId }]),
          fetchCollectionScoped<AbsenceLogRecord>('absenceLogs', [{ field: 'classId', op: '==', value: oversightClassId }])
        ]);

        await Promise.all([
          replaceStoreContents('members', targetMems),
          replaceStoreContents('grades', targetGrades),
          replaceStoreContents('offerings', targetOffs),
          replaceStoreContents('absenceLogs', targetAbs)
        ]);
      }
    } else {
      // Fallback for initial gate: load classes directory
      const cloudClasses = await fetchCollection<ClassProfile>('classes');
      await replaceStoreContents('allClasses', cloudClasses);
    }

    localStorage.removeItem('gofamint_scratch_mode');
    lastHydrationError = null;
    logSyncDiagnostic('HYDRATION_COMPLETE', { role, classId, scopeKey });
    return { ok: true };
  } catch (err: any) {
    const message = err?.message || 'Unknown cloud sync error';
    console.error('[cloud hydration] failed:', err);
    lastHydrationError = message;
    return { ok: false, error: message };
  }
}

// One full sync cycle for the current user's scope
export async function runFullCloudSyncCycle(scope?: SyncScope): Promise<{ ok: boolean; error?: string; pendingRetries: number }> {
  await retryFailedCloudPushes().catch((err) => console.warn('[cloud sync] retry pass failed:', err));
  const result = await hydrateLocalFromCloud(scope);
  const pending = await getPendingCloudSyncFailures().catch((error) => {
    console.error('[cloud sync] Could not inspect the durable retry queue:', error);
    return [];
  });
  return { ...result, pendingRetries: pending.length };
}

// -------------------------------------------------------------------------
// REAL-TIME SUPABASE EVENT STREAMING (ROLE & SCOPE BASED)
// -------------------------------------------------------------------------

export function stopRealtimeCloudSync(): void {
  if (activeUnsubscribes.length > 0) {
    logSyncDiagnostic('STOPPING_LISTENERS', { count: activeUnsubscribes.length });
    activeUnsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.warn('[RealtimeSync] Error unsubscribing:', e);
      }
    });
    activeUnsubscribes = [];
  }
  currentActiveScopeKey = null;
}

/**
 * Starts Supabase Realtime listeners scoped strictly to the current user's role.
 * Avoids duplicate listeners if already active for the same role and class scope.
 */
export function startRealtimeCloudSync(scope: SyncScope, onSyncCallback: (stores: string[]) => void): () => void {
  const scopeKey = `${scope.roleType || 'anon'}_${scope.classId || 'noclass'}_${scope.targetOversightPortal || 'noov'}_${scope.targetOversightClassId || 'noovclass'}`;

  // Singleton check: If listeners are already active for this exact scope, do not recreate!
  if (currentActiveScopeKey === scopeKey && activeUnsubscribes.length > 0) {
    logSyncDiagnostic('REUSING_ACTIVE_LISTENERS', { scopeKey, count: activeUnsubscribes.length });
    return stopRealtimeCloudSync;
  }

  stopRealtimeCloudSync();
  currentActiveScopeKey = scopeKey;

  const notifyChange = (store?: string) => {
    if (store) pendingSyncStores.add(store);
    if (syncDebounceTimer) {
      window.clearTimeout(syncDebounceTimer);
    }
    syncDebounceTimer = window.setTimeout(() => {
      const stores = Array.from(pendingSyncStores);
      pendingSyncStores.clear();
      try {
        if (typeof window !== 'undefined') {
          const detail = { store: stores.length === 1 ? stores[0] : undefined, stores, source: 'remote' };
          window.dispatchEvent(new CustomEvent('gofamint:sync-update', { detail }));
          if (stores.length === 0 || stores.some(changedStore => ['workers', 'workerAttendance', 'workerPrepAttendance', 'specialEvents', 'specialEventAttendance', 'workerCategories', 'clockInConfig'].includes(changedStore))) {
            window.dispatchEvent(new CustomEvent('gofamint:worker-sync', { detail }));
          }
        }
      } catch (error) {
        console.error('[RealtimeSync] Failed to notify the active views:', error);
      }
      onSyncCallback(stores);
    }, 80);
  };

  const role = scope.roleType || '';
  const classId = scope.classId;
  const oversightPortal = scope.targetOversightPortal;
  const oversightClassId = scope.targetOversightClassId;

  logSyncDiagnostic('STARTING_SCOPED_LISTENERS', { role, classId, oversightPortal, oversightClassId });

  // 1. Shared core reference listeners
  try {
    const unsubYear = subscribeToCollection<SundaySchoolYear>('sundaySchoolYear', async (cloudYear) => {
      try {
        await mergeStoreContents('sundaySchoolYear', cloudYear);
        notifyChange('sundaySchoolYear');
      } catch (err) {
        console.error('[RealtimeSync] Failed to store sundaySchoolYear:', err);
      }
    });
    activeUnsubscribes.push(unsubYear);
  } catch (err) {
    console.error('[RealtimeSync] Failed to subscribe to sundaySchoolYear:', err);
  }

  const isAnyAdminRole = [
    'SUPER_ADMIN',
    'GENERAL_SUPERINTENDENT',
    'GENERAL_SECRETARY',
    'ASST_GENERAL_SECRETARY',
    'ASSISTANT_GENERAL_SECRETARY',
    'TREASURER',
    'RECORD_OFFICER',
    'ENROLLMENT_OFFICER'
  ].includes(role);
  const isTeacherRole = ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(role);
  const isTreasurerRole = role === 'TREASURER';
  const isRecordOfficerRole = role === 'RECORD_OFFICER';
  const isEnrollmentOfficerRole = role === 'ENROLLMENT_OFFICER';
  const isDepartmentSuperintendentRole = role === 'DEPARTMENT_SUPERINTENDENT';
  const isAsstGenSecRole = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'].includes(role);
  const isWorkersDirectorateScope = role === 'WORKER' || oversightPortal === 'WORKERS';
  const isGenSecRole = role === 'GENERAL_SECRETARY';
  const isSuperintendentRole = ['GENERAL_SUPERINTENDENT', 'SUPER_ADMIN'].includes(role);

  // Curriculum and directory reference data is shared by class and
  // administrative portals. Subscribe only for roles that display it so a
  // General Secretary update appears immediately without polling or reload.
  if (isAnyAdminRole || isTeacherRole || isDepartmentSuperintendentRole) {
    try {
      const unsubLessons = subscribeToCollection<LessonInfo>('lessons', async (lessonUpdates) => {
        await mergeStoreContents('lessons', lessonUpdates);
        notifyChange('lessons');
      });
      activeUnsubscribes.push(unsubLessons);

      const unsubDepartments = subscribeToCollection<{ id: string; name: string }>('departments', async (departmentUpdates) => {
        await mergeStoreContents('departments', departmentUpdates);
        notifyChange('departments');
      });
      activeUnsubscribes.push(unsubDepartments);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach curriculum reference listeners:', err);
    }
  }

  // 2. Workers Directorate Real-time Listeners (Active for ALL Admin Profiles & Workers Scope)
  if (isWorkersDirectorateScope) {
    try {
      const unsubWorkers = subscribeToCollection<WorkerProfile>('workers', async (wrks) => {
        await mergeStoreContents('workers', wrks);
        notifyChange('workers');
      });
      activeUnsubscribes.push(unsubWorkers);

      const unsubAtt = subscribeToCollection<WorkerAttendanceRecord>('workerAttendance', async (atts) => {
        await mergeStoreContents('workerAttendance', atts);
        notifyChange('workerAttendance');
      });
      activeUnsubscribes.push(unsubAtt);

      const unsubPrep = subscribeToCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance', async (preps) => {
        await mergeStoreContents('workerPrepAttendance', preps);
        notifyChange('workerPrepAttendance');
      });
      activeUnsubscribes.push(unsubPrep);

      const unsubCats = subscribeToCollection<WorkerCategoryDef>('workerCategories', async (cats) => {
        await mergeStoreContents('workerCategories', cats);
        notifyChange('workerCategories');
      });
      activeUnsubscribes.push(unsubCats);

      const unsubEvts = subscribeToCollection<SpecialWorkersEvent>('specialEvents', async (evts) => {
        await mergeStoreContents('specialEvents', evts);
        notifyChange('specialEvents');
      });
      activeUnsubscribes.push(unsubEvts);

      const unsubEvtAtt = subscribeToCollection<SpecialEventAttendanceRecord>('specialEventAttendance', async (evtAtts) => {
        await mergeStoreContents('specialEventAttendance', evtAtts);
        notifyChange('specialEventAttendance');
      });
      activeUnsubscribes.push(unsubEvtAtt);

      const unsubCfg = subscribeToCollection<ClockInConfig>('clockInConfig', async (cfgs) => {
        if (cfgs.length > 0) {
          await mergeStoreContents('clockInConfig', cfgs);
          notifyChange('clockInConfig');
        }
      });
      activeUnsubscribes.push(unsubCfg);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach worker listeners:', err);
    }
  }

  // 3. Role-specific listeners. When an administrator explicitly enters the
  // Workers Directorate, the workers listeners above are the active scope;
  // attaching the ordinary executive/records listeners as well wastes
  // Realtime channels and can time out on the free Supabase tier.
  if (!isWorkersDirectorateScope) {
  if (isTeacherRole && classId && !isAnyAdminRole) {
    try {
      const unsubMembers = subscribeToClassMembers(classId, async (mems) => {
        await mergeStoreContents('members', mems);
        notifyChange('members');
      });
      activeUnsubscribes.push(unsubMembers);

      const unsubGrades = subscribeToClassGrades(classId, async (grds) => {
        await mergeStoreContents('grades', grds);
        notifyChange('grades');
      });
      activeUnsubscribes.push(unsubGrades);

      const unsubOfferings = subscribeToClassOfferings(classId, async (offs) => {
        await mergeStoreContents('offerings', offs);
        notifyChange('offerings');
      });
      activeUnsubscribes.push(unsubOfferings);

      const unsubAbsence = subscribeToClassAbsenceLogs(classId, async (logs) => {
        await mergeStoreContents('absenceLogs', logs);
        notifyChange('absenceLogs');
      });
      activeUnsubscribes.push(unsubAbsence);

      const unsubComments = subscribeToClassAdminComments(classId, async (comms) => {
        await mergeStoreContents('adminComments', comms);
        notifyChange('adminComments');
      });
      activeUnsubscribes.push(unsubComments);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach class-scoped listeners:', err);
    }
  } else if (isDepartmentSuperintendentRole) {
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await mergeStoreContents('allClasses', clss);
        notifyChange('allClasses');
      });
      const unsubMembers = subscribeToCollection<Member>('members', async (mems) => {
        await mergeStoreContents('members', mems);
        notifyChange('members');
      });
      const unsubGrades = subscribeToCollection<WeeklyGradeRecord>('grades', async (grds) => {
        await mergeStoreContents('grades', grds);
        notifyChange('grades');
      });
      activeUnsubscribes.push(unsubClasses, unsubMembers, unsubGrades);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach department superintendent listeners:', err);
    }
  } else if (isTreasurerRole) {
    // Treasurer: offerings & treasury expenditures across all classes
    try {
      const unsubOfferings = subscribeToCollection<WeeklyOfferingRecord>('offerings', async (offs) => {
        await mergeStoreContents('offerings', offs);
        notifyChange('offerings');
      });
      activeUnsubscribes.push(unsubOfferings);

      const unsubExp = subscribeToCollection<TreasuryExpenditure>('treasuryExpenditures', async (exps) => {
        await mergeStoreContents('treasuryExpenditures', exps);
        notifyChange('treasuryExpenditures');
      });
      activeUnsubscribes.push(unsubExp);

      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await mergeStoreContents('allClasses', clss);
        notifyChange('allClasses');
      });
      activeUnsubscribes.push(unsubClasses);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach treasurer listeners:', err);
    }
  } else if (isRecordOfficerRole) {
    // Record Officer: attendance collation across all classes
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await mergeStoreContents('allClasses', clss);
        notifyChange('allClasses');
      });
      activeUnsubscribes.push(unsubClasses);

      const unsubMembers = subscribeToCollection<Member>('members', async (mems) => {
        await mergeStoreContents('members', mems);
        notifyChange('members');
      });
      activeUnsubscribes.push(unsubMembers);

      const unsubGrades = subscribeToCollection<WeeklyGradeRecord>('grades', async (grds) => {
        await mergeStoreContents('grades', grds);
        notifyChange('grades');
      });
      activeUnsubscribes.push(unsubGrades);

      const unsubOfferings = subscribeToCollection<WeeklyOfferingRecord>('offerings', async (offs) => {
        await mergeStoreContents('offerings', offs);
        notifyChange('offerings');
      });
      activeUnsubscribes.push(unsubOfferings);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach record officer listeners:', err);
    }
  } else if (isEnrollmentOfficerRole) {
    // Enrollment Officer: progression & certification across all classes
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await mergeStoreContents('allClasses', clss);
        notifyChange('allClasses');
      });
      activeUnsubscribes.push(unsubClasses);

      const unsubMembers = subscribeToCollection<Member>('members', async (mems) => {
        await mergeStoreContents('members', mems);
        notifyChange('members');
      });
      activeUnsubscribes.push(unsubMembers);

      const unsubGrades = subscribeToCollection<WeeklyGradeRecord>('grades', async (grds) => {
        await mergeStoreContents('grades', grds);
        notifyChange('grades');
      });
      activeUnsubscribes.push(unsubGrades);

      const unsubCertifications = subscribeToCollection<EnrollmentCertificationRecord>('enrollmentCertifications', async (records) => {
        await mergeStoreContents('enrollmentCertifications', records);
        notifyChange('enrollmentCertifications');
      });
      activeUnsubscribes.push(unsubCertifications);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach enrollment officer listeners:', err);
    }
  } else if (isAsstGenSecRole) {
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        if (clss.length > 0) {
          await mergeStoreContents('allClasses', clss);
          notifyChange('allClasses');
        }
      });
      activeUnsubscribes.push(unsubClasses);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach asst gen sec class listeners:', err);
    }
  } else if (isGenSecRole || isSuperintendentRole) {
    // Executive Administration
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await mergeStoreContents('allClasses', clss);
        notifyChange('allClasses');
      });
      activeUnsubscribes.push(unsubClasses);

      const unsubProfiles = subscribeToCollection<AdminProfile>('adminProfiles', async (profs) => {
        await mergeStoreContents('adminProfiles', profs);
        notifyChange('adminProfiles');
      });
      activeUnsubscribes.push(unsubProfiles);

      const unsubComments = subscribeToCollection<AdminComment>('adminComments', async (comms) => {
        await mergeStoreContents('adminComments', comms);
        notifyChange('adminComments');
      });
      activeUnsubscribes.push(unsubComments);

      // Oversight Mode targeted listeners
      if (oversightPortal === 'CLASS_REGISTER' && oversightClassId) {
        const unsubTargetMems = subscribeToClassMembers(oversightClassId, async (mems) => {
          await mergeStoreContents('members', mems);
          notifyChange('members');
        });
        activeUnsubscribes.push(unsubTargetMems);

        const unsubTargetGrades = subscribeToClassGrades(oversightClassId, async (grds) => {
          await mergeStoreContents('grades', grds);
          notifyChange('grades');
        });
        activeUnsubscribes.push(unsubTargetGrades);

        const unsubTargetOffs = subscribeToClassOfferings(oversightClassId, async (offs) => {
          await mergeStoreContents('offerings', offs);
          notifyChange('offerings');
        });
        activeUnsubscribes.push(unsubTargetOffs);

        const unsubTargetAbs = subscribeToClassAbsenceLogs(oversightClassId, async (logs) => {
          await mergeStoreContents('absenceLogs', logs);
          notifyChange('absenceLogs');
        });
        activeUnsubscribes.push(unsubTargetAbs);
      }
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach executive listeners:', err);
    }
  }
  }

  logSyncDiagnostic('LISTENERS_ACTIVE', { activeCount: activeUnsubscribes.length, scopeKey });
  return stopRealtimeCloudSync;
}
