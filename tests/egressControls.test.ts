import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const syncSource = fs.readFileSync(new URL('../src/services/cloudSyncManager.ts', import.meta.url), 'utf8');
const indexedDbSource = fs.readFileSync(new URL('../src/db/indexedDB.ts', import.meta.url), 'utf8');
const workersViewSource = fs.readFileSync(new URL('../src/components/WorkersModule/WorkersModuleView.tsx', import.meta.url), 'utf8');

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('ordinary Workers module reads stay local and do not duplicate central cloud hydration', () => {
  for (const [start, end] of [
    ['export async function getAllWorkers', 'export async function getWorkerById'],
    ['export async function getAllWorkerAttendance', 'export async function saveWorkerAttendance'],
    ['export async function getAllWorkerPrepAttendance', 'export async function saveWorkerPrepAttendance'],
    ['export async function getAllSpecialEvents', 'export async function saveSpecialEvent'],
    ['export async function getAllSpecialEventAttendance', 'export async function getSpecialEventAttendanceByEvent'],
  ]) {
    const section = between(indexedDbSource, start, end);
    assert.match(section, /if \(forceCloudRefresh\)/);
    assert.doesNotMatch(section, /list\.length === 0 \|\| forceCloudRefresh/);
  }

  assert.match(workersViewSource, /refreshAllData\(false\)/);
});

test('workers datasets load only for a worker login or an explicitly opened Workers portal', () => {
  const expectedScope = /const isWorkersDirectorateScope = role === 'WORKER' \|\| oversightPortal === 'WORKERS';/g;
  assert.equal([...syncSource.matchAll(expectedScope)].length, 2);

  const generalSecretaryBranch = between(syncSource, '} else if (isGenSecRole) {', '} else if (isSuperintendentRole) {');
  const superintendentBranch = between(syncSource, '} else if (isSuperintendentRole) {', '} else {');
  for (const branch of [generalSecretaryBranch, superintendentBranch]) {
    assert.doesNotMatch(branch, /fetchCollection<WorkerProfile>\('workers'\)/);
    assert.doesNotMatch(branch, /fetchCollection<WorkerAttendanceRecord>\('workerAttendance'\)/);
    assert.doesNotMatch(branch, /fetchCollection<WorkerPrepAttendanceRecord>\('workerPrepAttendance'\)/);
  }
});

test('realtime updates merge changed rows instead of redownloading complete tables', () => {
  const realtimeSection = syncSource.slice(syncSource.indexOf('export function startRealtimeCloudSync'));
  assert.match(realtimeSection, /mergeStoreContents\('workers', wrks\)/);
  assert.match(realtimeSection, /mergeStoreContents\('workerAttendance', atts\)/);
  assert.match(realtimeSection, /mergeStoreContents\('specialEvents', evts\)/);
  assert.doesNotMatch(realtimeSection, /fetchCollection<WorkerProfile>\('workers'\)/);
});

test('Workers Directorate does not also attach unrelated role-specific realtime listeners', () => {
  const roleSpecificStart = syncSource.indexOf('// 3. Role-specific listeners');
  const listenersEnd = syncSource.indexOf("logSyncDiagnostic('LISTENERS_ACTIVE'", roleSpecificStart);
  const roleSpecificSection = syncSource.slice(roleSpecificStart, listenersEnd);
  assert.match(roleSpecificSection, /if \(!isWorkersDirectorateScope\) \{/);
});

test('durable cloud retries are bound to the account that created them', () => {
  assert.match(indexedDbSource, /actorUserId\?: string \| null/);
  assert.match(indexedDbSource, /actorUserId = await getCurrentCloudActorUserId\(\)/);
  assert.match(indexedDbSource, /belongsToCloudActor\(record, actorUserId\)/);
  assert.match(indexedDbSource, /Retry quarantined because it belongs to a different signed-in account/);
  assert.match(indexedDbSource, /Legacy retry quarantined because its originating account cannot be verified/);

  const replacementSection = between(indexedDbSource, 'export async function replaceStoreContents', '// Returns any cloud writes');
  assert.match(replacementSection, /pending\.filter\(record => belongsToCloudActor\(record, actorUserId\)\)/);
});
