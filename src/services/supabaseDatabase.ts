import { getSupabaseClient } from './supabase';
import {
  AdminComment,
  AdminProfile,
  ClassProfile,
  ClockInConfig,
  EvangelismReferralRecord,
  LessonInfo,
  SpecialEventAttendanceRecord,
  SpecialWorkersEvent,
  SundaySchoolYear,
  TreasuryExpenditure,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  WorkerAttendanceRecord,
  WorkerCategoryDef,
  WorkerPrepAttendanceRecord,
  WorkerProfile,
  Member,
  AbsenceLogRecord,
} from '../types';
import { collectAllPages } from '../utils/paginatedRead';

type Filter = { field: string; op: string; value: unknown };

export const SUPABASE_READ_PAGE_SIZE = 500;

type TableConfig = {
  table: string;
  columns?: Record<string, string>;
  hasUpdatedAt?: boolean;
};

// Legacy collection names stay at this boundary so existing application and
// IndexedDB shapes do not need a broad rewrite during the CRUD checkpoint.
const TABLES: Record<string, TableConfig> = {
  classes: { table: 'classes', columns: { departmentId: 'department_id', department: 'department_id' }, hasUpdatedAt: true },
  members: { table: 'members', columns: { classId: 'class_id' }, hasUpdatedAt: true },
  grades: { table: 'grades', columns: { classId: 'class_id', memberId: 'member_id', quarterNumber: 'quarter_number', weekNumber: 'week_number' }, hasUpdatedAt: true },
  offerings: { table: 'offerings', columns: { classId: 'class_id', quarterNumber: 'quarter_number', weekNumber: 'week_number' }, hasUpdatedAt: true },
  absenceLogs: { table: 'absence_logs', columns: { classId: 'class_id', memberId: 'member_id' }, hasUpdatedAt: true },
  enrollmentCertifications: { table: 'enrollment_certifications', columns: { classId: 'class_id', memberId: 'member_id', quarterNumber: 'quarter_number', weekNumber: 'week_number' } },
  referrals: { table: 'referrals', columns: { classId: 'class_id' }, hasUpdatedAt: true },
  workers: { table: 'workers', hasUpdatedAt: true },
  workerAttendance: { table: 'worker_attendance', columns: { workerId: 'worker_id', serviceDate: 'service_date' } },
  workerPrepAttendance: { table: 'worker_prep_attendance', columns: { workerId: 'worker_id', prepDate: 'prep_date' }, hasUpdatedAt: true },
  adminProfiles: { table: 'admin_profiles' },
  adminComments: { table: 'admin_comments', columns: { classId: 'class_id' }, hasUpdatedAt: true },
  treasuryExpenditures: { table: 'treasury_expenditures' },
  sundaySchoolYear: { table: 'sunday_school_years', hasUpdatedAt: true },
  sundaySchoolYearArchive: { table: 'sunday_school_year_archives' },
  departments: { table: 'departments', hasUpdatedAt: true },
  clockInConfig: { table: 'clock_in_config', hasUpdatedAt: true },
  workerCategories: { table: 'worker_categories', hasUpdatedAt: true },
  specialEvents: { table: 'special_events', hasUpdatedAt: true },
  specialEventAttendance: { table: 'special_event_attendance', columns: { eventId: 'event_id', workerId: 'worker_id' } },
  lessons: { table: 'lessons', columns: { yearId: 'year_id', weekNumber: 'week_number' }, hasUpdatedAt: true },
  auditLogs: { table: 'audit_logs' },
};

function configFor(collectionName: string): TableConfig {
  const config = TABLES[collectionName];
  if (!config) throw new Error(`No Supabase table mapping exists for ${collectionName}.`);
  return config;
}

/** JSONB accepts JSON values only; preserve Firestore documents without undefined values. */
export function cleanForSupabase<T>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.filter(item => item !== undefined).map(cleanForSupabase) as T;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, cleanForSupabase(nested)])
  ) as T;
}

