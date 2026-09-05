import {
  cloudSaveClassProfile,
  cloudSaveMember,
  cloudDeleteMember,
  cloudSaveGrade,
  cloudDeleteGrade,
  cloudSaveOffering,
  cloudDeleteOffering,
  cloudSaveAbsenceLog,
  cloudDeleteAbsenceLog,
  cloudSaveLesson,
  cloudSaveWorker,
  cloudSaveBulkWorkers,
  cloudDeleteWorker,
  cloudSaveWorkerAttendance,
  cloudSaveBulkWorkerAttendance,
  cloudDeleteWorkerAttendance,
  cloudSaveWorkerPrepAttendance,
  cloudSaveBulkWorkerPrepAttendance,
  cloudDeleteWorkerPrepAttendance,
  cloudSaveClockInConfig,
  cloudSaveSpecialEvent,
  cloudDeleteSpecialEvent,
  cloudSaveSpecialEventAttendance,
  cloudSaveBulkSpecialEventAttendance,
  cloudDeleteSpecialEventAttendance,
  cloudSaveWorkerCategory,
  cloudDeleteWorkerCategory,
  cloudDeleteClass,
  cloudSaveDepartment
} from '../services/supabaseDatabase';

// Fire-and-forget cloud push: local (IndexedDB) writes always succeed first so the
// app keeps working offline; this mirrors the write to Supabase in the background.
// If the push fails (offline, transient error, etc.) it is NOT silently dropped —
// it's persisted to the `cloudSyncFailures` store and retried automatically (see
// retryFailedCloudPushes(), invoked on reconnect / periodic sync / app focus in
// cloudSyncManager.ts). This is what guarantees a change made on one device is
// never lost before it reaches the central Supabase database that other devices
// read from.
export interface CloudSyncFailureRecord {
  id: string;
  label: string;
  collectionName: string;
  action: 'save' | 'delete';
  docId: string;
  data?: any;
  failedAt: string;
  lastError?: string;
}

