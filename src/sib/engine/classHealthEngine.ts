/**
 * GOFAMINT SIB Class Health Engine
 * 
 * Strict Requirement:
 * NO SCORE WITHOUT EXPLANATION. NO BLACK-BOX SCORES.
 * Computes multi-factor health score (0-100) and produces a complete,
 * transparent mathematical decomposition showing components, weights,
 * positive/negative contributors, confidence, and recommended action.
 */

import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  QuarterNumber
} from '../../types';

import { SIB_CONFIG } from '../config/sibConfig';
import {
  ClassHealthResult,
  ScoreExplanation,
  ScoreComponentBreakdown,
  TrendAnalysis,
  ConfidenceLevel,
  PriorityLevel,
  AttentionLevel
} from '../types/sibTypes';

import {
  calculateAttendanceRate,
  calculateRetentionRate,
  calculateVisitorReturnRate,
  calculateFollowUpRate,
  calculateRecordCompleteness
} from './metricEngine';

import { analyzeTrend } from './trendEngine';
import { evaluateConfidence } from './confidenceEngine';
import { evaluatePriority } from './priorityEngine';

export interface ClassHealthInput {
  classProfile: ClassProfile;
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  quarterNumber: QuarterNumber;
  totalWeeksInQuarter?: number;
}

export function calculateClassHealth(input: ClassHealthInput): ClassHealthResult {
  const {
    classProfile,
    members,
    grades,
    absenceLogs,
    quarterNumber,
    totalWeeksInQuarter = 12
  } = input;

  const weights = SIB_CONFIG.classHealthWeights;

  const students = members.filter(m => m.memberType === 'STUDENT');
  const visitors = members.filter(m => m.memberType === 'VISITOR');
  const activeStudents = students.filter(m => m.status !== 'LEFT_CLASS');

  // 1. Attendance Rate across all recorded lessons in quarter
  const recordedWeeks = Array.from(new Set(grades.map(g => g.weekNumber))).sort((a, b) => a - b);
  const studentGrades = grades.filter(g => students.some(s => s.id === g.memberId));
  
  const presentGradesCount = studentGrades.filter(g => g.attendance === 'PRESENT').length;
  const eligibleGradesCount = studentGrades.filter(g => g.attendance === 'PRESENT' || g.attendance === 'ABSENT').length;

  const attendanceMetric = calculateAttendanceRate(presentGradesCount, eligibleGradesCount);
  const attendanceRate = attendanceMetric.rate;

  // 2. Attendance Trend (compare latest 2 weeks vs earlier weeks if available)
  let trendAnalysis: TrendAnalysis;
  if (recordedWeeks.length >= 2) {
    const latestWeek = recordedWeeks[recordedWeeks.length - 1];
    const prevWeek = recordedWeeks[recordedWeeks.length - 2];

    const latestPresent = studentGrades.filter(g => g.weekNumber === latestWeek && g.attendance === 'PRESENT').length;
    const latestTotal = studentGrades.filter(g => g.weekNumber === latestWeek && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT')).length;
    const latestRate = latestTotal > 0 ? Math.round((latestPresent / latestTotal) * 1000) / 10 : 0;

    const prevPresent = studentGrades.filter(g => g.weekNumber === prevWeek && g.attendance === 'PRESENT').length;
    const prevTotal = studentGrades.filter(g => g.weekNumber === prevWeek && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT')).length;
    const prevRate = prevTotal > 0 ? Math.round((prevPresent / prevTotal) * 1000) / 10 : 0;

    trendAnalysis = analyzeTrend({
      currentValue: latestRate,
      previousValue: prevRate,
      periodLabel: `Lesson ${latestWeek}`,
      previousPeriodLabel: `Lesson ${prevWeek}`,
    });
  } else {
    trendAnalysis = analyzeTrend({
      currentValue: attendanceRate,
      previousValue: null,
      periodLabel: recordedWeeks.length === 1 ? `Lesson ${recordedWeeks[0]}` : 'Current Quarter',
      previousPeriodLabel: 'Previous Quarter',
    });
  }

  // Convert trend to score component (0-100)
  let trendScore = 70; // baseline for stable
  if (trendAnalysis.direction === 'IMPROVING') {
    trendScore = Math.min(100, 75 + Math.abs(trendAnalysis.changeAmount) * 2);
  } else if (trendAnalysis.direction === 'DECLINING') {
    trendScore = Math.max(0, 65 - Math.abs(trendAnalysis.changeAmount) * 2);
  } else if (trendAnalysis.direction === 'VOLATILE') {
    trendScore = 60;
  }

  // 3. Student Retention Rate
  const retentionMetric = calculateRetentionRate(activeStudents.length, students.length);
  const retentionRate = retentionMetric.rate;

  // 4. Visitor Progression
  const returningVisitors = visitors.filter(v => (v.consecutiveVisits || 0) >= 2 || v.conversionStatus === 'APPROVED').length;
  const visitorMetric = calculateVisitorReturnRate(returningVisitors, visitors.length);
  const visitorRate = visitors.length > 0 ? visitorMetric.rate : 80; // neutral default when no visitors

  // 5. Follow-Up Completion Rate
  const requiredFollowUps = absenceLogs.filter(a => a.consecutiveWeeksAbsent >= 2).length;
  const completedFollowUps = absenceLogs.filter(a => a.consecutiveWeeksAbsent >= 2 && a.decisionMade).length;
  const followUpMetric = calculateFollowUpRate(completedFollowUps, requiredFollowUps);
  const followUpRate = followUpMetric.rate;

  // 6. Record Completeness Rate
  const expectedEntries = Math.max(1, recordedWeeks.length * Math.max(1, students.length));
  const recordCompletenessMetric = calculateRecordCompleteness(studentGrades.length, expectedEntries);
  const recordCompletenessRate = recordCompletenessMetric.rate;

  // Composite Health Score Calculation
  const components: ScoreComponentBreakdown[] = [
    {
      label: 'Attendance Rate',
      value: attendanceRate,
      weight: weights.attendanceRate,
      weightedContribution: Math.round(attendanceRate * weights.attendanceRate * 10) / 10,
      status: attendanceRate >= 80 ? 'STRONG' : attendanceRate >= 60 ? 'ACCEPTABLE' : 'WEAK',
      explanation: `${attendanceRate}% average student attendance across ${recordedWeeks.length} recorded lesson(s).`,
    },
    {
      label: 'Attendance Trend',
      value: trendScore,
      weight: weights.attendanceTrend,
      weightedContribution: Math.round(trendScore * weights.attendanceTrend * 10) / 10,
      status: trendAnalysis.direction === 'IMPROVING' ? 'STRONG' : trendAnalysis.direction === 'DECLINING' ? 'WEAK' : 'ACCEPTABLE',
      explanation: trendAnalysis.explanation,
    },
    {
      label: 'Student Retention',
      value: retentionRate,
      weight: weights.studentRetention,
      weightedContribution: Math.round(retentionRate * weights.studentRetention * 10) / 10,
      status: retentionRate >= 90 ? 'STRONG' : retentionRate >= 75 ? 'ACCEPTABLE' : 'WEAK',
      explanation: `${activeStudents.length} of ${students.length} registered students currently active.`,
    },
    {
      label: 'Visitor Progression',
      value: visitorRate,
      weight: weights.visitorProgression,
      weightedContribution: Math.round(visitorRate * weights.visitorProgression * 10) / 10,
      status: visitors.length === 0 ? 'ACCEPTABLE' : visitorRate >= 50 ? 'STRONG' : 'WEAK',
      explanation: visitors.length === 0
        ? 'No visitors registered in this class roster for this period.'
        : `${returningVisitors} of ${visitors.length} visitors recorded return visits or progression.`,
    },
    {
      label: 'Follow-Up Completion',
      value: followUpRate,
      weight: weights.followUpCompletion,
      weightedContribution: Math.round(followUpRate * weights.followUpCompletion * 10) / 10,
      status: followUpRate >= 80 ? 'STRONG' : followUpRate >= 60 ? 'ACCEPTABLE' : 'WEAK',
      explanation: requiredFollowUps === 0
        ? 'No prolonged absences requiring escalation were recorded.'
        : `${completedFollowUps} of ${requiredFollowUps} pastoral follow-ups were marked executed.`,
    },
    {
      label: 'Record Completeness',
      value: recordCompletenessRate,
      weight: weights.recordCompleteness,
      weightedContribution: Math.round(recordCompletenessRate * weights.recordCompleteness * 10) / 10,
      status: recordCompletenessRate >= 85 ? 'STRONG' : recordCompletenessRate >= 60 ? 'ACCEPTABLE' : 'WEAK',
      explanation: `${studentGrades.length} weekly student grades submitted across ${recordedWeeks.length} active lesson week(s).`,
    },
  ];

  const totalWeighted = components.reduce((sum, c) => sum + c.weightedContribution, 0);
  const healthScore = Math.min(100, Math.max(0, Math.round(totalWeighted)));

  // Positive Contributors & Concerns
  const positiveDevelopments: string[] = [];
  const concerns: string[] = [];

  if (attendanceRate >= 80) positiveDevelopments.push(`Robust student attendance rate of ${attendanceRate}%.`);
  else if (attendanceRate < 60) concerns.push(`Low attendance rate of ${attendanceRate}% requires intervention.`);

  if (trendAnalysis.direction === 'IMPROVING') positiveDevelopments.push(`Positive upward attendance momentum (+${trendAnalysis.changeAmount} pp).`);
  else if (trendAnalysis.direction === 'DECLINING') concerns.push(`Declining attendance trend (-${Math.abs(trendAnalysis.changeAmount)} pp).`);

  if (followUpRate < 70 && requiredFollowUps > 0) concerns.push(`Follow-up gap: ${requiredFollowUps - completedFollowUps} absent students pending pastoral care.`);
  if (retentionRate < 80) concerns.push(`Retention alert: ${students.length - activeStudents.length} students marked left or inactive.`);
  if (recordCompletenessRate < 75) concerns.push(`Record gaps: Some weekly lesson grades have not yet been synchronized.`);

  if (positiveDevelopments.length === 0) {
    positiveDevelopments.push('Consistent class baseline records maintained.');
  }

  // Consecutive absences count
  const consecutiveAbsenceCount = members.filter(m => (m.consecutiveAbsences || 0) >= 2).length;

  // Attention level
  let attentionLevel: AttentionLevel = 'LOW';
  if (healthScore < 55 || consecutiveAbsenceCount >= 3 || trendAnalysis.direction === 'DECLINING') {
    attentionLevel = healthScore < 50 || consecutiveAbsenceCount >= 4 ? 'CRITICAL' : 'HIGH';
  } else if (healthScore < 70 || consecutiveAbsenceCount >= 1) {
    attentionLevel = 'MODERATE';
  }

  // Priority
  const priorityResult = evaluatePriority({
    severityScore: 100 - healthScore,
    impactedCount: consecutiveAbsenceCount || 1,
    consecutiveOccurrences: recordedWeeks.length,
    isUrgentCareNeeded: consecutiveAbsenceCount >= 3,
  });

  // Confidence
  const confidenceResult = evaluateConfidence({
    recordCount: studentGrades.length,
    periodDurationLessons: recordedWeeks.length,
    hasRecentData: recordedWeeks.length > 0,
    missingDataGapsCount: 100 - recordCompletenessRate > 25 ? 2 : 0,
  });

  // Limitations
  const limitations: string[] = [];
  if (recordedWeeks.length < SIB_CONFIG.sufficiency.minLessonsForLongTermTrend) {
    limitations.push(`Analysis is limited to ${recordedWeeks.length} recorded lessons; long-term seasonal trends require more data.`);
  }
  if (visitors.length === 0) {
    limitations.push('Visitor progression score uses neutral weighting as no visitors are registered in this class.');
  }

  const explanation: ScoreExplanation = {
    targetId: classProfile.id,
    targetName: classProfile.className,
    scoreName: 'Class Health Score',
    finalScore: healthScore,
    maxScore: 100,
    calculationFormula: 'Health = (Attendance × 30%) + (Trend × 20%) + (Retention × 15%) + (Visitor Progression × 10%) + (Follow-Up × 15%) + (Completeness × 10%)',
    components,
    positiveContributors: positiveDevelopments,
    negativeContributors: concerns,
    trend: trendAnalysis.direction,
    confidence: confidenceResult.level,
    confidenceReason: confidenceResult.reason,
    limitations,
    evidenceIds: [`class_${classProfile.id}_grades`, `class_${classProfile.id}_roster`],
    recommendedAction: concerns.length > 0
      ? `Review the ${concerns.length} identified concern(s), starting with: ${concerns[0]}`
      : 'Maintain current teaching, attendance, and follow-up standards.',
    comparisonSummary: trendAnalysis.explanation,
  };

  return {
    classId: classProfile.id,
    className: classProfile.className,
    department: classProfile.department,
    quarterNumber,
    healthScore,
    attendanceRate,
    attendanceTrend: trendAnalysis,
    studentRetentionRate: retentionRate,
    visitorProgressionRate: visitorRate,
    followUpCompletionRate: followUpRate,
    recordCompletenessRate,
    totalStudents: students.length,
    totalVisitors: visitors.length,
    activeStudentsPresent: activeStudents.length,
    registeredClassMembers: members.length,
    consecutiveAbsenceCount,
    attentionLevel,
    priority: priorityResult.level,
    confidence: confidenceResult.level,
    explanation,
    positiveDevelopments,
    concerns,
  };
}
