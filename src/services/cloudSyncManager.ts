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
  cloudSaveSpecialEvent,
  cloudDeleteSpecialEvent,
  cloudGetAllSpecialEventAttendance,
  cloudSaveSpecialEventAttendance,
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
  getAllFromStore,
  putInStore,
  deleteFromStore,
  getDB,
  replaceStoreContents,
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
  QuarterNumber
} from '../types';

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

let isHydrating = false;
let lastHydrationError: string | null = null;
let activeUnsubscribes: (() => void)[] = [];
let currentActiveScopeKey: string | null = null;
let syncDebounceTimer: number | null = null;

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
export async function hydrateLocalFromCloud(scope?: SyncScope): Promise<{ ok: boolean; error?: string }> {
  if (isHydrating) return { ok: true };
  isHydrating = true;
  const role = scope?.roleType || '';
  const classId = scope?.classId;
  const oversightPortal = scope?.targetOversightPortal;
  const oversightClassId = scope?.targetOversightClassId;

  logSyncDiagnostic('HYDRATION_START', { role, classId, oversightPortal, oversightClassId });

  try {
    // 1. Shared core configuration (Lightweight, common to all users)
    const [cloudYear, cloudDepts] = await Promise.all([
      fetchCollection<SundaySchoolYear>('sundaySchoolYear').catch(() => []),
      fetchCollection<{ id: string; name: string }>('departments').catch(() => [])
    ]);

    if (cloudYear.length > 0) {
      await replaceStoreContents('sundaySchoolYear', cloudYear);
    }
    if (cloudDepts.length > 0) {
      await replaceStoreContents('departments', cloudDepts.map(d => ({ name: d.name || d.id })));
    }

    // 2. Role-specific collection hydration
    const isTeacherRole = ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(role);
    const isTreasurerRole = role === 'TREASURER';
    const isRecordOfficerRole = role === 'RECORD_OFFICER';
    const isEnrollmentOfficerRole = role === 'ENROLLMENT_OFFICER';
    const isAsstGenSecRole = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'].includes(role);
    const isWorkerRole = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'WORKER'].includes(role);
    const isWorkersDirectorateScope = isWorkerRole || oversightPortal === 'WORKERS';
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
        fetchCollection<ClassProfile>('classes').catch(() => [])
      ]);

      // Safeguard special events & attendance: if cloud is empty but local has records, do not wipe!
      // Instead preserve local records and backfill to Supabase cloud.
      let finalEvts = cloudEvts;
      if (cloudEvts.length === 0) {
        const localEvts = await getAllFromStore<SpecialWorkersEvent>('specialEvents');
        if (localEvts.length > 0) {
          finalEvts = localEvts;
          for (const ev of localEvts) {
            cloudSaveSpecialEvent(ev).catch(() => {});
          }
        }
      }

      let finalEvtAtt = cloudEvtAtt;
      if (cloudEvtAtt.length === 0) {
        const localAtt = await getAllFromStore<SpecialEventAttendanceRecord>('specialEventAttendance');
        if (localAtt.length > 0) {
          finalEvtAtt = localAtt;
          for (const at of localAtt) {
            cloudSaveSpecialEventAttendance(at).catch(() => {});
          }
        }
      }

      await Promise.all([
        replaceStoreContents('workers', cloudWorkers),
        replaceStoreContents('workerCategories', cloudCats),
        replaceStoreContents('workerAttendance', cloudAtt),
        replaceStoreContents('workerPrepAttendance', cloudPrep),
        cloudCfg.length > 0 ? replaceStoreContents('clockInConfig', cloudCfg) : Promise.resolve(),
        replaceStoreContents('specialEvents', finalEvts),
        replaceStoreContents('specialEventAttendance', finalEvtAtt),
        replaceStoreContents('adminProfiles', cloudProfiles),
        cloudClasses.length > 0 ? replaceStoreContents('allClasses', cloudClasses) : Promise.resolve()
      ]);
    } else if (isTeacherRole && classId) {
      // Teacher / Class Secretary: strictly query their assigned class records
      const [clsMembers, clsGrades, clsOfferings, clsAbsence, clsComments, clsLessons, cloudClasses] = await Promise.all([
        fetchCollectionScoped<Member>('members', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<WeeklyGradeRecord>('grades', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<WeeklyOfferingRecord>('offerings', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<AbsenceLogRecord>('absenceLogs', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollectionScoped<AdminComment>('adminComments', [{ field: 'classId', op: '==', value: classId }]),
        fetchCollection<LessonInfo>('lessons').catch(() => []),
        fetchCollection<ClassProfile>('classes').catch(() => []),
      ]);

      await Promise.all([
        replaceStoreContents('members', clsMembers),
        replaceStoreContents('grades', clsGrades),
        replaceStoreContents('offerings', clsOfferings),
        replaceStoreContents('absenceLogs', clsAbsence),
        replaceStoreContents('adminComments', clsComments),
        clsLessons.length > 0 ? replaceStoreContents('lessons', clsLessons) : Promise.resolve(),
        cloudClasses.length > 0 ? replaceStoreContents('allClasses', cloudClasses) : Promise.resolve(),
      ]);

      const matchedProfile = cloudClasses.find(c => c.id === classId);
      if (matchedProfile) {
        await replaceStoreContents('classProfile', [matchedProfile]);
      }

      // Pre-populate workers directory via server endpoint so class setup & teacher selection are always populated
      await getAllWorkers(true).catch(() => []);
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
      // Record Officer: class directory, members, grades, offerings for overall attendance collation
      const [cloudClasses, cloudMembers, cloudGrades, cloudOfferings] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<Member>('members'),
        fetchCollection<WeeklyGradeRecord>('grades'),
        fetchCollection<WeeklyOfferingRecord>('offerings')
      ]);

      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('members', cloudMembers),
        replaceStoreContents('grades', cloudGrades),
        replaceStoreContents('offerings', cloudOfferings)
      ]);
    } else if (isEnrollmentOfficerRole) {
      // Enrollment Officer: class directory, members, grades for visitor progression & certification
      const [cloudClasses, cloudMembers, cloudGrades] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<Member>('members'),
        fetchCollection<WeeklyGradeRecord>('grades')
      ]);

      await Promise.all([
        replaceStoreContents('allClasses', cloudClasses),
        replaceStoreContents('members', cloudMembers),
        replaceStoreContents('grades', cloudGrades)
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
        cloudClasses.length > 0 ? replaceStoreContents('allClasses', cloudClasses) : Promise.resolve(),
        replaceStoreContents('adminProfiles', cloudProfiles),
        replaceStoreContents('adminComments', cloudComments),
        replaceStoreContents('lessons', cloudLessons)
      ]);
    } else if (isSuperintendentRole) {
      // General Superintendent: executive summary & council data
      const [cloudClasses, cloudProfiles, cloudComments] = await Promise.all([
        fetchCollection<ClassProfile>('classes'),
        fetchCollection<AdminProfile>('adminProfiles'),
        fetchCollection<AdminComment>('adminComments')
      ]);

      await Promise.all([
        cloudClasses.length > 0 ? replaceStoreContents('allClasses', cloudClasses) : Promise.resolve(),
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
    logSyncDiagnostic('HYDRATION_COMPLETE', { role, classId });
    return { ok: true };
  } catch (err: any) {
    const message = err?.message || 'Unknown cloud sync error';
    console.error('[cloud hydration] failed:', err);
    lastHydrationError = message;
    return { ok: false, error: message };
  } finally {
    isHydrating = false;
  }
}

// One full sync cycle for the current user's scope
export async function runFullCloudSyncCycle(scope?: SyncScope): Promise<{ ok: boolean; error?: string; pendingRetries: number }> {
  await retryFailedCloudPushes().catch((err) => console.warn('[cloud sync] retry pass failed:', err));
  const result = await hydrateLocalFromCloud(scope);
  const pending = await getPendingCloudSyncFailures().catch(() => []);
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
export function startRealtimeCloudSync(scope: SyncScope, onSyncCallback: () => void): () => void {
  const scopeKey = `${scope.roleType || 'anon'}_${scope.classId || 'noclass'}_${scope.targetOversightPortal || 'noov'}_${scope.targetOversightClassId || 'noovclass'}`;

  // Singleton check: If listeners are already active for this exact scope, do not recreate!
  if (currentActiveScopeKey === scopeKey && activeUnsubscribes.length > 0) {
    logSyncDiagnostic('REUSING_ACTIVE_LISTENERS', { scopeKey, count: activeUnsubscribes.length });
    return stopRealtimeCloudSync;
  }

  stopRealtimeCloudSync();
  currentActiveScopeKey = scopeKey;

  const notifyChange = () => {
    if (syncDebounceTimer) {
      window.clearTimeout(syncDebounceTimer);
    }
    syncDebounceTimer = window.setTimeout(() => {
      onSyncCallback();
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
        await replaceStoreContents('sundaySchoolYear', cloudYear);
        notifyChange();
      } catch (err) {
        console.error('[RealtimeSync] Failed to store sundaySchoolYear:', err);
      }
    });
    activeUnsubscribes.push(unsubYear);
  } catch (err) {
    console.error('[RealtimeSync] Failed to subscribe to sundaySchoolYear:', err);
  }

  const isTeacherRole = ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(role);
  const isTreasurerRole = role === 'TREASURER';
  const isRecordOfficerRole = role === 'RECORD_OFFICER';
  const isEnrollmentOfficerRole = role === 'ENROLLMENT_OFFICER';
  const isAsstGenSecRole = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'].includes(role);
  const isWorkerRole = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'WORKER'].includes(role);
  const isWorkersDirectorateScope = isWorkerRole || oversightPortal === 'WORKERS';
  const isGenSecRole = role === 'GENERAL_SECRETARY';
  const isSuperintendentRole = ['GENERAL_SUPERINTENDENT', 'SUPER_ADMIN'].includes(role);

  // 2. Class-scoped listeners for Teachers & Class Secretaries
  if (isWorkersDirectorateScope) {
    // Workers Directorate is an explicit, authorized destination for every
    // administrator. Its own RLS policies still determine which records may
    // be read or changed.
    try {
      const unsubWorkers = subscribeToCollection<WorkerProfile>('workers', async (wrks) => {
        await replaceStoreContents('workers', wrks);
        notifyChange();
      });
      activeUnsubscribes.push(unsubWorkers);

      const unsubAtt = subscribeToCollection<WorkerAttendanceRecord>('workerAttendance', async (atts) => {
        await replaceStoreContents('workerAttendance', atts);
        notifyChange();
      });
      activeUnsubscribes.push(unsubAtt);

      const unsubPrep = subscribeToCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance', async (preps) => {
        await replaceStoreContents('workerPrepAttendance', preps);
        notifyChange();
      });
      activeUnsubscribes.push(unsubPrep);

      const unsubCats = subscribeToCollection<WorkerCategoryDef>('workerCategories', async (cats) => {
        await replaceStoreContents('workerCategories', cats);
        notifyChange();
      });
      activeUnsubscribes.push(unsubCats);

      const unsubEvts = subscribeToCollection<SpecialWorkersEvent>('specialEvents', async (evts) => {
        await replaceStoreContents('specialEvents', evts);
        notifyChange();
      });
      activeUnsubscribes.push(unsubEvts);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach worker listeners:', err);
    }
  } else if (isTeacherRole && classId) {
    try {
      const unsubMembers = subscribeToClassMembers(classId, async (mems) => {
        await replaceStoreContents('members', mems);
        notifyChange();
      });
      activeUnsubscribes.push(unsubMembers);

      const unsubGrades = subscribeToClassGrades(classId, async (grds) => {
        await replaceStoreContents('grades', grds);
        notifyChange();
      });
      activeUnsubscribes.push(unsubGrades);

      const unsubOfferings = subscribeToClassOfferings(classId, async (offs) => {
        await replaceStoreContents('offerings', offs);
        notifyChange();
      });
      activeUnsubscribes.push(unsubOfferings);

      const unsubAbsence = subscribeToClassAbsenceLogs(classId, async (logs) => {
        await replaceStoreContents('absenceLogs', logs);
        notifyChange();
      });
      activeUnsubscribes.push(unsubAbsence);

      const unsubComments = subscribeToClassAdminComments(classId, async (comms) => {
        await replaceStoreContents('adminComments', comms);
        notifyChange();
      });
      activeUnsubscribes.push(unsubComments);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach class-scoped listeners:', err);
    }
  } else if (isTreasurerRole) {
    // Treasurer: offerings & treasury expenditures across all classes
    try {
      const unsubOfferings = subscribeToCollection<WeeklyOfferingRecord>('offerings', async (offs) => {
        await replaceStoreContents('offerings', offs);
        notifyChange();
      });
      activeUnsubscribes.push(unsubOfferings);

      const unsubExp = subscribeToCollection<TreasuryExpenditure>('treasuryExpenditures', async (exps) => {
        await replaceStoreContents('treasuryExpenditures', exps);
        notifyChange();
      });
      activeUnsubscribes.push(unsubExp);

      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await replaceStoreContents('allClasses', clss);
        notifyChange();
      });
      activeUnsubscribes.push(unsubClasses);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach treasurer listeners:', err);
    }
  } else if (isRecordOfficerRole) {
    // Record Officer: attendance collation across all classes
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await replaceStoreContents('allClasses', clss);
        notifyChange();
      });
      activeUnsubscribes.push(unsubClasses);

      const unsubMembers = subscribeToCollection<Member>('members', async (mems) => {
        await replaceStoreContents('members', mems);
        notifyChange();
      });
      activeUnsubscribes.push(unsubMembers);

      const unsubGrades = subscribeToCollection<WeeklyGradeRecord>('grades', async (grds) => {
        await replaceStoreContents('grades', grds);
        notifyChange();
      });
      activeUnsubscribes.push(unsubGrades);

      const unsubOfferings = subscribeToCollection<WeeklyOfferingRecord>('offerings', async (offs) => {
        await replaceStoreContents('offerings', offs);
        notifyChange();
      });
      activeUnsubscribes.push(unsubOfferings);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach record officer listeners:', err);
    }
  } else if (isEnrollmentOfficerRole) {
    // Enrollment Officer: progression & certification across all classes
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await replaceStoreContents('allClasses', clss);
        notifyChange();
      });
      activeUnsubscribes.push(unsubClasses);

      const unsubMembers = subscribeToCollection<Member>('members', async (mems) => {
        await replaceStoreContents('members', mems);
        notifyChange();
      });
      activeUnsubscribes.push(unsubMembers);

      const unsubGrades = subscribeToCollection<WeeklyGradeRecord>('grades', async (grds) => {
        await replaceStoreContents('grades', grds);
        notifyChange();
      });
      activeUnsubscribes.push(unsubGrades);
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach enrollment officer listeners:', err);
    }
  } else if (isWorkerRole) {
    // Workers Directorate
    try {
      const unsubWorkers = subscribeToCollection<WorkerProfile>('workers', async (wrks) => {
        await replaceStoreContents('workers', wrks);
        notifyChange();
      });
      activeUnsubscribes.push(unsubWorkers);

      const unsubAtt = subscribeToCollection<WorkerAttendanceRecord>('workerAttendance', async (atts) => {
        await replaceStoreContents('workerAttendance', atts);
        notifyChange();
      });
      activeUnsubscribes.push(unsubAtt);

      const unsubPrep = subscribeToCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance', async (preps) => {
        await replaceStoreContents('workerPrepAttendance', preps);
        notifyChange();
      });
      activeUnsubscribes.push(unsubPrep);

      const unsubCats = subscribeToCollection<WorkerCategoryDef>('workerCategories', async (cats) => {
        await replaceStoreContents('workerCategories', cats);
        notifyChange();
      });
      activeUnsubscribes.push(unsubCats);

      const unsubEvts = subscribeToCollection<SpecialWorkersEvent>('specialEvents', async (evts) => {
        await replaceStoreContents('specialEvents', evts);
        notifyChange();
      });
      activeUnsubscribes.push(unsubEvts);

      const unsubEvtAtt = subscribeToCollection<SpecialEventAttendanceRecord>('specialEventAttendance', async (evtAtts) => {
        await replaceStoreContents('specialEventAttendance', evtAtts);
        notifyChange();
      });
      activeUnsubscribes.push(unsubEvtAtt);

      const unsubCfg = subscribeToCollection<ClockInConfig>('clockInConfig', async (cfgs) => {
        if (cfgs.length > 0) {
          await replaceStoreContents('clockInConfig', cfgs);
          notifyChange();
        }
      });
      activeUnsubscribes.push(unsubCfg);

      if (isAsstGenSecRole) {
        const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
          if (clss.length > 0) {
            await replaceStoreContents('allClasses', clss);
            notifyChange();
          }
        });
        activeUnsubscribes.push(unsubClasses);
      }
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach worker listeners:', err);
    }
  } else if (isGenSecRole || isSuperintendentRole) {
    // Executive Administration
    try {
      const unsubClasses = subscribeToCollection<ClassProfile>('classes', async (clss) => {
        await replaceStoreContents('allClasses', clss);
        notifyChange();
      });
      activeUnsubscribes.push(unsubClasses);

      const unsubProfiles = subscribeToCollection<AdminProfile>('adminProfiles', async (profs) => {
        await replaceStoreContents('adminProfiles', profs);
        notifyChange();
      });
      activeUnsubscribes.push(unsubProfiles);

      const unsubComments = subscribeToCollection<AdminComment>('adminComments', async (comms) => {
        await replaceStoreContents('adminComments', comms);
        notifyChange();
      });
      activeUnsubscribes.push(unsubComments);

      // Oversight Mode targeted listeners
      if (oversightPortal === 'CLASS_REGISTER' && oversightClassId) {
        const unsubTargetMems = subscribeToClassMembers(oversightClassId, async (mems) => {
          await replaceStoreContents('members', mems);
          notifyChange();
        });
        activeUnsubscribes.push(unsubTargetMems);

        const unsubTargetGrades = subscribeToClassGrades(oversightClassId, async (grds) => {
          await replaceStoreContents('grades', grds);
          notifyChange();
        });
        activeUnsubscribes.push(unsubTargetGrades);

        const unsubTargetOffs = subscribeToClassOfferings(oversightClassId, async (offs) => {
          await replaceStoreContents('offerings', offs);
          notifyChange();
        });
        activeUnsubscribes.push(unsubTargetOffs);

        const unsubTargetAbs = subscribeToClassAbsenceLogs(oversightClassId, async (logs) => {
          await replaceStoreContents('absenceLogs', logs);
          notifyChange();
        });
        activeUnsubscribes.push(unsubTargetAbs);
      } else if (oversightPortal === 'WORKERS') {
        const unsubWorkers = subscribeToCollection<WorkerProfile>('workers', async (wrks) => {
          await replaceStoreContents('workers', wrks);
          notifyChange();
        });
        activeUnsubscribes.push(unsubWorkers);

        const unsubAtt = subscribeToCollection<WorkerAttendanceRecord>('workerAttendance', async (atts) => {
          await replaceStoreContents('workerAttendance', atts);
          notifyChange();
        });
        activeUnsubscribes.push(unsubAtt);

        const unsubPrep = subscribeToCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance', async (preps) => {
          await replaceStoreContents('workerPrepAttendance', preps);
          notifyChange();
        });
        activeUnsubscribes.push(unsubPrep);

        const unsubEvts = subscribeToCollection<SpecialWorkersEvent>('specialEvents', async (evts) => {
          await replaceStoreContents('specialEvents', evts);
          notifyChange();
        });
        activeUnsubscribes.push(unsubEvts);

        const unsubEvtAtt = subscribeToCollection<SpecialEventAttendanceRecord>('specialEventAttendance', async (evtAtts) => {
          await replaceStoreContents('specialEventAttendance', evtAtts);
          notifyChange();
        });
        activeUnsubscribes.push(unsubEvtAtt);
      }
    } catch (err) {
      console.error('[RealtimeSync] Failed to attach executive listeners:', err);
    }
  }

  logSyncDiagnostic('LISTENERS_ACTIVE', { activeCount: activeUnsubscribes.length, scopeKey });
  return stopRealtimeCloudSync;
}