function toRow(collectionName: string, document: Record<string, any>): Record<string, any> {
  const config = configFor(collectionName);
  if (!document?.id) throw new Error(`Cannot save ${collectionName} without a stable id.`);

  if (collectionName === 'adminProfiles') {
    throw new Error('Administrative profiles are provisioned only through the protected server API.');
  }

  const data = cleanForSupabase({ ...document });
  delete data.id;
  const row: Record<string, any> = { id: document.id, data };
  for (const [legacyField, column] of Object.entries(config.columns || {})) {
    if (legacyField in document) row[column] = document[legacyField] ?? null;
  }
  if (collectionName === 'departments') {
    row.name = document.name || document.id;
  }
  if (collectionName === 'classes' && (document.department || document.departmentId)) {
    row.department_id = document.department || document.departmentId;
  }
  if (config.hasUpdatedAt) row.updated_at = new Date().toISOString();
  return row;
}

function fromRow<T>(collectionName: string, row: Record<string, any>): T {
  const config = configFor(collectionName);
  if (collectionName === 'adminProfiles') {
    return {
      id: row.id,
      roleType: row.role_type,
      title: row.title,
      profileName: row.profile_name,
      username: row.username,
      photoBase64: row.photo_base64 || undefined,
      isApproved: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as T;
  }
  const result: Record<string, any> = {
    ...(row.data && typeof row.data === 'object' ? row.data : {}),
    id: row.id,
  };
  for (const [legacyField, column] of Object.entries(config.columns || {})) {
    if (row[column] !== null && row[column] !== undefined) result[legacyField] = row[column];
  }
  if (collectionName === 'departments') result.name = row.name || result.name || row.id;
  return result as T;
}

function columnFor(collectionName: string, legacyField: string): string {
  return configFor(collectionName).columns?.[legacyField] || legacyField;
}

function applyFilter(query: any, filter: Filter, column: string) {
  switch (filter.op) {
    case '==': return query.eq(column, filter.value);
    case '!=': return query.neq(column, filter.value);
    case '<': return query.lt(column, filter.value);
    case '<=': return query.lte(column, filter.value);
    case '>': return query.gt(column, filter.value);
    case '>=': return query.gte(column, filter.value);
    default: throw new Error(`Unsupported Supabase filter operator: ${filter.op}`);
  }
}

async function fetchRowsPaginated(collectionName: string, filters: Filter[] = []): Promise<Record<string, any>[]> {
  const config = configFor(collectionName);
  const client = getSupabaseClient();

  return collectAllPages<Record<string, any>>(
    async (from, to, pageIndex) => {
      let query: any = client
        .from(config.table)
        .select('*', pageIndex === 0 ? { count: 'exact' } : {})
        .order('id', { ascending: true })
        .range(from, to);

      for (const filter of filters) {
        if (filter.value !== undefined && filter.value !== null) {
          query = applyFilter(query, filter, columnFor(collectionName, filter.field));
        }
      }

      const { data, error, count } = await query;
      if (error) {
        console.error(`Supabase paginated read failed [${collectionName}] page ${pageIndex + 1}:`, error);
        throw error;
      }

      return { rows: data || [], totalCount: pageIndex === 0 ? count : undefined };
    },
    {
      pageSize: SUPABASE_READ_PAGE_SIZE,
      getId: row => row?.id ? String(row.id) : undefined,
      label: `Supabase ${collectionName}`,
    }
  );
}

export async function fetchCollection<T>(collectionName: string): Promise<T[]> {
  const client = getSupabaseClient();
  const data = await fetchRowsPaginated(collectionName);
  if (collectionName === 'adminProfiles') {
    const ids = (data || []).map((row: Record<string, any>) => row.profile_id).filter(Boolean);
    const profiles: Record<string, any>[] = [];
    for (let index = 0; index < ids.length; index += SUPABASE_READ_PAGE_SIZE) {
      const idBatch = ids.slice(index, index + SUPABASE_READ_PAGE_SIZE);
      const { data: profileBatch, error: profileError } = await client
        .from('profiles')
        .select('id,is_approved,approved_by,approved_at')
        .in('id', idBatch);
      if (profileError) {
        console.error(`Supabase profile-status read failed for adminProfiles batch ${Math.floor(index / SUPABASE_READ_PAGE_SIZE) + 1}:`, profileError);
        throw profileError;
      }
      profiles.push(...(profileBatch || []));
    }
    const statusById = new Map((profiles || []).map((profile: Record<string, any>) => [profile.id, profile]));
    return (data || []).map((row: Record<string, any>) => {
      const profile = statusById.get(row.profile_id);
      return {
        ...fromRow<T>(collectionName, row),
        isApproved: profile?.is_approved === true,
        approvedBy: profile?.approved_by || undefined,
        approvedAt: profile?.approved_at || undefined,
      };
    });
  }
  return (data || []).map(row => fromRow<T>(collectionName, row));
}

export async function fetchDocument<T>(collectionName: string, documentId: string): Promise<T | null> {
  if (!documentId) return null;
  const config = configFor(collectionName);
  const { data, error } = await getSupabaseClient().from(config.table).select('*').eq('id', documentId).maybeSingle();
  if (error) {
    console.error(`Supabase fetchDocument error [${collectionName}/${documentId}]:`, error);
    throw error;
  }
  return data ? fromRow<T>(collectionName, data) : null;
}

export async function saveDocument<T extends { id: string }>(collectionName: string, document: T): Promise<T> {
  const config = configFor(collectionName);
  let row = toRow(collectionName, document);
  if (collectionName === 'classes') {
    try {
      const { data: existing } = await getSupabaseClient().from('classes').select('data').eq('id', document.id).maybeSingle();
      if (existing?.data?.approvalStatus === 'APPROVED' && row.data?.approvalStatus !== 'APPROVED') {
        row.data.approvalStatus = 'APPROVED';
        if (existing.data.approvedBy) row.data.approvedBy = existing.data.approvedBy;
        if (existing.data.approvedAt) row.data.approvedAt = existing.data.approvedAt;
      }
    } catch (approvalLookupError) {
      console.warn(`Could not verify existing class approval before saving ${document.id}:`, approvalLookupError);
    }
  }
  const { error } = await getSupabaseClient().from(config.table).upsert(row, { onConflict: 'id' });
  if (error) {
    console.error(`Supabase saveDocument error [${collectionName}/${document.id}]:`, error);
    throw error;
  }
  return document;
}

export async function removeDocument(collectionName: string, documentId: string): Promise<void> {
  if (!documentId) return;
  if (collectionName === 'workers') {
    try {
      const { deleteWorkerApi } = await import('./adminUserApi');
      const res = await deleteWorkerApi(documentId);
      if (res && res.success) {
        return;
      }
    } catch (apiErr) {
      console.warn('deleteWorkerApi fallback to standard delete:', apiErr);
    }
  }
  const config = configFor(collectionName);
  const { error } = await getSupabaseClient().from(config.table).delete().eq('id', documentId);
  if (error) {
    console.error(`Supabase removeDocument error [${collectionName}/${documentId}]:`, error);
    throw error;
  }
}

export async function saveBatchDocuments<T extends { id: string }>(collectionName: string, documents: T[]): Promise<void> {
  if (!documents.length) return;
  const config = configFor(collectionName);
  const chunkSize = 450;
  for (let index = 0; index < documents.length; index += chunkSize) {
    const { error } = await getSupabaseClient()
      .from(config.table)
      .upsert(documents.slice(index, index + chunkSize).map(document => toRow(collectionName, document)), { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function fetchCollectionScoped<T>(collectionName: string, filters: Filter[] = []): Promise<T[]> {
  const data = await fetchRowsPaginated(collectionName, filters);
  return (data || []).map((row: Record<string, any>) => fromRow<T>(collectionName, row));
}

// -----------------------------------------------------------------------------
// REALTIME SUBSCRIPTIONS
// -----------------------------------------------------------------------------
// Insert/update payloads are converted locally for low-latency rendering.
// Delete notifications never trust their payload; they trigger an immediate
// RLS-protected authoritative query so removed rows converge safely.
type RealtimeUnsubscribe = () => void;
let realtimeSequence = 0;
export type RealtimeHealthStatus = 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'ERROR' | 'IDLE';
const realtimeChannelStatuses = new Map<string, string>();
let currentRealtimeHealthStatus: RealtimeHealthStatus = 'IDLE';

export function getRealtimeHealthStatus(): RealtimeHealthStatus {
  return currentRealtimeHealthStatus;
}

function emitRealtimeHealth(collectionName: string, channelKey: string, status: string, error?: string) {
  if (status === 'REMOVED') realtimeChannelStatuses.delete(channelKey);
  else realtimeChannelStatuses.set(channelKey, status);

  const statuses = Array.from(realtimeChannelStatuses.values());
  const overall: RealtimeHealthStatus = statuses.length === 0
    ? 'IDLE'
    : statuses.some(item => item === 'CHANNEL_ERROR' || item === 'TIMED_OUT')
      ? 'ERROR'
      : statuses.every(item => item === 'SUBSCRIBED')
        ? 'LIVE'
        : statuses.some(item => item === 'CLOSED')
          ? 'RECONNECTING'
          : 'CONNECTING';

  if (overall !== currentRealtimeHealthStatus) {
    currentRealtimeHealthStatus = overall;
    console.info(`[RealtimeHealth] ${overall} (${statuses.length} active channel${statuses.length === 1 ? '' : 's'})`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gofamint:realtime-status', {
      detail: { overall, collectionName, status, error, activeChannels: statuses.length, changedAt: Date.now() },
    }));
  }
}

function requestDeleteReconciliation(collectionName: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gofamint:realtime-delete', {
      detail: { collectionName, changedAt: Date.now() },
    }));
  }
}

