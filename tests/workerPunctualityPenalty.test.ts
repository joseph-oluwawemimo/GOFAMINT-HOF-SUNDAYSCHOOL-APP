import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePenaltyAwarePunctuality, computeAllWorkersQuarterPerformance, computeTop3PunctualityHonors, computeWorkerSpecialEventPerformance } from '../src/utils/quarterScheduleUtils';
import { getClockedInWorkers, isActiveWorkerProfile } from '../src/utils/workerProfileUtils';

const worker = (id = 'w1', overrides = {}) => ({ id, fullName: id, status: 'ACTIVE', categories: [], department: 'Adult', phone: '', whatsappNumber: '', address: '', qrCodeToken: '', createdAt: '', updatedAt: '', ...overrides }) as any;
const now = new Date('2026-09-22T12:00:00Z');
const schedule = [1, 2, 3, 4].map(week => ({
  weekNumber: week,
  sundayDate: `2026-09-${String(week * 7).padStart(2, '0')}`,
  prepDate: `2026-09-${String((week * 7) - 3).padStart(2, '0')}`,
  topic: '', scriptureReading: '', isSharingAdmonitionWeek: false
}));

test('punctuality deducts 50% for lateness and 100% for absence', () => {
  assert.equal(calculatePenaltyAwarePunctuality(3, 0, 3), 100);
  assert.equal(calculatePenaltyAwarePunctuality(2, 1, 3), 83);
  assert.equal(calculatePenaltyAwarePunctuality(2, 0, 3), 67);
});

test('quarter performance uses expected sessions rather than attended sessions as denominator', () => {
  const schedule = [1, 2, 3].map(week => ({
    weekNumber: week,
    sundayDate: `2026-09-${String(week * 7).padStart(2, '0')}`,
    prepDate: `2026-09-${String((week * 7) - 3).padStart(2, '0')}`,
    topic: '', scriptureReading: '', isSharingAdmonitionWeek: false
  }));
  const worker = { id: 'w1', fullName: 'Worker', status: 'ACTIVE', categories: [], department: 'Adult', phone: '', whatsappNumber: '', address: '', qrCodeToken: '', createdAt: '', updatedAt: '' } as any;
  const result = computeAllWorkersQuarterPerformance(
    [worker], schedule as any,
    [
      { workerId: 'w1', serviceDate: '2026-09-07', status: 'PRESENT', isLate: false },
      { workerId: 'w1', serviceDate: '2026-09-14', status: 'LATE', isLate: true }
    ] as any,
    []
  )[0];
  assert.equal(result.sunExpected, 3);
  assert.equal(result.sunAttended, 2);
  assert.equal(result.sunAbsent, 1);
  assert.equal(result.sunPunctualityRate, 50);
});

test('legacy workers without a status remain available while explicit inactive workers do not', () => {
  assert.equal(isActiveWorkerProfile({ fullName: 'Legacy' } as any), true);
  assert.equal(isActiveWorkerProfile({ status: ' active ' } as any), true);
  assert.equal(isActiveWorkerProfile({ status: ' inactive ' } as any), false);
  assert.equal(isActiveWorkerProfile({ status: 'ARCHIVED' } as any), false);
  assert.equal(isActiveWorkerProfile({ status: 'DELETED' } as any), false);
  assert.equal(isActiveWorkerProfile({ status: 'ACTIVE', archivedAt: '2026-09-01' } as any), false);
});

test('future sessions and sessions before joining do not reduce performance', () => {
  const result = computeAllWorkersQuarterPerformance([worker('new', { joinedDate: '2026-09-14' })], schedule,
    [{ workerId: 'new', serviceDate: '2026-09-14', status: 'PRESENT' }] as any, [], now)[0];
  assert.equal(result.sunExpected, 2);
  assert.equal(result.prepExpected, 1);
  assert.equal(result.sunAbsent, 1);
  assert.equal(result.sunPunctualityRate, 50);
});

