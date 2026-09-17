import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const syncSource = fs.readFileSync(new URL('../src/services/cloudSyncManager.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../src/server/app.ts', import.meta.url), 'utf8');
const indexedDbSource = fs.readFileSync(new URL('../src/db/indexedDB.ts', import.meta.url), 'utf8');
const workerModalSource = fs.readFileSync(new URL('../src/components/WorkersModule/WorkerProfileModal.tsx', import.meta.url), 'utf8');

test('deleted special events are never resurrected from stale browser caches', () => {
  assert.doesNotMatch(syncSource, /cloudSaveSpecialEvent\(ev\)\.catch/);
  assert.doesNotMatch(syncSource, /finalEvts\s*=\s*localEvts/);
  assert.match(syncSource, /replaceStoreContents\('specialEvents', cloudEvts\)/);
  assert.match(syncSource, /replaceStoreContents\('specialEventAttendance', cloudEvtAtt\)/);
});

test('special-event deletion relies on the database cascade as one atomic delete', () => {
  const route = serverSource.slice(
    serverSource.indexOf("app.delete('/api/admin/special-events/:id'"),
    serverSource.indexOf("app.post('/api/admin/special-events/attendance'"),
  );
  assert.doesNotMatch(route, /from\('special_event_attendance'\)\.delete/);
  assert.match(route, /from\('special_events'\)\.delete/);
});

test('forced cloud refreshes fail loudly instead of presenting stale cache as current data', () => {
  for (const [start, end] of [
    ['getAllWorkers', 'getWorkerById'],
    ['getAllWorkerAttendance', 'saveWorkerAttendance'],
    ['getAllWorkerPrepAttendance', 'saveWorkerPrepAttendance'],
    ['getAllClassesDirectory', 'saveClassToDirectory'],
    ['getAllSpecialEventAttendance', 'getSpecialEventAttendanceByEvent'],
  ]) {
    const section = indexedDbSource.slice(
      indexedDbSource.indexOf(`function ${start}`),
      indexedDbSource.indexOf(`function ${end}`),
    );
    assert.match(section, /if \(forceCloudRefresh\) throw/);
  }
});

test('worker editor keeps unsaved fields during background attendance sync and uses the active year', () => {
  assert.match(workerModalSource, /initializedContextRef\.current === contextKey/);
  assert.match(workerModalSource, /getQuarterWeeklySchedule\(activeQuarter\)/);
  assert.doesNotMatch(workerModalSource, /getQuarterWeeklySchedule\(activeQuarter,\s*2025\)/);
});
