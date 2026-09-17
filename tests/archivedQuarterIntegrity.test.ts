import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('class register labels stored quarter states and disables archived mutations', () => {
  const header = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf8');
  const grading = fs.readFileSync(path.resolve('src/components/GradingMatrixView.tsx'), 'utf8');
  const quarterSelector = fs.readFileSync(path.resolve('src/components/QuarterSelectorBar.tsx'), 'utf8');

  assert.match(header, /quarters\.find\(quarter => quarter\.quarterNumber === quarterNumber\)\?\.status/);
  assert.match(header, /selectedQuarterStatus === 'ARCHIVED'/);
  assert.match(grading, /const handleRemitOffering = \(\) => \{\s*if \(isWeekLocked\)/);
  assert.match(grading, /const executeRemitOffering = async \(\) => \{\s*if \(isWeekLocked\)/);
  assert.match(grading, /id="btn-remit-offering"[\s\S]{0,300}disabled=\{isWeekLocked\}/);
  assert.match(grading, /id=\{`btn-referral-\$\{member\.id\}`\}[\s\S]{0,350}disabled=\{isWeekLocked\}/);
  assert.doesNotMatch(quarterSelector, /btn-archive-active-quarter|Confirm Archive|onArchiveQuarter/);
  assert.match(quarterSelector, /Quarter lifecycle is controlled by the General Secretary/);
});

test('database policies require an active quarter for grades and offerings', () => {
  const migration = fs.readFileSync(
    path.resolve('supabase/migrations/202609130002_enforce_archived_quarter_integrity.sql'),
    'utf8'
  );

  assert.match(migration, /create or replace function public\.is_active_quarter_number/);
  assert.match(migration, /upper\(coalesce\(quarter_record ->> 'status', ''\)\) = 'ACTIVE'/);
  assert.match(migration, /create policy grades_update[\s\S]*is_active_quarter_number\(quarter_number\)/);
  assert.match(migration, /create policy offerings_update[\s\S]*is_active_quarter_number\(quarter_number\)/);
  assert.doesNotMatch(migration, /is_not_archived_record\(data\)/);
});