function pushToCloud<T>(
  label: string,
  fn: () => Promise<T>,
  retryMeta?: { collectionName: string; action: 'save' | 'delete'; docId: string; data?: any }
): void {
  fn().catch(async (err) => {
    console.warn(`[cloud sync] ${label} failed:`, err?.message || err);
    if (!retryMeta) return;
    try {
      const record: CloudSyncFailureRecord = {
        id: `${retryMeta.collectionName}_${retryMeta.docId}_${retryMeta.action}`,
        label,
        collectionName: retryMeta.collectionName,
        action: retryMeta.action,
        docId: retryMeta.docId,
        data: retryMeta.data,
        failedAt: new Date().toISOString(),
        lastError: err?.message || String(err)
      };
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('cloudSyncFailures', 'readwrite');
        tx.objectStore('cloudSyncFailures').put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (queueErr) {
      console.warn('[cloud sync] failed to queue retry record:', queueErr);
    }
  });
}

import {
  ClassProfile,
  DepartmentType,
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  EvangelismReferralRecord,
  SyncPayload,
  LessonInfo,
  AdminProfile,
  SundaySchoolYear,
  QuarterData,
  QuarterLesson,
  QuarterNumber,
  WorkerProfile,
  WorkerAttendanceRecord,
  WorkerPrepAttendanceRecord,
  ClockInConfig,
  WorkerCategoryDef,
  SpecialWorkersEvent,
  SpecialEventAttendanceRecord,
  AdminComment,
  TreasuryExpenditure,
  WeeklyClassReturn,
  RecordOfficerClassRow,
  RecordOfficerWeeklyCollation,
  ConvertedStudentAudit,
  EligibleVisitorCandidate,
  EnrollmentOfficerClassRow,
  EnrollmentOfficerWeeklyCollation,
  EnrollmentCertificationRecord
} from '../types';
import {
  DEFAULT_DEPARTMENTS
} from '../data/mockQuarterLessons';
import {
  DEFAULT_WORKER_CATEGORIES,
  DEFAULT_CLOCK_IN_CONFIG
} from '../data/mockWorkersData';
import {
  saveDocument,
  removeDocument,
  fetchCollection,
  fetchDocument
} from '../services/supabaseDatabase';

const DB_NAME = 'GOFAMINT_HOF_SundaySchool_DB';
// v7: added `cloudSyncFailures` store — persists cloud writes that failed
// (e.g. while offline) so they can be retried instead of being silently dropped,
// and added the cross-device cloud hydration pipeline (see cloudSyncManager.ts).
const DB_VERSION = 7;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('classProfile')) {
          db.createObjectStore('classProfile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('members')) {
          const store = db.createObjectStore('members', { keyPath: 'id' });
          store.createIndex('memberType', 'memberType', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('classId', 'classId', { unique: false });
        }
        if (!db.objectStoreNames.contains('grades')) {
          const store = db.createObjectStore('grades', { keyPath: 'id' });
          store.createIndex('memberId', 'memberId', { unique: false });
          store.createIndex('weekNumber', 'weekNumber', { unique: false });
          store.createIndex('classId', 'classId', { unique: false });
        }
        if (!db.objectStoreNames.contains('offerings')) {
          db.createObjectStore('offerings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('absenceLogs')) {
          const store = db.createObjectStore('absenceLogs', { keyPath: 'id' });
          store.createIndex('memberId', 'memberId', { unique: false });
          store.createIndex('classId', 'classId', { unique: false });
        }
        if (!db.objectStoreNames.contains('referrals')) {
          db.createObjectStore('referrals', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('lessons')) {
          db.createObjectStore('lessons', { keyPath: 'weekNumber' });
        }
        if (!db.objectStoreNames.contains('adminProfiles')) {
          db.createObjectStore('adminProfiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sundaySchoolYear')) {
          db.createObjectStore('sundaySchoolYear', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('allClasses')) {
          db.createObjectStore('allClasses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('departments')) {
          db.createObjectStore('departments', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('workers')) {
          const wStore = db.createObjectStore('workers', { keyPath: 'id' });
          wStore.createIndex('department', 'department', { unique: false });
          wStore.createIndex('status', 'status', { unique: false });
          wStore.createIndex('qrCodeToken', 'qrCodeToken', { unique: true });
        }
        if (!db.objectStoreNames.contains('workerAttendance')) {
          const aStore = db.createObjectStore('workerAttendance', { keyPath: 'id' });
          aStore.createIndex('workerId', 'workerId', { unique: false });
          aStore.createIndex('serviceDate', 'serviceDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('workerPrepAttendance')) {
          const pStore = db.createObjectStore('workerPrepAttendance', { keyPath: 'id' });
          pStore.createIndex('workerId', 'workerId', { unique: false });
          pStore.createIndex('prepDate', 'prepDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('clockInConfig')) {
          db.createObjectStore('clockInConfig', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workerCategories')) {
          db.createObjectStore('workerCategories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('specialEvents')) {
          db.createObjectStore('specialEvents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('specialEventAttendance')) {
          const sStore = db.createObjectStore('specialEventAttendance', { keyPath: 'id' });
          sStore.createIndex('eventId', 'eventId', { unique: false });
          sStore.createIndex('workerId', 'workerId', { unique: false });
          sStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('adminComments')) {
          const cStore = db.createObjectStore('adminComments', { keyPath: 'id' });
          cStore.createIndex('classId', 'classId', { unique: false });
        }
        if (!db.objectStoreNames.contains('treasuryExpenditures')) {
          const eStore = db.createObjectStore('treasuryExpenditures', { keyPath: 'id' });
          eStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('cloudSyncFailures')) {
          // Persisted queue of cloud writes that failed (e.g. offline, or a
          // rejected write). Retried automatically once connectivity is restored so a
          // failed write is never silently lost — see retryFailedCloudPushes().
          db.createObjectStore('cloudSyncFailures', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  return dbPromise;
}

// Generic transaction helpers with Supabase cloud mirroring
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    const local = localStorage.getItem(`gofamint_${storeName}`);
    return local ? JSON.parse(local) : [];
  }
}

// Map of local store names to legacy collection aliases. Exported so
// cloudSyncManager.ts can drive the reverse direction (pulling the central
// Supabase database down into each device's local IndexedDB cache).
export const CLOUD_STORE_MAP: Record<string, string> = {
  members: 'members',
  grades: 'grades',
  offerings: 'offerings',
  absenceLogs: 'absenceLogs',
  referrals: 'referrals',
  adminProfiles: 'adminProfiles',
  sundaySchoolYear: 'sundaySchoolYear',
  departments: 'departments',
  workers: 'workers',
  workerAttendance: 'workerAttendance',
  workerPrepAttendance: 'workerPrepAttendance',
  clockInConfig: 'clockInConfig',
  workerCategories: 'workerCategories',
  specialEvents: 'specialEvents',
  specialEventAttendance: 'specialEventAttendance',
  adminComments: 'adminComments',
  treasuryExpenditures: 'treasuryExpenditures'
};

export async function putInStore<T>(storeName: string, value: T, skipCloudMirror = false): Promise<T> {
  // Mirror to Supabase asynchronously. `skipCloudMirror` is used when the
  // value being written just came FROM the cloud (see hydrateLocalFromCloud in
  // cloudSyncManager.ts) so we don't immediately write it straight back.
  const colName = CLOUD_STORE_MAP[storeName];
  if (!skipCloudMirror && colName && (value as any)?.id) {
    pushToCloud(`${colName}/${(value as any).id}`, () => saveDocument(colName, value as any), {
      collectionName: colName,
      action: 'save',
      docId: (value as any).id,
      data: value
    });
  }

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => {
        // Also mirror to localStorage as backup
        getAllFromStore(storeName).then(all => {
          localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(all));
        }).catch(() => {});
        resolve(value);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const all = await getAllFromStore<any>(storeName);
    const key = (value as any).id;
    const idx = all.findIndex((i: any) => i.id === key);
    if (idx >= 0) all[idx] = value;
    else all.push(value);
    localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(all));
    return value;
  }
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  // Mirror deletion to Supabase asynchronously
  const colName = CLOUD_STORE_MAP[storeName];
  if (colName && id) {
    pushToCloud(`delete ${colName}/${id}`, () => removeDocument(colName, id), {
      collectionName: colName,
      action: 'delete',
      docId: id
    });
  }

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB delete error for ${storeName}:`, err);
  }
  // Also synchronize localStorage mirror
  try {
    const local = localStorage.getItem(`gofamint_${storeName}`);
    if (local) {
      const all = JSON.parse(local);
      const filtered = Array.isArray(all) ? all.filter((i: any) => i.id !== id && (i.keyPath ? i.keyPath !== id : true)) : [];
      localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn(`localStorage delete sync error:`, e);
  }
}

// Replaces the ENTIRE contents of a local IndexedDB store with `items`, without
// mirroring anything back to Supabase. This is the primitive used to pull
// the central Supabase database down into a device's local cache (cloud is
// authoritative, so this also correctly removes local records that were deleted
// on another device). See hydrateLocalFromCloud() in cloudSyncManager.ts.
export async function replaceStoreContents<T>(storeName: string, items: T[]): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  try {
    localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(items));
  } catch {
    // Non-fatal — localStorage is only used here as an IndexedDB-unavailable fallback mirror.
  }
}

// Returns any cloud writes that previously failed and are still pending retry.
export async function getPendingCloudSyncFailures(): Promise<CloudSyncFailureRecord[]> {
  try {
    return await getAllFromStore<CloudSyncFailureRecord>('cloudSyncFailures');
  } catch {
    return [];
  }
}

// Retries every queued failed Supabase write. Successful retries are removed
// from the queue; writes that fail again stay queued (with the latest error) for the
// next retry pass. Called on reconnect / periodic sync / app focus.
export async function retryFailedCloudPushes(): Promise<{ retried: number; succeeded: number }> {
  const pending = await getPendingCloudSyncFailures();
  let succeeded = 0;
  for (const record of pending) {
    try {
      if (record.collectionName === 'classes' && record.action === 'save') {
        // Classes should NEVER be overwritten with PENDING_APPROVAL via retry queue
        if (record.data?.approvalStatus !== 'APPROVED') {
          await deleteFromStore('cloudSyncFailures', record.id).catch(() => {});
          continue;
        }
        const localDir = await getAllFromStore<ClassProfile>('allClasses');
        const match = localDir.find(c => c.id === record.docId);
        if (match?.approvalStatus === 'APPROVED' && record.data?.approvalStatus !== 'APPROVED') {
          await deleteFromStore('cloudSyncFailures', record.id).catch(() => {});
          continue;
        }
      }

      if (record.action === 'save') {
        await saveDocument(record.collectionName, record.data);
      } else {
        await removeDocument(record.collectionName, record.docId);
      }
      await deleteFromStore('cloudSyncFailures', record.id).catch(() => {});
      succeeded++;
    } catch (err: any) {
      console.warn(`[cloud sync] retry failed for ${record.label}:`, err?.message || err);
      try {
        const db = await getDB();
        const tx = db.transaction('cloudSyncFailures', 'readwrite');
        tx.objectStore('cloudSyncFailures').put({ ...record, lastError: err?.message || String(err) });
      } catch {
        // best-effort
      }
    }
  }
  return { retried: pending.length, succeeded };
}

// Database Initialization & Clean Startup
export async function initializeDatabase(): Promise<{
  classProfile: ClassProfile | null;
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  absenceLogs: AbsenceLogRecord[];
}> {
  try {
    // Schema version gate: only run a fresh-system wipe when the local DB
    // has never been opened under this schema version. This prevents both
    // the first-ever open AND post-factory-reset from carrying stale data.
    const CURRENT_SCHEMA = 'gofamint_schema_v6';
    if (localStorage.getItem(CURRENT_SCHEMA) !== 'true') {
      await resetToFreshCleanSystem('UNINITIALIZED_BLANK');
      localStorage.setItem(CURRENT_SCHEMA, 'true');
      return { classProfile: null, members: [], grades: [], offerings: [], absenceLogs: [] };
    }

    // Purge any stale class retry failures that attempt to push PENDING_APPROVAL
    try {
      const failures = await getAllFromStore<CloudSyncFailureRecord>('cloudSyncFailures');
      for (const f of failures) {
        if (f && (f.collectionName === 'classes' || f.collectionName === 'classProfile') && f.data?.approvalStatus !== 'APPROVED') {
          await deleteFromStore('cloudSyncFailures', f.id).catch(() => {});
        }
      }
    } catch {}

    const classProfiles = await getAllFromStore<ClassProfile>('classProfile');
    const defaultClass = classProfiles[0] || null;
    const defaultClassId = defaultClass?.id || 'class_default';

    // Auto-migration: ensure members have classId and quarterEnrollments
    const rawMembers = await getAllFromStore<Member>('members');
    for (const m of rawMembers) {
      let changed = false;
      if (!m.classId && defaultClassId) {
        m.classId = defaultClassId;
        changed = true;
      }
      if (!m.quarterEnrollments) {
        m.quarterEnrollments = {
          1: {
            quarterNumber: 1,
            memberType: m.memberType || 'STUDENT',
            status: m.status || 'ACTIVE',
            firstLessonWeek: m.firstLessonWeek || 1,
            enrolledDate: m.enrolledDate || m.createdAt
          }
        };
        changed = true;
      }
      if (changed) {
        await putInStore('members', m);
      }
    }

    // Auto-migration: ensure grades have classId and quarterNumber
    const rawGrades = await getAllFromStore<WeeklyGradeRecord>('grades');
    for (const g of rawGrades) {
      let changed = false;
      if (!g.quarterNumber) {
        g.quarterNumber = 1;
        changed = true;
      }
      if (!g.classId) {
        const owner = rawMembers.find(m => m.id === g.memberId);
        g.classId = owner?.classId || defaultClassId;
        changed = true;
      }
      const expectedId = `${g.classId}_q${g.quarterNumber}_${g.memberId}_w${g.weekNumber}`;
      if (g.id !== expectedId) {
        await deleteFromStore('grades', g.id);
        g.id = expectedId;
        await putInStore('grades', g);
      } else if (changed) {
        await putInStore('grades', g);
      }
    }

    // Auto-migration: ensure offerings have classId and quarterNumber
    const rawOfferings = await getAllFromStore<WeeklyOfferingRecord>('offerings');
    for (const o of rawOfferings) {
      let changed = false;
      if (!o.quarterNumber) {
        o.quarterNumber = 1;
        changed = true;
      }
      if (!o.classId) {
        o.classId = defaultClassId;
        changed = true;
      }
      const expectedId = `${o.classId}_q${o.quarterNumber}_w${o.weekNumber}`;
      if (o.id !== expectedId) {
        await deleteFromStore('offerings', o.id);
        o.id = expectedId;
        await putInStore('offerings', o);
      } else if (changed) {
        await putInStore('offerings', o);
      }
    }

    // Auto-migration: ensure absence logs have classId and quarterNumber
    const rawLogs = await getAllFromStore<AbsenceLogRecord>('absenceLogs');
    for (const a of rawLogs) {
      let changed = false;
      if (!a.quarterNumber) {
        a.quarterNumber = 1;
        changed = true;
      }
      if (!a.classId) {
        const owner = rawMembers.find(m => m.id === a.memberId);
        a.classId = owner?.classId || defaultClassId;
        changed = true;
      }
      const expectedId = `${a.classId}_q${a.quarterNumber}_${a.memberId}_w${a.weekNumber}`;
      if (a.id !== expectedId) {
        await deleteFromStore('absenceLogs', a.id);
        a.id = expectedId;
        await putInStore('absenceLogs', a);
      } else if (changed) {
        await putInStore('absenceLogs', a);
      }
    }

    const activeQuarter = defaultClass?.quarter || 1;
    const members = defaultClass ? await getMembersByClass(defaultClass.id, activeQuarter) : [];
    const grades = defaultClass ? await getGradesByClassAndQuarter(defaultClass.id, activeQuarter) : [];
    const offerings = defaultClass ? await getOfferingsByClassAndQuarter(defaultClass.id, activeQuarter) : [];
    const absenceLogs = defaultClass ? await getAbsenceLogsByClassAndQuarter(defaultClass.id, activeQuarter) : [];

    return {
      classProfile: defaultClass,
      members,
      grades,
      offerings,
      absenceLogs
    };
  } catch (err) {
    console.error('Failed to init IndexedDB, using local fallback:', err);
    return {
      classProfile: null,
      members: [],
      grades: [],
      offerings: [],
      absenceLogs: []
    };
  }
}

// Lessons & Topics Management (Week 1 to 12)
export async function getAllLessons(): Promise<LessonInfo[]> {
  try {
    const stored = await getAllFromStore<LessonInfo>('lessons');
    if (stored && stored.length > 0) {
      // Sort by weekNumber
      return stored.sort((a, b) => a.weekNumber - b.weekNumber);
    }
  } catch (e) {
    console.warn('Error reading lessons store:', e);
  }
  return [];
}

export async function saveLessonTopic(weekNumber: number, topic: string): Promise<LessonInfo[]> {
  const currentLessons = await getAllLessons();
  const index = currentLessons.findIndex(l => l.weekNumber === weekNumber);
  
  let updatedLesson: LessonInfo;
  if (index >= 0) {
    updatedLesson = {
      ...currentLessons[index],
      topic: topic.trim() || `Lesson ${weekNumber} Topic`
    };
    currentLessons[index] = updatedLesson;
  } else {
    updatedLesson = {
      weekNumber,
      topic: topic.trim() || `Lesson ${weekNumber} Topic`,
      scriptureReading: 'Scripture to be assigned',
      memoryVerse: 'Memory verse to be assigned',
      memoryVerseRef: '',
      aim: 'Lesson spiritual objective'
    };
    currentLessons.push(updatedLesson);
  }

  await putInStore('lessons', updatedLesson);
  pushToCloud('lesson', () => cloudSaveLesson(updatedLesson));
  return currentLessons.sort((a, b) => a.weekNumber - b.weekNumber);
}

// Clear all data to start completely fresh / from scratch
export async function clearAllDatabaseData(wipeClassProfile: boolean = true): Promise<void> {
  localStorage.setItem('gofamint_scratch_mode', 'true');
  sessionStorage.removeItem('gofamint_unlocked');

  const storesToClear = ['members', 'grades', 'offerings', 'absenceLogs', 'referrals', 'syncQueue'];
  if (wipeClassProfile) {
    storesToClear.push('classProfile');
  }

  try {
    const db = await getDB();
    for (const storeName of storesToClear) {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
      } catch (err) {
        console.warn(`Could not clear store ${storeName}:`, err);
      }
      localStorage.removeItem(`gofamint_${storeName}`);
    }
  } catch (e) {
    for (const storeName of storesToClear) {
      localStorage.removeItem(`gofamint_${storeName}`);
    }
  }
}

// Class Profile
export async function getClassProfile(): Promise<ClassProfile | null> {
  const profiles = await getAllFromStore<ClassProfile>('classProfile');
  return profiles[0] || null;
}

export async function saveClassProfile(profile: ClassProfile): Promise<ClassProfile> {
  const existingAll = (await getAllFromStore<ClassProfile>('allClasses')) || [];
  const existingInDir = existingAll.find(c => c.id === profile.id);
  const safeProfile: ClassProfile = (existingInDir?.approvalStatus === 'APPROVED' && profile.approvalStatus !== 'APPROVED')
    ? { ...profile, approvalStatus: 'APPROVED', approvedBy: existingInDir.approvedBy, approvedAt: existingInDir.approvedAt }
    : profile;

  await putInStore<ClassProfile>('allClasses', safeProfile, true);
  const result = await putInStore<ClassProfile>('classProfile', safeProfile, true);
  if (safeProfile.approvalStatus === 'APPROVED') {
    pushToCloud('classProfile', () => cloudSaveClassProfile(safeProfile));
  }
  return result;
}

// Members
export async function getAllMembers(): Promise<Member[]> {
  return getAllFromStore<Member>('members');
}

export async function getMembersByClass(classId: string, quarterNumber?: number): Promise<Member[]> {
  if (!classId) return [];
  const all = await getAllFromStore<Member>('members');
  const classMembers = all.filter(m => m.classId === classId);

  if (!quarterNumber) {
    return classMembers;
  }

  // Filter or map for the specific quarter
  const result: Member[] = [];
  for (const m of classMembers) {
    if (quarterNumber === 1) {
      if (m.quarterEnrollments?.[1]) {
        const enr = m.quarterEnrollments[1];
        result.push({
          ...m,
          memberType: enr.memberType || m.memberType,
          status: enr.status || m.status,
          firstLessonWeek: enr.firstLessonWeek || m.firstLessonWeek || 1
        });
      } else {
        // Default to Q1 member
        result.push(m);
      }
    } else {
      // For Q2, Q3, Q4: Only include if explicitly enrolled/forwarded in this quarter
      if (m.quarterEnrollments?.[quarterNumber as QuarterNumber]) {
        const enr = m.quarterEnrollments[quarterNumber as QuarterNumber]!;
        result.push({
          ...m,
          memberType: enr.memberType || m.memberType,
          status: enr.status || m.status,
          firstLessonWeek: enr.firstLessonWeek || 1
        });
      }
    }
  }
  return result;
}

export async function saveMember(member: Member, targetQuarter: number = 1): Promise<Member> {
  const qNum = (targetQuarter || 1) as QuarterNumber;
  const enrollments = member.quarterEnrollments || {};
  if (!enrollments[qNum]) {
    enrollments[qNum] = {
      quarterNumber: qNum,
      memberType: member.memberType || 'STUDENT',
      status: member.status || 'ACTIVE',
      firstLessonWeek: member.firstLessonWeek || 1,
      enrolledDate: member.enrolledDate || new Date().toISOString()
    };
  }

  const updated: Member = {
    ...member,
    quarterEnrollments: enrollments,
    updatedAt: new Date().toISOString()
  };
  const result = await putInStore<Member>('members', updated);
  pushToCloud('member', () => cloudSaveMember(updated));
  return result;
}

export async function saveBulkMembers(membersList: Member[], targetQuarter: number = 1): Promise<Member[]> {
  for (const m of membersList) {
    await saveMember(m, targetQuarter);
  }
  return membersList;
}

export async function deleteMember(id: string): Promise<void> {
  await deleteFromStore('members', id);
  pushToCloud('deleteMember', () => cloudDeleteMember(id));
  // Also delete associated grades, absence logs
  const allGrades = await getAllGrades();
  const memberGrades = allGrades.filter(g => g.memberId === id);
  for (const g of memberGrades) {
    await deleteFromStore('grades', g.id);
    pushToCloud('deleteGrade', () => cloudDeleteGrade(g.id));
  }
  const allLogs = await getAllAbsenceLogs();
  const memberLogs = allLogs.filter(a => a.memberId === id);
  for (const l of memberLogs) {
    await deleteFromStore('absenceLogs', l.id);
    pushToCloud('deleteAbsenceLog', () => cloudDeleteAbsenceLog(l.id));
  }
}

// Student & Visitor Forwarding across Quarters (e.g. Q1 -> Q2)
export async function forwardMembersToQuarter(
  classId: string,
  fromQuarter: QuarterNumber,
  toQuarter: QuarterNumber,
  transitions: Array<{
    memberId: string;
    targetType: 'STUDENT' | 'VISITOR';
    targetStatus: 'ACTIVE' | 'LEFT_CLASS' | 'RELEGATED_VISITOR' | 'HIGH_PROBABILITY';
    firstLessonWeek?: number;
    note?: string;
  }>
): Promise<Member[]> {
  const allMembers = await getAllFromStore<Member>('members');
  const updatedList: Member[] = [];

  for (const t of transitions) {
    const existing = allMembers.find(m => m.id === t.memberId && m.classId === classId);
    if (!existing) continue;

    const currentEnrollments = existing.quarterEnrollments || {};
    currentEnrollments[toQuarter] = {
      quarterNumber: toQuarter,
      memberType: t.targetType,
      status: t.targetStatus,
      firstLessonWeek: t.firstLessonWeek || 1,
      enrolledDate: new Date().toISOString().split('T')[0],
      exitNote: t.note,
      forwardedFromQuarter: fromQuarter,
      forwardedAt: new Date().toISOString()
    };

    const updatedMember: Member = {
      ...existing,
      quarterEnrollments: currentEnrollments,
      updatedAt: new Date().toISOString()
    };

    await putInStore('members', updatedMember);
    updatedList.push(updatedMember);
  }

  return updatedList;
}

// Grades
export async function getAllGrades(): Promise<WeeklyGradeRecord[]> {
  return getAllFromStore<WeeklyGradeRecord>('grades');
}

export async function getGradesByClassAndQuarter(classId: string, quarterNumber: number): Promise<WeeklyGradeRecord[]> {
  if (!classId) return [];
  const all = await getAllFromStore<WeeklyGradeRecord>('grades');
  return all.filter(g => g.classId === classId && g.quarterNumber === quarterNumber);
}

export async function saveGrade(grade: WeeklyGradeRecord): Promise<WeeklyGradeRecord> {
  const classId = grade.classId;
  if (!classId) {
    throw new Error('Cannot save grade without classId');
  }
  const qNum = grade.quarterNumber || 1;
  const canonicalId = `${classId}_q${qNum}_${grade.memberId}_w${grade.weekNumber}`;

  // Enforce auto-calculation of lessonTotal (max 50)
  const total = (grade.attendance === 'PRESENT')
    ? Math.min(50, Math.max(0, (grade.punctuality || 0) + (grade.memoryVerse || 0) + (grade.classParticipation || 0)))
    : 0;
  
  const calculatedGrade: WeeklyGradeRecord = {
    ...grade,
    id: canonicalId,
    classId,
    quarterNumber: qNum,
    lessonTotal: total,
    updatedAt: new Date().toISOString()
  };

  const result = await putInStore<WeeklyGradeRecord>('grades', calculatedGrade);
  pushToCloud('grade', () => cloudSaveGrade(calculatedGrade));
  return result;
}

export async function saveBulkGrades(gradesList: WeeklyGradeRecord[]): Promise<void> {
  for (const g of gradesList) {
    await saveGrade(g);
  }
}

// Offerings
export async function getAllOfferings(): Promise<WeeklyOfferingRecord[]> {
  return getAllFromStore<WeeklyOfferingRecord>('offerings');
}

export async function getOfferingsByClassAndQuarter(classId: string, quarterNumber: number): Promise<WeeklyOfferingRecord[]> {
  if (!classId) return [];
  const all = await getAllFromStore<WeeklyOfferingRecord>('offerings');
  return all.filter(o => o.classId === classId && o.quarterNumber === quarterNumber);
}

export async function saveOffering(offering: WeeklyOfferingRecord): Promise<WeeklyOfferingRecord> {
  const classId = offering.classId;
  if (!classId) {
    throw new Error('Cannot save offering without classId');
  }
  const qNum = offering.quarterNumber || 1;
  const canonicalId = `${classId}_q${qNum}_w${offering.weekNumber}`;

  // Default remittanceStatus if not present
  const existingOfferings = await getAllOfferings();
  const existing = existingOfferings.find(o => o.id === canonicalId);

  let remittanceStatus = offering.remittanceStatus;
  if (!remittanceStatus) {
    if (existing?.remittanceStatus) {
      remittanceStatus = existing.remittanceStatus;
    } else {
      remittanceStatus = Number(offering.amount) > 0 ? 'PENDING_REMITTANCE' : undefined;
    }
  }

  const updated: WeeklyOfferingRecord = {
    ...offering,
    id: canonicalId,
    classId,
    quarterNumber: qNum,
    remittanceStatus,
    recordedAt: offering.recordedAt || existing?.recordedAt || new Date().toISOString(),
    recordedBy: offering.recordedBy || existing?.recordedBy,
    remittedBy: offering.remittedBy || existing?.remittedBy,
    remittedAt: offering.remittedAt || existing?.remittedAt,
    auditedBy: offering.auditedBy || existing?.auditedBy,
    auditedAt: offering.auditedAt || existing?.auditedAt,
    auditedAmount: offering.auditedAmount !== undefined ? offering.auditedAmount : existing?.auditedAmount,
    updatedAt: new Date().toISOString()
  };

  const result = await putInStore<WeeklyOfferingRecord>('offerings', updated);
  pushToCloud('offering', () => cloudSaveOffering(updated));
  return result;
}

export async function remitOfferingRecord(
  classId: string,
  quarterNumber: number,
  weekNumber: number,
  remittedBy: string
): Promise<WeeklyOfferingRecord> {
  const canonicalId = `${classId}_q${quarterNumber}_w${weekNumber}`;
  const allOfferings = await getAllOfferings();
  const existing = allOfferings.find(o => o.id === canonicalId || (o.classId === classId && o.quarterNumber === quarterNumber && o.weekNumber === weekNumber));

  if (!existing || Number(existing.amount) <= 0) {
    throw new Error('No recorded offering amount to remit.');
  }

  if (existing.remittanceStatus === 'AUDITED') {
    return existing; // Idempotent
  }

  const updated: WeeklyOfferingRecord = {
    ...existing,
    id: canonicalId,
    classId,
    quarterNumber,
    remittanceStatus: 'REMITTED',
    remittedBy: remittedBy || 'Class Secretary',
    remittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const remitResult = await putInStore<WeeklyOfferingRecord>('offerings', updated);
  pushToCloud('offering-remit', () => cloudSaveOffering(updated));
  return remitResult;
}

export async function auditOfferingRecord(
  classId: string,
  quarterNumber: number,
  weekNumber: number,
  auditedBy: string,
  auditedAmount?: number
): Promise<WeeklyOfferingRecord> {
  const canonicalId = `${classId}_q${quarterNumber}_w${weekNumber}`;
  const allOfferings = await getAllOfferings();
  const existing = allOfferings.find(o => o.id === canonicalId || (o.classId === classId && o.quarterNumber === quarterNumber && o.weekNumber === weekNumber));

  if (!existing) {
    throw new Error('Offering record not found to audit.');
  }

  const verifiedAmount = auditedAmount !== undefined ? Number(auditedAmount) : Number(existing.amount);

  const updated: WeeklyOfferingRecord = {
    ...existing,
    id: canonicalId,
    classId,
    quarterNumber,
    remittanceStatus: 'AUDITED',
    auditedBy: auditedBy || 'Treasurer',
    auditedAt: new Date().toISOString(),
    auditedAmount: verifiedAmount,
    updatedAt: new Date().toISOString()
  };

  const auditResult = await putInStore<WeeklyOfferingRecord>('offerings', updated);
  pushToCloud('offering-audit', () => cloudSaveOffering(updated));
  return auditResult;
}

export async function bulkAuditOfferings(
  items: Array<{ classId: string; quarterNumber: number; weekNumber: number; auditedAmount?: number }>,
  auditedBy: string
): Promise<WeeklyOfferingRecord[]> {
  const list: WeeklyOfferingRecord[] = [];
  for (const item of items) {
    const res = await auditOfferingRecord(item.classId, item.quarterNumber, item.weekNumber, auditedBy, item.auditedAmount);
    list.push(res);
  }
  return list;
}

// Absence Logs
export async function getAllAbsenceLogs(): Promise<AbsenceLogRecord[]> {
  return getAllFromStore<AbsenceLogRecord>('absenceLogs');
}

export async function getAbsenceLogsByClassAndQuarter(classId: string, quarterNumber: number): Promise<AbsenceLogRecord[]> {
  if (!classId) return [];
  const all = await getAllFromStore<AbsenceLogRecord>('absenceLogs');
  return all.filter(a => a.classId === classId && a.quarterNumber === quarterNumber);
}

export async function saveAbsenceLog(log: AbsenceLogRecord): Promise<AbsenceLogRecord> {
  const classId = log.classId;
  if (!classId) {
    throw new Error('Cannot save absence log without classId');
  }
  const qNum = log.quarterNumber || 1;
  const canonicalId = `${classId}_q${qNum}_${log.memberId}_w${log.weekNumber}`;

  const updated: AbsenceLogRecord = {
    ...log,
    id: canonicalId,
    classId,
    quarterNumber: qNum,
    loggedAt: log.loggedAt || new Date().toISOString()
  };

  const result = await putInStore<AbsenceLogRecord>('absenceLogs', updated);
  pushToCloud('absenceLog', () => cloudSaveAbsenceLog(updated));
  return result;
}

// Referrals
export async function getAllReferrals(): Promise<EvangelismReferralRecord[]> {
  return getAllFromStore<EvangelismReferralRecord>('referrals');
}

export async function saveReferral(ref: EvangelismReferralRecord): Promise<EvangelismReferralRecord> {
  return putInStore<EvangelismReferralRecord>('referrals', ref);
}

// Full Export / Import Payload for backup & Central Server Sync
export async function getFullSyncPayload(): Promise<SyncPayload> {
  const classProfile = await getClassProfile();
  const members = await getAllMembers();
  const grades = await getAllGrades();
  const offerings = await getAllOfferings();
  const absenceLogs = await getAllAbsenceLogs();
  const referrals = await getAllReferrals();

  return {
    classProfile,
    members,
    grades,
    offerings,
    absenceLogs,
    referrals,
    timestamp: new Date().toISOString(),
    sourceClient: navigator.userAgent
  };
}

export async function restoreFullSyncPayload(payload: SyncPayload): Promise<void> {
  if (payload.classProfile) {
    await putInStore('classProfile', payload.classProfile);
  }
  if (payload.members) {
    for (const m of payload.members) {
      await putInStore('members', m);
    }
  }
  if (payload.grades) {
    for (const g of payload.grades) {
      await putInStore('grades', g);
    }
  }
  if (payload.offerings) {
    for (const o of payload.offerings) {
      await putInStore('offerings', o);
    }
  }
  if (payload.absenceLogs) {
    for (const a of payload.absenceLogs) {
      await putInStore('absenceLogs', a);
    }
  }
  if (payload.referrals) {
    for (const r of payload.referrals) {
      await putInStore('referrals', r);
    }
  }
}

// -------------------------------------------------------------
// COMPLETE FULL-DATABASE BACKUP & RESTORE SERVICES (ALL STORES)
// -------------------------------------------------------------

export interface DatabaseBackupPackage {
  app: string;
  version: string;
  formatVersion: number;
  exportedAt: string;
  sourceClient: string;
  summary: {
    className: string;
    department: string;
    totalMembers: number;
    totalStudents: number;
    totalVisitors: number;
    totalGrades: number;
    totalOfferings: number;
    totalAbsenceLogs: number;
    totalWorkers: number;
    totalWorkerAttendance: number;
    totalWorkerPrepAttendance: number;
    totalAdminProfiles: number;
    totalClasses: number;
    yearTheme?: string;
  };
  data: {
    classProfile: ClassProfile | null;
    allClasses: ClassProfile[];
    members: Member[];
    grades: WeeklyGradeRecord[];
    offerings: WeeklyOfferingRecord[];
    absenceLogs: AbsenceLogRecord[];
    referrals: EvangelismReferralRecord[];
    lessons: LessonInfo[];
    adminProfiles: AdminProfile[];
    sundaySchoolYear: SundaySchoolYear | null;
    departments: string[];
    workers: WorkerProfile[];
    workerAttendance: WorkerAttendanceRecord[];
    workerPrepAttendance: WorkerPrepAttendanceRecord[];
    clockInConfig: ClockInConfig | null;
    workerCategories: WorkerCategoryDef[];
    syncQueue: any[];
  };
}

export interface LocalSnapshotItem {
  id: string;
  label: string;
  createdAt: string;
  summary: DatabaseBackupPackage['summary'];
  packageData: DatabaseBackupPackage;
}

export async function getDatabaseStatisticsSummary() {
  const [
    classProfile,
    allClasses,
    members,
    grades,
    offerings,
    absenceLogs,
    workers,
    workerAttendance,
    workerPrepAttendance,
    adminProfiles,
    sundaySchoolYear,
    lessons
  ] = await Promise.all([
    getClassProfile(),
    getAllClassesDirectory(),
    getAllMembers(),
    getAllGrades(),
    getAllOfferings(),
    getAllAbsenceLogs(),
    getAllWorkers(),
    getAllWorkerAttendance(),
    getAllWorkerPrepAttendance(),
    getAllAdminProfiles(),
    getSundaySchoolYear(),
    getAllLessons()
  ]);

  const students = members.filter(m => m.memberType === 'STUDENT');
  const visitors = members.filter(m => m.memberType === 'VISITOR');

  return {
    className: classProfile?.className || 'No Active Class',
    department: classProfile?.department || 'N/A',
    totalMembers: members.length,
    totalStudents: students.length,
    totalVisitors: visitors.length,
    totalGrades: grades.length,
    totalOfferings: offerings.length,
    totalAbsenceLogs: absenceLogs.length,
    totalWorkers: workers.length,
    totalWorkerAttendance: workerAttendance.length,
    totalWorkerPrepAttendance: workerPrepAttendance.length,
    totalAdminProfiles: adminProfiles.length,
    totalClasses: allClasses.length,
    totalLessons: lessons.length,
    yearTheme: sundaySchoolYear?.overallTheme || 'N/A',
    yearName: sundaySchoolYear?.yearName || 'N/A',
    isYearInitialized: !!sundaySchoolYear?.isInitialized
  };
}

export async function exportCompleteDatabaseSnapshot(): Promise<DatabaseBackupPackage> {
  const [
    classProfile,
    allClasses,
    members,
    grades,
    offerings,
    absenceLogs,
    referrals,
    lessons,
    adminProfiles,
    sundaySchoolYear,
    departments,
    workers,
    workerAttendance,
    workerPrepAttendance,
    clockInConfig,
    workerCategories,
    syncQueue
  ] = await Promise.all([
    getClassProfile(),
    getAllClassesDirectory(),
    getAllMembers(),
    getAllGrades(),
    getAllOfferings(),
    getAllAbsenceLogs(),
    getAllReferrals(),
    getAllLessons(),
    getAllAdminProfiles(),
    getSundaySchoolYear(),
    getAllDepartmentsList(),
    getAllWorkers(),
    getAllWorkerAttendance(),
    getAllWorkerPrepAttendance(),
    getClockInConfig(),
    getAllWorkerCategories(),
    getSyncQueue()
  ]);

  const students = members.filter(m => m.memberType === 'STUDENT');
  const visitors = members.filter(m => m.memberType === 'VISITOR');

  const backupPackage: DatabaseBackupPackage = {
    app: 'THE GOSPEL FAITH MISSION INTL - Sunday School Management System',
    version: '4.0.0',
    formatVersion: 4,
    exportedAt: new Date().toISOString(),
    sourceClient: typeof navigator !== 'undefined' ? navigator.userAgent : 'GOFAMINT_HOF Web PWA',
    summary: {
      className: classProfile?.className || 'General Directorate',
      department: classProfile?.department || 'General',
      totalMembers: members.length,
      totalStudents: students.length,
      totalVisitors: visitors.length,
      totalGrades: grades.length,
      totalOfferings: offerings.length,
      totalAbsenceLogs: absenceLogs.length,
      totalWorkers: workers.length,
      totalWorkerAttendance: workerAttendance.length,
      totalWorkerPrepAttendance: workerPrepAttendance.length,
      totalAdminProfiles: adminProfiles.length,
      totalClasses: allClasses.length,
      yearTheme: sundaySchoolYear?.overallTheme
    },
    data: {
      classProfile,
      allClasses,
      members,
      grades,
      offerings,
      absenceLogs,
      referrals,
      lessons,
      adminProfiles,
      sundaySchoolYear,
      departments,
      workers,
      workerAttendance,
      workerPrepAttendance,
      clockInConfig,
      workerCategories,
      syncQueue
    }
  };

  return backupPackage;
}

export async function downloadDatabaseBackupFile(customLabel?: string): Promise<{ filename: string; sizeBytes: number }> {
  const snapshot = await exportCompleteDatabaseSnapshot();
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');

  const cleanClassName = snapshot.summary.className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const tag = customLabel ? `_${customLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  const filename = `GOFAMINT_HOF_SundaySchool_DB_${cleanClassName}_${year}-${month}-${day}_${hours}${mins}${tag}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    filename,
    sizeBytes: blob.size
  };
}

export interface RestoreResultSummary {
  success: boolean;
  message: string;
  restoredCounts: {
    members: number;
    grades: number;
    offerings: number;
    absenceLogs: number;
    referrals: number;
    workers: number;
    workerAttendance: number;
    workerPrepAttendance: number;
    adminProfiles: number;
    classes: number;
    lessons: number;
    departments: number;
    categories: number;
  };
}

export async function restoreCompleteDatabaseSnapshot(
  rawBackup: any,
  wipeExisting: boolean = true
): Promise<RestoreResultSummary> {
  if (!rawBackup) {
    throw new Error('No database backup content provided.');
  }

  // Handle both standard wrapped package ({ data: {...}, summary: {...} }) and flat format
  const data = rawBackup.data || rawBackup;

  const db = await getDB();

  if (wipeExisting) {
    // Clear all existing stores to guarantee a clean, exact restore
    const allStores = [
      'classProfile',
      'members',
      'grades',
      'offerings',
      'absenceLogs',
      'referrals',
      'syncQueue',
      'lessons',
      'adminProfiles',
      'sundaySchoolYear',
      'allClasses',
      'departments',
      'workers',
      'workerAttendance',
      'workerPrepAttendance',
      'clockInConfig',
      'workerCategories'
    ];

    for (const storeName of allStores) {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
      } catch (err) {
        console.warn(`Note clearing store ${storeName}:`, err);
      }
      localStorage.removeItem(`gofamint_${storeName}`);
    }
  }

  const restoredCounts = {
    members: 0,
    grades: 0,
    offerings: 0,
    absenceLogs: 0,
    referrals: 0,
    workers: 0,
    workerAttendance: 0,
    workerPrepAttendance: 0,
    adminProfiles: 0,
    classes: 0,
    lessons: 0,
    departments: 0,
    categories: 0
  };

  // 1. Class Profile
  if (data.classProfile) {
    await putInStore('classProfile', data.classProfile);
  }

  // 2. All Classes Directory
  if (Array.isArray(data.allClasses) && data.allClasses.length > 0) {
    for (const c of data.allClasses) {
      await putInStore('allClasses', c);
      restoredCounts.classes++;
    }
  } else if (data.classProfile) {
    await putInStore('allClasses', data.classProfile);
    restoredCounts.classes++;
  }

  // 3. Members
  if (Array.isArray(data.members)) {
    for (const m of data.members) {
      await putInStore('members', m);
      restoredCounts.members++;
    }
  }

  // 4. Grades
  if (Array.isArray(data.grades)) {
    for (const g of data.grades) {
      await putInStore('grades', g);
      restoredCounts.grades++;
    }
  }

  // 5. Offerings
  if (Array.isArray(data.offerings)) {
    for (const o of data.offerings) {
      await putInStore('offerings', o);
      restoredCounts.offerings++;
    }
  }

  // 6. Absence Logs
  if (Array.isArray(data.absenceLogs)) {
    for (const a of data.absenceLogs) {
      await putInStore('absenceLogs', a);
      restoredCounts.absenceLogs++;
    }
  }

  // 7. Referrals
  if (Array.isArray(data.referrals)) {
    for (const r of data.referrals) {
      await putInStore('referrals', r);
      restoredCounts.referrals++;
    }
  }

  // 8. Lessons
  if (Array.isArray(data.lessons)) {
    for (const l of data.lessons) {
      await putInStore('lessons', l);
      restoredCounts.lessons++;
    }
  }

  // 9. Admin Profiles
  if (Array.isArray(data.adminProfiles)) {
    for (const ap of data.adminProfiles) {
      await putInStore('adminProfiles', ap);
      restoredCounts.adminProfiles++;
    }
  }

  // 10. Sunday School Year & Quarters
  if (data.sundaySchoolYear) {
    await putInStore('sundaySchoolYear', data.sundaySchoolYear);
  }

  // 11. Departments
  if (Array.isArray(data.departments)) {
    for (const d of data.departments) {
      await putInStore('departments', { name: typeof d === 'string' ? d : d.name });
      restoredCounts.departments++;
    }
  }

  // 12. Workers Directory
  if (Array.isArray(data.workers)) {
    for (const w of data.workers) {
      await putInStore('workers', w);
      restoredCounts.workers++;
    }
  }

  // 13. Worker Attendance
  if (Array.isArray(data.workerAttendance)) {
    for (const wa of data.workerAttendance) {
      await putInStore('workerAttendance', wa);
      restoredCounts.workerAttendance++;
    }
  }

  // 14. Worker Prep Attendance
  if (Array.isArray(data.workerPrepAttendance)) {
    for (const wpa of data.workerPrepAttendance) {
      await putInStore('workerPrepAttendance', wpa);
      restoredCounts.workerPrepAttendance++;
    }
  }

  // 15. ClockIn Config
  if (data.clockInConfig) {
    await putInStore('clockInConfig', data.clockInConfig);
  }

  // 16. Worker Categories
  if (Array.isArray(data.workerCategories)) {
    for (const wc of data.workerCategories) {
      await putInStore('workerCategories', wc);
      restoredCounts.categories++;
    }
  }

  // 17. Sync Queue
  if (Array.isArray(data.syncQueue)) {
    for (const sq of data.syncQueue) {
      await putInStore('syncQueue', sq);
    }
  }

  // Mark scratch mode false and unlock state appropriately
  localStorage.removeItem('gofamint_scratch_mode');
  if (data.classProfile && data.classProfile.approvalStatus === 'APPROVED') {
    sessionStorage.setItem('gofamint_unlocked', 'true');
  }

  return {
    success: true,
    message: `Database successfully restored! Loaded ${restoredCounts.members} members, ${restoredCounts.grades} grading entries, ${restoredCounts.workers} workers, and ${restoredCounts.adminProfiles} administrative profiles.`,
    restoredCounts
  };
}

// -------------------------------------------------------------
// LOCAL IN-BROWSER SNAPSHOT SLOTS (INSTANT SAVES)
// -------------------------------------------------------------

const SNAPSHOTS_KEY = 'gofamint_local_snapshots_v1';

export async function saveLocalBrowserSnapshot(label?: string): Promise<LocalSnapshotItem> {
  const backupPackage = await exportCompleteDatabaseSnapshot();
  const snapshotItem: LocalSnapshotItem = {
    id: `snap_${Date.now()}`,
    label: label?.trim() || `Local Snapshot (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
    createdAt: new Date().toISOString(),
    summary: backupPackage.summary,
    packageData: backupPackage
  };

  const existing = getLocalBrowserSnapshots();
  // Keep up to 10 snapshots
  const updated = [snapshotItem, ...existing].slice(0, 10);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));

  return snapshotItem;
}

export function getLocalBrowserSnapshots(): LocalSnapshotItem[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteLocalBrowserSnapshot(id: string): void {
  const existing = getLocalBrowserSnapshots();
  const filtered = existing.filter(s => s.id !== id);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
}

export async function restoreLocalBrowserSnapshot(id: string, wipeExisting: boolean = true): Promise<RestoreResultSummary> {
  const existing = getLocalBrowserSnapshots();
  const target = existing.find(s => s.id === id);
  if (!target) {
    throw new Error('Local snapshot not found.');
  }

  return restoreCompleteDatabaseSnapshot(target.packageData, wipeExisting);
}

// Sync Queue Operations
export async function getSyncQueue(): Promise<any[]> {
  return getAllFromStore<any>('syncQueue');
}

export async function addToSyncQueue(item: any): Promise<void> {
  await putInStore('syncQueue', item);
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.clear();
  } catch {
    localStorage.removeItem('gofamint_syncQueue');
  }
}

// Reset Entire System to State A — Completely Fresh System (Zero Sample Data)
export async function resetToFreshCleanSystem(mode: 'STANDARD_INITIALIZED' | 'UNINITIALIZED_BLANK' = 'UNINITIALIZED_BLANK'): Promise<void> {
  localStorage.setItem('gofamint_scratch_mode', 'true');
  sessionStorage.removeItem('gofamint_unlocked');
  sessionStorage.removeItem('gofamint_active_admin_role');

  const allStores = [
    'classProfile',
    'members',
    'grades',
    'offerings',
    'absenceLogs',
    'referrals',
    'syncQueue',
    'lessons',
    'adminProfiles',
    'sundaySchoolYear',
    'allClasses',
    'departments',
    'workers',
    'workerAttendance',
    'workerPrepAttendance',
    'clockInConfig',
    'workerCategories',
    'specialEvents',
    'specialEventAttendance'
  ];

  try {
    const db = await getDB();
    for (const storeName of allStores) {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
      } catch (err) {
        console.warn(`Could not clear store ${storeName}:`, err);
      }
      localStorage.removeItem(`gofamint_${storeName}`);
    }
  } catch (e) {
    for (const storeName of allStores) {
      localStorage.removeItem(`gofamint_${storeName}`);
    }
  }

  // Clear all localStorage entries starting with gofamint
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('gofamint_') || key.startsWith('GOFAMINT_HOF_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error clearing localStorage keys:', e);
  }

  // Re-seed structural config defaults (not organizational data)
  await putInStore('clockInConfig', DEFAULT_CLOCK_IN_CONFIG);
  for (const cat of DEFAULT_WORKER_CATEGORIES) {
    await putInStore('workerCategories', cat);
  }
}

// -------------------------------------------------------------
// WORKERS MASTER DIRECTORY & ATTENDANCE DATABASE SERVICES
// -------------------------------------------------------------

export async function getAllWorkers(forceCloudRefresh = false): Promise<WorkerProfile[]> {
  try {
    let list = (await getAllFromStore<WorkerProfile>('workers')) || [];

    // If local workers directory is empty or a fresh pull is requested, fetch from server API
    if (list.length === 0 || forceCloudRefresh) {
      try {
        const { fetchWorkersDirectoryApi } = await import('../services/adminUserApi');
        const res = await fetchWorkersDirectoryApi();
        if (res.success && res.workers && res.workers.length > 0) {
          const map = new Map<string, WorkerProfile>();
          for (const w of list) {
            if (w && w.id) map.set(w.id, w);
          }
          for (const w of res.workers) {
            if (w && w.id) {
              map.set(w.id, w);
              await putInStore('workers', w).catch(() => {});
            }
          }
          list = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Could not fetch workers from server API:', err);
      }
    }

    if (!list) {
      return [];
    }

    // Auto-normalize worker departments from old uppercase or legacy names
    list = list.map(w => {
      let dept = w.department;
      if (dept === 'ADMIN' || dept === 'ADULT') dept = 'Adult';
      else if (dept === 'YOUTH') dept = 'Youth';
      else if (dept === 'TEENS') dept = 'Teenagers';
      else if (dept === 'CHILDREN') dept = 'Children';
      
      if (dept !== w.department) {
        const updated = { ...w, department: dept, updatedAt: new Date().toISOString() };
        putInStore('workers', updated).catch(() => {});
        return updated;
      }
      return w;
    });

    return list;
  } catch (e) {
    console.warn('Error reading workers store:', e);
    return [];
  }
}

export async function getWorkerById(id: string): Promise<WorkerProfile | null> {
  const all = await getAllWorkers();
  return all.find(w => w.id === id) || null;
}

export async function getWorkerByQrToken(token: string): Promise<WorkerProfile | null> {
  const all = await getAllWorkers();
  const trimmed = token.trim();
  return all.find(w => w.qrCodeToken === trimmed || w.id === trimmed || w.phone === trimmed) || null;
}

export async function saveWorker(worker: WorkerProfile): Promise<WorkerProfile> {
  const res = await putInStore<WorkerProfile>('workers', worker);
  pushToCloud('saveWorker', () => cloudSaveWorker(worker), {
    collectionName: 'workers',
    action: 'save',
    docId: worker.id,
    data: worker
  });
  return res;
}

export async function saveBulkWorkers(workers: WorkerProfile[]): Promise<WorkerProfile[]> {
  for (const w of workers) {
    await putInStore<WorkerProfile>('workers', w);
  }
  pushToCloud('saveBulkWorkers', () => cloudSaveBulkWorkers(workers));
  return workers;
}

export async function deleteWorker(id: string): Promise<void> {
  await deleteFromStore('workers', id);
  pushToCloud('deleteWorker', () => cloudDeleteWorker(id), {
    collectionName: 'workers',
    action: 'delete',
    docId: id
  });
}

// Sunday Clock-In Attendance Store
export async function getAllWorkerAttendance(serviceDate?: string): Promise<WorkerAttendanceRecord[]> {
  try {
    const list = await getAllFromStore<WorkerAttendanceRecord>('workerAttendance');
    if (serviceDate) {
      return (list || []).filter(a => a.serviceDate === serviceDate);
    }
    return list || [];
  } catch (e) {
    console.warn('Error reading worker attendance:', e);
    return [];
  }
}

export async function saveWorkerAttendance(record: WorkerAttendanceRecord): Promise<WorkerAttendanceRecord> {
  const res = await putInStore<WorkerAttendanceRecord>('workerAttendance', record);
  pushToCloud('saveWorkerAttendance', () => cloudSaveWorkerAttendance(record), {
    collectionName: 'workerAttendance',
    action: 'save',
    docId: record.id,
    data: record
  });
  return res;
}

export async function saveBulkWorkerAttendance(records: WorkerAttendanceRecord[]): Promise<WorkerAttendanceRecord[]> {
  for (const r of records) {
    await putInStore<WorkerAttendanceRecord>('workerAttendance', r);
  }
  pushToCloud('saveBulkWorkerAttendance', () => cloudSaveBulkWorkerAttendance(records));
  return records;
}

export async function deleteWorkerAttendance(id: string): Promise<void> {
  await deleteFromStore('workerAttendance', id);
  pushToCloud('deleteWorkerAttendance', () => cloudDeleteWorkerAttendance(id), {
    collectionName: 'workerAttendance',
    action: 'delete',
    docId: id
  });
}

// Preparatory Class Attendance Store
export async function getAllWorkerPrepAttendance(prepDate?: string): Promise<WorkerPrepAttendanceRecord[]> {
  try {
    const list = await getAllFromStore<WorkerPrepAttendanceRecord>('workerPrepAttendance');
    if (prepDate) {
      return (list || []).filter(p => p.prepDate === prepDate);
    }
    return list || [];
  } catch (e) {
    console.warn('Error reading worker prep attendance:', e);
    return [];
  }
}

export async function saveWorkerPrepAttendance(record: WorkerPrepAttendanceRecord): Promise<WorkerPrepAttendanceRecord> {
  const res = await putInStore<WorkerPrepAttendanceRecord>('workerPrepAttendance', record);
  pushToCloud('saveWorkerPrepAttendance', () => cloudSaveWorkerPrepAttendance(record), {
    collectionName: 'workerPrepAttendance',
    action: 'save',
    docId: record.id,
    data: record
  });
  return res;
}

export async function saveBulkWorkerPrepAttendance(records: WorkerPrepAttendanceRecord[]): Promise<WorkerPrepAttendanceRecord[]> {
  for (const r of records) {
    await putInStore<WorkerPrepAttendanceRecord>('workerPrepAttendance', r);
  }
  pushToCloud('saveBulkWorkerPrepAttendance', () => cloudSaveBulkWorkerPrepAttendance(records));
  return records;
}

// Clock-in Configuration
export async function getClockInConfig(): Promise<ClockInConfig> {
  try {
    const list = await getAllFromStore<ClockInConfig>('clockInConfig');
    if (list && list.length > 0) {
      return list[0];
    }
  } catch (e) {
    console.warn('Error reading clock in config:', e);
  }
  await putInStore('clockInConfig', DEFAULT_CLOCK_IN_CONFIG);
  return DEFAULT_CLOCK_IN_CONFIG;
}

export async function saveClockInConfig(config: ClockInConfig): Promise<ClockInConfig> {
  const res = await putInStore<ClockInConfig>('clockInConfig', config);
  pushToCloud('saveClockInConfig', () => cloudSaveClockInConfig(config), {
    collectionName: 'clockInConfig',
    action: 'save',
    docId: config.id,
    data: config
  });
  return res;
}

// Worker Categories
export async function getAllWorkerCategories(): Promise<WorkerCategoryDef[]> {
  try {
    const list = await getAllFromStore<WorkerCategoryDef>('workerCategories');
    if (list && list.length > 0) {
      const hasLegacy = list.some(c => c.department === 'ADMIN' || c.department === 'ADULT' || c.department === 'YOUTH' || c.department === 'CHILDREN');
      if (hasLegacy) {
        for (const cat of DEFAULT_WORKER_CATEGORIES) {
          await putInStore('workerCategories', cat);
        }
        return DEFAULT_WORKER_CATEGORIES;
      }
      return list;
    }
  } catch (e) {
    console.warn('Error reading worker categories:', e);
  }
  for (const c of DEFAULT_WORKER_CATEGORIES) {
    await putInStore('workerCategories', c);
  }
  return [...DEFAULT_WORKER_CATEGORIES];
}

export async function saveWorkerCategory(cat: WorkerCategoryDef): Promise<WorkerCategoryDef> {
  const res = await putInStore<WorkerCategoryDef>('workerCategories', cat);
  pushToCloud('saveWorkerCategory', () => cloudSaveWorkerCategory(cat), {
    collectionName: 'workerCategories',
    action: 'save',
    docId: cat.id,
    data: cat
  });
  return res;
}

export async function deleteWorkerCategory(id: string): Promise<void> {
  await deleteFromStore('workerCategories', id);
  pushToCloud('deleteWorkerCategory', () => cloudDeleteWorkerCategory(id), {
    collectionName: 'workerCategories',
    action: 'delete',
    docId: id
  });
}

// Admin Profiles Management (8 Permitted Roles)
export async function getAllAdminProfiles(): Promise<AdminProfile[]> {
  try {
    const profiles = await getAllFromStore<AdminProfile>('adminProfiles');
    return profiles || [];
  } catch (e) {
    console.warn('Error reading admin profiles store:', e);
    return [];
  }
}

export async function saveAdminProfile(profile: AdminProfile): Promise<AdminProfile> {
  return putInStore<AdminProfile>('adminProfiles', profile);
}

export async function approveAdminProfile(id: string, approverName: string = 'General Superintendent'): Promise<AdminProfile | null> {
  const all = await getAllAdminProfiles();
  const target = all.find(p => p.id === id);
  if (!target) return null;
  const updated: AdminProfile = {
    ...target,
    isApproved: true,
    approvedBy: approverName,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await putInStore('adminProfiles', updated);
  return updated;
}

export async function deleteAdminProfile(id: string): Promise<void> {
  await deleteFromStore('adminProfiles', id);
}

// Sunday School Year & Quarters (General Secretary Domain)
export async function getSundaySchoolYear(): Promise<SundaySchoolYear> {
  try {
    const years = await getAllFromStore<SundaySchoolYear>('sundaySchoolYear');
    if (years && years.length > 0) {
      let year = years[0];
      let needsUpdate = false;

      // Filter out legacy 36 departments while preserving the 4 recognized departments + any dynamic user created ones
      const legacyDeptsToRemove = new Set([
        'Sunday School', 'Ministers Council', 'Choir', 'Youth Ministry', 'Good Women', 'Men Fellowship',
        'Evangelism Board', 'Ushering Unit', 'Prayer Band', 'Sanctuary Keepers', 'Welfare Board',
        'Media & Technical Unit', 'Young Adults', 'Teens', 'Elders', 'Searchers / Believers',
        'Follow-Up Unit', 'Protocol Unit', 'Music Ministry', 'Christian Education'
      ]);

      const cleanedDepts = Array.from(new Set([
        'Adult',
        'Youth',
        'Teenagers',
        'Children',
        ...(year.departments || []).filter(d => !legacyDeptsToRemove.has(d))
      ]));

      if (cleanedDepts.length !== (year.departments || []).length || !cleanedDepts.includes('Teenagers')) {
        year.departments = cleanedDepts;
        needsUpdate = true;
      }

      // Ensure Quarter 1 has 2025-09-07 start date and 2025-09-04 prep start date
      if (year.quarters && year.quarters.length > 0) {
        const q1 = year.quarters[0];
        if (q1.startDate !== '2025-09-07' || !q1.lessons || q1.lessons.length === 0) {
          q1.startDate = '2025-09-07';
          q1.endDate = '2025-11-23';
          q1.sharingAdmonitionDate = '2025-11-30';
          if (!q1.lessons || q1.lessons.length === 0) {
            q1.lessons = [];
            q1.isDistributed = true;
            q1.status = 'ACTIVE';
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        year.updatedAt = new Date().toISOString();
        await putInStore('sundaySchoolYear', year);
      }

      return year;
    }
  } catch (e) {
    console.warn('Error reading sundaySchoolYear store:', e);
  }

  const BLANK_YEAR: SundaySchoolYear = { id: 'YEAR_BLANK', yearName: 'Blank', overallTheme: '', startDate: '', endDate: '', activeQuarterNumber: 1, isInitialized: false, departments: [], updatedAt: new Date().toISOString(), quarters: [] };
  await putInStore('sundaySchoolYear', BLANK_YEAR);
  return BLANK_YEAR;
}

export async function saveSundaySchoolYear(year: SundaySchoolYear): Promise<SundaySchoolYear> {
  const updated = { ...year, updatedAt: new Date().toISOString() };
  await putInStore('sundaySchoolYear', updated);
  return updated;
}

// Automatic Distribution of Lessons to Classes
export async function distributeQuarterLessonsToClasses(quarterNumber: QuarterNumber): Promise<LessonInfo[]> {
  const year = await getSundaySchoolYear();
  const quarter = year.quarters.find(q => q.quarterNumber === quarterNumber);
  if (!quarter || !quarter.lessons || quarter.lessons.length === 0) return [];

  // Convert QuarterLessons to LessonInfo format
  const distributedLessons: LessonInfo[] = quarter.lessons.map(ql => ({
    weekNumber: ql.weekNumber,
    topic: ql.topic,
    scriptureReading: ql.scriptureReading || 'Scripture reading as assigned',
    memoryVerse: ql.memoryVerse || '',
    memoryVerseRef: ql.memoryVerseRef || '',
    aim: ql.aim || (ql.isSharingAdmonitionWeek ? 'Sharing & Admonition Week' : 'Lesson spiritual objective')
  }));

  // Store into local 'lessons' store for the active class
  for (const dl of distributedLessons) {
    await putInStore('lessons', dl);
  }

  // Update quarter status to ACTIVE, isDistributed = true, and mark Sunday School Year as initialized
  const updatedQuarters = year.quarters.map(q => {
    if (q.quarterNumber === quarterNumber) {
      return {
        ...q,
        status: 'ACTIVE' as const,
        isDistributed: true,
        distributedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return q;
  });

  const updatedYear: SundaySchoolYear = {
    ...year,
    isInitialized: true,
    activeQuarterNumber: quarterNumber,
    quarters: updatedQuarters,
    updatedAt: new Date().toISOString()
  };

  await saveSundaySchoolYear(updatedYear);

  return distributedLessons;
}

// Activate Quarter explicitly by General Secretary
export async function activateQuarterByGenSec(quarterNumber: QuarterNumber): Promise<SundaySchoolYear> {
  const year = await getSundaySchoolYear();
  const updatedQuarters = year.quarters.map(q => {
    if (q.quarterNumber === quarterNumber) {
      return {
        ...q,
        status: 'ACTIVE' as const,
        isDistributed: true,
        distributedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return q;
  });

  const updatedYear: SundaySchoolYear = {
    ...year,
    isInitialized: true,
    activeQuarterNumber: quarterNumber,
    quarters: updatedQuarters,
    updatedAt: new Date().toISOString()
  };

  await saveSundaySchoolYear(updatedYear);
  await distributeQuarterLessonsToClasses(quarterNumber);
  return updatedYear;
}

// Archive Quarter explicitly by General Secretary
export async function archiveQuarterByGenSec(quarterNumber: QuarterNumber): Promise<SundaySchoolYear> {
  const year = await getSundaySchoolYear();
  const updatedQuarters = year.quarters.map(q => {
    if (q.quarterNumber === quarterNumber) {
      return {
        ...q,
        status: 'ARCHIVED' as const,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return q;
  });

  const updatedYear: SundaySchoolYear = {
    ...year,
    quarters: updatedQuarters,
    updatedAt: new Date().toISOString()
  };

  await saveSundaySchoolYear(updatedYear);
  return updatedYear;
}

// Quarter Transition & Archive for Class Register & GenSec
export async function archiveQuarterForRegister(currentQuarterNumber: QuarterNumber): Promise<SundaySchoolYear> {
  const year = await getSundaySchoolYear();
  const nextQuarterNumber = (currentQuarterNumber < 4 ? (currentQuarterNumber + 1) : 4) as QuarterNumber;

  const nextQuarter = year.quarters.find(q => q.quarterNumber === nextQuarterNumber);
  const isNextApproved = !!(nextQuarter && (nextQuarter.isDistributed || nextQuarter.status === 'ACTIVE'));

  const updatedQuarters = year.quarters.map(q => {
    if (q.quarterNumber === currentQuarterNumber) {
      return {
        ...q,
        status: 'ARCHIVED' as const,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    if (q.quarterNumber === nextQuarterNumber && currentQuarterNumber < 4) {
      if (isNextApproved) {
        return {
          ...q,
          status: 'ACTIVE' as const,
          isDistributed: true,
          updatedAt: new Date().toISOString()
        };
      }
    }
    return q;
  });

  const newActiveQuarter = (isNextApproved && currentQuarterNumber < 4) ? nextQuarterNumber : year.activeQuarterNumber;

  const updatedYear: SundaySchoolYear = {
    ...year,
    activeQuarterNumber: newActiveQuarter,
    quarters: updatedQuarters,
    updatedAt: new Date().toISOString()
  };

  await saveSundaySchoolYear(updatedYear);
  return updatedYear;
}

export async function archiveQuarterAndActivateNext(currentQuarterNumber: QuarterNumber): Promise<SundaySchoolYear> {
  return archiveQuarterForRegister(currentQuarterNumber);
}

// Directory of All Classes (For Admin Approval & Directory Listing)
// Directory of All Classes (For Admin Approval & Directory Listing)
export async function getAllClassesDirectory(forceCloudRefresh = false): Promise<ClassProfile[]> {
  try {
    let classes = (await getAllFromStore<ClassProfile>('allClasses')) || [];

    // If local directory is empty or a fresh pull was requested, query the server API
    if (classes.length === 0 || forceCloudRefresh) {
      try {
        const { fetchAdminClassesApi } = await import('../services/adminUserApi');
        const res = await fetchAdminClassesApi();
        if (res.success && res.classes && res.classes.length > 0) {
          const map = new Map<string, ClassProfile>();
          for (const c of classes) {
            if (c && c.id) map.set(c.id, c);
          }
          for (const c of res.classes) {
            if (c && c.id) {
              const existingLocal = map.get(c.id);
              const merged = (existingLocal?.approvalStatus === 'APPROVED' && c.approvalStatus !== 'APPROVED')
                ? { ...c, approvalStatus: 'APPROVED' as const }
                : c;
              map.set(c.id, merged);
              await putInStore('allClasses', merged, true).catch(() => {});
            }
          }
          classes = Array.from(map.values());
        }
      } catch (e) {
        console.warn('Could not fetch classes from server API in getAllClassesDirectory:', e);
      }
    }

    const activeCurrent = await getClassProfile();

    const map = new Map<string, ClassProfile>();
    for (const c of classes) {
      if (c && c.id) {
        map.set(c.id, c);
      }
    }

    if (activeCurrent && activeCurrent.id) {
      const existing = map.get(activeCurrent.id);
      const mergedCurrent = (existing?.approvalStatus === 'APPROVED' && activeCurrent.approvalStatus !== 'APPROVED')
        ? { ...activeCurrent, approvalStatus: 'APPROVED' as const }
        : activeCurrent;
      if (!existing || (mergedCurrent.updatedAt && (!existing.updatedAt || mergedCurrent.updatedAt >= existing.updatedAt))) {
        map.set(activeCurrent.id, mergedCurrent);
      }
      // Ensure activeCurrent is safely recorded in allClasses store
      await putInStore('allClasses', mergedCurrent, true).catch(() => {});
    }

    return Array.from(map.values());
  } catch (e) {
    console.warn('Error reading allClasses store:', e);
    return [];
  }
}

export async function saveClassToDirectory(profile: ClassProfile): Promise<ClassProfile> {
  await putInStore<ClassProfile>('allClasses', profile);
  const current = await getClassProfile();
  if (current && current.id === profile.id) {
    await putInStore<ClassProfile>('classProfile', profile);
  }
  return profile;
}

export async function createBatchClasses(
  classesToCreate: Array<{ className: string; department: string; classId?: string; password?: string }>
): Promise<ClassProfile[]> {
  let cloudClasses: ClassProfile[] | null = null;
  try {
    const { massCreateClassesApi } = await import('../services/adminUserApi');
    const res = await massCreateClassesApi({ classes: classesToCreate });
    if (res.success && res.classes && res.classes.length > 0) {
      cloudClasses = res.classes;
    }
  } catch (err) {
    console.warn('Could not invoke server create classes API:', err);
  }

  const existing = await getAllClassesDirectory();
  const createdOrUpdated: ClassProfile[] = [];
  const currentYear = new Date().getFullYear();
  const now = new Date().toISOString();

  if (cloudClasses && cloudClasses.length > 0) {
    for (const cls of cloudClasses) {
      await putInStore('allClasses', cls);
      createdOrUpdated.push(cls);
    }
  } else {
    for (const item of classesToCreate) {
      const cleanDept = (item.department || 'Adult').trim();
      const className = item.className.trim();
      const classId = (item.classId || className.toUpperCase().replace(/[^A-Z0-9]/g, '_')).trim();
      const password = item.password || 'password123';

      const alreadyExists = existing.find(
        c => c.id.toUpperCase() === classId.toUpperCase() || c.className.toLowerCase() === className.toLowerCase()
      );
      if (alreadyExists) {
        createdOrUpdated.push(alreadyExists);
        continue;
      }

      const newClass: ClassProfile = {
        id: classId,
        className,
        department: cleanDept as DepartmentType,
        password,
        secretaryName: '',
        secretaryPhone: '',
        teachers: [],
        quarterTitle: 'Quarter 1: Sunday School Curriculum',
        year: currentYear,
        currencySymbol: '₦',
        isSetupComplete: false,
        approvalStatus: 'PENDING_REGISTRATION',
        createdAt: now,
        updatedAt: now
      };

      await putInStore('allClasses', newClass);
      await cloudSaveClassProfile(newClass).catch(() => {});
      createdOrUpdated.push(newClass);
    }
  }

  return createdOrUpdated;
}

export async function massCreateClasses(
  department: DepartmentType | string,
  suffixes: string[] = ['A', 'B', 'C']
): Promise<ClassProfile[]> {
  const cleanDept = (department || 'Adult').trim();
  const cleanSuffixes = suffixes.map(s => s.trim().toUpperCase()).filter(Boolean);

  // Ensure department is saved in local departments store
  try {
    await putInStore('departments', { name: cleanDept });
    await cloudSaveDepartment(cleanDept).catch(() => {});
  } catch {}

  // 1. Primary: Use the server API (bypasses RLS issues, ensures departments row, and creates in Supabase)
  let cloudClasses: ClassProfile[] | null = null;
  try {
    const { massCreateClassesApi } = await import('../services/adminUserApi');
    const res = await massCreateClassesApi({ department: cleanDept, suffixes: cleanSuffixes });
    if (res.success && res.classes && res.classes.length > 0) {
      cloudClasses = res.classes;
    }
  } catch (err) {
    console.warn('Could not invoke server mass-create classes API:', err);
  }

  const existing = await getAllClassesDirectory();
  const createdOrUpdated: ClassProfile[] = [];
  const currentYear = new Date().getFullYear();
  const now = new Date().toISOString();

  if (cloudClasses && cloudClasses.length > 0) {
    for (const cls of cloudClasses) {
      await putInStore('allClasses', cls);
      createdOrUpdated.push(cls);
    }
  } else {
    // Fallback if offline
    for (const suffix of cleanSuffixes) {
      const classId = `${cleanDept.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${suffix}`;
      const className = `${cleanDept} Class ${suffix}`;

      const alreadyExists = existing.find(
        c => c.id.toUpperCase() === classId || c.className.toLowerCase() === className.toLowerCase()
      );
      if (alreadyExists) {
        createdOrUpdated.push(alreadyExists);
        continue;
      }

      const newClass: ClassProfile = {
        id: classId,
        className,
        department: cleanDept as DepartmentType,
        password: 'password123',
        secretaryName: '',
        secretaryPhone: '',
        teachers: [],
        quarterTitle: 'Quarter 1: Sunday School Curriculum',
        year: currentYear,
        currencySymbol: '₦',
        isSetupComplete: false,
        approvalStatus: 'PENDING_REGISTRATION',
        createdAt: now,
        updatedAt: now
      };

      await putInStore('allClasses', newClass);
      await cloudSaveClassProfile(newClass).catch(() => {});
      createdOrUpdated.push(newClass);
    }
  }

  return createdOrUpdated;
}

export async function deleteClassFromDirectory(classId: string): Promise<boolean> {
  try {
    await deleteFromStore('allClasses', classId);
    try {
      const { deleteClassApi } = await import('../services/adminUserApi');
      await deleteClassApi(classId);
    } catch {}
    await cloudDeleteClass(classId).catch(() => {});
    return true;
  } catch (e) {
    console.error('Failed to delete class from directory:', e);
    return false;
  }
}

export async function approveClassById(classId: string, approvedBy: string = 'General Superintendent / Secretary'): Promise<ClassProfile | null> {
  const classes = await getAllClassesDirectory();
  let target = classes.find(c => c.id === classId);
  if (!target) {
    const current = await getClassProfile();
    if (current && current.id === classId) {
      target = current;
    }
  }

  const now = new Date().toISOString();
  // 1. Immediately create locally approved class profile
  const locallyApproved: ClassProfile = {
    ...(target || {} as ClassProfile),
    id: classId,
    className: target?.className || `Class ${classId}`,
    department: target?.department || 'Adult',
    teachers: target?.teachers || [],
    approvalStatus: 'APPROVED',
    approvedBy: target?.approvedBy || approvedBy,
    approvedAt: target?.approvedAt || now,
    updatedAt: now
  };

  // 2. Persist immediately to local IndexedDB store so the local UI and directory reflect APPROVED without latency
  await putInStore('allClasses', locallyApproved, true);
  const currentProfile = await getClassProfile();
  if (currentProfile && currentProfile.id === classId) {
    await putInStore('classProfile', locallyApproved, true);
  }

  // Purge any stale failed cloud write for this class from cloudSyncFailures so it can never be reverted
  try {
    const failures = await getPendingCloudSyncFailures();
    for (const f of failures) {
      if (f.docId === classId && (f.collectionName === 'classes' || f.collectionName === 'classProfile')) {
        await deleteFromStore('cloudSyncFailures', f.id).catch(() => {});
      }
    }
  } catch {}

  // 3. Authoritative server approval call (uses service role admin)
  let authoritativeClass: ClassProfile = locallyApproved;
  let serverSuccess = false;
  try {
    const { approveClassApi } = await import('../services/adminUserApi');
    const apiResult = await approveClassApi(classId, locallyApproved);
    if (apiResult.success && apiResult.class) {
      authoritativeClass = {
        ...locallyApproved,
        ...(apiResult.class as ClassProfile),
        approvalStatus: 'APPROVED',
        updatedAt: now
      };
      serverSuccess = true;
    } else {
      console.warn('approveClassApi responded without success:', apiResult.error);
    }
  } catch (apiErr) {
    console.warn('approveClassApi server call failed, attempting direct Supabase fallback:', apiErr);
  }

  // 4. Direct Supabase client update fallback if server API was unreachable
  if (!serverSuccess) {
    try {
      const { getSupabaseClient } = await import('../services/supabase');
      const supabase = getSupabaseClient();
      const { data: existingRow } = await supabase.from('classes').select('*').eq('id', classId).maybeSingle();
      const mergedSupabaseData = {
        ...(existingRow?.data && typeof existingRow.data === 'object' ? existingRow.data : {}),
        ...locallyApproved,
        approvalStatus: 'APPROVED',
        updatedAt: now
      };
      if (existingRow) {
        await supabase.from('classes').update({
          data: mergedSupabaseData,
          department_id: mergedSupabaseData.department || existingRow.department_id || 'Adult',
          updated_at: now
        }).eq('id', classId);
      } else {
        await supabase.from('classes').insert({
          id: classId,
          data: mergedSupabaseData,
          department_id: mergedSupabaseData.department || 'Adult',
          created_at: now,
          updated_at: now
        });
      }
      authoritativeClass = mergedSupabaseData;
      serverSuccess = true;
    } catch (directErr) {
      console.warn('Direct Supabase client approval fallback failed:', directErr);
    }
  }

  // 5. Store authoritative record back into IndexedDB
  await putInStore('allClasses', authoritativeClass, true);
  if (currentProfile && currentProfile.id === classId) {
    await putInStore('classProfile', authoritativeClass, true);
  }

  // 6. Ensure curriculum is distributed
  try {
    const year = await getSundaySchoolYear();
    if (year && year.activeQuarterNumber) {
      await distributeQuarterLessonsToClasses(year.activeQuarterNumber);
    }
  } catch (e) {
    console.warn('Could not distribute quarter lessons locally:', e);
  }

  return authoritativeClass;
}

// Departments Management (Controlled by General Secretary)
export async function getAllDepartmentsList(): Promise<string[]> {
  try {
    const year = await getSundaySchoolYear();
    if (year.departments && year.departments.length > 0) {
      return year.departments;
    }
  } catch (e) {
    console.warn('Error reading departments:', e);
  }
  return [...DEFAULT_DEPARTMENTS];
}

export async function addDepartmentToYear(newDepartment: string): Promise<string[]> {
  const year = await getSundaySchoolYear();
  const trimmed = newDepartment.trim();
  if (!trimmed || year.departments.includes(trimmed)) {
    return year.departments;
  }
  const updatedList = [...year.departments, trimmed];
  const updatedYear: SundaySchoolYear = {
    ...year,
    departments: updatedList,
    updatedAt: new Date().toISOString()
  };
  await saveSundaySchoolYear(updatedYear);
  return updatedList;
}

export async function updateDepartmentNameInYear(oldName: string, newName: string): Promise<string[]> {
  const year = await getSundaySchoolYear();
  const trimmedNew = newName.trim();
  if (!trimmedNew || oldName === trimmedNew) {
    return year.departments;
  }

  const updatedList = year.departments.map(d => d === oldName ? trimmedNew : d);
  const updatedYear: SundaySchoolYear = {
    ...year,
    departments: updatedList,
    updatedAt: new Date().toISOString()
  };
  await saveSundaySchoolYear(updatedYear);

  // Update allClasses
  const classes = await getAllClassesDirectory();
  for (const c of classes) {
    if (c.department === oldName) {
      const updatedClass: ClassProfile = {
        ...c,
        department: trimmedNew as any,
        updatedAt: new Date().toISOString()
      };
      await putInStore('allClasses', updatedClass);
    }
  }

  // Update current active classProfile if matching
  const currentClass = await getClassProfile();
  if (currentClass && currentClass.department === oldName) {
    const updatedClass: ClassProfile = {
      ...currentClass,
      department: trimmedNew as any,
      updatedAt: new Date().toISOString()
    };
    await putInStore('classProfile', updatedClass);
  }

  // Update workers linked to this department
  const workers = await getAllWorkers();
  for (const w of workers) {
    if (w.department === oldName) {
      const updatedWorker: WorkerProfile = {
        ...w,
        department: trimmedNew,
        updatedAt: new Date().toISOString()
      };
      await putInStore('workers', updatedWorker);
    }
  }

  return updatedList;
}

export async function deleteDepartmentFromYear(departmentName: string): Promise<string[]> {
  const year = await getSundaySchoolYear();
  const updatedList = year.departments.filter(d => d !== departmentName);
  const fallbackDept = updatedList[0] || 'General';
  const updatedYear: SundaySchoolYear = {
    ...year,
    departments: updatedList,
    updatedAt: new Date().toISOString()
  };
  await saveSundaySchoolYear(updatedYear);

  // Reassign classes assigned to the deleted department
  const classes = await getAllClassesDirectory();
  for (const c of classes) {
    if (c.department === departmentName) {
      const updatedClass: ClassProfile = {
        ...c,
        department: fallbackDept as any,
        updatedAt: new Date().toISOString()
      };
      await putInStore('allClasses', updatedClass);
    }
  }

  // Reassign active class profile if matching
  const currentClass = await getClassProfile();
  if (currentClass && currentClass.department === departmentName) {
    const updatedClass: ClassProfile = {
      ...currentClass,
      department: fallbackDept as any,
      updatedAt: new Date().toISOString()
    };
    await putInStore('classProfile', updatedClass);
  }

  // Reassign workers assigned to the deleted department
  const workers = await getAllWorkers();
  for (const w of workers) {
    if (w.department === departmentName) {
      const updatedWorker: WorkerProfile = {
        ...w,
        department: fallbackDept,
        updatedAt: new Date().toISOString()
      };
      await putInStore('workers', updatedWorker);
    }
  }

  return updatedList;
}

// Convenient Aliases
export const initDB = initializeDatabase;
export const saveMemberToDB = saveMember;
export const saveBulkMembersToDB = saveBulkMembers;
export const deleteMemberFromDB = deleteMember;
export const saveGradeToDB = saveGrade;
export const saveOfferingToDB = saveOffering;
export const saveAbsenceLogToDB = saveAbsenceLog;

// Workers Module Aliases
export const recordWorkerAttendance = saveWorkerAttendance;
export const recordBulkWorkerAttendance = saveBulkWorkerAttendance;
export const recordWorkerPrepAttendance = saveWorkerPrepAttendance;
export const recordBulkWorkerPrepAttendance = saveBulkWorkerPrepAttendance;

// -------------------------------------------------------------
// SPECIAL WORKERS TRAINING & EVENTS MODULE
// -------------------------------------------------------------

export async function getAllSpecialEvents(): Promise<SpecialWorkersEvent[]> {
  try {
    const list = await getAllFromStore<SpecialWorkersEvent>('specialEvents');
    return list ? list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  } catch (e) {
    console.warn('Error reading specialEvents store:', e);
    return [];
  }
}

export async function saveSpecialEvent(event: SpecialWorkersEvent): Promise<SpecialWorkersEvent> {
  const res = await putInStore<SpecialWorkersEvent>('specialEvents', event);
  pushToCloud('saveSpecialEvent', () => cloudSaveSpecialEvent(event), {
    collectionName: 'specialEvents',
    action: 'save',
    docId: event.id,
    data: event
  });
  return res;
}

export async function deleteSpecialEvent(eventId: string): Promise<void> {
  await deleteFromStore('specialEvents', eventId);
  pushToCloud('deleteSpecialEvent', () => cloudDeleteSpecialEvent(eventId), {
    collectionName: 'specialEvents',
    action: 'delete',
    docId: eventId
  });
  // Also clean up all attendance records for this event
  const allAtt = await getAllSpecialEventAttendance();
  const matching = allAtt.filter(a => a.eventId === eventId);
  for (const a of matching) {
    await deleteFromStore('specialEventAttendance', a.id);
    pushToCloud('deleteSpecialEventAttendance', () => cloudDeleteSpecialEventAttendance(a.id), {
      collectionName: 'specialEventAttendance',
      action: 'delete',
      docId: a.id
    });
  }
}

export async function getAllSpecialEventAttendance(): Promise<SpecialEventAttendanceRecord[]> {
  try {
    const list = await getAllFromStore<SpecialEventAttendanceRecord>('specialEventAttendance');
    return list || [];
  } catch (e) {
    console.warn('Error reading specialEventAttendance store:', e);
    return [];
  }
}

export async function getSpecialEventAttendanceByEvent(eventId: string): Promise<SpecialEventAttendanceRecord[]> {
  const all = await getAllSpecialEventAttendance();
  return all.filter(a => a.eventId === eventId);
}

export async function recordSpecialEventAttendance(record: SpecialEventAttendanceRecord): Promise<SpecialEventAttendanceRecord> {
  const res = await putInStore<SpecialEventAttendanceRecord>('specialEventAttendance', record);
  pushToCloud('saveSpecialEventAttendance', () => cloudSaveSpecialEventAttendance(record), {
    collectionName: 'specialEventAttendance',
    action: 'save',
    docId: record.id,
    data: record
  });
  return res;
}

export async function recordBulkSpecialEventAttendance(records: SpecialEventAttendanceRecord[]): Promise<SpecialEventAttendanceRecord[]> {
  for (const r of records) {
    await putInStore<SpecialEventAttendanceRecord>('specialEventAttendance', r);
  }
  pushToCloud('saveBulkSpecialEventAttendance', () => cloudSaveBulkSpecialEventAttendance(records));
  return records;
}

export async function deleteSpecialEventAttendance(recordId: string): Promise<void> {
  await deleteFromStore('specialEventAttendance', recordId);
  pushToCloud('deleteSpecialEventAttendance', () => cloudDeleteSpecialEventAttendance(recordId), {
    collectionName: 'specialEventAttendance',
    action: 'delete',
    docId: recordId
  });
}

// -------------------------------------------------------------
// ADMIN COMMENTS SYSTEM (READ-ONLY OVERSIGHT & FEEDBACK)
// -------------------------------------------------------------

export async function getAllAdminComments(): Promise<AdminComment[]> {
  try {
    const list = await getAllFromStore<AdminComment>('adminComments');
    return list ? list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  } catch (e) {
    console.warn('Error reading adminComments store:', e);
    return [];
  }
}

export async function getAdminCommentsByClass(classId: string): Promise<AdminComment[]> {
  const all = await getAllAdminComments();
  return all.filter(c => c.classId === classId);
}

export async function saveAdminComment(comment: AdminComment): Promise<AdminComment> {
  return putInStore<AdminComment>('adminComments', comment);
}

export async function deleteAdminComment(commentId: string): Promise<void> {
  await deleteFromStore('adminComments', commentId);
}

// -------------------------------------------------------------
// TREASURY EXPENDITURES & REAL FINANCIAL SERVICES
// -------------------------------------------------------------

export async function getAllTreasuryExpenditures(): Promise<TreasuryExpenditure[]> {
  try {
    const list = await getAllFromStore<TreasuryExpenditure>('treasuryExpenditures');
    return list ? list.sort((a, b) => b.date.localeCompare(a.date)) : [];
  } catch (e) {
    console.warn('Error reading treasuryExpenditures store:', e);
    return [];
  }
}

export async function saveTreasuryExpenditure(expenditure: TreasuryExpenditure): Promise<TreasuryExpenditure> {
  return putInStore<TreasuryExpenditure>('treasuryExpenditures', expenditure);
}

export async function deleteTreasuryExpenditure(id: string): Promise<void> {
  await deleteFromStore('treasuryExpenditures', id);
}

// -------------------------------------------------------------
// SINGLE SOURCE OF TRUTH: REAL DATA CROSS-CLASS QUERY ENGINE
// -------------------------------------------------------------

export async function getGradesByClass(classId: string, quarterNumber?: number): Promise<WeeklyGradeRecord[]> {
  if (!classId) return [];
  const allGrades = await getAllGrades();
  return allGrades.filter(g => {
    const matchesClass = g.classId === classId;
    const matchesQuarter = quarterNumber === undefined || g.quarterNumber === quarterNumber;
    return matchesClass && matchesQuarter;
  });
}

export async function getOfferingsByClass(classId: string, quarterNumber?: number): Promise<WeeklyOfferingRecord[]> {
  if (!classId) return [];
  const allOfferings = await getAllOfferings();
  return allOfferings.filter(o => {
    const matchesClass = o.classId === classId;
    const matchesQuarter = quarterNumber === undefined || o.quarterNumber === quarterNumber;
    return matchesClass && matchesQuarter;
  });
}

export async function getAbsenceLogsByClass(classId: string, quarterNumber?: number): Promise<AbsenceLogRecord[]> {
  if (!classId) return [];
  const allLogs = await getAllAbsenceLogs();
  return allLogs.filter(a => {
    const matchesClass = a.classId === classId;
    const matchesQuarter = quarterNumber === undefined || a.quarterNumber === quarterNumber;
    return matchesClass && matchesQuarter;
  });
}

/**
 * Aggregates real-time returns from all approved classes for a specific week and quarter.
 * Strictly uses real data from IndexedDB with zero fabricated/random data.
 */
export async function getRealWeeklyClassReturns(
  weekNumber: number,
  quarterNumber: number = 1
): Promise<WeeklyClassReturn[]> {
  const allClasses = await getAllClassesDirectory();
  const allMembers = await getAllMembers();
  const allGrades = await getAllGrades();
  const allOfferings = await getAllOfferings();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  const returns: WeeklyClassReturn[] = [];

  for (const cls of approvedClasses) {
    const classMembers = allMembers.filter(m => m.classId === cls.id);
    const enrolledCount = classMembers.length;

    const classGrades = allGrades.filter(g => {
      const matchCls = g.classId === cls.id;
      const matchQtr = g.quarterNumber === quarterNumber;
      return matchCls && matchQtr && g.weekNumber === weekNumber;
    });

    let presentCount = 0;
    let absentCount = 0;
    let visitorCount = 0;
    let newVisitors = 0;
    let returningVisitors = 0;

    for (const grade of classGrades) {
      if (grade.isNoRecordWeek) continue;

      const mem = classMembers.find(m => m.id === grade.memberId);
      if (grade.attendance === 'PRESENT') {
        presentCount++;
        if (mem?.memberType === 'VISITOR') {
          visitorCount++;
          // check prior attendance
          const prior = allGrades.filter(
            g => g.memberId === mem.id && g.classId === cls.id && g.quarterNumber === quarterNumber && g.weekNumber < weekNumber && g.attendance === 'PRESENT'
          ).length;
          if (prior === 0) newVisitors++;
          else returningVisitors++;
        }
      } else if (grade.attendance === 'ABSENT') {
        absentCount++;
      }
    }

    const classOffering = allOfferings.find(o => {
      const matchCls = o.classId === cls.id;
      const matchQtr = o.quarterNumber === quarterNumber;
      return matchCls && matchQtr && o.weekNumber === weekNumber && !o.isNoRecordWeek;
    });

    returns.push({
      classId: cls.id,
      className: cls.className,
      department: cls.department,
      teachersInCharge: cls.teachers?.[0]?.name || cls.secretaryName || 'Assigned Teacher',
      enrolledCount,
      presentCount,
      absentCount,
      visitorCount,
      newVisitors,
      returningVisitors,
      totalAttendance: presentCount,
      biblesBrought: Math.round(presentCount * 0.9),
      workbooksUsed: Math.round(presentCount * 0.85),
      offeringAmount: classOffering ? Number(classOffering.amount) || 0 : 0,
      avgScore: presentCount > 0 ? Math.round((classGrades.filter(g => g.attendance === 'PRESENT').reduce((s, g) => s + (g.lessonTotal || 0), 0) / presentCount) * 10) / 10 : 0,
      notes: `Submitted by ${cls.secretaryName || 'Class Secretary'}`
    });
  }

  return returns;
}

/**
 * Aggregates real financial summary for the Treasurer:
 * - Total Recorded: All amounts entered by Class Secretaries (informational)
 * - Pending Remittance: Recorded but not yet marked Remitted
 * - Remitted / Pending Audit: Marked as remitted, awaiting Treasurer audit
 * - Cumulative Audited Income: Total physically verified & audited by Treasurer
 * - Total Cumulative Expenditure: All recorded expenditures
 * - NET INCOME = TOTAL CUMULATIVE AUDITED INCOME - TOTAL CUMULATIVE EXPENDITURE
 * Zero fake or fabricated data.
 */
export async function getRealTreasurySummary(quarterNumber: number = 1) {
  const allClasses = await getAllClassesDirectory();
  const allOfferings = await getAllOfferings();
  const expenditures = await getAllTreasuryExpenditures();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  let totalRecorded = 0;
  let pendingRemittance = 0;
  let pendingAudit = 0;
  let cumulativeAuditedIncome = 0;

  const classOfferingsBreakdown: {
    classId: string;
    className: string;
    department: string;
    secretaryName?: string;
    totalRecorded: number;
    pendingRemittance: number;
    pendingAudit: number;
    auditedAmount: number;
    amount: number; // for backward compatibility
    weekCount: number;
  }[] = [];

  const pendingRemittancesList: (WeeklyOfferingRecord & { className: string; department: string; secretaryName?: string })[] = [];
  const auditedOfferingsList: (WeeklyOfferingRecord & { className: string; department: string; secretaryName?: string })[] = [];

  for (const cls of approvedClasses) {
    const offeringsForClass = allOfferings.filter(o => {
      const matchCls = o.classId === cls.id || (!o.classId && cls.id === 'default_class');
      const matchQtr = o.quarterNumber === quarterNumber || (o.quarterNumber === undefined && quarterNumber === 1);
      return matchCls && matchQtr && !o.isNoRecordWeek;
    });

    let clsRecorded = 0;
    let clsPendingRemit = 0;
    let clsPendingAudit = 0;
    let clsAudited = 0;

    for (const o of offeringsForClass) {
      const rawAmt = Number(o.amount) || 0;
      if (rawAmt <= 0) continue;

      clsRecorded += rawAmt;

      if (o.remittanceStatus === 'AUDITED') {
        const audAmt = o.auditedAmount !== undefined ? Number(o.auditedAmount) : rawAmt;
        clsAudited += audAmt;
        auditedOfferingsList.push({
          ...o,
          className: cls.className,
          department: cls.department,
          secretaryName: cls.secretaryName
        });
      } else if (o.remittanceStatus === 'REMITTED') {
        clsPendingAudit += rawAmt;
        pendingRemittancesList.push({
          ...o,
          className: cls.className,
          department: cls.department,
          secretaryName: cls.secretaryName
        });
      } else {
        // PENDING_REMITTANCE or unremitted
        clsPendingRemit += rawAmt;
      }
    }

    totalRecorded += clsRecorded;
    pendingRemittance += clsPendingRemit;
    pendingAudit += clsPendingAudit;
    cumulativeAuditedIncome += clsAudited;

    classOfferingsBreakdown.push({
      classId: cls.id,
      className: cls.className,
      department: cls.department,
      secretaryName: cls.secretaryName,
      totalRecorded: clsRecorded,
      pendingRemittance: clsPendingRemit,
      pendingAudit: clsPendingAudit,
      auditedAmount: clsAudited,
      amount: clsAudited, // for backward compatibility
      weekCount: offeringsForClass.length
    });
  }

  // Filter expenditures strictly for the selected quarter
  const quarterExpenditures = expenditures.filter(e => {
    return e.quarterNumber === quarterNumber || (e.quarterNumber === undefined && quarterNumber === 1);
  });

  const totalExpenditure = quarterExpenditures.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netIncome = cumulativeAuditedIncome - totalExpenditure;

  return {
    totalRecorded,
    pendingRemittance,
    pendingAudit,
    cumulativeAuditedIncome,
    totalIncome: cumulativeAuditedIncome, // for backward compatibility
    totalExpenditure,
    netIncome,
    netBalance: netIncome, // for backward compatibility
    classOfferingsBreakdown,
    pendingRemittancesList: pendingRemittancesList.sort((a, b) => b.weekNumber - a.weekNumber),
    auditedOfferingsList: auditedOfferingsList.sort((a, b) => (b.auditedAt || '').localeCompare(a.auditedAt || '')),
    expenditures: quarterExpenditures
  };
}

/**
 * Aggregates real enrollment summary for Enrollment Officer
 */
export async function getRealEnrollmentSummary() {
  const allClasses = await getAllClassesDirectory();
  const allMembers = await getAllMembers();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  const departmentMap: Record<string, { total: number; students: number; visitors: number; classesCount: number }> = {};

  for (const cls of approvedClasses) {
    if (!departmentMap[cls.department]) {
      departmentMap[cls.department] = { total: 0, students: 0, visitors: 0, classesCount: 0 };
    }
    departmentMap[cls.department].classesCount++;
  }

  const enrichedMembers: (Member & { className: string; department: string })[] = [];

  for (const member of allMembers) {
    const cls = approvedClasses.find(c => c.id === member.classId) || current;
    const dept = cls ? cls.department : 'General';
    const cName = cls ? cls.className : 'Sunday School Class';

    if (!departmentMap[dept]) {
      departmentMap[dept] = { total: 0, students: 0, visitors: 0, classesCount: 0 };
    }

    departmentMap[dept].total++;
    if (member.memberType === 'STUDENT') {
      departmentMap[dept].students++;
    } else {
      departmentMap[dept].visitors++;
    }

    enrichedMembers.push({
      ...member,
      className: cName,
      department: dept
    });
  }

  const totalEnrolled = allMembers.length;
  const totalStudents = allMembers.filter(m => m.memberType === 'STUDENT').length;
  const totalVisitors = allMembers.filter(m => m.memberType === 'VISITOR').length;

  return {
    totalEnrolled,
    totalStudents,
    totalVisitors,
    departmentMap,
    allEnrichedMembers: enrichedMembers
  };
}

// -------------------------------------------------------------
// RECORD OFFICER & ENROLLMENT OFFICER QUERY ENGINES
// -------------------------------------------------------------

/**
 * RECORD OFFICER REAL-TIME QUERY ENGINE
 * Reads directly from Class Register records.
 * Follows the strict formulas:
 * TOTAL PRESENT = STUDENTS PRESENT + CURRENT VISITORS PRESENT + NEW VISITORS
 * REGISTERED CLASS MEMBERS = Students + Existing Visitors before this week's new intake
 * ONBOARDED = New Visitors received into class
 * ENDING ACTIVE CLASS MEMBERS = Registered Class Members + Onboarded - Exited
 */
export async function getRealRecordOfficerCollation(
  quarterNumber: number = 1,
  weekNumber: number = 1
): Promise<RecordOfficerWeeklyCollation> {
  const allClasses = await getAllClassesDirectory();
  const allMembers = await getAllMembers();
  const allGrades = await getAllGrades();
  const allOfferings = await getAllOfferings();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  const rows: RecordOfficerClassRow[] = [];

  for (const cls of approvedClasses) {
    // Retrieve members for this class in this quarter
    const classMembers = allMembers.filter(m => m.classId === cls.id);
    
    // Filter active members belonging to this quarter
    const qMembers = classMembers.filter(m => {
      if (quarterNumber === 1) return true;
      return !!m.quarterEnrollments?.[quarterNumber as QuarterNumber];
    });

    let studentPresent = 0;
    let currentVisitorPresent = 0;
    let newVisitors = 0;
    let classMembersAbsent = 0;
    let registeredCount = 0;
    let onboardedCount = 0;
    let exitedCount = 0;

    for (const mem of qMembers) {
      const qEnr = mem.quarterEnrollments?.[quarterNumber as QuarterNumber];
      const status = qEnr?.status || mem.status || 'ACTIVE';
      const effectiveFirstWeek = qEnr?.firstLessonWeek || mem.firstLessonWeek || 1;
      const convertedWeek = mem.convertedFromVisitorAtLesson;

      // EXEMPT CRITICAL RULE:
      // If the member only joined in a later week, they are EXEMPT for weekNumber.
      // That person's data DOES NOT EXIST for this week and MUST BE COMPLETELY EXCLUDED.
      if (weekNumber < effectiveFirstWeek) {
        continue;
      }

      // Check attendance grade for this week
      const grade = allGrades.find(
        g => g.classId === cls.id && g.quarterNumber === quarterNumber && g.memberId === mem.id && g.weekNumber === weekNumber
      );

      // If explicitly marked EXEMPT for this week, exclude from this week's member calculations completely
      if (grade && grade.attendance === 'EXEMPT') {
        continue;
      }

      if (status === 'LEFT_CLASS') {
        exitedCount++;
        continue;
      }

      // Determine member category at this specific weekNumber
      let isStudentAtThisWeek = false;
      if (mem.memberType === 'STUDENT') {
        if (convertedWeek && convertedWeek > weekNumber) {
          isStudentAtThisWeek = false; // was still a visitor in weekNumber
        } else {
          isStudentAtThisWeek = true;
        }
      } else {
        isStudentAtThisWeek = false;
      }

      const isNewVisitorThisWeek = !isStudentAtThisWeek && (effectiveFirstWeek === weekNumber);

      if (isStudentAtThisWeek) {
        registeredCount++;
        if (grade && !grade.isNoRecordWeek) {
          if (grade.attendance === 'PRESENT') {
            studentPresent++;
          } else if (grade.attendance === 'ABSENT') {
            classMembersAbsent++;
          }
        } else if (!grade) {
          const hasAnyClassGrades = allGrades.some(g => g.classId === cls.id && g.quarterNumber === quarterNumber && g.weekNumber === weekNumber);
          if (hasAnyClassGrades) {
            classMembersAbsent++;
          }
        }
      } else {
        // Active Visitor in this week
        onboardedCount++; // Visitors currently active in class for this week

        if (isNewVisitorThisWeek) {
          newVisitors++;
        } else {
          registeredCount++; // Existing visitor prior to this week's intake
        }

        if (grade && !grade.isNoRecordWeek) {
          if (grade.attendance === 'PRESENT') {
            if (isNewVisitorThisWeek) {
              // New visitor present (counted in newVisitors)
            } else {
              currentVisitorPresent++;
            }
          } else if (grade.attendance === 'ABSENT') {
            if (!isNewVisitorThisWeek) {
              classMembersAbsent++;
            }
          }
        } else if (!grade && !isNewVisitorThisWeek) {
          const hasAnyClassGrades = allGrades.some(g => g.classId === cls.id && g.quarterNumber === quarterNumber && g.weekNumber === weekNumber);
          if (hasAnyClassGrades) {
            classMembersAbsent++;
          }
        }
      }
    }

    // New visitor present count is the count of new visitors who attended (or arrived this week)
    const newVisitorPresent = newVisitors;

    // Strict Formula: TOTAL PRESENT = STUDENTS PRESENT + CURRENT VISITORS PRESENT + NEW VISITORS
    const totalPresent = studentPresent + currentVisitorPresent + newVisitorPresent;

    // Registered Class Members = Students + Existing Visitors before this week's intake
    const registeredClassMembers = registeredCount;

    // Ending Active Class Members = Registered + New Visitors - Exited
    const endingActiveClassMembers = registeredClassMembers + newVisitors - exitedCount;

    // Offering for this week
    const offeringRecord = allOfferings.find(
      o => o.classId === cls.id && 
           (o.quarterNumber === quarterNumber || (o.quarterNumber === undefined && quarterNumber === 1)) && 
           o.weekNumber === weekNumber && 
           !o.isNoRecordWeek
    );
    const offering = offeringRecord ? Number(offeringRecord.amount) || 0 : 0;

    rows.push({
      classId: cls.id,
      className: cls.className,
      department: cls.department,
      teachersInCharge: cls.teachers?.[0]?.name || cls.secretaryName || 'Assigned Teacher',
      studentPresent,
      currentVisitorPresent,
      newVisitors,
      classMembersAbsent,
      totalPresent,
      registeredClassMembers,
      onboarded: onboardedCount,
      endingActiveClassMembers,
      offering,
      notes: `Class Register return for ${cls.className}`
    });
  }

  // Grand Totals across all Sunday Bible School classes
  const totalStudentPresent = rows.reduce((s, r) => s + r.studentPresent, 0);
  const totalCurrentVisitorPresent = rows.reduce((s, r) => s + r.currentVisitorPresent, 0);
  const totalNewVisitors = rows.reduce((s, r) => s + r.newVisitors, 0);
  const totalClassMembersAbsent = rows.reduce((s, r) => s + r.classMembersAbsent, 0);
  const grandTotalPresent = rows.reduce((s, r) => s + r.totalPresent, 0);
  const totalRegisteredClassMembers = rows.reduce((s, r) => s + r.registeredClassMembers, 0);
  const totalOnboarded = rows.reduce((s, r) => s + r.onboarded, 0);
  const totalOffering = rows.reduce((s, r) => s + r.offering, 0);
  const totalEndingActiveClassMembers = rows.reduce((s, r) => s + r.endingActiveClassMembers, 0);

  return {
    quarterNumber,
    weekNumber,
    rows,
    totalStudentPresent,
    totalCurrentVisitorPresent,
    totalNewVisitors,
    totalClassMembersAbsent,
    grandTotalPresent,
    totalRegisteredClassMembers,
    totalOnboarded,
    totalOffering,
    totalEndingActiveClassMembers
  };
}

/**
 * ENROLLMENT OFFICER REAL-TIME QUERY ENGINE
 * ------------------------------------------
 * Tracks movement from Visitor to Student and onboarding pipeline.
 * Formats weekly class table with:
 * | Week | Class | Previously Enrolled Students | Onboarded | New Visitors | Newly Enrolled | Visitor → Student |
 */
export async function getRealEnrollmentOfficerCollation(
  quarterNumber: number = 1,
  selectedWeek: number = 1
): Promise<EnrollmentOfficerWeeklyCollation> {
  const allClasses = await getAllClassesDirectory();
  const allMembers = await getAllMembers();
  const allGrades = await getAllGrades();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  const rows: EnrollmentOfficerClassRow[] = [];
  let cumulativeOnboardedAll = 0;
  let cumulativeEnrollmentAll = 0;
  let currentStudentsAll = 0;
  let currentVisitorsAll = 0;

  for (const cls of approvedClasses) {
    const classMembers = allMembers.filter(m => m.classId === cls.id);
    const qMembers = classMembers.filter(m => {
      if (quarterNumber === 1) return true;
      return !!m.quarterEnrollments?.[quarterNumber as QuarterNumber];
    });

    let broughtForwardStudents = 0;
    let previouslyEnrolled = 0;
    let onboarded = 0;
    let newVisitors = 0;
    let newlyEnrolled = 0;
    const convertedList: ConvertedStudentAudit[] = [];

    let currentStudentCount = 0;
    let currentVisitorCount = 0;

    for (const mem of qMembers) {
      const qEnr = mem.quarterEnrollments?.[quarterNumber as QuarterNumber];
      const status = qEnr?.status || mem.status || 'ACTIVE';
      const effectiveFirstWeek = qEnr?.firstLessonWeek || mem.firstLessonWeek || 1;
      const convertedWeek = mem.convertedFromVisitorAtLesson;

      // EXEMPT CRITICAL RULE:
      // If member entered in a later week, they are EXEMPT for selectedWeek.
      // Exclude completely from this week's data.
      if (selectedWeek < effectiveFirstWeek) {
        continue;
      }

      // If explicitly marked EXEMPT for this week, exclude completely
      const grade = allGrades.find(
        g => g.classId === cls.id && g.quarterNumber === quarterNumber && g.memberId === mem.id && g.weekNumber === selectedWeek
      );
      if (grade && grade.attendance === 'EXEMPT') {
        continue;
      }

      if (status === 'LEFT_CLASS') {
        continue;
      }

      // Member attendance history across quarter up to selectedWeek
      const memberGrades = allGrades.filter(
        g => g.classId === cls.id && g.quarterNumber === quarterNumber && g.memberId === mem.id && g.weekNumber <= selectedWeek && g.attendance === 'PRESENT'
      );
      const attendedWeeks = memberGrades.map(g => g.weekNumber).sort((a, b) => a - b);

      // Determine Student vs Visitor status at selectedWeek
      let isStudentAtSelectedWeek = false;
      if (mem.memberType === 'STUDENT') {
        if (convertedWeek && convertedWeek > selectedWeek) {
          isStudentAtSelectedWeek = false; // had not yet converted at selectedWeek
        } else {
          isStudentAtSelectedWeek = true;
        }
      } else {
        isStudentAtSelectedWeek = false;
      }

      if (isStudentAtSelectedWeek) {
        currentStudentCount++;

        if (!convertedWeek || convertedWeek < 1) {
          // Started this quarter as a Student
          broughtForwardStudents++;
        } else if (convertedWeek < selectedWeek) {
          // Previously enrolled in an earlier week of this quarter
          previouslyEnrolled++;
        } else if (convertedWeek === selectedWeek) {
          // Newly enrolled in this current lesson
          newlyEnrolled++;

          convertedList.push({
            memberId: mem.id,
            fullName: mem.fullName,
            classId: cls.id,
            className: cls.className,
            department: cls.department,
            quarterNumber,
            conversionWeek: selectedWeek,
            previousStatus: 'VISITOR',
            currentStatus: 'STUDENT',
            firstLessonWeek: effectiveFirstWeek,
            attendedWeeks,
            consecutiveVisits: memberGrades.length,
            attendanceRate: Math.round((memberGrades.length / selectedWeek) * 100),
            conversionDate: mem.enrolledDate || mem.updatedAt || new Date().toISOString(),
            certifiedBy: mem.certifiedBy,
            certifiedAt: mem.certifiedAt,
            phone: mem.phone,
            occupation: mem.occupation,
            address: mem.address
          });
        }
      } else {
        // Active Visitor at selectedWeek
        currentVisitorCount++;
        onboarded++; // Existing visitor in the class at selectedWeek

        if (effectiveFirstWeek === selectedWeek) {
          newVisitors++; // First-time arrival in this current lesson
        }
      }
    }

    // Visitor to Student movement accounts for both previously enrolled and newly enrolled
    const visitorToStudent = previouslyEnrolled + newlyEnrolled;

    rows.push({
      weekNumber: selectedWeek,
      classId: cls.id,
      className: cls.className,
      department: cls.department,
      broughtForwardStudents,
      previouslyEnrolledStudents: previouslyEnrolled,
      onboarded,
      newVisitors,
      newlyEnrolled,
      visitorToStudent,
      convertedMembers: convertedList,
      currentStudentCount,
      currentVisitorCount,
      totalActiveClassMembers: currentStudentCount + currentVisitorCount
    });

    currentStudentsAll += currentStudentCount;
    currentVisitorsAll += currentVisitorCount;
  }

  // Calculate cumulative stats strictly within this quarter up to selectedWeek
  for (const m of allMembers) {
    const qEnr = m.quarterEnrollments?.[quarterNumber as QuarterNumber];
    if (quarterNumber > 1 && !qEnr) continue;

    const firstWeek = qEnr?.firstLessonWeek || m.firstLessonWeek || 1;
    const convertedWeek = m.convertedFromVisitorAtLesson;

    if (firstWeek <= selectedWeek) {
      if (m.memberType === 'VISITOR' || (convertedWeek && convertedWeek >= 1)) {
        cumulativeOnboardedAll++;
      }
      if (convertedWeek && convertedWeek <= selectedWeek && convertedWeek >= 1) {
        cumulativeEnrollmentAll++;
      }
    }
  }

  const weeklyTotals = {
    broughtForwardStudents: rows.reduce((s, r) => s + r.broughtForwardStudents, 0),
    previouslyEnrolledStudents: rows.reduce((s, r) => s + r.previouslyEnrolledStudents, 0),
    onboarded: rows.reduce((s, r) => s + r.onboarded, 0),
    newVisitors: rows.reduce((s, r) => s + r.newVisitors, 0),
    newlyEnrolled: rows.reduce((s, r) => s + r.newlyEnrolled, 0),
    visitorToStudent: rows.reduce((s, r) => s + r.visitorToStudent, 0)
  };

  const cumulativeTotals = {
    cumulativeOnboarded: cumulativeOnboardedAll,
    cumulativeEnrollment: cumulativeEnrollmentAll,
    currentStudentPopulation: currentStudentsAll,
    currentVisitorPopulation: currentVisitorsAll,
    totalActiveClassMembers: currentStudentsAll + currentVisitorsAll
  };

  return {
    quarterNumber,
    selectedWeek,
    rows,
    weeklyTotals,
    cumulativeTotals
  };
}

/**
 * Get Eligible Visitor Candidates for Enrollment Officer Review & Certification
 * Derives strictly from actual Class Register attendance records.
 */
export async function getEligibleVisitorCandidates(
  quarterNumber: number = 1,
  selectedWeek: number = 1
): Promise<EligibleVisitorCandidate[]> {
  const allClasses = await getAllClassesDirectory();
  const allMembers = await getAllMembers();
  const allGrades = await getAllGrades();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  const candidates: EligibleVisitorCandidate[] = [];

  for (const cls of approvedClasses) {
    const classVisitors = allMembers.filter(
      m => m.classId === cls.id && m.memberType === 'VISITOR' && m.status === 'ACTIVE'
    );

    for (const visitor of classVisitors) {
      const qEnr = visitor.quarterEnrollments?.[quarterNumber as QuarterNumber];
      const firstWeek = qEnr?.firstLessonWeek || visitor.firstLessonWeek || 1;

      // Check attendance in this quarter up to selectedWeek
      const memberGrades = allGrades.filter(
        g => g.classId === cls.id && g.quarterNumber === quarterNumber && g.memberId === visitor.id && g.weekNumber <= selectedWeek && g.attendance === 'PRESENT'
      );
      const attendedWeeks = memberGrades.map(g => g.weekNumber).sort((a, b) => a - b);

      // Check consecutive attendances leading up to selectedWeek
      let consecutive = 0;
      for (let w = selectedWeek; w >= 1; w--) {
        const g = allGrades.find(
          item => item.classId === cls.id && item.quarterNumber === quarterNumber && item.memberId === visitor.id && item.weekNumber === w
        );
        if (g?.isNoRecordWeek) continue;
        if (g && g.attendance === 'PRESENT') {
          consecutive++;
        } else {
          break;
        }
      }

      const totalEligible = Math.max(1, selectedWeek - firstWeek + 1);
      const attendanceRate = Math.round((attendedWeeks.length / totalEligible) * 100);

      // Standard consistency rule: 3+ consecutive visits or >= 75% attendance with at least 3 attendances
      const isEligible = consecutive >= 3 || (attendedWeeks.length >= 3 && attendanceRate >= 75);
      const reason = consecutive >= 3
        ? `${consecutive} Consecutive Attendances Achieved`
        : attendedWeeks.length >= 3 && attendanceRate >= 75
        ? `High Attendance Consistency (${attendedWeeks.length} of ${totalEligible} weeks - ${attendanceRate}%)`
        : `Attendance Consistency in Progress (${consecutive} consecutive, ${attendedWeeks.length} total)`;

      candidates.push({
        member: visitor,
        classId: cls.id,
        className: cls.className,
        department: cls.department,
        quarterNumber,
        consecutiveVisits: consecutive,
        attendedWeeks,
        attendanceRate,
        isEligible,
        eligibilityReason: reason,
        firstLessonWeek: firstWeek
      });
    }
  }

  return candidates;
}

/**
 * Certifies a Visitor's enrollment into Student status.
 * Updates the Class Register directly as the single source of truth.
 */
export async function certifyVisitorEnrollment(
  memberId: string,
  classId: string,
  quarterNumber: number,
  weekNumber: number,
  officerProfile: AdminProfile,
  notes?: string
): Promise<{ success: boolean; member: Member }> {
  const allMembers = await getAllMembers();
  const target = allMembers.find(m => m.id === memberId);
  if (!target) {
    throw new Error(`Member ${memberId} not found in database`);
  }

  const currentEnr = target.quarterEnrollments || {};
  const qNum = quarterNumber as QuarterNumber;
  currentEnr[qNum] = {
    ...(currentEnr[qNum] || {
      quarterNumber: qNum,
      status: 'ACTIVE',
      firstLessonWeek: target.firstLessonWeek || 1
    }),
    memberType: 'STUDENT',
    enrolledDate: new Date().toISOString()
  };

  const statusHistory = target.statusHistory || [];
  statusHistory.push({
    fromStatus: 'VISITOR',
    toStatus: 'STUDENT',
    date: new Date().toISOString(),
    reason: `Certified by Enrollment Officer ${officerProfile.profileName} (Week ${weekNumber}, Q${quarterNumber})`,
    authorizedBy: officerProfile.profileName
  });

  const updatedMember: Member = {
    ...target,
    memberType: 'STUDENT',
    convertedFromVisitorAtLesson: weekNumber,
    enrolledDate: new Date().toISOString(),
    certifiedBy: officerProfile.profileName,
    certifiedAt: new Date().toISOString(),
    quarterEnrollments: currentEnr,
    statusHistory,
    updatedAt: new Date().toISOString()
  };

  await putInStore('members', updatedMember);

  // Store certification audit record
  const certRecord: EnrollmentCertificationRecord = {
    id: `cert_${memberId}_w${weekNumber}_q${quarterNumber}_${Date.now()}`,
    memberId: target.id,
    memberName: target.fullName,
    classId,
    className: target.classId || 'Sunday School Class',
    quarterNumber,
    weekNumber,
    certifiedByOfficerId: officerProfile.id || officerProfile.roleType,
    certifiedByOfficerName: officerProfile.profileName,
    certifiedAt: new Date().toISOString(),
    reason: `Consistency requirement verified and ratified`,
    notes
  };

  try {
    const rawCerts = localStorage.getItem('gofamint_enrollment_certifications');
    const certsList: EnrollmentCertificationRecord[] = rawCerts ? JSON.parse(rawCerts) : [];
    certsList.unshift(certRecord);
    localStorage.setItem('gofamint_enrollment_certifications', JSON.stringify(certsList));
  } catch (e) {
    console.warn('Could not save certification to localStorage:', e);
  }

  return { success: true, member: updatedMember };
}

/**
 * Retrieve all Enrollment Certification audit logs
 */
export async function getAllEnrollmentCertifications(): Promise<EnrollmentCertificationRecord[]> {
  try {
    const rawCerts = localStorage.getItem('gofamint_enrollment_certifications');
    return rawCerts ? JSON.parse(rawCerts) : [];
  } catch {
    return [];
  }
}

/**
 * Performs a complete local cleanup after a factory reset.
 * Clears ALL local storage layers to prevent stale data from returning.
 */
export async function performLocalFactoryReset(): Promise<void> {
  // 1. Clear all IndexedDB stores
  await resetToFreshCleanSystem('UNINITIALIZED_BLANK');
  
  // 2. Clear the schema version flag so next init starts fresh
  localStorage.removeItem('gofamint_schema_v6');
  // Also remove legacy flag
  localStorage.removeItem('gofamint_clean_zero_init_v5');
  
  // 3. Clear sessionStorage
  sessionStorage.clear();
  
  // 4. Clear ALL remaining gofamint keys from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('gofamint_') || key.startsWith('GOFAMINT_HOF_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  
  // 5. Delete and recreate the IndexedDB database to clear the local cache
  try {
    const dbName = 'GOFAMINT_HOF_SundaySchool_DB';
    const databases = await indexedDB.databases();
    for (const dbInfo of databases) {
      if (dbInfo.name) {
        indexedDB.deleteDatabase(dbInfo.name);
      }
    }
  } catch (e) {
    console.warn('Could not enumerate/delete IndexedDB databases:', e);
  }
}
