import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeSSSRDeliveryMaps } from '../src/utils/sssrDeliveries';
import { prepareSSSRDeliveryBatch } from '../src/server/sssrPersistence';

test('SSS delivery merge keeps the newest durable status instead of stale local state', () => {
  const oldPending = { id: 'd1', status: 'PENDING', updatedAt: '2026-10-18T08:00:00.000Z' } as any;
  const newDone = { id: 'd1', status: 'DONE', updatedAt: '2026-10-18T09:00:00.000Z' } as any;
  assert.equal(mergeSSSRDeliveryMaps({ d1: newDone }, { d1: oldPending }).d1.status, 'DONE');
  assert.equal(mergeSSSRDeliveryMaps({ d1: oldPending }, { d1: newDone }).d1.status, 'DONE');
});

test('migration atomically merges only the SSS deliveries JSON field', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610180001_atomic_sssr_delivery_persistence.sql', import.meta.url), 'utf8');
  assert.match(sql, /merge_class_sssr_deliveries/);
  assert.match(sql, /merge_timestamped_record_maps\(data->'sssrDeliveries'/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.classes/i);
  assert.match(sql, /revoke all .* authenticated/);
});

test('SSS saves accept only canonical records and assign the authenticated actor and server timestamp', () => {
  const raw = {
    id: 'YOUTH_C_q1_w6_mmember-1', classId: 'YOUTH_C', memberId: 'member-1',
    memberName: 'Samuel', quarterNumber: 1, weekNumber: 6, attendance: 'PRESENT',
    status: 'DONE', method: 'WHATSAPP', sentBy: 'forged-actor', updatedAt: '2000-01-01T00:00:00Z',
    privateNote: 'must not be persisted'
  };
  const now = '2026-10-18T10:00:00.000Z';
  const result = prepareSSSRDeliveryBatch('YOUTH_C', [raw], 'approved-user', now)[raw.id];
  assert.equal(result.sentBy, 'approved-user');
  assert.equal(result.sentAt, now);
  assert.equal(result.updatedAt, now);
  assert.equal((result as any).privateNote, undefined);
  for (const change of [
    { classId: 'YOUTH_B' }, { id: '__proto__' }, { quarterNumber: 0 },
    { weekNumber: 99 }, { status: 'FORGED' }, { attendance: 'UNKNOWN' }
  ]) {
    assert.throws(() => prepareSSSRDeliveryBatch('YOUTH_C', [{ ...raw, ...change }], 'approved-user'));
  }
  assert.throws(() => prepareSSSRDeliveryBatch('YOUTH_C', [], 'approved-user'));
});

test('a pending reset clears completion attribution rather than trusting stale sent fields', () => {
  const result = prepareSSSRDeliveryBatch('YOUTH_C', [{
    id: 'YOUTH_C_q1_w6_mmember-1', classId: 'YOUTH_C', memberId: 'member-1', memberName: 'Samuel',
    quarterNumber: 1, weekNumber: 6, attendance: 'ABSENT', status: 'PENDING', sentAt: 'old', sentBy: 'old'
  }], 'approved-user');
  assert.equal(result['YOUTH_C_q1_w6_mmember-1'].sentAt, undefined);
  assert.equal(result['YOUTH_C_q1_w6_mmember-1'].sentBy, undefined);
});
