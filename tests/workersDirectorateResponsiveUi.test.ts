import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const shellSource = readSource('../src/components/WorkersModule/WorkersModuleView.tsx');
const dashboardSource = readSource('../src/components/WorkersModule/WorkersDashboardView.tsx');
const directorySource = readSource('../src/components/WorkersModule/WorkersDirectoryView.tsx');
const sundayTerminalSource = readSource('../src/components/WorkersModule/SundayClockInKiosk.tsx');
const thursdayTerminalSource = readSource('../src/components/WorkersModule/ThursdayClockInTerminalModal.tsx');
const pageSources = [
  '../src/components/WorkersModule/WorkersDashboardView.tsx',
  '../src/components/WorkersModule/WorkersDirectoryView.tsx',
  '../src/components/WorkersModule/SundayClockInKiosk.tsx',
  '../src/components/WorkersModule/PreparatoryAttendanceView.tsx',
  '../src/components/WorkersModule/SpecialEventsView.tsx',
  '../src/components/WorkersModule/QuarterPunctualityAdmonitionView.tsx',
  '../src/components/WorkersModule/WorkerMyAttendanceView.tsx'
].map(readSource);

test('Workers Directorate exposes the seven operational workspaces plus attendance inspection', () => {
  for (const label of [
    'Executive Dashboard',
    'Attendance Inspection',
    'Workers Directory',
    'Sunday Clock-In',
    'Thursday Preparatory',
    'Special Events & Training',
    'Honours & Admonition',
    'My Workers Pass'
  ]) {
    assert.match(shellSource, new RegExp(label.replace(/[&]/g, '\\&')));
  }
});

test('Workers Directorate uses a desktop sidebar and mobile bottom taskbar', () => {
  assert.match(shellSource, /aria-label="Workers Directorate navigation"/);
  assert.match(shellSource, /hidden lg:flex fixed inset-y-0 left-0/);
  assert.match(shellSource, /lg:pl-72/);
  assert.match(shellSource, /aria-label="Mobile Workers Directorate navigation"/);
  assert.match(shellSource, /fixed inset-x-0 bottom-0/);
  assert.match(shellSource, /safe-area-inset-bottom/);
  assert.match(shellSource, /aria-current=\{isActive \? 'page' : undefined\}/);
});

test('all Workers Directorate pages opt into the shared responsive design system', () => {
  for (const source of pageSources) {
    assert.match(source, /workers-page workers-page-/);
  }
});

test('executive dashboard renders record-driven KPI and chart visualizations', () => {
  assert.match(dashboardSource, /Workforce pulse/);
  assert.match(dashboardSource, /weeklyMetrics\.map\(metric => metric\.sundayTurnoutRate\)/);
  assert.match(dashboardSource, /weeklyMetrics\.map\(metric => metric\.prepTurnoutRate\)/);
  assert.match(dashboardSource, /<polyline points=\{sundayTrend\}/);
  assert.match(dashboardSource, /conic-gradient\(#163f8f/);
  assert.match(dashboardSource, /Attendance composition/);
});

test('inspection owns detailed records and exports while dashboard keeps explicit quick actions', () => {
  assert.match(dashboardSource, /viewMode = 'DASHBOARD'/);
  assert.match(dashboardSource, /Attendance Inspection/);
  assert.match(dashboardSource, /12-week attendance breakdown/);
  assert.match(dashboardSource, /Worker attendance records/);
  assert.match(dashboardSource, /Sunday clock-in/);
  assert.match(dashboardSource, /Thursday clock-in/);
});

test('mobile directory uses compact cards with a full profile sheet', () => {
  assert.match(directorySource, /aria-label="Workers directory cards"/);
  assert.match(directorySource, /selectedMobileWorker/);
  assert.match(directorySource, /Print ID pass/);
  assert.match(directorySource, /Go to Sunday clock-in/);
});

test('clock-in terminals remove completed workers from their available queues', () => {
  assert.match(sundayTerminalSource, /availableWorkersList/);
  assert.match(sundayTerminalSource, /clockedInIds/);
  assert.match(thursdayTerminalSource, /remainingWorkers/);
  assert.match(thursdayTerminalSource, /recordedIds/);
});
