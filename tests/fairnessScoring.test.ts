import test from 'node:test';
import assert from 'node:assert/strict';
import type { Member, WeeklyGradeRecord } from '../src/types';
import {
  calculateRawRate,
  calculateAdjustedRate,
  formatRate,
  computeRawMemberMetrics,
  calculateLeaveOneOutReferenceRates,
  computeClassFairnessRankings,
  FAIRNESS_RELIABILITY_K
} from '../src/utils/fairnessScoring';

function makeMember(id: string, name: string, type: 'STUDENT' | 'VISITOR', firstLessonWeek: number = 1): Member {
  return {
    id,
    fullName: name,
    memberType: type,
    status: 'ACTIVE',
    firstLessonWeek,
    evangelismReferralCount: 0,
    classId: 'CLASS_TEST'
  } as Member;
}

function makeGrade(
  memberId: string,
  weekNumber: number,
  attendance: 'PRESENT' | 'ABSENT' | 'EXEMPT',
  scores: { punctuality?: number; memoryVerse?: number; classParticipation?: number; lessonTotal?: number } = {}
): WeeklyGradeRecord {
  const p = scores.punctuality ?? (attendance === 'PRESENT' ? 15 : 0);
  const m = scores.memoryVerse ?? (attendance === 'PRESENT' ? 15 : 0);
  const c = scores.classParticipation ?? (attendance === 'PRESENT' ? 20 : 0);
  return {
    id: `grd_${memberId}_w${weekNumber}`,
    memberId,
    classId: 'CLASS_TEST',
    weekNumber,
    attendance,
    punctuality: p,
    memoryVerse: m,
    classParticipation: c,
    lessonTotal: scores.lessonTotal ?? (p + m + c)
  } as WeeklyGradeRecord;
}

test('1. Raw overall calculation — 12 eligible lessons, full marks: 600 / 600 = 100%', () => {
  const m = makeMember('mem-1', 'Grace', 'STUDENT', 1);
  const grades: WeeklyGradeRecord[] = [];
  for (let w = 1; w <= 12; w++) {
    grades.push(makeGrade('mem-1', w, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 }));
  }

  const raw = computeRawMemberMetrics(m, grades, 12);
  assert.equal(raw.eligibleLessons, 12);
  assert.equal(raw.totalPointsEarned, 600);
  assert.equal(raw.maxAvailablePoints, 600);
  assert.equal(raw.rawOverallRate, 100);
  assert.equal(formatRate(raw.rawOverallRate), '100.0%');
});

test('2. Raw overall calculation — 4 eligible lessons, 170 marks: 170 / 200 = 85%', () => {
  const m = makeMember('mem-2', 'John', 'STUDENT', 9);
  // Joined at week 9 in 12-week quarter (weeks 9, 10, 11, 12 = 4 lessons)
  const grades = [
    makeGrade('mem-2', 9, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 15 }), // 45
    makeGrade('mem-2', 10, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 18 }), // 48
    makeGrade('mem-2', 11, 'PRESENT', { punctuality: 10, memoryVerse: 10, classParticipation: 10 }), // 30
    makeGrade('mem-2', 12, 'PRESENT', { punctuality: 15, memoryVerse: 12, classParticipation: 20 })  // 47
  ]; // Total = 45 + 48 + 30 + 47 = 170

  const raw = computeRawMemberMetrics(m, grades, 12);
  assert.equal(raw.eligibleLessons, 4);
  assert.equal(raw.totalPointsEarned, 170);
  assert.equal(raw.maxAvailablePoints, 200);
  assert.equal(raw.rawOverallRate, 85);
  assert.equal(formatRate(raw.rawOverallRate), '85.0%');
});

test('3. Late joiner — Joined at Lesson 9 in a 12-lesson quarter: eligible lessons = 4', () => {
  const m = makeMember('mem-3', 'Late Joiner', 'VISITOR', 9);
  const grades = [
    makeGrade('mem-3', 9, 'PRESENT'),
    makeGrade('mem-3', 10, 'PRESENT'),
    makeGrade('mem-3', 11, 'PRESENT'),
    makeGrade('mem-3', 12, 'PRESENT')
  ];

  const raw = computeRawMemberMetrics(m, grades, 12);
  assert.equal(raw.eligibleLessons, 4);
  assert.equal(raw.exemptWeeks, 8); // Weeks 1-8 are N/A / not eligible
  assert.equal(raw.rawOverallRate, 100);
});

test('4. Late joiner with absence: 45, 48, 0 (absent), 47 -> 140 / 200 = 70%', () => {
  const m = makeMember('mem-4', 'Absence Joiner', 'STUDENT', 9);
  const grades = [
    makeGrade('mem-4', 9, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 15 }), // 45
    makeGrade('mem-4', 10, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 18 }), // 48
    makeGrade('mem-4', 11, 'ABSENT', { punctuality: 0, memoryVerse: 0, classParticipation: 0 }),     // 0
    makeGrade('mem-4', 12, 'PRESENT', { punctuality: 15, memoryVerse: 12, classParticipation: 20 })  // 47
  ]; // Total = 140 / 200 = 70%

  const raw = computeRawMemberMetrics(m, grades, 12);
  assert.equal(raw.eligibleLessons, 4);
  assert.equal(raw.totalPointsEarned, 140);
  assert.equal(raw.maxAvailablePoints, 200);
  assert.equal(raw.rawOverallRate, 70);
  assert.equal(raw.attendedWeeks, 3);
  assert.equal(raw.absentWeeks, 1);
  assert.equal(raw.attendanceRate, 75); // 3 / 4 * 100 = 75%
});

