import { randomBytes } from 'node:crypto';
import { normalizePhoneNumber } from '../utils/phoneUtils.js';

export function publicReportToken(memberData: Record<string, any>, suppliedToken: string): string {
  const raw = memberData.reportCardToken;
  return (typeof raw === 'string' ? raw : raw?.token) || suppliedToken;
}

/** Only these member-owned fields may be changed through a public profile link. */
export function validatePublicProfile(body: Record<string, unknown>): Record<string, string> {
  const requiredText = (key: string, limit: number) => {
    const value = body[key];
    if (typeof value !== 'string' || !value.trim() || value.length > limit) {
      throw new Error(`${key} is required and must contain at most ${limit} characters.`);
    }
    return value.trim();
  };
  const phone = normalizePhoneNumber(requiredText('phone', 40));
  if (!/^\+?[0-9]{10,15}$/.test(phone)) throw new Error('A valid phone number is required.');
  const gender = requiredText('gender', 10);
  if (!['MALE', 'FEMALE'].includes(gender)) throw new Error('Gender must be MALE or FEMALE.');
  const ageGroup = requiredText('ageGroup', 20);
  if (!['Adult', 'Youth', 'Children'].includes(ageGroup)) throw new Error('Select Adult, Youth, or Children as the department.');
  const photoBase64 = requiredText('photoBase64', 5_000_000);
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(photoBase64)) {
    throw new Error('The profile photograph must be a PNG, JPEG, or WebP image.');
  }
  return {
    fullName: requiredText('fullName', 200), phone,
    address: requiredText('address', 1_000),
    occupation: requiredText('occupation', 200),
    prayerRequests: requiredText('prayerRequests', 3_000),
    gender, ageGroup, photoBase64
  };
}

export function createPublicReportToken(): string {
  return `rc_${randomBytes(24).toString('base64url')}`;
}
