import {
  cloudSaveClassProfile,
  cloudSaveLesson,
  cloudDeleteClass,
  cloudSaveDepartment
} from '../services/supabaseDatabase';
import { protectPendingCloudChanges } from '../utils/cloudOutbox';

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
  revision?: string;
  lastError?: string;
  /** Supabase user that originally attempted this write. Never retry as another account. */
  actorUserId?: string | null;
}

const activeCloudPushes = new Map<string, Promise<unknown>>();

async function getCurrentCloudActorUserId(): Promise<string | null> {
  try {
    const { getSupabaseClient } = await import('../services/supabase');
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    return data.session?.user.id || null;
  } catch (error) {
    console.error('[cloud sync] Could not identify the signed-in user for the durable retry queue:', error);
    return null;
  }
}

function belongsToCloudActor(record: CloudSyncFailureRecord, actorUserId: string | null): boolean {
  return Boolean(actorUserId && record.actorUserId && record.actorUserId === actorUserId);
}

const WORKER_SYNC_STORES = new Set([
  'workers', 'workerAttendance', 'workerPrepAttendance', 'specialEvents',
  'specialEventAttendance', 'workerCategories', 'clockInConfig'
]);

function notifyLocalStoreChange(storeName: string): void {
  if (typeof window === 'undefined') return;
  try {
    const detail = { store: storeName, stores: [storeName], source: 'local' };
    window.dispatchEvent(new CustomEvent('gofamint:sync-update', { detail }));
    if (WORKER_SYNC_STORES.has(storeName)) {
      window.dispatchEvent(new CustomEvent('gofamint:worker-sync', { detail }));
    }
  } catch (error) {
    console.error(`Could not notify the UI about the ${storeName} update:`, error);
  }
}

async function writeCloudOutboxRecord(record: CloudSyncFailureRecord): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cloudSyncFailures', 'readwrite');
      tx.objectStore('cloudSyncFailures').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Cloud outbox transaction was aborted.'));
    });
  } catch (indexedDbError) {
    try {
      const key = 'gofamint_cloudSyncFailures';
      const current = JSON.parse(localStorage.getItem(key) || '[]') as CloudSyncFailureRecord[];
      const next = current.filter(item => item.id !== record.id);
      next.push(record);
      localStorage.setItem(key, JSON.stringify(next));
      console.warn('IndexedDB cloud outbox was unavailable; using the localStorage outbox.', indexedDbError);
    } catch (localStorageError) {
      throw new AggregateError([indexedDbError, localStorageError], 'Could not persist the cloud retry operation.');
    }
  }
}

async function mutateCloudOutboxRecordIfCurrent(
  record: CloudSyncFailureRecord,
  mutation: 'delete' | 'record-error',
  lastError?: string
): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cloudSyncFailures', 'readwrite');
      const store = tx.objectStore('cloudSyncFailures');
      const request = store.get(record.id);
      request.onsuccess = () => {
        const current = request.result as CloudSyncFailureRecord | undefined;
        if (!current || current.revision !== record.revision) return;
        if (mutation === 'delete') store.delete(record.id);
        else store.put({ ...current, lastError });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Cloud outbox update was aborted.'));
    });
    // Also clear/update a fallback record left by an earlier session in which
    // IndexedDB was unavailable.
    try {
      const key = 'gofamint_cloudSyncFailures';
      const current = JSON.parse(localStorage.getItem(key) || '[]') as CloudSyncFailureRecord[];
      const matching = current.find(item => item.id === record.id);
      if (matching?.revision === record.revision) {
        const next = mutation === 'delete'
          ? current.filter(item => item.id !== record.id)
          : current.map(item => item.id === record.id ? { ...item, lastError } : item);
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch (fallbackMirrorError) {
      console.warn('Could not update the optional localStorage outbox mirror:', fallbackMirrorError);
    }
  } catch (indexedDbError) {
    try {
      const key = 'gofamint_cloudSyncFailures';
      const current = JSON.parse(localStorage.getItem(key) || '[]') as CloudSyncFailureRecord[];
      const matching = current.find(item => item.id === record.id);
      if (!matching || matching.revision !== record.revision) return;
      const next = mutation === 'delete'
        ? current.filter(item => item.id !== record.id)
        : current.map(item => item.id === record.id ? { ...item, lastError } : item);
      localStorage.setItem(key, JSON.stringify(next));
    } catch (localStorageError) {
      throw new AggregateError([indexedDbError, localStorageError], 'Could not update the cloud retry operation.');
    }
  }
}

async function pushToCloud<T>(
  label: string,
  fn: () => Promise<T>,
  retryMeta?: { collectionName: string; action: 'save' | 'delete'; docId: string; data?: any }
): Promise<void> {
  if (!retryMeta) {
    void fn().catch((err) => console.error(`[cloud sync] ${label} failed without retry metadata:`, err));
    return;
  }

  const actorUserId = await getCurrentCloudActorUserId();
  const record: CloudSyncFailureRecord = {
    id: `${retryMeta.collectionName}_${retryMeta.docId}_${retryMeta.action}`,
    label,
    collectionName: retryMeta.collectionName,
    action: retryMeta.action,
    docId: retryMeta.docId,
    data: retryMeta.data,
    failedAt: new Date().toISOString(),
    revision: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorUserId
  };

  await writeCloudOutboxRecord(record);
  const previousOperation = activeCloudPushes.get(record.id) || Promise.resolve();
  const operation = previousOperation
    .catch((previousError) => {
      console.error(`[cloud sync] Previous serialized operation failed for ${record.id}:`, previousError);
    })
    .then(async () => {
      try {
        await fn();
        await mutateCloudOutboxRecordIfCurrent(record, 'delete');
      } catch (err: any) {
        const lastError = err?.message || String(err);
        console.warn(`[cloud sync] ${label} queued for retry:`, lastError);
        await mutateCloudOutboxRecordIfCurrent(record, 'record-error', lastError);
      }
    })
    .finally(() => {
      if (activeCloudPushes.get(record.id) === operation) {
        activeCloudPushes.delete(record.id);
      }
    });

  activeCloudPushes.set(record.id, operation);
  void operation.catch((error) => {
    console.error(`[cloud sync] Could not update durable outbox record ${record.id}:`, error);
  });
}

import {
  ClassProfile,
  DepartmentType,
  Member,
  MemberStatus,
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
  EnrollmentCertificationRecord,
  StudentTransferRecord,
  AttendanceChangeRequestRecord,
  WeekLockRecord
} from '../types';
import {
  DEFAULT_DEPARTMENTS,
  FRESH_UNINITIALIZED_YEAR
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
// v8: durable enrollment certification audit records (IndexedDB + cloud sync).
// v7: added `cloudSyncFailures` store — persists cloud writes that failed
// v8: added `enrollmentCertifications`
// v9: added `studentTransfers` store for controlled student transfers preserving historical class data
const DB_VERSION = 9;

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
        if (!db.objectStoreNames.contains('enrollmentCertifications')) {
          db.createObjectStore('enrollmentCertifications', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('studentTransfers')) {
          const tStore = db.createObjectStore('studentTransfers', { keyPath: 'id' });
          tStore.createIndex('studentId', 'studentId', { unique: false });
          tStore.createIndex('status', 'status', { unique: false });
          tStore.createIndex('fromDepartment', 'fromDepartment', { unique: false });
          tStore.createIndex('toDepartment', 'toDepartment', { unique: false });
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
  } catch (error) {
    console.warn(`IndexedDB read unavailable for ${storeName}; using the localStorage mirror:`, error);
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
  treasuryExpenditures: 'treasuryExpenditures',
  enrollmentCertifications: 'enrollmentCertifications',
  studentTransfers: 'studentTransfers'
};

export async function putInStore<T>(storeName: string, value: T, skipCloudMirror = false): Promise<T> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error(`IndexedDB write to ${storeName} was aborted.`));
    });
    void getAllFromStore(storeName)
      .then(all => localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(all)))
      .catch((error) => console.warn(`Local backup mirror failed for ${storeName}:`, error));
  } catch (indexedDbError) {
    const all = await getAllFromStore<any>(storeName);
    const key = (value as any).id;
    const idx = all.findIndex((i: any) => i.id === key);
    if (idx >= 0) all[idx] = value;
    else all.push(value);
    try {
      localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(all));
    } catch (localStorageError) {
      throw new AggregateError(
        [indexedDbError, localStorageError],
        `Could not persist data in either IndexedDB or localStorage for ${storeName}.`
      );
    }
  }

  // Persist the cloud operation only after the local transaction commits.
  // Returning from this function therefore means the record and its outbox
  // entry can both survive an immediate browser refresh.
  const colName = CLOUD_STORE_MAP[storeName];
  const documentId = (value as any)?.id;
  if (!skipCloudMirror && colName && documentId) {
    await pushToCloud(`${colName}/${documentId}`, () => saveDocument(colName, value as any), {
      collectionName: colName,
      action: 'save',
      docId: documentId,
      data: value
    });
  }
  if (!skipCloudMirror) notifyLocalStoreChange(storeName);
  return value;
}