function realtimeChannelName(collectionName: string, scope: string): string {
  realtimeSequence += 1;
  return `gofamint:${collectionName}:${scope}:${realtimeSequence}`;
}

function reportRealtimeError(collectionName: string, error: unknown, onError?: (error: Error) => void) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  console.error(`Supabase realtime subscription error [${collectionName}]:`, normalized);
  onError?.(normalized);
}

export function subscribeToCollection<T>(
  collectionName: string,
  onUpdate: (data: T[]) => void,
  onError?: (error: Error) => void,
  skipInitialFetch = true
): RealtimeUnsubscribe {
  const config = configFor(collectionName);
  const client = getSupabaseClient();
  let active = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingRows = new Map<string, Record<string, any>>();

  const refresh = async () => {
    try {
      const items = await fetchCollection<T>(collectionName);
      if (active) onUpdate(items);
    } catch (error) {
      if (active) reportRealtimeError(collectionName, error, onError);
    }
  };

  const debouncedRefresh = (payload: { new?: Record<string, any> }) => {
    const row = payload.new;
    if (row?.id) pendingRows.set(String(row.id), row);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!active) return;
      if (collectionName === 'adminProfiles') {
        pendingRows.clear();
        void refresh();
        return;
      }
      const items = Array.from(pendingRows.values()).map(rowValue => fromRow<T>(collectionName, rowValue));
      pendingRows.clear();
      if (items.length > 0) onUpdate(items);
    }, 80);
  };

  const scheduleAuthoritativeRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (active) {
        void refresh();
        requestDeleteReconciliation(collectionName);
      }
    }, 80);
  };

  if (!skipInitialFetch) {
    void refresh();
  }

  const channelKey = realtimeChannelName(collectionName, 'all');
  emitRealtimeHealth(collectionName, channelKey, 'CONNECTING');
  const channel = client
    .channel(channelKey)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: config.table }, debouncedRefresh)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: config.table }, debouncedRefresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: config.table }, scheduleAuthoritativeRefresh)
    .subscribe((status) => {
      emitRealtimeHealth(collectionName, channelKey, status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reportRealtimeError(collectionName, new Error(`Realtime channel status: ${status}`), onError);
      }
    });

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    emitRealtimeHealth(collectionName, channelKey, 'REMOVED');
    void client.removeChannel(channel);
  };
}

