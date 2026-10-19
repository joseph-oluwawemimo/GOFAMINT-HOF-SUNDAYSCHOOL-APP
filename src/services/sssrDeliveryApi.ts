import { SSSRDeliveryRecord } from '../types';
import { getAccessToken } from './authService';

export async function persistSSSRDeliveryRecords(
  classId: string,
  records: SSSRDeliveryRecord[]
): Promise<Record<string, SSSRDeliveryRecord>> {
  if (!classId) throw new Error('Cannot save SSS report completion without a class id.');
  if (records.length === 0) throw new Error('Cannot save an empty SSS report completion batch.');
  const token = await getAccessToken();
  if (!token) throw new Error('Your sign-in session is unavailable. Sign in again before marking a report done.');

  const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/sssr-deliveries`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `SSS completion save failed (${response.status}).`);
  }
  if (!body.deliveries || typeof body.deliveries !== 'object') {
    throw new Error('SSS completion save returned an invalid database response.');
  }
  return body.deliveries as Record<string, SSSRDeliveryRecord>;
}

export async function ensureMemberProfileLinks(
  classId: string,
  memberIds: string[]
): Promise<Record<string, { token: string }>> {
  if (!classId) throw new Error('Cannot prepare student profile links without a class id.');
  if (!memberIds.length || memberIds.length > 200) throw new Error('Prepare between 1 and 200 student profile links at a time.');
  const token = await getAccessToken();
  if (!token) throw new Error('Your sign-in session is unavailable. Sign in again before sending reports.');
  const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/member-profile-links`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberIds })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Student profile link preparation failed (${response.status}).`);
  if (!body.links || typeof body.links !== 'object') throw new Error('Student profile link preparation returned an invalid response.');
  for (const id of memberIds) {
    if (typeof body.links[id]?.token !== 'string' || body.links[id].token.length < 16) {
      throw new Error(`Student profile link preparation returned no secure link for ${id}.`);
    }
  }
  return body.links;
}

