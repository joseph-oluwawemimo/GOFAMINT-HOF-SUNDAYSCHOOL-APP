import { getAccessToken } from './authService';

type ApiResult = Record<string, any>;

async function request(path: string, options: RequestInit = {}, authenticated = true): Promise<{ ok: boolean; status: number; data: ApiResult }> {
  const headers = new Headers(options.headers);
  let accessToken: string | null;
  try {
    accessToken = await getAccessToken();
  } catch (error: any) {
    console.error(`Could not read the Supabase session for ${path}:`, error);
    return { ok: false, status: 0, data: { error: error?.message || 'The current sign-in session could not be read.' } };
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  } else if (authenticated) {
    return { ok: false, status: 401, data: { error: 'You must be signed in to do this.' } };
  }
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(path, { ...options, headers });
    const text = await response.text();
    let data: ApiResult = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch (error) {
        console.error(`Invalid JSON response from ${path}:`, error);
        data = { error: 'Invalid response format from server.' };
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, data: { error: error?.message || 'Network request failed.' } };
  }
}

export async function createStaffLogin(params: { email: string; password: string; roleType: string; displayName?: string; classId?: string; departmentId?: string }): Promise<{ success: boolean; error?: string; uid?: string; isApproved?: boolean; message?: string }> {
  const result = await request('/api/admin/create-user', { method: 'POST', body: JSON.stringify(params) });
  if (!result.ok) return { success: false, error: result.data.error || `Request failed (${result.status})` };
  return { success: true, uid: result.data.uid, isApproved: result.data.isApproved, message: result.data.message };
}