export function subscribeToCollectionScoped<T>(
  collectionName: string,
  filters: Filter[],
  onUpdate: (data: T[]) => void,
  onError?: (error: Error) => void,
  skipInitialFetch = true
): RealtimeUnsubscribe {
  const config = configFor(collectionName);
  const realtimeFilter = filters.find(filter => filter.op === '==' && filter.value !== undefined && filter.value !== null);
  if (!realtimeFilter) {
    throw new Error(`Supabase realtime requires an equality scope for ${collectionName}.`);
  }

  const client = getSupabaseClient();
  const column = columnFor(collectionName, realtimeFilter.field);
  let active = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingRows = new Map<string, Record<string, any>>();

  const refresh = async () => {
    try {
      const items = await fetchCollectionScoped<T>(collectionName, filters);
      if (active) onUpdate(items);
    } catch (error) {
      if (active) reportRealtimeError(collectionName, error, onError);
    }
  };

  const debouncedRefresh = (payload: { new?: Record<string, any> }) => {
    const row = payload.new;
    if (row?.id) pendingRows.set(String(row.id), row);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!active) return;
      const items = Array.from(pendingRows.values()).map(rowValue => fromRow<T>(collectionName, rowValue));
      pendingRows.clear();
      if (items.length > 0) onUpdate(items);
    }, 80);
  };

  const scheduleAuthoritativeRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (active) {
        void refresh();
        requestDeleteReconciliation(collectionName);
      }
    }, 80);
  };

  if (!skipInitialFetch) {
    void refresh();
  }

  const channelKey = realtimeChannelName(collectionName, `${column}:${String(realtimeFilter.value)}`);
  emitRealtimeHealth(collectionName, channelKey, 'CONNECTING');
  const channel = client
    .channel(channelKey)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: config.table, filter: `${column}=eq.${realtimeFilter.value}` },
      debouncedRefresh
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: config.table, filter: `${column}=eq.${realtimeFilter.value}` },
      debouncedRefresh
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: config.table }, scheduleAuthoritativeRefresh)
    .subscribe((status) => {
      emitRealtimeHealth(collectionName, channelKey, status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reportRealtimeError(collectionName, new Error(`Realtime channel status: ${status}`), onError);
      }
    });

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    emitRealtimeHealth(collectionName, channelKey, 'REMOVED');
    void client.removeChannel(channel);
  };
}

