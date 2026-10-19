import type { SSSRDeliveryRecord } from '../types.js';

export function prepareSSSRDeliveryBatch(
  classId: string,
  records: unknown,
  actorId: string,
  now = new Date().toISOString()
): Record<string, SSSRDeliveryRecord> {
  if (!Array.isArray(records) || records.length < 1 || records.length > 200) {
    throw new Error('Provide between 1 and 200 SSS delivery records.');
  }
  const deliveries: Record<string, SSSRDeliveryRecord> = Object.create(null);
  for (const raw of records) {
    const memberId = typeof raw?.memberId === 'string' ? raw.memberId.trim() : '';
    const quarterNumber = raw?.quarterNumber;
    const weekNumber = raw?.weekNumber;
    if (!memberId || memberId.length > 160 || raw.classId !== classId
      || !Number.isInteger(quarterNumber) || quarterNumber < 1 || quarterNumber > 4
      || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 13) {
      throw new Error('Every SSS delivery must have a matching class, member, quarter (1–4), and lesson week (1–13).');
    }
    const id = `${classId}_q${quarterNumber}_w${weekNumber}_m${memberId}`;
    if (raw.id !== id || (raw.status !== 'DONE' && raw.status !== 'PENDING')) {
      throw new Error(`Invalid SSS delivery id or status for ${memberId}.`);
    }
    if (!['PRESENT', 'ABSENT', 'EXEMPT'].includes(raw.attendance)) {
      throw new Error(`Invalid attendance status for ${memberId}.`);
    }
    const record: SSSRDeliveryRecord = {
      id, classId, memberId, quarterNumber, weekNumber,
      memberName: typeof raw.memberName === 'string' ? raw.memberName.trim().slice(0, 200) : memberId,
      attendance: raw.attendance,
      status: raw.status,
      updatedAt: now
    };
    if (raw.status === 'DONE') {
      record.sentAt = now;
      record.sentBy = actorId;
      record.method = ['WHATSAPP', 'MANUAL', 'COPY'].includes(raw.method) ? raw.method : 'MANUAL';
    }
    deliveries[id] = record;
  }
  return deliveries;
}
