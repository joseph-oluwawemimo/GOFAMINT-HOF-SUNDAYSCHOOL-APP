import test from 'node:test';
import assert from 'node:assert/strict';
import type { Member, WeeklyGradeRecord } from '../src/types';
import {
  calculateCategoryScore,
  calculateMemberStats,
  checkVisitorQualification,
  getConsecutiveAbsences,
  getConsecutiveVisits,
} from '../src/utils/calculations';

const member = {
  id: 'member-1',
  fullName: 'Test Member',
  memberType: 'STUDENT',
  status: 'ACTIVE',
  firstLessonWeek: 2,
  evangelismReferralCount: 0,
} as Member;

function grade(weekNumber: number, attendance: WeeklyGradeRecord['attendance'], overrides: Partial<WeeklyGradeRecord> = {}) {
  return {
    id: `member-1-week-${weekNumber}`,
    memberId: member.id,
    weekNumber,
    attendance,
    punctuality: 0,
    memoryVerse: 0,
    classParticipation: 0,
    lessonTotal: 0,
    ...overrides,
  } as WeeklyGradeRecord;
}

test('category scores are bounded and reject non-finite values', () => {
  assert.deepEqual(calculateCategoryScore(20, 15, 1), {
    scoreObtained: 15,
    maxObtainable: 15,
    eligibleLessons: 1,
    percentage: 100,
  });
  assert.equal(calculateCategoryScore(-4, 15, 1).percentage, 0);
  assert.equal(calculateCategoryScore(Number.NaN, 15, 1).percentage, 0);
});

test('member statistics exclude pre-enrollment, no-record, and exempt weeks', () => {
  const stats = calculateMemberStats(member, [
    grade(2, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20, lessonTotal: 999 }),
    grade(3, 'ABSENT'),
    grade(4, 'EXEMPT'),
    grade(5, 'PRESENT', { isNoRecordWeek: true, punctuality: 15, memoryVerse: 15, classParticipation: 20 }),
  ], 5);

  assert.equal(stats.eligibleLessonsCount, 2);
  assert.equal(stats.attendedWeeks, 1);
  assert.equal(stats.absentWeeks, 1);
  assert.equal(stats.exemptWeeks, 2);
  assert.equal(stats.totalPointsEarned, 50);
  assert.equal(stats.hardWorkRate, 50);
});

test('attendance streaks skip no-record weeks and stop at present/exempt records', () => {
  const records = [
    grade(1, 'PRESENT'),
    grade(2, 'ABSENT'),
    grade(3, 'ABSENT'),
    grade(4, 'PRESENT'),
    grade(5, 'PRESENT'),
  ];
  assert.equal(getConsecutiveAbsences(member.id, 3, records), 2);
  assert.equal(getConsecutiveAbsences(member.id, 3, records, 1, [2]), 1);
  assert.equal(getConsecutiveVisits(member.id, 5, records), 2);
});

test('visitor conversion requires three consecutive attendances before quarter end', () => {
  const visitor = { ...member, memberType: 'VISITOR', firstLessonWeek: 1 } as Member;
  const twoVisits = [grade(1, 'PRESENT'), grade(2, 'PRESENT')];
  assert.equal(checkVisitorQualification(visitor, twoVisits, 2).isQualified, false);

  const threeVisits = [...twoVisits, grade(3, 'PRESENT')];
  const result = checkVisitorQualification(visitor, threeVisits, 3);
  assert.equal(result.isQualified, true);
  assert.equal(result.reason, 'CONSECUTIVE_VISITS');
});

test('visitor consecutive attendance continues across a quarter boundary', () => {
  const visitor = {
    ...member,
    memberType: 'VISITOR',
    firstLessonWeek: 1,
    quarterEnrollments: {
      2: {
        quarterNumber: 2,
        memberType: 'VISITOR',
        status: 'ACTIVE',
        consecutiveVisitsCarried: 2,
      },
    },
  } as Member;
  const firstWeekOfQ2 = [grade(1, 'PRESENT', { quarterNumber: 2 })];
  const result = checkVisitorQualification(visitor, firstWeekOfQ2, 1, [], 2);

  assert.equal(result.isQualified, true);
  assert.equal(result.consecutiveVisits, 3);
  assert.equal(result.reason, 'CONSECUTIVE_VISITS');
});

test('50 percent attendance is considered only at quarter end and uses eligible weeks', () => {
  const visitor = { ...member, memberType: 'VISITOR', firstLessonWeek: 11 } as Member;
  const records = [grade(11, 'PRESENT'), grade(12, 'ABSENT')];

  assert.equal(checkVisitorQualification(visitor, [grade(1, 'PRESENT'), grade(2, 'ABSENT')], 2).isQualified, false);
  const result = checkVisitorQualification(visitor, records, 12);
  assert.equal(result.isQualified, true);
  assert.equal(result.reason, 'ATTENDANCE_PERCENTAGE');
  assert.equal(result.attendancePercentage, 50);
});
