import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPublicReportToken, publicReportToken, validatePublicProfile } from '../src/server/publicProfile';

const validProfile = {
  fullName: ' Samuel ', phone: '08031234567', address: ' House 1 ', occupation: 'Teacher',
  gender: 'MALE', ageGroup: 'Youth', prayerRequests: 'None', photoBase64: 'data:image/png;base64,YQ=='
};

test('public profile writes whitelist personal fields and normalize values', () => {
  const profile = validatePublicProfile({
    ...validProfile, password: 'do not touch', classId: 'another-class', memberType: 'STUDENT',
    isProfileCompleted: false, reportCardToken: { token: 'attacker' }, notes: 'private'
  });
  assert.equal(profile.fullName, 'Samuel');
  assert.equal(profile.phone, '+2348031234567');
  assert.equal(profile.address, 'House 1');
  assert.deepEqual(Object.keys(profile).sort(), Object.keys(validProfile).sort());
});

test('public profile input validation rejects missing values, invalid images, and oversized fields', () => {
  for (const change of [
    { fullName: '' }, { phone: '123' }, { gender: 'OTHER' }, { ageGroup: 'Unknown' },
    { photoBase64: 'javascript:alert(1)' }, { occupation: 'x'.repeat(201) }
  ]) {
    assert.throws(() => validatePublicProfile({ ...validProfile, ...change }));
  }
});

test('public report links preserve string/object secrets and legacy profile tokens', () => {
  assert.equal(publicReportToken({ reportCardToken: 'rc_existing' }, 'vis_old'), 'rc_existing');
  assert.equal(publicReportToken({ reportCardToken: { token: 'rc_existing' } }, 'vis_old'), 'rc_existing');
  assert.equal(publicReportToken({ isProfileCompleted: true }, 'vis_old'), 'vis_old');
  const tokens = Array.from({ length: 100 }, createPublicReportToken);
  assert.equal(new Set(tokens).size, 100);
  assert.ok(tokens.every(token => /^rc_[A-Za-z0-9_-]{32}$/.test(token)));
});

test('profile persistence and link creation are restricted row-lock operations', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610180001_atomic_sssr_delivery_persistence.sql', import.meta.url), 'utf8');
  assert.match(sql, /complete_member_public_profile/);
  assert.match(sql, /where id = p_member_id for update/);
  assert.match(sql, /p_public_token is distinct from profile_token and p_public_token is distinct from report_token/);
  assert.match(sql, /profile_fields.*jsonb_build_object/s);
  assert.match(sql, /ensure_class_member_public_links/);
  assert.match(sql, /class_id = p_class_id or data->>'classId' = p_class_id/);
  assert.match(sql, /revoke all on function public\.complete_member_public_profile.*authenticated/);
  assert.match(sql, /revoke all on function public\.ensure_class_member_public_links.*authenticated/);
});
