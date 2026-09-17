import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('department superintendent migration enforces scoped reads without broad write authority', () => {
  const migration = fs.readFileSync(path.resolve('supabase/migrations/202609110003_department_superintendent_rls.sql'), 'utf8');
  assert.match(migration, /one_department_superintendent_per_department/);
  assert.match(migration, /is_department_superintendent_for_class\(class_id\)/);
  assert.match(migration, /create policy members_read[\s\S]*is_department_superintendent_for_class\(class_id\)/);
  assert.match(migration, /create policy grades_read[\s\S]*is_department_superintendent_for_class\(class_id\)/);
  assert.doesNotMatch(migration, /create policy members_(create|update|delete)[\s\S]{0,300}department_superintendent/i);
  assert.doesNotMatch(migration, /create policy grades_(create|update|delete)[\s\S]{0,300}department_superintendent/i);
});

test('department superintendents and ordinary workers cannot enter worker-management APIs', () => {
  const server = fs.readFileSync(path.resolve('src/server/app.ts'), 'utf8');
  const workerModule = fs.readFileSync(path.resolve('src/components/WorkersModule/WorkersModuleView.tsx'), 'utf8');
  const personalView = fs.readFileSync(path.resolve('src/components/WorkersModule/WorkerMyAttendanceView.tsx'), 'utf8');
  assert.match(server, /WORKER_MANAGERS[^;]+ASST_GENERAL_SECRETARY/);
  assert.doesNotMatch(server.match(/const WORKER_MANAGERS[^;]+;/)?.[0] || '', /'DEPARTMENT_SUPERINTENDENT'|'WORKER'/);
  assert.match(workerModule, /isPersonalWorker[\s\S]*tab !== 'MY_ATTENDANCE'/);
  assert.match(personalView, /lockedWorkerId \? workers\.filter\(worker => worker\.id === lockedWorkerId\)/);
});

test('staged reset migration archives before any destructive statement', () => {
  const migration = fs.readFileSync(path.resolve('supabase/migrations/202609110004_staged_archive_first_resets.sql'), 'utf8');
  const archivePosition = migration.indexOf('insert into public.sunday_school_year_archives');
  const firstDeletePosition = migration.indexOf('delete from');
  assert.ok(archivePosition >= 0, 'archive insertion must exist');
  assert.ok(firstDeletePosition > archivePosition, 'the recovery archive must be written before deletion begins');
  assert.match(migration, /revoke all on function public\.gofamint_staged_reset/);
});

test('annual rollover archives records before clearing rosters and preserves directories', () => {
  const migration = fs.readFileSync(path.resolve('supabase/migrations/202609110005_correct_annual_year_reset.sql'), 'utf8');
  const archivePosition = migration.indexOf('insert into public.sunday_school_year_archives');
  const memberDeletePosition = migration.indexOf('delete from public.members');
  assert.ok(archivePosition >= 0 && memberDeletePosition > archivePosition);
  assert.match(migration, /delete from auth\.users[\s\S]*TEACHER/);
  assert.match(migration, /update public\.classes/);
  assert.match(migration, /update public\.workers/);
  assert.doesNotMatch(migration, /delete from public\.classes/);
  assert.doesNotMatch(migration, /delete from public\.workers/);
  assert.doesNotMatch(migration, /^\+/m);
});

test('only assistant general secretaries can create classes and remaining realtime tables are published', () => {
  const migration = fs.readFileSync(path.resolve('supabase/migrations/202609120001_complete_realtime_and_class_authority.sql'), 'utf8');
  const classPolicy = migration.slice(migration.indexOf('create policy classes_create'));
  assert.match(classPolicy, /ASST_GENERAL_SECRETARY/);
  assert.match(classPolicy, /ASSISTANT_GENERAL_SECRETARY/);
  const authorizedRoles = Array.from(classPolicy.matchAll(/'([^']+)'::public\.gofamint_role/g), match => match[1]);
  assert.deepEqual(authorizedRoles, ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY']);
  for (const table of ['departments', 'lessons', 'clock_in_config', 'special_event_attendance']) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
});
