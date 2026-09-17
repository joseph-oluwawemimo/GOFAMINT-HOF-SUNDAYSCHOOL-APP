import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeClassLoginIdentifier, normalizeLoginIdentifier } from '../src/utils/loginIdentifier';

test('class login identifiers use the same deterministic mapping as sign-in', () => {
  assert.equal(normalizeClassLoginIdentifier('ADULT_A'), 'class_adult_a@gofamint-hof.internal');
  assert.equal(normalizeClassLoginIdentifier('Youth B'), 'class_youth_b@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('ADULT_A'), normalizeClassLoginIdentifier('ADULT_A'));
  assert.equal(normalizeLoginIdentifier('GS'), 'gofaminthouseoffavour@gmail.com');
});

test('class creation is server-authoritative and never falls back to a local ghost', () => {
  const source = fs.readFileSync(path.resolve('src/db/indexedDB.ts'), 'utf8');
  const start = source.indexOf('export async function createBatchClasses');
  const end = source.indexOf('export async function massCreateClasses', start);
  const implementation = source.slice(start, end);
  assert.match(implementation, /if \(!response\.success\)[\s\S]*throw new Error/);
  assert.match(implementation, /delete cls\.password/);
  assert.doesNotMatch(implementation, /cloudSaveClassProfile|password123|console\.warn/);
});

test('class creation provisions an approved bound Auth identity and stores no plaintext password', () => {
  const source = fs.readFileSync(path.resolve('src/server/app.ts'), 'utf8');
  const start = source.indexOf("app.post('/api/admin/classes/mass-create'");
  const end = source.indexOf("app.post('/api/admin/classes/approve'", start);
  const route = source.slice(start, end);
  assert.match(route, /caller\(req, r, CLASS_CREATORS\)/);
  assert.match(route, /normalizeClassLoginIdentifier\(classId\)/);
  assert.match(route, /provisionSupabaseUserProfile/);
  assert.match(route, /role: 'TEACHER \/ CLASS_SECRETARY'/);
  assert.match(route, /profile_class_assignments/);
  assert.match(route, /delete classData\.password/);
  assert.doesNotMatch(route, /data:\s*\{[\s\S]{0,300}password/);
});

test('class creator UI does not expose weak defaults or readable passwords', () => {
  const assistantView = fs.readFileSync(path.resolve('src/components/AdminPortal/AsstGeneralSecretaryView.tsx'), 'utf8');
  const accountsView = fs.readFileSync(path.resolve('src/components/AdminPortal/CloudUserManagementPanel.tsx'), 'utf8');
  assert.doesNotMatch(assistantView, /password123|Pwd:\s*\{/);
  assert.match(assistantView, /type="password"[\s\S]{0,220}autoComplete="new-password"/);
  assert.match(accountsView, /isClassAccount[\s\S]*TEACHER \/ CLASS_SECRETARY/);
  assert.doesNotMatch(accountsView, /useState\('123456'\)/);
});

test('class registration reports success only after the protected server confirms persistence', () => {
  const server = fs.readFileSync(path.resolve('src/server/app.ts'), 'utf8');
  const view = fs.readFileSync(path.resolve('src/components/OpeningFlowView.tsx'), 'utf8');
  const database = fs.readFileSync(path.resolve('src/db/indexedDB.ts'), 'utf8');
  const migration = fs.readFileSync(path.resolve('supabase/migrations/202609130001_class_registration_integrity.sql'), 'utf8');

  assert.match(server, /\/api\/classes\/:classId\/submit-registration/);
  assert.match(server, /CLASS_PORTAL_ROLES\.includes\(c\.role\)/);
  assert.match(server, /canonicalClassId\(c\.classId\) !== canonicalClassId\(classId\)/);
  assert.match(server, /SUBMIT_CLASS_REGISTRATION/);
  assert.match(view, /await submitClassRegistrationApi/);
  assert.match(view, /if \(!response\.success \|\| !response\.class\)[\s\S]*throw new Error/);
  assert.match(view, /await cacheConfirmedClassProfile\(confirmedProfile\)/);
  assert.doesNotMatch(view, /await saveClassProfile\(updatedProfile\)/);
  assert.match(database, /deleteFromStore\('cloudSyncFailures', `classes_\$\{safeProfile\.id\}_save`, true\)/);
  assert.match(migration, /enforce_class_status_authority/);
  assert.match(migration, /Only an executive approval endpoint may change class lifecycle status/);
});