export function subscribeToDocument<T>(
  collectionName: string,
  documentId: string,
  onUpdate: (data: T | null) => void,
  onError?: (error: Error) => void
): RealtimeUnsubscribe {
  if (!documentId) return () => {};
  const config = configFor(collectionName);
  const client = getSupabaseClient();
  let active = true;
  const refresh = async () => {
    try {
      const item = await fetchDocument<T>(collectionName, documentId);
      if (active) onUpdate(item);
    } catch (error) {
      if (active) reportRealtimeError(collectionName, error, onError);
    }
  };

  void refresh();
  const channelKey = realtimeChannelName(collectionName, `id:${documentId}`);
  emitRealtimeHealth(collectionName, channelKey, 'CONNECTING');
  const channel = client
    .channel(channelKey)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: config.table, filter: `id=eq.${documentId}` }, () => void refresh())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: config.table, filter: `id=eq.${documentId}` }, () => void refresh())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: config.table }, () => {
      void refresh();
      requestDeleteReconciliation(collectionName);
    })
    .subscribe((status) => {
      emitRealtimeHealth(collectionName, channelKey, status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reportRealtimeError(collectionName, new Error(`Realtime channel status: ${status}`), onError);
      }
    });

  return () => {
    active = false;
    emitRealtimeHealth(collectionName, channelKey, 'REMOVED');
    void client.removeChannel(channel);
  };
}

export const subscribeToClassGrades = (classId: string, onUpdate: (items: WeeklyGradeRecord[]) => void) =>
  subscribeToCollectionScoped('grades', [{ field: 'classId', op: '==', value: classId }], onUpdate);
export const subscribeToClassMembers = (classId: string, onUpdate: (items: Member[]) => void) =>
  subscribeToCollectionScoped('members', [{ field: 'classId', op: '==', value: classId }], onUpdate);
export const subscribeToClassAbsenceLogs = (classId: string, onUpdate: (items: AbsenceLogRecord[]) => void) =>
  subscribeToCollectionScoped('absenceLogs', [{ field: 'classId', op: '==', value: classId }], onUpdate);
export const subscribeToClassOfferings = (classId: string, onUpdate: (items: WeeklyOfferingRecord[]) => void) =>
  subscribeToCollectionScoped('offerings', [{ field: 'classId', op: '==', value: classId }], onUpdate);
export const subscribeToClassAdminComments = (classId: string, onUpdate: (items: AdminComment[]) => void) =>
  subscribeToCollectionScoped('adminComments', [{ field: 'classId', op: '==', value: classId }], onUpdate);