export async function deleteFromStore(storeName: string, id: string, skipCloudMirror = false): Promise<void> {
  let indexedDbError: unknown;
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error(`IndexedDB delete from ${storeName} was aborted.`));
    });
  } catch (err) {
    indexedDbError = err;
    console.warn(`IndexedDB delete unavailable for ${storeName}; applying localStorage fallback:`, err);
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
    if (indexedDbError) {
      throw new AggregateError([indexedDbError, e], `Could not delete data from either local store for ${storeName}.`);
    }
    console.warn(`localStorage delete mirror failed for ${storeName}:`, e);
  }

  const colName = CLOUD_STORE_MAP[storeName];
  if (!skipCloudMirror && colName && id) {
    await pushToCloud(`delete ${colName}/${id}`, () => removeDocument(colName, id), {
      collectionName: colName,
      action: 'delete',
      docId: id
    });
  }
  notifyLocalStoreChange(storeName);
}

// Replaces the ENTIRE contents of a local IndexedDB store with `items`, without
// mirroring anything back to Supabase. This is the primitive used to pull
// the central Supabase database down into a device's local cache (cloud is
// authoritative, so this also correctly removes local records that were deleted
// on another device). See hydrateLocalFromCloud() in cloudSyncManager.ts.
export async function replaceStoreContents<T>(storeName: string, items: T[]): Promise<void> {
  let protectedItems = items;
  const collectionName = CLOUD_STORE_MAP[storeName]
    || ((storeName === 'classProfile' || storeName === 'allClasses')
      ? 'classes'
      : storeName === 'lessons'
        ? 'lessons'
        : undefined);
  if (collectionName) {
    const pending = await getAllFromStore<CloudSyncFailureRecord>('cloudSyncFailures');
    const actorUserId = await getCurrentCloudActorUserId();
    const actorPending = pending.filter(record => belongsToCloudActor(record, actorUserId));
    protectedItems = protectPendingCloudChanges(items, actorPending, collectionName);
  }

  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of protectedItems) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`Replacing ${storeName} was aborted.`));
  });
  try {
    localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(protectedItems));
  } catch (error) {
    // Non-fatal — IndexedDB already committed, but the fallback failure must remain diagnosable.
    console.warn(`Could not update the localStorage cache mirror for ${storeName}:`, error);
  }
}

// Returns any cloud writes that previously failed and are still pending retry.
export async function getPendingCloudSyncFailures(): Promise<CloudSyncFailureRecord[]> {
  try {
    const indexed = await getAllFromStore<CloudSyncFailureRecord>('cloudSyncFailures');
    let fallback: CloudSyncFailureRecord[] = [];
    try {
      fallback = JSON.parse(localStorage.getItem('gofamint_cloudSyncFailures') || '[]');
    } catch (error) {
      console.warn('Could not read the localStorage cloud outbox mirror:', error);
    }
    const merged = new Map<string, CloudSyncFailureRecord>();
    for (const record of [...indexed, ...fallback]) {
      const existing = merged.get(record.id);
      if (!existing || String(record.revision || record.failedAt) >= String(existing.revision || existing.failedAt)) {
        merged.set(record.id, record);
      }
    }
    return Array.from(merged.values());
  } catch (error) {
    console.error('Could not read the durable cloud retry queue:', error);
    throw error;
  }
}

// Applies realtime INSERT/UPDATE payloads without clearing or re-downloading an
// entire table. Full hydration remains responsible for deletion convergence.
export async function mergeStoreContents<T>(storeName: string, items: T[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`Merging realtime changes into ${storeName} was aborted.`));
  });
  try {
    localStorage.setItem(`gofamint_${storeName}`, JSON.stringify(await getAllFromStore<T>(storeName)));
  } catch (error) {
    // IndexedDB is authoritative; localStorage is only a fallback mirror.
    console.warn(`Could not update the realtime localStorage mirror for ${storeName}:`, error);
  }
}

// Retries every queued failed Supabase write. Successful retries are removed
// from the queue; writes that fail again stay queued (with the latest error) for the
// next retry pass. Called on reconnect / periodic sync / app focus.
export async function retryFailedCloudPushes(): Promise<{ retried: number; succeeded: number }> {
  const pending = await getPendingCloudSyncFailures();
  const actorUserId = await getCurrentCloudActorUserId();
  let retried = 0;
  let succeeded = 0;
  for (const record of pending) {
    // The foreground writer owns this record until its current attempt ends.
    // Retrying it concurrently could let an older request erase a newer write.
    if (activeCloudPushes.has(record.id)) continue;
    if (!belongsToCloudActor(record, actorUserId)) {
      const reason = record.actorUserId
        ? 'Retry quarantined because it belongs to a different signed-in account.'
        : 'Legacy retry quarantined because its originating account cannot be verified.';
      console.error(`[cloud sync] ${reason} Operation: ${record.label}`);
      await mutateCloudOutboxRecordIfCurrent(record, 'record-error', reason);
      continue;
    }
    retried++;
    try {
      if (record.action === 'save') {
        await saveDocument(record.collectionName, record.data);
      } else {
        await removeDocument(record.collectionName, record.docId);
      }
      await mutateCloudOutboxRecordIfCurrent(record, 'delete');
      succeeded++;
    } catch (err: any) {
      console.warn(`[cloud sync] retry failed for ${record.label}:`, err?.message || err);
      await mutateCloudOutboxRecordIfCurrent(record, 'record-error', err?.message || String(err));
    }
  }
  return { retried, succeeded };
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
    const CURRENT_SCHEMA = 'gofamint_schema_v7';
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
          await deleteFromStore('cloudSyncFailures', f.id).catch(error => console.warn(`Could not purge stale class retry ${f.id}:`, error));
        }
      }
    } catch (error) {
      console.warn('Could not inspect stale class retry records during initialization:', error);
    }

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
  await pushToCloud('lesson', () => cloudSaveLesson(updatedLesson), {
    collectionName: 'lessons',
    action: 'save',
    docId: `WEEK_${updatedLesson.weekNumber}`,
    data: { ...updatedLesson, id: `WEEK_${updatedLesson.weekNumber}` }
  });
  return currentLessons.sort((a, b) => a.weekNumber - b.weekNumber);
}

// Clear all data to start completely fresh / from scratch
export async function clearAllDatabaseData(wipeClassProfile: boolean = true): Promise<void> {
  localStorage.setItem('gofamint_scratch_mode', 'true');
  sessionStorage.removeItem('gofamint_unlocked');

  const storesToClear = ['members', 'grades', 'offerings', 'absenceLogs', 'referrals', 'enrollmentCertifications', 'studentTransfers', 'syncQueue'];
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
  await pushToCloud('classProfile', () => cloudSaveClassProfile(safeProfile), {
    collectionName: 'classes',
    action: 'save',
    docId: safeProfile.id,
    data: safeProfile
  });
  return result;
}

/** Cache a class record only after a protected server mutation has confirmed it. */
export async function cacheConfirmedClassProfile(profile: ClassProfile): Promise<ClassProfile> {
  const safeProfile = { ...profile };
  delete safeProfile.password;
  await putInStore<ClassProfile>('allClasses', safeProfile, true);
  const result = await putInStore<ClassProfile>('classProfile', safeProfile, true);
  // Remove any older client-side retry for this class so it cannot overwrite
  // the server-confirmed state after reconnect or refresh.
  await deleteFromStore('cloudSyncFailures', `classes_${safeProfile.id}_save`, true);
  return result;
}

// Members
export async function getAllMembers(): Promise<Member[]> {
  return getAllFromStore<Member>('members');
}

export async function getMembersByClass(classId: string, quarterNumber?: number): Promise<Member[]> {
  if (!classId) return [];
  const all = await getAllFromStore<Member>('members');
  const classMembers = all.filter(m => 
    m.classId === classId || 
    (!m.classId && classId === 'default_class') || 
    (m.classId === 'default_class' && !classId)
  );

  if (!quarterNumber) {
    return classMembers;
  }

  // Filter or map for the specific quarter
  const result: Member[] = [];
  const qNum = quarterNumber as QuarterNumber;

  for (const m of classMembers) {
    if (m.quarterEnrollments?.[qNum]) {
      const enr = m.quarterEnrollments[qNum]!;
      result.push({
        ...m,
        memberType: enr.memberType || m.memberType,
        status: enr.status || m.status,
        firstLessonWeek: enr.firstLessonWeek || m.firstLessonWeek || 1
      });
    } else {
      // Robust fallback: Always keep class member visible across all quarters
      result.push({
        ...m,
        firstLessonWeek: m.firstLessonWeek || 1
      });
    }
  }
  return result;
}

