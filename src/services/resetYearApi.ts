import { getAccessToken } from './authService';
export interface ResetYearParams {
  confirmYearId: string;
  newYearName: string;
  newOverallTheme?: string;
}

export interface ResetYearResult {
  success: boolean;
  error?: string;
  newYearId?: string;
  newYearName?: string;
  deletedCounts?: Record<string, number>;
  classesReassigned?: number;
  workersReassigned?: number;
}

export async function resetYearOnServer(params: ResetYearParams): Promise<ResetYearResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'You must be signed in to reset a year.' };

  try {
    const response = await fetch('/api/admin/reset-year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => ({}));
    return response.ok
      ? { success: true, newYearId: data.newYearId, newYearName: data.newYearName, classesReassigned: data.classesReassigned, workersReassigned: data.workersReassigned }
      : { success: false, error: data.error || `Year reset failed (${response.status}).` };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not reach the server for year reset.' };
  }
}

export { factoryReset } from './adminUserApi';
