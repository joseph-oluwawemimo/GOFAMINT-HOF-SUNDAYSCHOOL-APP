import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const registerSource = readFileSync(
  new URL('../src/components/GradingMatrixView.tsx', import.meta.url),
  'utf8'
);
const navigationSource = readFileSync(
  new URL('../src/components/Navigation.tsx', import.meta.url),
  'utf8'
);
const headerSource = readFileSync(
  new URL('../src/components/Header.tsx', import.meta.url),
  'utf8'
);
const appSource = readFileSync(
  new URL('../src/App.tsx', import.meta.url),
  'utf8'
);
const sectionSources = [
  '../src/components/RosterManagementView.tsx',
  '../src/components/WelfareFollowUpView.tsx',
  '../src/components/QuarterAnalysisView.tsx',
  '../src/components/ClassDiscussionView.tsx'
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));

test('class register keeps its responsive mobile controls and accessible landmarks', () => {
  assert.match(registerSource, /aria-labelledby="week-selector-heading"/);
  assert.match(registerSource, /grid grid-cols-6/);
  assert.match(registerSource, /sm:grid-cols-12/);
  assert.match(registerSource, /aria-label={`Select week \${wk}/);
  assert.match(registerSource, /aria-labelledby="lesson-topic-heading"/);
  assert.match(registerSource, /aria-label="Week summary"/);
  assert.match(registerSource, /aria-label="Search class members"/);
  assert.match(registerSource, /grid grid-cols-4 gap-1\.5 sm:gap-2/);
});

test('weekly return toolbar stays compact and does not expose sharing', () => {
  assert.doesNotMatch(registerSource, /Share Return/);
  assert.doesNotMatch(registerSource, /btn-open-return-modal/);
  assert.match(registerSource, /id="btn-print-official-return"/);
  assert.match(registerSource, /id="btn-toggle-no-record"/);
});

test('class register exposes one remittance changes entry point', () => {
  const changesEntryPoints = registerSource.match(/id="btn-enter-changes-mode"/g) || [];
  assert.equal(changesEntryPoints.length, 1);
});

test('primary navigation names the register in user-facing language', () => {
  assert.match(navigationSource, /label: 'Class Register'/);
  assert.match(navigationSource, /shortLabel: 'Register'/);
  assert.match(navigationSource, /aria-label="Class register sections"/);
});

test('top bar provides compact mobile home and lock controls', () => {
  assert.match(headerSource, /id="header-btn-back-welcome-mobile"/);
  assert.match(headerSource, /id="header-btn-lock-mobile"/);
  assert.match(headerSource, /aria-label="Select quarter"/);
});

test('main header scrolls away while section navigation stays available responsively', () => {
  assert.match(headerSource, /<header className="relative z-30/);
  assert.doesNotMatch(headerSource, /<header className="sticky top-0/);
  assert.match(navigationSource, /<nav aria-label="Class register sections" className="fixed inset-x-0 bottom-0 z-50/);
  assert.match(navigationSource, /sm:sticky sm:top-0 sm:bottom-auto/);
  assert.match(navigationSource, /safe-area-inset-bottom/);
  assert.match(appSource, /pb-\[calc\(4\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
});

test('section pages use responsive labelled hero regions', () => {
  for (const source of sectionSources) {
    assert.match(source, /<section aria-labelledby=/);
    assert.match(source, /rounded-2xl/);
    assert.match(source, /text-xl sm:text-3xl/);
  }
});