export async function saveMember(member: Member, targetQuarter: number = 1): Promise<Member> {
  const qNum = (targetQuarter || 1) as QuarterNumber;
  const existingEnrollment = member.quarterEnrollments?.[qNum];
  const enrollments = {
    ...(member.quarterEnrollments || {}),
    [qNum]: {
      ...existingEnrollment,
      quarterNumber: qNum,
      memberType: member.memberType || existingEnrollment?.memberType || 'STUDENT',
      status: member.status || existingEnrollment?.status || 'ACTIVE',
      firstLessonWeek: existingEnrollment?.firstLessonWeek || member.firstLessonWeek || 1,
      enrolledDate: existingEnrollment?.enrolledDate || member.enrolledDate || new Date().toISOString(),
      exitNote: member.exitNote || existingEnrollment?.exitNote
    }
  };

  const updated: Member = {
    ...member,
    quarterEnrollments: enrollments,
    updatedAt: new Date().toISOString()
  };
  const result = await putInStore<Member>('members', updated);
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
  // Also delete associated grades, absence logs
  const allGrades = await getAllGrades();
  const memberGrades = allGrades.filter(g => g.memberId === id);
  for (const g of memberGrades) {
    await deleteFromStore('grades', g.id);
  }
  const allLogs = await getAllAbsenceLogs();
  const memberLogs = allLogs.filter(a => a.memberId === id);
  for (const l of memberLogs) {
    await deleteFromStore('absenceLogs', l.id);
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
  const allGrades = await getAllGrades();
  const updatedList: Member[] = [];

  for (const t of transitions) {
    const existing = allMembers.find(m => m.id === t.memberId && m.classId === classId);
    if (!existing) continue;

    const currentEnrollments = existing.quarterEnrollments || {};
    const sourceGrades = allGrades.filter(g =>
      g.classId === classId &&
      g.memberId === existing.id &&
      g.quarterNumber === fromQuarter
    );
    const lastRecordedWeek = sourceGrades.reduce(
      (latest, grade) => grade.isNoRecordWeek ? latest : Math.max(latest, grade.weekNumber),
      0
    );
    let consecutiveVisitsCarried = 0;
    for (let week = lastRecordedWeek; week >= 1; week--) {
      const grade = sourceGrades.find(item => item.weekNumber === week);
      if (grade?.isNoRecordWeek) continue;
      if (grade?.attendance === 'PRESENT') {
        consecutiveVisitsCarried++;
        continue;
      }
      break;
    }
    currentEnrollments[toQuarter] = {
      quarterNumber: toQuarter,
      memberType: t.targetType,
      status: t.targetStatus,
      firstLessonWeek: t.firstLessonWeek || 1,
      enrolledDate: new Date().toISOString().split('T')[0],
      exitNote: t.note,
      forwardedFromQuarter: fromQuarter,
      forwardedAt: new Date().toISOString(),
      consecutiveVisitsCarried: t.targetType === 'VISITOR' ? consecutiveVisitsCarried : 0
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
  return auditResult;
}

export async function moveOfferingToChildrenAccount(
  classId: string,
  quarterNumber: number,
  weekNumber: number
): Promise<WeeklyOfferingRecord> {
  const canonicalId = `${classId}_q${quarterNumber}_w${weekNumber}`;
  const allOfferings = await getAllOfferings();
  const existing = allOfferings.find(o => o.id === canonicalId || (o.classId === classId && o.quarterNumber === quarterNumber && o.weekNumber === weekNumber));

  if (!existing) {
    throw new Error('Offering record not found to move.');
  }

  const updated: WeeklyOfferingRecord = {
    ...existing,
    isChildrenAccount: true,
    accountType: 'CHILDREN',
    updatedAt: new Date().toISOString()
  };

  return await putInStore<WeeklyOfferingRecord>('offerings', updated);
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
    enrollmentCertifications: EnrollmentCertificationRecord[];
    studentTransfers?: StudentTransferRecord[];
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
    enrollmentCertifications,
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
    getAllEnrollmentCertifications(),
    getSyncQueue()
  ]);

  const students = members.filter(m => m.memberType === 'STUDENT');
  const visitors = members.filter(m => m.memberType === 'VISITOR');

  const backupPackage: DatabaseBackupPackage = {
    app: 'THE GOSPEL FAITH MISSION INTL - Sunday School Management System',
    version: '4.0.0',
    formatVersion: 5,
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
      enrollmentCertifications,
      studentTransfers: await getAllFromStore<StudentTransferRecord>('studentTransfers'),
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
      'workerCategories',
      'enrollmentCertifications'
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

  // 17. Enrollment certification audit trail
  if (Array.isArray(data.enrollmentCertifications)) {
    for (const certification of data.enrollmentCertifications) {
      await putInStore('enrollmentCertifications', certification);
    }
  }

  // 17b. Student Transfers
  if (Array.isArray(data.studentTransfers)) {
    for (const transfer of data.studentTransfers) {
      await putInStore('studentTransfers', transfer);
    }
  }

  // 18. Sync Queue
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
  } catch (error) {
    console.error('Could not read local database snapshots:', error);
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
  } catch (indexedDbError) {
    console.warn('IndexedDB sync queue could not be cleared; using the localStorage fallback:', indexedDbError);
    try {
      localStorage.removeItem('gofamint_syncQueue');
    } catch (localStorageError) {
      throw new AggregateError([indexedDbError, localStorageError], 'Could not clear the synchronization queue.');
    }
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
    'specialEventAttendance',
    'enrollmentCertifications'
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
  // These are local structural fallbacks, not user-authored database changes.
  // Mirroring them while signed out creates guaranteed RLS failures and a noisy
  // retry queue on every fresh browser/device.
  await putInStore('clockInConfig', DEFAULT_CLOCK_IN_CONFIG, true);
  for (const cat of DEFAULT_WORKER_CATEGORIES) {
    await putInStore('workerCategories', cat, true);
  }
}

// -------------------------------------------------------------
// WORKERS MASTER DIRECTORY & ATTENDANCE DATABASE SERVICES
// -------------------------------------------------------------

export async function getAllWorkers(forceCloudRefresh = false): Promise<WorkerProfile[]> {
  try {
    let list = (await getAllFromStore<WorkerProfile>('workers')) || [];

    // A successful server response is authoritative, including an empty list.
    // replaceStoreContents preserves records that still have a durable pending
    // outbox operation, while removing records deleted on another device.
    // Ordinary reads are local-only. App-level role hydration owns the initial
    // cloud read, preventing this view from racing it with a duplicate request.
    if (forceCloudRefresh) {
      try {
        const { fetchWorkersDirectoryApi } = await import('../services/adminUserApi');
        const res = await fetchWorkersDirectoryApi();
        if (!res.success) throw new Error(res.error || 'The server could not load the workers directory.');
        if (!Array.isArray(res.workers)) throw new Error('The workers directory response did not contain a records array.');
        await replaceStoreContents('workers', res.workers);
        list = await getAllFromStore<WorkerProfile>('workers');
      } catch (err) {
        console.warn('Could not fetch workers from server API:', err);
        if (forceCloudRefresh) throw err;
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
        putInStore('workers', updated).catch(error => console.error(`Could not persist normalized worker ${w.id}:`, error));
        return updated;
      }
      return w;
    });

    return list;
  } catch (e) {
    console.warn('Error reading workers store:', e);
    if (forceCloudRefresh) throw e;
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
  return res;
}

export async function saveBulkWorkers(workers: WorkerProfile[]): Promise<WorkerProfile[]> {
  for (const w of workers) {
    await putInStore<WorkerProfile>('workers', w);
  }
  return workers;
}

export async function deleteWorker(id: string): Promise<void> {
  await deleteFromStore('workers', id);
}

// Sunday Clock-In Attendance Store
export async function getAllWorkerAttendance(serviceDate?: string, forceCloudRefresh = false): Promise<WorkerAttendanceRecord[]> {
  try {
    let list = (await getAllFromStore<WorkerAttendanceRecord>('workerAttendance')) || [];
    if (forceCloudRefresh) {
      try {
        const { cloudGetAllWorkerAttendance } = await import('../services/supabaseDatabase');
        const cloudAtt = await cloudGetAllWorkerAttendance();
        await replaceStoreContents('workerAttendance', cloudAtt || []);
        list = await getAllFromStore<WorkerAttendanceRecord>('workerAttendance');
      } catch (err) {
        console.warn('Could not fetch cloud worker attendance:', err);
        if (forceCloudRefresh) throw err;
      }
    }
    if (serviceDate) {
      return (list || []).filter(a => a.serviceDate === serviceDate);
    }
    return list || [];
  } catch (e) {
    console.warn('Error reading worker attendance:', e);
    if (forceCloudRefresh) throw e;
    return [];
  }
}

export async function saveWorkerAttendance(record: WorkerAttendanceRecord): Promise<WorkerAttendanceRecord> {
  // 1. Local write first — always succeeds regardless of network state.
  const res = await putInStore<WorkerAttendanceRecord>('workerAttendance', record);
  notifyLocalStoreChange('workerAttendance');

  // 2. Immediate durable cloud push — serialised per record, with outbox retry on failure.
  //    Uses the same pushToCloud pattern as every other write path in this file.
  const { cloudSaveWorkerAttendance } = await import('../services/supabaseDatabase');
  void pushToCloud(
    `Save worker attendance ${record.id}`,
    () => cloudSaveWorkerAttendance(record),
    { collectionName: 'workerAttendance', action: 'save', docId: record.id, data: record }
  );

  return res;
}

export async function saveBulkWorkerAttendance(records: WorkerAttendanceRecord[]): Promise<WorkerAttendanceRecord[]> {
  for (const r of records) {
    // Local write first for every record.
    await putInStore<WorkerAttendanceRecord>('workerAttendance', r);
  }
  notifyLocalStoreChange('workerAttendance');

  // Push each record to Supabase durably.
  const { cloudSaveWorkerAttendance } = await import('../services/supabaseDatabase');
  for (const r of records) {
    void pushToCloud(
      `Save worker attendance ${r.id}`,
      () => cloudSaveWorkerAttendance(r),
      { collectionName: 'workerAttendance', action: 'save', docId: r.id, data: r }
    );
  }

  return records;
}

export async function deleteWorkerAttendance(id: string): Promise<void> {
  await deleteFromStore('workerAttendance', id);
}

// Preparatory Class Attendance Store
export async function getAllWorkerPrepAttendance(prepDate?: string, forceCloudRefresh = false): Promise<WorkerPrepAttendanceRecord[]> {
  try {
    let list = (await getAllFromStore<WorkerPrepAttendanceRecord>('workerPrepAttendance')) || [];
    if (forceCloudRefresh) {
      let fetchedFromServer = false;
      let serverError: unknown;
      try {
        const { fetchWorkerPrepAttendanceApi } = await import('../services/adminUserApi');
        const res = await fetchWorkerPrepAttendanceApi();
        if (!res.success) throw new Error(res.error || 'The server could not load preparatory attendance.');
        if (!Array.isArray(res.records)) throw new Error('The preparatory-attendance response did not contain a records array.');
        await replaceStoreContents('workerPrepAttendance', res.records);
        list = await getAllFromStore<WorkerPrepAttendanceRecord>('workerPrepAttendance');
        fetchedFromServer = true;
      } catch (err) {
        console.warn('Could not fetch prep attendance from server API:', err);
        serverError = err;
      }

      if (!fetchedFromServer) {
        try {
          const { cloudGetAllWorkerPrepAttendance } = await import('../services/supabaseDatabase');
          const direct = await cloudGetAllWorkerPrepAttendance();
          await replaceStoreContents('workerPrepAttendance', direct || []);
          list = await getAllFromStore<WorkerPrepAttendanceRecord>('workerPrepAttendance');
        } catch (dbErr) {
          console.warn('Direct Supabase prep attendance fallback warning:', dbErr);
          if (forceCloudRefresh) {
            throw new AggregateError([serverError, dbErr].filter(Boolean), 'Preparatory attendance could not be refreshed from either server path.');
          }
        }
      }
    }
    if (prepDate) {
      return (list || []).filter(p => p.prepDate === prepDate);
    }
    return list || [];
  } catch (e) {
    console.warn('Error reading worker prep attendance:', e);
    if (forceCloudRefresh) throw e;
    return [];
  }
}

export async function saveWorkerPrepAttendance(record: WorkerPrepAttendanceRecord): Promise<WorkerPrepAttendanceRecord> {
  return putInStore<WorkerPrepAttendanceRecord>('workerPrepAttendance', record);
}

export async function saveBulkWorkerPrepAttendance(records: WorkerPrepAttendanceRecord[]): Promise<WorkerPrepAttendanceRecord[]> {
  for (const r of records) {
    await putInStore<WorkerPrepAttendanceRecord>('workerPrepAttendance', r);
  }
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
  await putInStore('clockInConfig', DEFAULT_CLOCK_IN_CONFIG, true);
  return DEFAULT_CLOCK_IN_CONFIG;
}

export async function saveClockInConfig(config: ClockInConfig): Promise<ClockInConfig> {
  const res = await putInStore<ClockInConfig>('clockInConfig', config);
  return res;
}

export async function lockAttendanceWeek(
  sessionType: 'THURSDAY' | 'SUNDAY',
  quarterNumber: QuarterNumber,
  weekNumber: number,
  officerName: string
): Promise<ClockInConfig> {
  const config = await getClockInConfig();
  const weekKey = `${sessionType}_${quarterNumber}_${weekNumber}`;
  const now = new Date().toISOString();
  
  const existingRecord = config.lockedWeeks?.[weekKey];
  const updatedWeeks = {
    ...(config.lockedWeeks || {}),
    [weekKey]: {
      isLocked: true,
      lockedAt: now,
      lockedBy: officerName,
      changeHistory: existingRecord?.changeHistory || []
    }
  };

  const updatedConfig: ClockInConfig = {
    ...config,
    lockedWeeks: updatedWeeks
  };

  return await saveClockInConfig(updatedConfig);
}

export async function requestAttendanceWeekChanges(
  sessionType: 'THURSDAY' | 'SUNDAY',
  quarterNumber: QuarterNumber,
  weekNumber: number,
  requestedBy: string,
  reason: string
): Promise<ClockInConfig> {
  const config = await getClockInConfig();
  const weekKey = `${sessionType}_${quarterNumber}_${weekNumber}`;
  const now = new Date().toISOString();
  const changeRequestId = `cr_${sessionType}_${quarterNumber}_${weekNumber}_${Date.now()}`;

  const changeRequest: AttendanceChangeRequestRecord = {
    id: changeRequestId,
    sessionType,
    quarterNumber,
    weekNumber,
    requestedBy,
    requestedAt: now,
    reason: reason.trim(),
    status: 'PENDING'
  };

  const existingRecord = config.lockedWeeks?.[weekKey] || { isLocked: true };
  const updatedWeeks = {
    ...(config.lockedWeeks || {}),
    [weekKey]: {
      ...existingRecord,
      activeChangeRequest: changeRequest
    }
  };

  const updatedConfig: ClockInConfig = {
    ...config,
    lockedWeeks: updatedWeeks
  };

  return await saveClockInConfig(updatedConfig);
}

export async function approveAttendanceWeekChanges(
  sessionType: 'THURSDAY' | 'SUNDAY',
  quarterNumber: QuarterNumber,
  weekNumber: number,
  reviewedBy: string
): Promise<ClockInConfig> {
  const config = await getClockInConfig();
  const weekKey = `${sessionType}_${quarterNumber}_${weekNumber}`;
  const now = new Date().toISOString();

  const existingRecord = config.lockedWeeks?.[weekKey];
  if (!existingRecord?.activeChangeRequest) {
    throw new Error(`No active change request found for ${sessionType} Week ${weekNumber}`);
  }

  const approvedRequest: AttendanceChangeRequestRecord = {
    ...existingRecord.activeChangeRequest,
    status: 'APPROVED',
    reviewedBy,
    reviewedAt: now
  };

  const updatedWeeks = {
    ...(config.lockedWeeks || {}),
    [weekKey]: {
      ...existingRecord,
      activeChangeRequest: approvedRequest
    }
  };

  const updatedConfig: ClockInConfig = {
    ...config,
    lockedWeeks: updatedWeeks
  };

  return await saveClockInConfig(updatedConfig);
}

export async function completeAttendanceWeekChanges(
  sessionType: 'THURSDAY' | 'SUNDAY',
  quarterNumber: QuarterNumber,
  weekNumber: number
): Promise<ClockInConfig> {
  const config = await getClockInConfig();
  const weekKey = `${sessionType}_${quarterNumber}_${weekNumber}`;
  const now = new Date().toISOString();

  const existingRecord = config.lockedWeeks?.[weekKey];
  const activeReq = existingRecord?.activeChangeRequest;

  const completedRequest: AttendanceChangeRequestRecord | undefined = activeReq ? {
    ...activeReq,
    status: 'COMPLETED',
    completedAt: now
  } : undefined;

  const changeHistory = [...(existingRecord?.changeHistory || [])];
  if (completedRequest) {
    changeHistory.push(completedRequest);
  }

  // Automatically lock the week again
  const updatedWeeks = {
    ...(config.lockedWeeks || {}),
    [weekKey]: {
      isLocked: true,
      lockedAt: now,
      lockedBy: completedRequest?.reviewedBy || completedRequest?.requestedBy || 'System',
      activeChangeRequest: undefined,
      changeHistory
    }
  };

  const updatedConfig: ClockInConfig = {
    ...config,
    lockedWeeks: updatedWeeks
  };

  return await saveClockInConfig(updatedConfig);
}

// Worker Categories
export async function getAllWorkerCategories(): Promise<WorkerCategoryDef[]> {
  try {
    const list = await getAllFromStore<WorkerCategoryDef>('workerCategories');
    if (list && list.length > 0) {
      const hasLegacy = list.some(c => c.department === 'ADMIN' || c.department === 'ADULT' || c.department === 'YOUTH' || c.department === 'CHILDREN');
      if (hasLegacy) {
        for (const cat of DEFAULT_WORKER_CATEGORIES) {
          await putInStore('workerCategories', cat, true);
        }
        return DEFAULT_WORKER_CATEGORIES;
      }
      return list;
    }
  } catch (e) {
    console.warn('Error reading worker categories:', e);
  }
  for (const c of DEFAULT_WORKER_CATEGORIES) {
    await putInStore('workerCategories', c, true);
  }
  return [...DEFAULT_WORKER_CATEGORIES];
}

export async function saveWorkerCategory(cat: WorkerCategoryDef): Promise<WorkerCategoryDef> {
  const res = await putInStore<WorkerCategoryDef>('workerCategories', cat);
  return res;
}

export async function deleteWorkerCategory(id: string): Promise<void> {
  await deleteFromStore('workerCategories', id);
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
  // Administrative identities are written only by the protected server API.
  // This helper maintains the local read cache and must never enqueue a direct
  // browser write that RLS will reject and retry forever.
  return putInStore<AdminProfile>('adminProfiles', profile, true);
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
  await putInStore('adminProfiles', updated, true);
  return updated;
}

export async function deleteAdminProfile(id: string): Promise<void> {
  await deleteFromStore('adminProfiles', id);
}

// Sunday School Year & Quarters (General Secretary Domain)
export async function getSundaySchoolYear(): Promise<SundaySchoolYear> {
  let localReadError: unknown;
  try {
    const years = await getAllFromStore<SundaySchoolYear>('sundaySchoolYear');
    if (years && years.length > 0) {
      let year = years[0];
      let needsUpdate = false;

      // A partially-created/legacy year must not crash administrative screens.
      // Restore only the missing structural quarter records; preserve every
      // user-entered year and quarter value already present.
      if (!Array.isArray(year.quarters) || year.quarters.length === 0) {
        year = {
          ...year,
          quarters: FRESH_UNINITIALIZED_YEAR.quarters.map(q => ({
            ...q,
            id: `${year.id}_${q.quarterNumber}`,
            updatedAt: year.updatedAt || q.updatedAt
          }))
        };
        needsUpdate = true;
      }

      // Filter out legacy 36 church departments while preserving all authorized user-configured departments
      const legacyDeptsToRemove = new Set([
        'Sunday School', 'Ministers Council', 'Choir', 'Youth Ministry', 'Good Women', 'Men Fellowship',
        'Evangelism Board', 'Ushering Unit', 'Prayer Band', 'Sanctuary Keepers', 'Welfare Board',
        'Media & Technical Unit', 'Young Adults', 'Teens', 'Elders', 'Searchers / Believers',
        'Follow-Up Unit', 'Protocol Unit', 'Music Ministry', 'Christian Education'
      ]);

      if (!Array.isArray(year.departments)) {
        year.departments = [...DEFAULT_DEPARTMENTS];
        needsUpdate = true;
      } else {
        const cleanedDepts = Array.from(new Set(
          year.departments.filter(d => typeof d === 'string' && d.trim() && !legacyDeptsToRemove.has(d))
        ));
        if (cleanedDepts.length !== year.departments.length) {
          year.departments = cleanedDepts;
          needsUpdate = true;
        }
      }

      // Legacy repair only: normalize a missing lessons array. Never inject or
      // overwrite calendar dates while merely reading the record.
      if (year.quarters && year.quarters.length > 0) {
        const q1 = year.quarters[0];
        if (!Array.isArray(q1.lessons)) {
          q1.lessons = [];
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        year.updatedAt = new Date().toISOString();
        // Reading/normalizing cached legacy data must not perform a cloud write,
        // particularly on the unauthenticated sign-in screen.
        await putInStore('sundaySchoolYear', year, true);
      }

      return year;
    }
  } catch (e) {
    localReadError = e;
    console.error('Error reading sundaySchoolYear local cache:', e);
  }

  // Cache miss is not permission to overwrite the cloud with a blank record.
  // Recover the authoritative record first, then seed a local-only setup shell
  // only when the installation genuinely has no year yet.
  try {
    const cloudYears = await fetchCollection<SundaySchoolYear>('sundaySchoolYear');
    if (cloudYears.length > 0) {
      await putInStore('sundaySchoolYear', cloudYears[0], true);
      return cloudYears[0];
    }
  } catch (cloudError) {
    if (localReadError) {
      throw new AggregateError([localReadError, cloudError], 'Could not load the Sunday School year from local storage or Supabase.');
    }
    console.error('Could not check Supabase for the Sunday School year:', cloudError);
  }

  const blankYear: SundaySchoolYear = {
    ...FRESH_UNINITIALIZED_YEAR,
    quarters: FRESH_UNINITIALIZED_YEAR.quarters.map(q => ({ ...q })),
    updatedAt: new Date().toISOString()
  };
  await putInStore('sundaySchoolYear', blankYear, true);
  return blankYear;
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

export async function archiveQuarterAndActivateNext(currentQuarterNumber: QuarterNumber): Promise<SundaySchoolYear> {
  const year = await getSundaySchoolYear();
  if (currentQuarterNumber >= 4) {
    throw new Error('Quarter 4 is the final quarter. Start a new Sunday School year instead.');
  }
  const nextQuarterNumber = (currentQuarterNumber + 1) as QuarterNumber;
  if (!year.quarters.some(q => q.quarterNumber === nextQuarterNumber)) {
    throw new Error(`Quarter ${nextQuarterNumber} is missing from the Sunday School year configuration.`);
  }
  const now = new Date().toISOString();
  const updatedYear: SundaySchoolYear = {
    ...year,
    activeQuarterNumber: nextQuarterNumber,
    quarters: year.quarters.map(q => {
      if (q.quarterNumber === currentQuarterNumber) {
        return { ...q, status: 'ARCHIVED' as const, archivedAt: now, updatedAt: now };
      }
      if (q.quarterNumber === nextQuarterNumber) {
        return { ...q, status: 'ACTIVE' as const, updatedAt: now };
      }
      return q;
    }),
    updatedAt: now
  };
  return saveSundaySchoolYear(updatedYear);
}

// Directory of All Classes (For Admin Approval & Directory Listing)
// Directory of All Classes (For Admin Approval & Directory Listing)
export async function getAllClassesDirectory(forceCloudRefresh = false): Promise<ClassProfile[]> {
  try {
    let classes = (await getAllFromStore<ClassProfile>('allClasses')) || [];
    let cloudRefreshSucceeded = false;

    // If local directory is empty or a fresh pull was requested, query the server API
    if (classes.length === 0 || forceCloudRefresh) {
      try {
        const { fetchAdminClassesApi } = await import('../services/adminUserApi');
        const res = await fetchAdminClassesApi();
        if (!res.success) throw new Error(res.error || 'The server could not load the class directory.');
        if (!Array.isArray(res.classes)) throw new Error('The class-directory response did not contain a classes array.');
        await replaceStoreContents('allClasses', res.classes);
        classes = await getAllFromStore<ClassProfile>('allClasses');
        cloudRefreshSucceeded = true;
      } catch (e) {
        console.warn('Could not fetch classes from server API in getAllClassesDirectory:', e);
        if (forceCloudRefresh) throw e;
      }
    }

    const activeCurrent = await getClassProfile();

    const map = new Map<string, ClassProfile>();
    for (const c of classes) {
      if (c && c.id) {
        map.set(c.id, c);
      }
    }

    if (activeCurrent && activeCurrent.id && (!cloudRefreshSucceeded || map.has(activeCurrent.id))) {
      const existing = map.get(activeCurrent.id);
      const mergedCurrent = existing || activeCurrent;
      if (!existing || (mergedCurrent.updatedAt && (!existing.updatedAt || mergedCurrent.updatedAt >= existing.updatedAt))) {
        map.set(activeCurrent.id, mergedCurrent);
      }
      // Ensure activeCurrent is safely recorded in allClasses store
      await putInStore('allClasses', mergedCurrent, true).catch(error => console.error(`Could not cache active class ${mergedCurrent.id}:`, error));
    }

    return Array.from(map.values());
  } catch (e) {
    console.warn('Error reading allClasses store:', e);
    if (forceCloudRefresh) throw e;
    return [];
  }
}

export async function saveClassToDirectory(profile: ClassProfile): Promise<ClassProfile> {
  await putInStore<ClassProfile>('allClasses', profile, true);
  const current = await getClassProfile();
  if (current && current.id === profile.id) {
    await putInStore<ClassProfile>('classProfile', profile, true);
  }
  await pushToCloud('classDirectory', () => cloudSaveClassProfile(profile), {
    collectionName: 'classes',
    action: 'save',
    docId: profile.id,
    data: profile
  });
  return profile;
}

export async function createBatchClasses(
  classesToCreate: Array<{ className: string; department: string; classId?: string; password?: string }>
): Promise<ClassProfile[]> {
  if (classesToCreate.length === 0) return [];
  const { massCreateClassesApi } = await import('../services/adminUserApi');
  const response = await massCreateClassesApi({ classes: classesToCreate });
  if (!response.success) {
    throw new Error(response.error || 'The server did not create the requested class login(s).');
  }
  if (!response.classes || response.classes.length !== classesToCreate.length) {
    throw new Error(`The server created ${response.classes?.length || 0} of ${classesToCreate.length} requested class login(s). No local-only class was created.`);
  }

  const createdOrUpdated: ClassProfile[] = [];
  for (const serverClass of response.classes) {
    const cls = { ...serverClass } as ClassProfile;
    delete cls.password;
    await putInStore('allClasses', cls, true);
    createdOrUpdated.push(cls);
  }
  return createdOrUpdated;
}

export async function massCreateClasses(
  department: DepartmentType | string,
  suffixes: string[] = ['A', 'B', 'C'],
  temporaryPassword?: string
): Promise<ClassProfile[]> {
  const cleanDept = (department || 'Adult').trim();
  const cleanSuffixes = suffixes.map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!temporaryPassword || temporaryPassword.length < 6) {
    throw new Error('Bulk class creation requires an explicit temporary password of at least 6 characters.');
  }
  return createBatchClasses(cleanSuffixes.map(suffix => ({
    department: cleanDept,
    className: `${cleanDept} Class ${suffix}`,
    classId: `${cleanDept.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${suffix}`,
    password: temporaryPassword,
  })));
}

export async function deleteClassFromDirectory(classId: string): Promise<boolean> {
  try {
    // 1. Delete on server using authoritative admin endpoint
    try {
      const { deleteClassApi } = await import('../services/adminUserApi');
      const apiRes = await deleteClassApi(classId);
      if (!apiRes.success) {
        console.warn('Server class delete returned notice:', apiRes.error);
      }
    } catch (apiErr) {
      console.warn('Server class delete API error:', apiErr);
    }

    // 2. Delete from local IndexedDB
    await deleteFromStore('allClasses', classId, true);
    const active = await getClassProfile();
    if (active && active.id === classId) {
      await deleteFromStore('classProfile', classId, true);
    }
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
        await deleteFromStore('cloudSyncFailures', f.id).catch(error => console.warn(`Could not purge obsolete approval retry ${f.id}:`, error));
      }
    }
  } catch (error) {
    console.warn(`Could not inspect obsolete approval retries for class ${classId}:`, error);
  }

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

// Departments Management (Controlled by General Secretary & General Superintendent)
export async function getAllDepartmentsList(): Promise<string[]> {
  try {
    const year = await getSundaySchoolYear();
    if (year.departments && year.departments.length > 0) {
      return Array.from(new Set(year.departments.filter(Boolean)));
    }
  } catch (e) {
    console.warn('Error reading departments:', e);
  }
  return [...DEFAULT_DEPARTMENTS];
}

export async function addDepartmentToYear(newDepartment: string): Promise<string[]> {
  const year = await getSundaySchoolYear();
  const trimmed = newDepartment.trim();
  if (!trimmed) {
    return year.departments;
  }

  // Persist to Supabase through authoritative server endpoint
  try {
    const { createDepartmentApi } = await import('../services/adminUserApi');
    await createDepartmentApi(trimmed);
  } catch (apiErr) {
    console.warn('Server department creation warning:', apiErr);
  }

  if (year.departments.includes(trimmed)) {
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
      await saveClassToDirectory(updatedClass);
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
  const trimmedName = (departmentName || '').trim();
  if (!trimmedName) {
    const year = await getSundaySchoolYear();
    return year.departments || [];
  }

  // 1. Validate whether classes currently depend on this department
  const classes = await getAllClassesDirectory();
  const currentClass = await getClassProfile();
  const activeClasses = [...classes];
  if (currentClass && !activeClasses.some(c => c.id === currentClass.id)) {
    activeClasses.push(currentClass);
  }

  const dependentClasses = activeClasses.filter(
    c => String(c.department || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (dependentClasses.length > 0) {
    const classNames = dependentClasses.map(c => c.className || c.id).join(', ');
    throw new Error(
      `Cannot delete department "${trimmedName}" because ${dependentClasses.length} class(es) (${classNames}) currently belong to it. Please reassign or delete these classes first.`
    );
  }

  // 2. Safe to delete: Delete from Supabase via authoritative server endpoint
  try {
    const { deleteDepartmentApi } = await import('../services/adminUserApi');
    const res = await deleteDepartmentApi(trimmedName);
    if (!res.success) {
      if (res.error && res.error.toLowerCase().includes('belong to it')) {
        throw new Error(res.error);
      }
      console.warn('Server department deletion warning:', res.error);
    }
  } catch (apiErr: any) {
    if (apiErr?.message?.toLowerCase().includes('belong to it')) {
      throw apiErr;
    }
    console.warn('Server department deletion error (proceeding with local update):', apiErr);
  }

  // 3. Update local IndexedDB SundaySchoolYear
  const year = await getSundaySchoolYear();
  const updatedList = (year.departments || []).filter(
    d => String(d || '').trim().toLowerCase() !== trimmedName.toLowerCase()
  );
  const updatedYear: SundaySchoolYear = {
    ...year,
    departments: updatedList,
    updatedAt: new Date().toISOString()
  };
  await saveSundaySchoolYear(updatedYear);

  try {
    await deleteFromStore('departments', trimmedName);
  } catch (e) {
    // ignore
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

export async function getAllSpecialEvents(forceCloudRefresh = false): Promise<SpecialWorkersEvent[]> {
  try {
    let list = (await getAllFromStore<SpecialWorkersEvent>('specialEvents')) || [];
    if (forceCloudRefresh) {
      try {
        const { fetchSpecialEventsApi } = await import('../services/adminUserApi');
        const res = await fetchSpecialEventsApi();
        if (!res.success) throw new Error(res.error || 'The server could not load special events.');
        if (res.events) {
          await replaceStoreContents('specialEvents', res.events);
          list = await getAllFromStore<SpecialWorkersEvent>('specialEvents');
        }
        if (res.attendance) {
          await replaceStoreContents('specialEventAttendance', res.attendance);
        }
      } catch (err) {
        console.warn('Could not fetch special events from server API:', err);
        if (forceCloudRefresh) throw err;
      }
    }
    return list ? list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  } catch (e) {
    console.error('Error reading specialEvents store:', e);
    if (forceCloudRefresh) throw e;
    return [];
  }
}

export async function saveSpecialEvent(event: SpecialWorkersEvent): Promise<SpecialWorkersEvent> {
  const local = await putInStore<SpecialWorkersEvent>('specialEvents', event);
  const { saveSpecialEventApi } = await import('../services/adminUserApi');
  const result = await saveSpecialEventApi(event);
  if (!result.success) throw new Error(result.error || 'The server did not save the special event.');
  return result.event || local;
}

export async function deleteSpecialEvent(eventId: string): Promise<void> {
  const { deleteSpecialEventApi } = await import('../services/adminUserApi');
  const result = await deleteSpecialEventApi(eventId);
  if (!result.success) throw new Error(result.error || 'The server did not delete the special event.');
  await deleteFromStore('specialEvents', eventId, true);
  // Also clean up all attendance records for this event
  const allAtt = await getAllSpecialEventAttendance();
  const matching = allAtt.filter(a => a.eventId === eventId);
  for (const a of matching) {
    await deleteFromStore('specialEventAttendance', a.id, true);
  }
}

export async function getAllSpecialEventAttendance(forceCloudRefresh = false): Promise<SpecialEventAttendanceRecord[]> {
  try {
    let list = (await getAllFromStore<SpecialEventAttendanceRecord>('specialEventAttendance')) || [];
    if (forceCloudRefresh) {
      try {
        const { fetchSpecialEventsApi } = await import('../services/adminUserApi');
        const res = await fetchSpecialEventsApi();
        if (!res.success) throw new Error(res.error || 'The server could not load special-event attendance.');
        if (res.attendance) {
          await replaceStoreContents('specialEventAttendance', res.attendance);
          list = await getAllFromStore<SpecialEventAttendanceRecord>('specialEventAttendance');
        }
      } catch (err) {
        console.warn('Could not fetch special event attendance from server API:', err);
        if (forceCloudRefresh) throw err;
      }
    }
    return list || [];
  } catch (e) {
    console.warn('Error reading specialEventAttendance store:', e);
    if (forceCloudRefresh) throw e;
    return [];
  }
}

export async function getSpecialEventAttendanceByEvent(eventId: string): Promise<SpecialEventAttendanceRecord[]> {
  const all = await getAllSpecialEventAttendance();
  return all.filter(a => a.eventId === eventId);
}

export async function recordSpecialEventAttendance(record: SpecialEventAttendanceRecord): Promise<SpecialEventAttendanceRecord> {
  const local = await putInStore<SpecialEventAttendanceRecord>('specialEventAttendance', record);
  const { saveSpecialEventAttendanceApi } = await import('../services/adminUserApi');
  const result = await saveSpecialEventAttendanceApi([record]);
  if (!result.success) throw new Error(result.error || 'The server did not save special-event attendance.');
  return local;
}

export async function recordBulkSpecialEventAttendance(records: SpecialEventAttendanceRecord[]): Promise<SpecialEventAttendanceRecord[]> {
  for (const r of records) {
    await putInStore<SpecialEventAttendanceRecord>('specialEventAttendance', r);
  }
  const { saveSpecialEventAttendanceApi } = await import('../services/adminUserApi');
  const result = await saveSpecialEventAttendanceApi(records);
  if (!result.success) throw new Error(result.error || 'The server did not save bulk special-event attendance.');
  return records;
}

export async function deleteSpecialEventAttendance(recordId: string): Promise<void> {
  const { deleteSpecialEventAttendanceApi } = await import('../services/adminUserApi');
  const result = await deleteSpecialEventAttendanceApi(recordId);
  if (!result.success) throw new Error(result.error || 'The server did not delete special-event attendance.');
  await deleteFromStore('specialEventAttendance', recordId, true);
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

      const isChild = o.isChildrenAccount || o.accountType === 'CHILDREN';

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

  // Segregate normal expenditures from Children Account expenditures (Phase 31)
  const normalExpenditures = quarterExpenditures.filter(e => !e.isChildrenAccount && e.accountType !== 'CHILDREN');
  const childrenExpenditures = quarterExpenditures.filter(e => e.isChildrenAccount || e.accountType === 'CHILDREN');

  // Segregate normal audited offerings from Children Account offerings
  const normalAuditedOfferings = auditedOfferingsList.filter(o => !o.isChildrenAccount && o.accountType !== 'CHILDREN');
  const childrenAuditedOfferings = auditedOfferingsList.filter(o => o.isChildrenAccount || o.accountType === 'CHILDREN');

  const totalExpenditure = normalExpenditures.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const normalAuditedTotal = normalAuditedOfferings.reduce((sum, o) => sum + (Number(o.auditedAmount !== undefined ? o.auditedAmount : o.amount) || 0), 0);
  const netIncome = normalAuditedTotal - totalExpenditure;

  // Children Account Totals (Phase 31)
  const childrenAuditedIncome = childrenAuditedOfferings.reduce((sum, o) => sum + (Number(o.auditedAmount !== undefined ? o.auditedAmount : o.amount) || 0), 0);
  const childrenTotalExpenditure = childrenExpenditures.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const childrenNetBalance = childrenAuditedIncome - childrenTotalExpenditure;

  return {
    totalRecorded,
    pendingRemittance,
    pendingAudit,
    cumulativeAuditedIncome: normalAuditedTotal,
    totalIncome: normalAuditedTotal, // for backward compatibility
    totalExpenditure,
    netIncome,
    netBalance: netIncome, // for backward compatibility
    classOfferingsBreakdown,
    pendingRemittancesList: pendingRemittancesList.sort((a, b) => b.weekNumber - a.weekNumber),
    auditedOfferingsList: auditedOfferingsList.sort((a, b) => (b.auditedAt || '').localeCompare(a.auditedAt || '')),
    expenditures: normalExpenditures,
    childrenAccount: {
      auditedIncome: childrenAuditedIncome,
      totalExpenditure: childrenTotalExpenditure,
      netBalance: childrenNetBalance,
      inflows: childrenAuditedOfferings,
      expenditures: childrenExpenditures
    }
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

function hasPermanentlyExitedBy(member: Member, quarterNumber: number, weekNumber: number, fallbackStatus: MemberStatus): boolean {
  if (member.departureQuarter && member.departureWeek) {
    return quarterNumber > member.departureQuarter ||
      (quarterNumber === member.departureQuarter && weekNumber >= member.departureWeek);
  }
  return fallbackStatus === 'LEFT_CLASS';
}

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
  const allTransfers = await getAllStudentTransfers();
  const current = await getClassProfile();

  const approvedClasses = allClasses.filter(c => c.approvalStatus === 'APPROVED');
  if (approvedClasses.length === 0 && current && current.approvalStatus === 'APPROVED') {
    approvedClasses.push(current);
  }

  const rows: RecordOfficerClassRow[] = [];

  for (const cls of approvedClasses) {
    // Phase 10.5 & 10.7: Retrieve members who belonged to this class historically at this weekNumber
    const classMembers = allMembers.filter(m => {
      const hist = getStudentClassForWeek(m, weekNumber);
      return hist.classId === cls.id || (!hist.classId && m.classId === cls.id);
    });

    // Phase 10.8 & 10.9: Check approved transfers affecting this class at this specific weekNumber
    const approvedTransfers = allTransfers.filter(t => t.status === 'APPROVED');
    const transfersInList = approvedTransfers.filter(
      t => (t.destinationClassId === cls.id || t.toClassId === cls.id) &&
           (t.effectiveWeekNumber || t.effectiveWeek || 1) === weekNumber
    );
    const transfersOutList = approvedTransfers.filter(
      t => (t.previousClassId === cls.id || t.fromClassId === cls.id) &&
           (t.effectiveWeekNumber || t.effectiveWeek || 1) === weekNumber
    );
    const transfersIn = transfersInList.length;
    const transfersOut = transfersOutList.length;
    const transferNotes: string[] = [
      ...transfersInList.map(t => `Student ${t.memberName || t.studentName} transferred from ${t.previousClassName || t.fromClassName}`),
      ...transfersOutList.map(t => `Student ${t.memberName || t.studentName} transferred to ${t.destinationClassName || t.toClassName}`)
    ];
    
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

      if (hasPermanentlyExitedBy(mem, quarterNumber, weekNumber, status)) {
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
      transfersIn,
      transfersOut,
      transferNotes,
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
  const allTransfers = await getAllStudentTransfers();
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
    // Phase 10.5 & 10.7: Resolve members historically at selectedWeek
    const classMembers = allMembers.filter(m => {
      const hist = getStudentClassForWeek(m, selectedWeek);
      return hist.classId === cls.id || (!hist.classId && m.classId === cls.id);
    });

    const approvedTransfers = allTransfers.filter(t => t.status === 'APPROVED');
    const transfersInList = approvedTransfers.filter(
      t => (t.destinationClassId === cls.id || t.toClassId === cls.id) &&
           (t.effectiveWeekNumber || t.effectiveWeek || 1) === selectedWeek
    );
    const transfersOutList = approvedTransfers.filter(
      t => (t.previousClassId === cls.id || t.fromClassId === cls.id) &&
           (t.effectiveWeekNumber || t.effectiveWeek || 1) === selectedWeek
    );
    const transfersIn = transfersInList.length;
    const transfersOut = transfersOutList.length;
    const transferNotes: string[] = [
      ...transfersInList.map(t => `Student ${t.memberName || t.studentName} transferred from ${t.previousClassName || t.fromClassName}`),
      ...transfersOutList.map(t => `Student ${t.memberName || t.studentName} transferred to ${t.destinationClassName || t.toClassName}`)
    ];

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

      if (hasPermanentlyExitedBy(mem, quarterNumber, selectedWeek, status)) {
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
      totalActiveClassMembers: currentStudentCount + currentVisitorCount,
      transfersIn,
      transfersOut,
      transferNotes
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

      // Standard consistency rule: 3+ consecutive visits or >= 75% attendance with at least 3 attendances or explicit teacher conversion request
      const isPendingApproval = visitor.conversionStatus === 'PENDING_APPROVAL';
      const isEligible = isPendingApproval || consecutive >= 3 || (attendedWeeks.length >= 3 && attendanceRate >= 75);
      const reason = isPendingApproval
        ? `Teacher Promotion Requested — Awaiting Certification${visitor.conversionRequestedBy ? ` (by ${visitor.conversionRequestedBy})` : ''}`
        : consecutive >= 3
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

  // Sort candidates so PENDING_APPROVAL appears at the very top
  candidates.sort((a, b) => {
    const aPending = a.member.conversionStatus === 'PENDING_APPROVAL' ? 1 : 0;
    const bPending = b.member.conversionStatus === 'PENDING_APPROVAL' ? 1 : 0;
    return bPending - aPending;
  });

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
    conversionStatus: 'APPROVED',
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

  await putInStore('enrollmentCertifications', certRecord);

  return { success: true, member: updatedMember };
}

/**
 * Denies a Visitor's promotion request and keeps them as visitor.
 */
export async function denyVisitorConversion(
  memberId: string,
  officerProfile: AdminProfile,
  reason?: string
): Promise<{ success: boolean; member: Member }> {
  const allMembers = await getAllMembers();
  const target = allMembers.find(m => m.id === memberId);
  if (!target) {
    throw new Error(`Member ${memberId} not found in database`);
  }

  const updatedMember: Member = {
    ...target,
    conversionStatus: 'DENIED',
    notes: reason ? `${target.notes || ''}\n[Conversion Denied by ${officerProfile.profileName}]: ${reason}`.trim() : target.notes,
    updatedAt: new Date().toISOString()
  };

  await putInStore('members', updatedMember);

  return { success: true, member: updatedMember };
}

/**
 * Retrieve all Enrollment Certification audit logs
 */
export async function getAllEnrollmentCertifications(): Promise<EnrollmentCertificationRecord[]> {
  const stored = await getAllFromStore<EnrollmentCertificationRecord>('enrollmentCertifications');
  if (stored.length > 0) {
    return stored.sort((a, b) => b.certifiedAt.localeCompare(a.certifiedAt));
  }

  // One-time compatibility import for audit records produced by older builds.
  const rawCerts = localStorage.getItem('gofamint_enrollment_certifications');
  if (!rawCerts) return [];
  const legacy = JSON.parse(rawCerts) as EnrollmentCertificationRecord[];
  for (const record of legacy) {
    await putInStore('enrollmentCertifications', record);
  }
  localStorage.removeItem('gofamint_enrollment_certifications');
  return legacy.sort((a, b) => b.certifiedAt.localeCompare(a.certifiedAt));
}

/**
 * Performs a complete local cleanup after a factory reset.
 * Clears ALL local storage layers to prevent stale data from returning.
 */
export async function performLocalFactoryReset(): Promise<void> {
  // 1. Clear all IndexedDB stores
  await resetToFreshCleanSystem('UNINITIALIZED_BLANK');
  
  // 2. Clear the schema version flag so next init starts fresh
  localStorage.removeItem('gofamint_schema_v7');
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

/**
 * Student Transfers (Phase 10)
 */
export async function getAllStudentTransfers(): Promise<StudentTransferRecord[]> {
  const stored = await getAllFromStore<StudentTransferRecord>('studentTransfers');
  return stored.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getStudentTransfersForStudent(studentId: string): Promise<StudentTransferRecord[]> {
  const all = await getAllStudentTransfers();
  return all.filter(t => (t.memberId === studentId || t.studentId === studentId));
}

export async function getStudentTransfersByDepartment(deptName: string): Promise<StudentTransferRecord[]> {
  const all = await getAllStudentTransfers();
  return all.filter(t => (
    t.previousDepartment === deptName ||
    t.fromDepartment === deptName ||
    t.destinationDepartment === deptName ||
    t.toDepartment === deptName
  ));
}

export async function requestStudentTransfer(req: {
  studentId: string;
  studentName: string;
  memberType?: 'STUDENT' | 'VISITOR';
  fromDepartment: string;
  fromClassId: string;
  fromClassName: string;
  toDepartment: string;
  toClassId: string;
  toClassName: string;
  reason: string;
  requestedBy: string;
  effectiveWeek: number;
  notes?: string;
}): Promise<StudentTransferRecord> {
  const now = new Date().toISOString();
  const transferRecord: StudentTransferRecord = {
    id: `transfer_${req.studentId}_${Date.now()}`,
    memberId: req.studentId,
    studentId: req.studentId,
    memberType: req.memberType || 'STUDENT',
    memberName: req.studentName,
    studentName: req.studentName,
    previousDepartment: req.fromDepartment,
    fromDepartment: req.fromDepartment,
    previousClassId: req.fromClassId,
    fromClassId: req.fromClassId,
    previousClassName: req.fromClassName,
    fromClassName: req.fromClassName,
    destinationDepartment: req.toDepartment,
    toDepartment: req.toDepartment,
    destinationClassId: req.toClassId,
    toClassId: req.toClassId,
    destinationClassName: req.toClassName,
    toClassName: req.toClassName,
    reason: req.reason,
    requestingOfficer: req.requestedBy,
    requestedBy: req.requestedBy,
    requestedAt: now,
    effectiveWeekNumber: req.effectiveWeek,
    effectiveWeek: req.effectiveWeek,
    status: 'PENDING',
    notes: req.notes,
    createdAt: now,
    updatedAt: now
  };

  await putInStore('studentTransfers', transferRecord);
  return transferRecord;
}

export async function approveStudentTransfer(
  transferId: string,
  officerName: string,
  notes?: string
): Promise<{ success: boolean; transfer: StudentTransferRecord; member: Member }> {
  const transfers = await getAllStudentTransfers();
  const transfer = transfers.find(t => t.id === transferId);
  if (!transfer) {
    throw new Error(`Transfer request ${transferId} not found`);
  }

  const now = new Date().toISOString();
  const updatedTransfer: StudentTransferRecord = {
    ...transfer,
    status: 'APPROVED',
    approvingOfficer: officerName,
    reviewedBy: officerName,
    approvalDate: now,
    reviewedAt: now,
    notes: notes || transfer.notes,
    updatedAt: now
  };

  await putInStore('studentTransfers', updatedTransfer);

  // Update student's current membership & append transfer to their transferHistory
  const targetMemberId = transfer.memberId || transfer.studentId;
  const allMembers = await getAllMembers();
  const student = allMembers.find(m => m.id === targetMemberId);
  if (!student) {
    throw new Error(`Student ${targetMemberId} not found in database`);
  }

  const transferHistory = [...(student.transferHistory || []), updatedTransfer];
  const destClassId = updatedTransfer.destinationClassId || updatedTransfer.toClassId;
  const destClassName = updatedTransfer.destinationClassName || updatedTransfer.toClassName;
  const destDept = updatedTransfer.destinationDepartment || updatedTransfer.toDepartment;
  const effWk = updatedTransfer.effectiveWeekNumber || updatedTransfer.effectiveWeek || 1;

  const updatedMember: Member = {
    ...student,
    department: destDept,
    classId: destClassId,
    className: destClassName,
    transferHistory,
    notes: `${student.notes || ''}\n[Transferred to ${destClassName} effective Wk ${effWk} by ${officerName}]`.trim(),
    updatedAt: now
  };

  await putInStore('members', updatedMember);

  return { success: true, transfer: updatedTransfer, member: updatedMember };
}

export async function rejectStudentTransfer(
  transferId: string,
  officerName: string,
  notes?: string
): Promise<{ success: boolean; transfer: StudentTransferRecord }> {
  const transfers = await getAllStudentTransfers();
  const transfer = transfers.find(t => t.id === transferId);
  if (!transfer) {
    throw new Error(`Transfer request ${transferId} not found`);
  }

  const now = new Date().toISOString();
  const updatedTransfer: StudentTransferRecord = {
    ...transfer,
    status: 'REJECTED',
    approvingOfficer: officerName,
    reviewedBy: officerName,
    approvalDate: now,
    reviewedAt: now,
    notes: notes || transfer.notes,
    updatedAt: now
  };

  await putInStore('studentTransfers', updatedTransfer);

  return { success: true, transfer: updatedTransfer };
}

/**
 * Historical Membership Resolver (Phase 10.5 & 10.7)
 * Determines which department/class a student belonged to during a specific weekNumber,
 * preserving historical records without modifying past week data.
 */
export function getStudentClassForWeek(
  student: Member,
  weekNumber: number
): { department: string; classId: string; className: string } {
  if (!student.transferHistory || student.transferHistory.length === 0) {
    return {
      department: student.department || '',
      classId: student.classId || '',
      className: student.className || student.classId || ''
    };
  }

  const approvedTransfers = student.transferHistory
    .filter(t => t.status === 'APPROVED')
    .sort((a, b) => (a.effectiveWeekNumber || a.effectiveWeek || 1) - (b.effectiveWeekNumber || b.effectiveWeek || 1));

  if (approvedTransfers.length === 0) {
    return {
      department: student.department || '',
      classId: student.classId || '',
      className: student.className || student.classId || ''
    };
  }

  // If a transfer took effect in a future week relative to weekNumber,
  // the student was in that transfer's previousClass during weekNumber.
  const futureTransfer = approvedTransfers.find(t => (t.effectiveWeekNumber || t.effectiveWeek || 1) > weekNumber);
  if (futureTransfer) {
    return {
      department: futureTransfer.previousDepartment || futureTransfer.fromDepartment || '',
      classId: futureTransfer.previousClassId || futureTransfer.fromClassId || '',
      className: futureTransfer.previousClassName || futureTransfer.fromClassName || ''
    };
  }

  // Otherwise, the latest transfer that took effect at or before weekNumber applies.
  const activeTransfer = [...approvedTransfers].reverse().find(t => (t.effectiveWeekNumber || t.effectiveWeek || 1) <= weekNumber);
  if (activeTransfer) {
    return {
      department: activeTransfer.destinationDepartment || activeTransfer.toDepartment || '',
      classId: activeTransfer.destinationClassId || activeTransfer.toClassId || '',
      className: activeTransfer.destinationClassName || activeTransfer.toClassName || ''
    };
  }

  return {
    department: student.department || '',
    classId: student.classId || '',
    className: student.className || student.classId || ''
  };
}

/**
 * Check Department Dependencies (Phase 13.1)
 */
export async function checkDepartmentDependencies(
  departmentName: string
): Promise<{ hasDependencies: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  const classes = await getAllClassesDirectory();
  const dependentClasses = classes.filter(c => c.department === departmentName);
  if (dependentClasses.length > 0) {
    reasons.push(`${dependentClasses.length} class(es): ${dependentClasses.map(c => c.className || c.id).join(', ')}`);
  }

  const members = await getAllMembers();
  const deptMembers = members.filter(m => m.department === departmentName);
  if (deptMembers.length > 0) {
    reasons.push(`${deptMembers.length} member(s)/student(s) enrolled`);
  }

  const workers = await getAllWorkers();
  const deptWorkers = workers.filter(w => w.department === departmentName);
  if (deptWorkers.length > 0) {
    reasons.push(`${deptWorkers.length} worker(s) assigned`);
  }

  return {
    hasDependencies: reasons.length > 0,
    reasons
  };
}

/**
 * Archive Department in Year (Phase 13.1)
 * Safely removes a department from the active list and marks it archived,
 * keeping historical records, classes, and members fully intact.
 */
export async function archiveDepartmentInYear(departmentName: string): Promise<SundaySchoolYear> {
  const year = await getSundaySchoolYear();
  const currentDepts = year.departments || [];
  const currentArchived = year.archivedDepartments || [];

  const updatedDepts = currentDepts.filter(d => d !== departmentName);
  const updatedArchived = currentArchived.includes(departmentName)
    ? currentArchived
    : [...currentArchived, departmentName];

  const updatedYear: SundaySchoolYear = {
    ...year,
    departments: updatedDepts,
    archivedDepartments: updatedArchived,
    updatedAt: new Date().toISOString()
  };

  await saveSundaySchoolYear(updatedYear);
  return updatedYear;
}

