import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIENT_WRITE_PROTOCOL_VERSION, stampClientWriteMetadata } from '../src/services/supabaseDatabase';

test('every standard database row is stamped with the current write protocol', () => {
  const stamped = stampClientWriteMetadata({ id: 'x', updatedAt: '2026-10-18T00:00:00.000Z' });
  assert.equal(stamped._clientWriteVersion, CLIENT_WRITE_PROTOCOL_VERSION);
  assert.match(stamped._clientWrittenAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('database migration rejects obsolete authenticated clients and backdated updates', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610180002_reject_obsolete_client_writes.sql', import.meta.url), 'utf8');
  assert.match(sql, /APP_UPDATE_REQUIRED/);
  assert.match(sql, /STALE_WRITE_REJECTED/);
  assert.match(sql, /auth\.role\(\).*authenticated/s);
  assert.match(sql, /'classes'.*'members'.*'grades'.*'worker_attendance'/s);
  assert.doesNotMatch(sql, /delete\s+from/i);
});
