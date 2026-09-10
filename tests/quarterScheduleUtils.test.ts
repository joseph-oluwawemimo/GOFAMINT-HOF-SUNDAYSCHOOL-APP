import test from 'node:test';
import assert from 'node:assert/strict';
import type { QuarterData, WorkerProfile } from '../src/types';
import {
  computeQuarterWeeklyMetrics,
  formatDateISO,
  generateFullYearQuarterPreviews,
  getDefaultQuarterStartDate,
  getQuarterWeeklySchedule,
  parseDateSafe,
} from '../src/utils/quarterScheduleUtils';

test('strict date parsing rejects calendar overflow', () => {
  const fallback = new Date(2000, 0, 1, 12);
  assert.equal(formatDateISO(parseDateSafe('2026-02-31', fallback)), '2000-01-01');
  assert.equal(formatDateISO(parseDateSafe('2026-02-28', fallback)), '2026-02-28');
});

test('default quarter dates honor the requested Sunday School year', () => {
  assert.equal(formatDateISO(getDefaultQuarterStartDate(1, 2030)), '2030-09-01');
  assert.equal(formatDateISO(getDefaultQuarterStartDate(2, 2030)), '2030-12-01');
  assert.equal(formatDateISO(getDefaultQuarterStartDate(3, 2030)), '2031-03-02');
  assert.equal(formatDateISO(getDefaultQuarterStartDate(4, 2030)), '2031-06-01');
});

test('generated quarters are contiguous thirteen-week blocks', () => {
  const previews = generateFullYearQuarterPreviews('2030-09-01');
  assert.equal(previews.length, 4);
  assert.equal(previews[0].startDate, '2030-09-01');
  assert.equal(previews[0].sharingAdmonitionDate, '2030-11-24');
  assert.equal(previews[1].startDate, '2030-12-01');
});

test('weekly schedules include the mandatory sharing and admonition week', () => {
  const quarter = {
    id: 'q1', quarterNumber: 1, quarterName: 'First Quarter', quarterTheme: '',
    startDate: '2030-09-01', totalLessonWeeks: 12, hasSharingAdmonitionWeek: true,
    status: 'ACTIVE', lessons: [], updatedAt: new Date(0).toISOString(),
  } as QuarterData;
  const schedule = getQuarterWeeklySchedule(quarter, 2030);
  assert.equal(schedule.length, 13);
  assert.equal(schedule[12].sundayDate, '2030-11-24');
  assert.equal(schedule[12].isSharingAdmonitionWeek, true);
});

test('worker metrics exclude inactive workers from active denominators', () => {
  const active = { id: 'active', fullName: 'Active', department: 'Adult', status: 'ACTIVE' } as WorkerProfile;
  const inactive = { id: 'inactive', fullName: 'Inactive', department: 'Adult', status: 'INACTIVE' } as WorkerProfile;
  const metrics = computeQuarterWeeklyMetrics([
    { weekNumber: 1, sundayDate: '2030-09-01', prepDate: '2030-08-29' },
  ], [active, inactive], [], []);
  assert.equal(metrics[0].sundayTotalActive, 1);
  assert.equal(metrics[0].sundayAbsentCount, 1);
  assert.equal(metrics[0].prepTotalActive, 1);
});
