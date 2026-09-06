import { getAccessToken } from './authService';

type ApiResult = Record<string, any>;

async function request(path: string, options: RequestInit = {}, authenticated = true): Promise<{ ok: boolean; status: number; data: ApiResult }> {
  const headers = new Headers(options.headers);
  const accessToken = await getAccessToken().catch(() => null);
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
      catch { data = { error: 'Invalid response format from server.' }; }
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, data: { error: error?.message || 'Network request failed.' } };
  }
}

export async function createStaffLogin(params: { email: string; password: string; roleType: string; displayName?: string; classId?: string }): Promise<{ success: boolean; error?: string; uid?: string; isApproved?: boolean; message?: string }> {
  const result = await request('/api/admin/create-user', { method: 'POST', body: JSON.stringify(params) });
  if (!result.ok) return { success: false, error: result.data.error || `Request failed (${result.status})` };
  return { success: true, uid: result.data.uid, isApproved: result.data.isApproved, message: result.data.message };
}

export async function approveStaffUser(params: { targetUid?: string; email?: string; roleType?: string; approverName?: string }): Promise<{ success: boolean; error?: string; message?: string }> {
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
  return { initialized: result.ok && result.data.initialized === true, schemaVersion: result.ok ? result.data.schemaVersion || 0 : 0 };
}

export async function bootstrapSystem(params: { bootstrapSecret: string; churchName: string; superintendent?: { email: string; password: string; displayName: string }; secretary?: { email: string; password: string; displayName: string } }): Promise<{ success: boolean; error?: string; message?: string }> {
  const result = await request('/api/admin/bootstrap', { method: 'POST', body: JSON.stringify(params) }, false);
  return result.ok ? { success: true, message: result.data.message } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

// The server keeps destructive operations fail-closed until a transaction-tested
// Supabase implementation exists; this client call cannot bypass that guard.
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
  const result = await request('/api/workers/directory', { method: 'GET' }, false);
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

export async function fetchWorkerPrepAttendanceApi(): Promise<{ success: boolean; records?: any[]; error?: string }> {
  const result = await request('/api/admin/workers/prep-attendance', { method: 'GET' });
  return result.ok ? { success: true, records: result.data.records || [] } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}

export async function saveWorkerPrepAttendanceApi(records: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  const result = await request('/api/admin/workers/prep-attendance', { method: 'POST', body: JSON.stringify({ records }) });
  return result.ok ? { success: true, count: result.data.count } : { success: false, error: result.data.error || `Request failed (${result.status})` };
}
