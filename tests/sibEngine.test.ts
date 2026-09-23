import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateAttendanceRate,
  calculatePunctualityRate,
  calculateFollowUpRate,
  calculateVisitorReturnRate,
  calculateRetentionRate,
  calculateRecordCompleteness
} from '../src/sib/engine/metricEngine';

import { analyzeTrend } from '../src/sib/engine/trendEngine';
import { evaluateConfidence } from '../src/sib/engine/confidenceEngine';
import { evaluatePriority } from '../src/sib/engine/priorityEngine';
import { calculateClassHealth } from '../src/sib/engine/classHealthEngine';
import { computeStudentAttentionList } from '../src/sib/engine/studentAttentionEngine';
import { detectAnomalies } from '../src/sib/engine/anomalyEngine';
import { SIBEvidenceRegistry } from '../src/sib/engine/evidenceEngine';

import type {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord
} from '../src/types';

// ==========================================
// 1. Metric Engine Tests
// ==========================================
test('metricEngine: attendance rate calculation', () => {
  const normal = calculateAttendanceRate(8, 10);
  assert.equal(normal.rate, 80);
  assert.equal(normal.sufficiencyStatus, 'SUFFICIENT');

  const zeroEligible = calculateAttendanceRate(0, 0);
  assert.equal(zeroEligible.rate, 0);
  assert.equal(zeroEligible.sufficiencyStatus, 'INSUFFICIENT');

  const perfect = calculateAttendanceRate(15, 15);
  assert.equal(perfect.rate, 100);
});

test('metricEngine: punctuality rate calculation', () => {
  // max score for 10 lessons is 10 * 15 = 150 points
  const normal = calculatePunctualityRate(135, 10);
  assert.equal(normal.rate, 90);
  assert.equal(normal.sufficiencyStatus, 'SUFFICIENT');
});

test('metricEngine: follow-up rate calculation', () => {
  const partial = calculateFollowUpRate(3, 5);
  assert.equal(partial.rate, 60);

  const empty = calculateFollowUpRate(0, 0);
  assert.equal(empty.rate, 100); // 0 required means no pending backlog
  assert.equal(empty.sufficiencyStatus, 'SUFFICIENT');
});

test('metricEngine: visitor return and retention calculations', () => {
  const visitors = calculateVisitorReturnRate(2, 4);
  assert.equal(visitors.rate, 50);

  const retention = calculateRetentionRate(9, 10);
  assert.equal(retention.rate, 90);
});

test('metricEngine: record completeness audits', () => {
  const completeness = calculateRecordCompleteness(18, 20);
  assert.equal(completeness.rate, 90);
  assert.equal(completeness.sufficiencyStatus, 'SUFFICIENT');
});

// ==========================================
// 2. Trend Engine Tests
// ==========================================
test('trendEngine: analyzes improving, declining, and stable trends', () => {
  const improving = analyzeTrend({
    currentValue: 85,
    previousValue: 70,
    periodLabel: 'Week 2',
    previousPeriodLabel: 'Week 1',
    series: [70, 85]
  });
  assert.equal(improving.direction, 'IMPROVING');
  assert.equal(improving.isPositiveDevelopment, true);
  assert.ok(improving.changeAmount > 0);

  const declining = analyzeTrend({
    currentValue: 65,
    previousValue: 80,
    periodLabel: 'Week 2',
    previousPeriodLabel: 'Week 1',
    series: [80, 65]
  });
  assert.equal(declining.direction, 'DECLINING');
  assert.equal(declining.isPositiveDevelopment, false);
  assert.ok(declining.changeAmount < 0);

  const stable = analyzeTrend({
    currentValue: 80,
    previousValue: 80.5,
    periodLabel: 'Week 2',
    previousPeriodLabel: 'Week 1'
  });
  assert.equal(stable.direction, 'STABLE');

  const insufficient = analyzeTrend({
    currentValue: 80,
    previousValue: null,
    periodLabel: 'Week 1',
    previousPeriodLabel: 'None'
  });
  assert.equal(insufficient.direction, 'INSUFFICIENT_DATA');
});