// High-level accessors preserve existing callers while moving all active CRUD
// to the authenticated browser Supabase client.
export const cloudGetClassProfile = (id: string) => fetchDocument<ClassProfile>('classes', id);
export const cloudGetAllClasses = () => fetchCollection<ClassProfile>('classes');
export const cloudSaveClassProfile = (profile: ClassProfile) => saveDocument('classes', profile);
export const cloudDeleteClass = (id: string) => removeDocument('classes', id);
export const cloudGetAllMembers = () => fetchCollection<Member>('members');
export const cloudGetMember = (id: string) => fetchDocument<Member>('members', id);
export const cloudSaveMember = (item: Member) => saveDocument('members', item);
export const cloudSaveBulkMembers = (items: Member[]) => saveBatchDocuments('members', items);
export const cloudDeleteMember = (id: string) => removeDocument('members', id);
export const cloudGetAllGrades = () => fetchCollection<WeeklyGradeRecord>('grades');
export const cloudSaveGrade = (item: WeeklyGradeRecord) => saveDocument('grades', item);
export const cloudSaveBulkGrades = (items: WeeklyGradeRecord[]) => saveBatchDocuments('grades', items);
export const cloudDeleteGrade = (id: string) => removeDocument('grades', id);
export const cloudGetAllOfferings = () => fetchCollection<WeeklyOfferingRecord>('offerings');
export const cloudSaveOffering = (item: WeeklyOfferingRecord) => saveDocument('offerings', item);
export const cloudSaveBulkOfferings = (items: WeeklyOfferingRecord[]) => saveBatchDocuments('offerings', items);
export const cloudDeleteOffering = (id: string) => removeDocument('offerings', id);
export const cloudGetAllAbsenceLogs = () => fetchCollection<AbsenceLogRecord>('absenceLogs');
export const cloudSaveAbsenceLog = (item: AbsenceLogRecord) => saveDocument('absenceLogs', item);
export const cloudDeleteAbsenceLog = (id: string) => removeDocument('absenceLogs', id);
export const cloudGetAllReferrals = () => fetchCollection<EvangelismReferralRecord>('referrals');
export const cloudSaveReferral = (item: EvangelismReferralRecord) => saveDocument('referrals', item);
export const cloudDeleteReferral = (id: string) => removeDocument('referrals', id);
export const cloudGetAllWorkers = () => fetchCollection<WorkerProfile>('workers');
export const cloudSaveWorker = (item: WorkerProfile) => saveDocument('workers', item);
export const cloudSaveBulkWorkers = (items: WorkerProfile[]) => saveBatchDocuments('workers', items);
export const cloudDeleteWorker = (id: string) => removeDocument('workers', id);
export const cloudGetAllWorkerAttendance = () => fetchCollection<WorkerAttendanceRecord>('workerAttendance');
export const cloudSaveWorkerAttendance = (item: WorkerAttendanceRecord) => saveDocument('workerAttendance', item);
export const cloudSaveBulkWorkerAttendance = (items: WorkerAttendanceRecord[]) => saveBatchDocuments('workerAttendance', items);
export const cloudDeleteWorkerAttendance = (id: string) => removeDocument('workerAttendance', id);
export const cloudGetAllWorkerPrepAttendance = () => fetchCollection<WorkerPrepAttendanceRecord>('workerPrepAttendance');
export const cloudSaveWorkerPrepAttendance = (item: WorkerPrepAttendanceRecord) => saveDocument('workerPrepAttendance', item);
export const cloudSaveBulkWorkerPrepAttendance = (items: WorkerPrepAttendanceRecord[]) => saveBatchDocuments('workerPrepAttendance', items);
export const cloudDeleteWorkerPrepAttendance = (id: string) => removeDocument('workerPrepAttendance', id);
export async function cloudGetAllAdminProfiles(): Promise<AdminProfile[]> {
  const rows = await fetchRowsPaginated('adminProfiles');
  return rows.map(row => ({
    id: row.id,
    roleType: row.role_type,
    title: row.title,
    profileName: row.profile_name,
    username: row.username,
    photoBase64: row.photo_base64 || undefined,
    departmentId: row.department_id || undefined,
    isApproved: row.is_approved === true,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as AdminProfile));
}
export async function cloudSaveAdminProfile(profile: AdminProfile): Promise<AdminProfile> {
  const { error } = await getSupabaseClient().from('admin_profiles').upsert({
    id: profile.id,
    profile_id: (profile as any).profileId || profile.id,
    role_type: profile.roleType,
    title: profile.title,
    profile_name: profile.profileName,
    username: profile.username,
    photo_base64: profile.photoBase64 || null,
    department_id: profile.departmentId || null,
    is_approved: profile.isApproved === true,
    approved_by: profile.approvedBy || null,
    approved_at: profile.approvedAt || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw error;
  return profile;
}
export async function cloudApproveAdminProfile(id: string, approverName: string = 'General Superintendent'): Promise<void> {
  const now = new Date().toISOString();
  const client = getSupabaseClient();
  const [adminResult, profileResult] = await Promise.all([
    client.from('admin_profiles').update({
      is_approved: true,
      approved_by: approverName,
      approved_at: now,
      updated_at: now,
    }).or(`id.eq.${id},profile_id.eq.${id}`),
    client.from('profiles').update({
      is_approved: true,
      approved_by: approverName,
      approved_at: now,
      updated_at: now,
    }).eq('id', id),
  ]);
  if (adminResult.error) throw adminResult.error;
  if (profileResult.error) throw profileResult.error;
}
export async function cloudDeleteAdminProfile(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('admin_profiles').delete().eq('id', id);
  if (error) throw error;
}
export const cloudGetAllAdminComments = () => fetchCollection<AdminComment>('adminComments');
export const cloudSaveAdminComment = (item: AdminComment) => saveDocument('adminComments', item);
export const cloudDeleteAdminComment = (id: string) => removeDocument('adminComments', id);
export const cloudGetAllTreasuryExpenditures = () => fetchCollection<TreasuryExpenditure>('treasuryExpenditures');
export const cloudSaveTreasuryExpenditure = (item: TreasuryExpenditure) => saveDocument('treasuryExpenditures', item);
export const cloudDeleteTreasuryExpenditure = (id: string) => removeDocument('treasuryExpenditures', id);
export const cloudGetSundaySchoolYear = async () => (await fetchCollection<SundaySchoolYear>('sundaySchoolYear'))[0] || null;
export const cloudSaveSundaySchoolYear = (item: SundaySchoolYear) => saveDocument('sundaySchoolYear', item);
export const cloudGetAllDepartments = async () => (await fetchCollection<{ id: string; name: string }>('departments')).map(item => item.name || item.id);
export const cloudSaveDepartment = (name: string) => saveDocument('departments', { id: name, name });
export const cloudDeleteDepartment = (name: string) => removeDocument('departments', name);
export const cloudGetClockInConfig = async () => (await fetchCollection<ClockInConfig>('clockInConfig'))[0] || null;
export const cloudSaveClockInConfig = (item: ClockInConfig) => saveDocument('clockInConfig', item);
export const cloudGetAllWorkerCategories = () => fetchCollection<WorkerCategoryDef>('workerCategories');
export const cloudSaveWorkerCategory = (item: WorkerCategoryDef) => saveDocument('workerCategories', item);
export const cloudDeleteWorkerCategory = (id: string) => removeDocument('workerCategories', id);
export const cloudGetAllSpecialEvents = () => fetchCollection<SpecialWorkersEvent>('specialEvents');
export const cloudSaveSpecialEvent = (item: SpecialWorkersEvent) => saveDocument('specialEvents', item);
export const cloudDeleteSpecialEvent = (id: string) => removeDocument('specialEvents', id);
export const cloudGetAllSpecialEventAttendance = () => fetchCollection<SpecialEventAttendanceRecord>('specialEventAttendance');
export const cloudSaveSpecialEventAttendance = (item: SpecialEventAttendanceRecord) => saveDocument('specialEventAttendance', item);
export const cloudSaveBulkSpecialEventAttendance = (items: SpecialEventAttendanceRecord[]) => saveBatchDocuments('specialEventAttendance', items);
export const cloudDeleteSpecialEventAttendance = (id: string) => removeDocument('specialEventAttendance', id);
export const cloudGetAllLessons = () => fetchCollection<LessonInfo>('lessons');
export const cloudSaveLesson = (item: LessonInfo) => saveDocument('lessons', { ...item, id: `WEEK_${item.weekNumber}` });
export const cloudGetResetAuditLogs = () => fetchCollection<any>('auditLogs');
export const cloudGetSundaySchoolYearArchive = () => fetchCollection<SundaySchoolYear>('sundaySchoolYearArchive');

export async function cloudGetSystemConfig(): Promise<{ initialized: boolean; schemaVersion: number } | null> {
  const { data, error } = await getSupabaseClient()
    .from('system_config')
    .select('initialized, schema_version')
    .eq('id', 'initialization')
    .maybeSingle();
  if (error) {
    console.error('Supabase system_config read failed:', error);
    return null;
  }
  return data ? { initialized: data.initialized === true, schemaVersion: data.schema_version || 0 } : null;
}