test('duplicate imports count once and a newer absent correction cannot earn late credit', () => {
  const result = computeAllWorkersQuarterPerformance([worker()], schedule, [
    { workerId: 'w1', serviceDate: '2026-09-07', status: 'PRESENT', createdAt: '2026-09-07T09:00:00Z' },
    { workerId: 'w1', serviceDate: '2026-09-07', status: 'PRESENT', createdAt: '2026-09-07T09:00:00Z' },
    { workerId: 'w1', serviceDate: '2026-09-14', status: 'LATE', isLate: true, createdAt: '2026-09-14T09:00:00Z' },
    { workerId: 'w1', serviceDate: '2026-09-14', status: 'ABSENT', isLate: true, updatedAt: '2026-09-15T09:00:00Z' }
  ] as any, [], now)[0];
  assert.equal(result.sunAttended, 1);
  assert.equal(result.sunLate, 0);
  assert.equal(result.sunAbsent, 2);
  assert.equal(result.sunPunctualityRate, 33);
});

test('honors rank consistent attendance above a single perfect arrival and exclude zero attendance', () => {
  const workers = [worker('consistent', { status: ' active ' }), worker('occasional'), worker('absent')];
  const records = schedule.slice(0, 3).map(session => ({ workerId: 'consistent', serviceDate: session.sundayDate, status: 'PRESENT' }));
  records.push({ workerId: 'occasional', serviceDate: schedule[0].sundayDate, status: 'PRESENT' });
  const { top3SundayService } = computeTop3PunctualityHonors(workers, schedule, records as any, [], now);
  assert.equal(top3SundayService.length, 2);
  assert.equal(top3SundayService[0].workerId, 'consistent');
  assert.equal(top3SundayService[0].punctualityRate, 100);
  assert.equal(top3SundayService[1].punctualityRate, 33);
  assert.equal(top3SundayService[1].totalQuarterWeeks, 3);
});

test('live clock-in totals ignore absent placeholders and duplicate rows', () => {
  const date = '2026-09-21';
  const before = [{ workerId: 'w1', serviceDate: date, status: 'ABSENT', createdAt: '2026-09-21T06:00:00Z' }] as any;
  assert.equal(getClockedInWorkers(before, date).length, 0);
  const after = [...before,
    { workerId: 'w1', serviceDate: date, status: 'PRESENT', createdAt: '2026-09-21T07:00:00Z' },
    { workerId: 'w1', serviceDate: date, status: 'PRESENT', createdAt: '2026-09-21T07:00:00Z' },
    { workerId: 'w2', serviceDate: date, status: 'LATE', createdAt: '2026-09-21T08:00:00Z' },
    { workerId: 'w3', serviceDate: '2026-09-14', status: 'PRESENT' }
  ] as any;
  const clockedIn = getClockedInWorkers(after, date);
  assert.equal(clockedIn.length, 2);
  assert.equal(clockedIn.filter(record => record.status === 'LATE' || record.isLate).length, 1);
});

test('special-event and cumulative inputs use expected days with the same absence and late penalties', () => {
  const events = [{ id: 'event', startDate: '2026-09-19', includeInPunctualityHonors: true,
    daySchedules: ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-28'].map(date => ({ date })) }] as any;
  const records = [
    { workerId: 'w1', eventId: 'event', date: '2026-09-19', status: 'PRESENT' },
    { workerId: 'w1', eventId: 'event', date: '2026-09-19', status: 'PRESENT' },
    { workerId: 'w1', eventId: 'event', date: '2026-09-20', status: 'LATE' }
  ] as any;
  const result = computeWorkerSpecialEventPerformance(worker(), events, records, now);
  assert.equal(result.totalEvents, 3);
  assert.equal(result.attendedCount, 2);
  assert.equal(result.punctualityRate, 50);
  assert.equal(result.attendanceRate, 67);
});