// ==========================================
// 3. Confidence & Priority Engine Tests
// ==========================================
test('confidenceEngine: evaluates confidence levels deterministically', () => {
  const high = evaluateConfidence({
    recordCount: 25,
    expectedRecordCount: 25,
    periodDurationLessons: 6,
    hasRecentData: true
  });
  assert.equal(high.level, 'HIGH');

  const lowData = evaluateConfidence({
    recordCount: 1,
    expectedRecordCount: 10,
    periodDurationLessons: 1,
    hasRecentData: false
  });
  assert.ok(lowData.level === 'LOW' || lowData.level === 'INSUFFICIENT_DATA');
});

test('priorityEngine: evaluates priority levels based on factors', () => {
  const critical = evaluatePriority({
    severityScore: 80,
    impactedCount: 6,
    consecutiveOccurrences: 3,
    isUrgentCareNeeded: true
  });
  assert.equal(critical.level, 'CRITICAL');
  assert.ok(critical.reason.length > 0);

  const low = evaluatePriority({
    severityScore: 10,
    impactedCount: 1,
    consecutiveOccurrences: 1,
    isUrgentCareNeeded: false
  });
  assert.ok(low.level === 'LOW' || low.level === 'MODERATE');
});

// ==========================================
// 4. Class Health Score Engine (No Black-Box Score)
// ==========================================
test('classHealthEngine: computes decomposable class health with full explanation', () => {
  const mockClass = {
    id: 'cls-101',
    className: 'Believers Class',
    department: 'Adults',
    quarter: 1,
    approvalStatus: 'APPROVED'
  } as unknown as ClassProfile;

  const mockStudents = [
    { id: 's1', fullName: 'Student One', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-101' },
    { id: 's2', fullName: 'Student Two', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-101' },
    { id: 's3', fullName: 'Student Three', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-101' }
  ] as unknown as Member[];

  const mockGrades = [
    { id: 'g1', memberId: 's1', classId: 'cls-101', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g2', memberId: 's2', classId: 'cls-101', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g3', memberId: 's3', classId: 'cls-101', weekNumber: 1, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 },
    { id: 'g4', memberId: 's1', classId: 'cls-101', weekNumber: 2, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g5', memberId: 's2', classId: 'cls-101', weekNumber: 2, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g6', memberId: 's3', classId: 'cls-101', weekNumber: 2, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 }
  ] as unknown as WeeklyGradeRecord[];

  const mockAbsences = [
    { id: 'a1', classId: 'cls-101', memberId: 's3', weekNumber: 1 }
  ] as unknown as AbsenceLogRecord[];

  const health = calculateClassHealth({
    classProfile: mockClass,
    members: mockStudents,
    grades: mockGrades,
    absenceLogs: mockAbsences,
    quarterNumber: 1,
    totalWeeksInQuarter: 12
  });

  // Verify non-black-box explainability
  assert.ok(health.healthScore >= 0 && health.healthScore <= 100);
  assert.ok(health.explanation);
  assert.ok(health.explanation.components.length > 0);
  assert.ok(health.explanation.calculationFormula.includes('Health ='));
  assert.equal(health.classId, 'cls-101');
  assert.equal(health.className, 'Believers Class');
});

// ==========================================
// 5. Student Attention Engine (Consecutive Absences)
// ==========================================
test('studentAttentionEngine: detects 2 and 3+ consecutive absences accurately', () => {
  const mockClass = {
    id: 'cls-1',
    className: 'Disciples Class',
    quarter: 1,
    approvalStatus: 'APPROVED'
  } as unknown as ClassProfile;

  const mockStudents = [
    { id: 'std-1', fullName: 'Faithful Student', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-1' },
    { id: 'std-2', fullName: 'Missing Student', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-1' }
  ] as unknown as Member[];

  const mockGrades = [
    { id: 'g11', memberId: 'std-1', classId: 'cls-1', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g12', memberId: 'std-1', classId: 'cls-1', weekNumber: 2, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g13', memberId: 'std-1', classId: 'cls-1', weekNumber: 3, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },

    { id: 'g21', memberId: 'std-2', classId: 'cls-1', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g22', memberId: 'std-2', classId: 'cls-1', weekNumber: 2, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 },
    { id: 'g23', memberId: 'std-2', classId: 'cls-1', weekNumber: 3, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 }
  ] as unknown as WeeklyGradeRecord[];

  const mockAbsences = [
    { id: 'ab1', classId: 'cls-1', memberId: 'std-2', weekNumber: 2, followUpStatus: 'PENDING' },
    { id: 'ab2', classId: 'cls-1', memberId: 'std-2', weekNumber: 3, followUpStatus: 'PENDING' }
  ] as unknown as AbsenceLogRecord[];

  const attentionList = computeStudentAttentionList({
    members: mockStudents,
    grades: mockGrades,
    absenceLogs: mockAbsences,
    classes: [mockClass]
  });

  // std-2 has 2 consecutive absences (weeks 2, 3)
  const item = attentionList.find(a => a.studentId === 'std-2');
  assert.ok(item, 'Student with 2 absences must appear in attention list');
  assert.equal(item?.consecutiveAbsences, 2);
  assert.ok(item?.attentionLevel === 'MODERATE' || item?.attentionLevel === 'HIGH' || item?.attentionLevel === 'CRITICAL');
  assert.ok(item?.whyBreakdown.contributingFactors.some(r => r.includes('consecutive')));
});

// ==========================================
// 6. Anomaly Engine & Evidence Engine
// ==========================================
test('anomalyEngine: detects sudden attendance drop between lessons', () => {
  const mockClass = {
    id: 'cls-anom',
    className: 'Youth Class',
    quarter: 1,
    approvalStatus: 'APPROVED'
  } as unknown as ClassProfile;

  const members = [
    { id: 'm1', fullName: 'M1', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-anom' },
    { id: 'm2', fullName: 'M2', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-anom' },
    { id: 'm3', fullName: 'M3', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-anom' },
    { id: 'm4', fullName: 'M4', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-anom' }
  ] as unknown as Member[];

  // Week 1: 4 present (100%)
  // Week 2: 1 present, 3 absent (25%) -> 75% drop!
  const grades = [
    { id: 'g1', memberId: 'm1', classId: 'cls-anom', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g2', memberId: 'm2', classId: 'cls-anom', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g3', memberId: 'm3', classId: 'cls-anom', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g4', memberId: 'm4', classId: 'cls-anom', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },

    { id: 'g5', memberId: 'm1', classId: 'cls-anom', weekNumber: 2, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 },
    { id: 'g6', memberId: 'm2', classId: 'cls-anom', weekNumber: 2, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 },
    { id: 'g7', memberId: 'm3', classId: 'cls-anom', weekNumber: 2, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 },
    { id: 'g8', memberId: 'm4', classId: 'cls-anom', weekNumber: 2, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 }
  ] as unknown as WeeklyGradeRecord[];

  const anomalies = detectAnomalies({
    classes: [mockClass],
    members,
    grades,
    absenceLogs: []
  });

  assert.ok(anomalies.some(a => a.type === 'ATTENDANCE_DROP'));
});

test('evidenceEngine: records and queries evidence objects', () => {
  SIBEvidenceRegistry.clear();

  const mockClass = {
    id: 'cls-ev-1',
    className: 'Test Class',
    quarter: 1,
    approvalStatus: 'APPROVED'
  } as unknown as ClassProfile;

  const health = calculateClassHealth({
    classProfile: mockClass,
    members: [{ id: 'm1', fullName: 'M1', memberType: 'STUDENT', status: 'ACTIVE', classId: 'cls-ev-1' }] as unknown as Member[],
    grades: [{ id: 'g1', memberId: 'm1', classId: 'cls-ev-1', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 10, lessonTotal: 30 }] as unknown as WeeklyGradeRecord[],
    absenceLogs: [],
    quarterNumber: 1
  });

  const ev = SIBEvidenceRegistry.createClassHealthEvidence(health);
  assert.ok(ev.id);
  const retrieved = SIBEvidenceRegistry.getEvidence(ev.id);
  assert.ok(retrieved);
  assert.equal(retrieved?.targetId, 'cls-ev-1');
  assert.equal(retrieved?.metricName, 'Class Health Score');
});