export async function approveStaffUser(params: { targetUid: string }): Promise<{ success: boolean; error?: string; message?: string }> {
  const result = await request('/api/admin/approve-user', { method: 'POST', body: JSON.stringify(params) });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function deleteStaffUser(targetUid: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const result = await request('/api/admin/delete-user', { method: 'POST', body: JSON.stringify({ targetUid }) });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function listStaffUsers(): Promise<{ success: boolean; users?: any[]; error?: string }> {
  const result = await request('/api/admin/list-users', { method: 'GET' });
  return result.ok ? { success: true, users: result.data.users || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function logOversightAccess(params: { targetPortal: string; targetClassId?: string; action?: string }): Promise<{ success: boolean; error?: string }> {
  const result = await request('/api/admin/log-oversight', { method: 'POST', body: JSON.stringify(params) });
  return result.ok ? { success: true } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function getSystemStatus(): Promise<{ initialized: boolean; schemaVersion: number }> {
  const result = await request('/api/system/status', { method: 'GET' }, false);
  if (!result.ok) {
    throw new Error(result.data.error || `Could not verify system initialization (${result.status || 'network error'}).`);
  }
  return { initialized: result.data.initialized === true, schemaVersion: result.data.schemaVersion || 0 };
}

export async function updateStaffLogin(targetUid: string, params: { displayName?: string; email?: string; password?: string }): Promise<{ success: boolean; error?: string; message?: string }> {
  const result = await request(`/api/admin/users/${encodeURIComponent(targetUid)}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function bootstrapSystem(params: { bootstrapSecret: string; churchName: string; superintendent?: { email: string; password: string; displayName: string }; secretary?: { email: string; password: string; displayName: string } }): Promise<{ success: boolean; error?: string; message?: string }> {
  const result = await request('/api/admin/bootstrap', { method: 'POST', body: JSON.stringify(params) }, false);
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

// The server keeps this fail-closed behind FACTORY_RESET_ENABLED and performs
// the archive plus reset in one database transaction.
export async function factoryReset(confirmPhrase: string): Promise<{ success: boolean; error?: string; message?: string; deletedCounts?: Record<string, number> }> {
  const result = await request('/api/admin/factory-reset', { method: 'POST', body: JSON.stringify({ confirmPhrase }) });
  return result.ok ? { success: true, message: result.data.message, deletedCounts: result.data.deletedCounts } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function massCreateClassesApi(params: { department?: string; suffixes?: string[]; classes?: any[] }): Promise<{ success: boolean; classes?: any[]; error?: string }> {
  const result = await request('/api/admin/classes/mass-create', { method: 'POST', body: JSON.stringify(params) });
  return result.ok ? { success: true, classes: result.data.classes || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function fetchAdminClassesApi(): Promise<{ success: boolean; classes?: any[]; error?: string }> {
  const result = await request('/api/admin/classes', { method: 'GET' });
  return result.ok ? { success: true, classes: result.data.classes || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function deleteClassApi(classId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await request(`/api/admin/classes/${encodeURIComponent(classId)}`, { method: 'DELETE' });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function updateClassApi(classId: string, updates: { className?: string; department?: string; password?: string }): Promise<{ success: boolean; message?: string; class?: any; error?: string }> {
  const result = await request(`/api/admin/classes/${encodeURIComponent(classId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
  return result.ok ? { success: true, message: result.data.message, class: result.data.class } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function fetchDepartmentsApi(): Promise<{ success: boolean; departments?: string[]; error?: string }> {
  const result = await request('/api/admin/departments', { method: 'GET' });
  return result.ok ? { success: true, departments: result.data.departments || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function createDepartmentApi(name: string): Promise<{ success: boolean; department?: string; message?: string; error?: string }> {
  const result = await request('/api/admin/departments', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  return result.ok ? { success: true, department: result.data.department, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function deleteDepartmentApi(name: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await request(`/api/admin/departments/${encodeURIComponent(name)}`, { method: 'DELETE' });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function fetchClassInspectionApi(classId: string): Promise<{
  success: boolean;
  classId?: string;
  members?: any[];
  grades?: any[];
  offerings?: any[];
  absenceLogs?: any[];
  adminComments?: any[];
  error?: string;
}> {
  const result = await request(`/api/admin/classes/${encodeURIComponent(classId)}/inspection`, { method: 'GET' });
  return result.ok ? { success: true, ...result.data } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function approveClassApi(classId: string, classData?: any): Promise<{ success: boolean; message?: string; class?: any; error?: string }> {
  const result = await request('/api/admin/classes/approve', {
    method: 'POST',
    body: JSON.stringify({ classId, classData })
  });
  return result.ok
    ? { success: true, message: result.data.message, class: result.data.class }
    : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function fetchWorkersDirectoryApi(): Promise<{ success: boolean; workers?: any[]; error?: string }> {
  const result = await request('/api/workers/directory', { method: 'GET' });
  return result.ok ? { success: true, workers: result.data.workers || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function deleteWorkerApi(workerId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await request(`/api/admin/workers/${encodeURIComponent(workerId)}`, { method: 'DELETE' });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function fetchSpecialEventsApi(): Promise<{ success: boolean; events?: any[]; attendance?: any[]; error?: string }> {
  const result = await request('/api/admin/special-events', { method: 'GET' });
  return result.ok ? { success: true, events: result.data.events || [], attendance: result.data.attendance || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function saveSpecialEventApi(event: any): Promise<{ success: boolean; event?: any; error?: string }> {
  const result = await request('/api/admin/special-events', { method: 'POST', body: JSON.stringify({ event }) });
  return result.ok ? { success: true, event: result.data.event } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function deleteSpecialEventApi(eventId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await request(`/api/admin/special-events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function saveSpecialEventAttendanceApi(records: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  const result = await request('/api/admin/special-events/attendance', { method: 'POST', body: JSON.stringify({ records }) });
  return result.ok ? { success: true, count: result.data.count } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function submitClassRegistrationApi(
  classId: string,
  params: { secretaryWorkerId: string; teacherWorkerIds: string[] }
): Promise<{ success: boolean; class?: any; error?: string }> {
  const result = await request(`/api/classes/${encodeURIComponent(classId)}/submit-registration`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result.ok
    ? { success: true, class: result.data.class }
    : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function stagedReset(scope: 'CLASSES' | 'WORKERS' | 'ADMINS', confirmPhrase: string): Promise<{ success: boolean; error?: string; message?: string; archiveId?: string }> {
  const result = await request('/api/admin/staged-reset', { method: 'POST', body: JSON.stringify({ scope, confirmPhrase }) });
  return result.ok
    ? { success: true, message: result.data.message, archiveId: result.data.archiveId }
    : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export interface DatabaseArchiveMetadata {
  id: string;
  archived_at: string;
  archive_type: 'STAGED_RESET' | 'YEAR_ARCHIVE';
  scope: string;
  summary?: Record<string, number>;
}

export async function listDatabaseArchives(): Promise<{ success: boolean; archives?: DatabaseArchiveMetadata[]; error?: string }> {
  const result = await request('/api/admin/year-archives', { method: 'GET' });
  return result.ok
    ? { success: true, archives: result.data.archives || [] }
    : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function downloadDatabaseArchive(archiveId: string): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('You must be signed in to download an archive.');
  const response = await fetch(`/api/admin/year-archives/${encodeURIComponent(archiveId)}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Archive download failed (${response.status}).`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${archiveId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function deleteSpecialEventAttendanceApi(recordId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await request(`/api/admin/special-events/attendance/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function fetchWorkerPrepAttendanceApi(): Promise<{ success: boolean; records?: any[]; error?: string }> {
  const result = await request('/api/admin/workers/prep-attendance', { method: 'GET' });
  return result.ok ? { success: true, records: result.data.records || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function saveWorkerPrepAttendanceApi(records: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  const result = await request('/api/admin/workers/prep-attendance', { method: 'POST', body: JSON.stringify({ records }) });
  return result.ok ? { success: true, count: result.data.count } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}