test('5. Fair rate — Raw = 85, n = 4, reference = 70, k = 6 -> Expected: 76%', () => {
  const adjusted = calculateAdjustedRate(4, 85, 70, 6);
  // (4 * 85 + 6 * 70) / (4 + 6) = (340 + 420) / 10 = 760 / 10 = 76
  assert.equal(adjusted, 76);
  assert.equal(formatRate(adjusted), '76.0%');
});

test('6. Fair rate — Raw = 94, n = 2, reference = 70, k = 6 -> Expected: 76%', () => {
  const adjusted = calculateAdjustedRate(2, 94, 70, 6);
  // (2 * 94 + 6 * 70) / (2 + 6) = (188 + 420) / 8 = 608 / 8 = 76
  assert.equal(adjusted, 76);
  assert.equal(formatRate(adjusted), '76.0%');
});

test('7. Fair rate — Raw = 90, n = 11, reference = 70, k = 6 -> Expected approx: 82.94%', () => {
  const adjusted = calculateAdjustedRate(11, 90, 70, 6);
  // (11 * 90 + 6 * 70) / (11 + 6) = (990 + 420) / 17 = 1410 / 17 ≈ 82.941176...
  assert.ok(Math.abs(adjusted - 82.941176) < 0.001);
  assert.equal(formatRate(adjusted), '82.9%');
});

test('8. Student / Visitor & Award Eligibility Separation', () => {
  const student = makeMember('mem-s', 'Faith Student', 'STUDENT', 1);
  const visitor = makeMember('mem-v', 'Peter Visitor', 'VISITOR', 1);

  // Both have identical scores
  const grades = [
    makeGrade('mem-s', 1, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 }),
    makeGrade('mem-v', 1, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 })
  ];

  const summary = computeClassFairnessRankings([student, visitor], grades, 1);
  const sMetrics = summary.memberMetrics.find(m => m.memberId === 'mem-s')!;
  const vMetrics = summary.memberMetrics.find(m => m.memberId === 'mem-v')!;

  // Scores must NOT be hidden or zeroed for visitor
  assert.equal(vMetrics.totalPointsEarned, 50);
  assert.equal(vMetrics.overall.rawRate, 100);
  assert.equal(vMetrics.isAwardEligible, false);
  assert.equal(vMetrics.awardEligibilityLabel, 'Not Eligible for Awards');

  assert.equal(sMetrics.totalPointsEarned, 50);
  assert.equal(sMetrics.overall.rawRate, 100);
  assert.equal(sMetrics.isAwardEligible, true);
  assert.equal(sMetrics.awardEligibilityLabel, 'Eligible for Awards');

  // Award winner MUST be the student, never the visitor
  assert.equal(summary.awardWinners.overall?.memberId, 'mem-s');
});

test('9. Ongoing Quarter — Future lessons do not penalize rates', () => {
  const m = makeMember('mem-ongoing', 'Mid Quarter', 'STUDENT', 1);
  // Current week is 4 of ongoing quarter
  const grades = [
    makeGrade('mem-ongoing', 1, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 }),
    makeGrade('mem-ongoing', 2, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 }),
    makeGrade('mem-ongoing', 3, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 }),
    makeGrade('mem-ongoing', 4, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 })
  ];

  const raw = computeRawMemberMetrics(m, grades, 4); // evaluated at week 4
  assert.equal(raw.eligibleLessons, 4);
  assert.equal(raw.maxAvailablePoints, 200);
  assert.equal(raw.rawOverallRate, 100); // 100%, NOT 200/600 (33.3%)!
});

test('10. Leave-one-out reference rate fallback with one-person class', () => {
  const m = makeMember('mem-solo', 'Solo Student', 'STUDENT', 1);
  const grades = [
    makeGrade('mem-solo', 1, 'PRESENT', { punctuality: 15, memoryVerse: 15, classParticipation: 20 })
  ];

  const summary = computeClassFairnessRankings([m], grades, 1);
  const soloMetrics = summary.memberMetrics[0];

  assert.ok(Number.isFinite(soloMetrics.overall.referenceRate));
  assert.ok(Number.isFinite(soloMetrics.overall.adjustedRate));
  assert.equal(soloMetrics.overall.rawRate, 100);
});

test('11. Deterministic tie breaking between equal adjusted rates', () => {
  const p1 = makeMember('m1', 'Alice', 'STUDENT', 1);
  const p2 = makeMember('m2', 'Bob', 'STUDENT', 1);

  // Both have 100% on 2 lessons
  const grades = [
    makeGrade('m1', 1, 'PRESENT'), makeGrade('m1', 2, 'PRESENT'),
    makeGrade('m2', 1, 'PRESENT'), makeGrade('m2', 2, 'PRESENT')
  ];

  const summary = computeClassFairnessRankings([p1, p2], grades, 2);
  const a1 = summary.memberMetrics.find(m => m.memberId === 'm1')!;
  const a2 = summary.memberMetrics.find(m => m.memberId === 'm2')!;

  // Both receive rank 1 because of exact tie
  assert.equal(a1.rankings.overall, 1);
  assert.equal(a2.rankings.overall, 1);
});
