/**
 * GOFAMINT SIB School Overview Intelligence Coordinator
 * 
 * Assembles school-wide intelligence deterministically from raw records.
 * Integrates Class Health, Student Attention, Visitor Intelligence,
 * Follow-up, Department Intelligence, Anomalies, and the Action Center.
 */

import { SIBRawDataset, getMembersForClass, getGradesForClass, getAbsenceLogsForClass } from '../data/sibDataAccess';
import {
  SIBOverviewData,
  ClassHealthResult,
  DepartmentIntelResult,
  VisitorIntelligenceResult,
  FollowUpIntelligenceResult,
  ActionItem,
  SIBDataQualityResult,
  ScoreExplanation,
  ScoreComponentBreakdown,
  PriorityLevel
} from '../types/sibTypes';

import { SIB_CONFIG } from '../config/sibConfig';
import { calculateClassHealth } from './classHealthEngine';
import { computeStudentAttentionList } from './studentAttentionEngine';
import { detectAnomalies } from './anomalyEngine';
import { analyzeTrend } from './trendEngine';
import { SIBEvidenceRegistry } from './evidenceEngine';
import { calculateAttendanceRate, calculateVisitorReturnRate, calculateFollowUpRate } from './metricEngine';

export function computeSchoolOverview(dataset: SIBRawDataset): SIBOverviewData {
  const { classes, members, grades, absenceLogs, year, quarterNumber } = dataset;

  // 1. Compute Class Health for each class
  const classHealthResults: ClassHealthResult[] = classes.map(cls => {
    const classMembers = getMembersForClass(members, cls.id);
    const classGrades = getGradesForClass(grades, cls.id);
    const classAbsences = getAbsenceLogsForClass(absenceLogs, cls.id);

    const result = calculateClassHealth({
      classProfile: cls,
      members: classMembers,
      grades: classGrades,
      absenceLogs: classAbsences,
      quarterNumber,
    });

    // Register evidence in SIB registry
    SIBEvidenceRegistry.createClassHealthEvidence(result);
    return result;
  });

  // Sort classes by health score descending
  const sortedClasses = [...classHealthResults].sort((a, b) => b.healthScore - a.healthScore);
  const strongestClasses = sortedClasses.slice(0, 3);
  const classesNeedingAttention = sortedClasses.filter(c => c.attentionLevel === 'CRITICAL' || c.attentionLevel === 'HIGH');

  // 2. Student Attention List
  const studentAttentionItems = computeStudentAttentionList({
    members,
    grades,
    absenceLogs,
    classes,
  });

  studentAttentionItems.forEach(item => {
    SIBEvidenceRegistry.createStudentAttentionEvidence(item);
  });

  const criticalAttentionCount = studentAttentionItems.filter(i => i.attentionLevel === 'CRITICAL').length;
  const highAttentionCount = studentAttentionItems.filter(i => i.attentionLevel === 'HIGH').length;
  const moderateAttentionCount = studentAttentionItems.filter(i => i.attentionLevel === 'MODERATE').length;

  // 3. School-wide Attendance Aggregation
  const studentMembers = members.filter(m => m.memberType === 'STUDENT');
  const studentGrades = grades.filter(g => studentMembers.some(s => s.id === g.memberId));
  const presentCount = studentGrades.filter(g => g.attendance === 'PRESENT').length;
  const eligibleCount = studentGrades.filter(g => g.attendance === 'PRESENT' || g.attendance === 'ABSENT').length;
  const schoolAttendanceMetric = calculateAttendanceRate(presentCount, eligibleCount);

  // Lesson by lesson trend
  const recordedWeeks = Array.from(new Set(grades.map(g => g.weekNumber))).sort((a, b) => a - b);
  let schoolAttendanceTrend = analyzeTrend({
    currentValue: schoolAttendanceMetric.rate,
    previousValue: null,
    periodLabel: `Quarter ${quarterNumber}`,
    previousPeriodLabel: 'Previous Period',
  });

  if (recordedWeeks.length >= 2) {
    const latestWeek = recordedWeeks[recordedWeeks.length - 1];
    const prevWeek = recordedWeeks[recordedWeeks.length - 2];
    const latestPresent = studentGrades.filter(g => g.weekNumber === latestWeek && g.attendance === 'PRESENT').length;
    const latestTotal = studentGrades.filter(g => g.weekNumber === latestWeek && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT')).length;
    const prevPresent = studentGrades.filter(g => g.weekNumber === prevWeek && g.attendance === 'PRESENT').length;
    const prevTotal = studentGrades.filter(g => g.weekNumber === prevWeek && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT')).length;

    const latestRate = latestTotal > 0 ? Math.round((latestPresent / latestTotal) * 1000) / 10 : 0;
    const prevRate = prevTotal > 0 ? Math.round((prevPresent / prevTotal) * 1000) / 10 : 0;

    schoolAttendanceTrend = analyzeTrend({
      currentValue: latestRate,
      previousValue: prevRate,
      periodLabel: `Lesson ${latestWeek}`,
      previousPeriodLabel: `Lesson ${prevWeek}`,
    });
  }

  // 4. Visitor Intelligence
  const visitors = members.filter(m => m.memberType === 'VISITOR');
  const returningVisitors = visitors.filter(v => (v.consecutiveVisits || 0) >= 2 || v.conversionStatus === 'APPROVED');
  const convertedStudents = members.filter(m => m.conversionStatus === 'APPROVED' || (m.convertedFromVisitorAtLesson && m.convertedFromVisitorAtLesson > 0));
  const consecutiveVisitCandidates = visitors.filter(v => (v.consecutiveVisits || 0) >= 3);
  const visitorsNeedingFollowUp = visitors.filter(v => (v.consecutiveVisits || 0) === 1);
  const totalEvangelismReferrals = members.reduce((sum, m) => sum + (m.evangelismReferralCount || 0), 0);

  const visitorReturnMetric = calculateVisitorReturnRate(returningVisitors.length, visitors.length);

  const visitorIntelligence: VisitorIntelligenceResult = {
    quarterNumber,
    totalVisitors: visitors.length,
    activeVisitors: visitors.filter(v => v.status !== 'LEFT_CLASS').length,
    returningVisitors: returningVisitors.length,
    returnRate: visitorReturnMetric.rate,
    convertedStudentsCount: convertedStudents.length,
    conversionRate: visitors.length > 0 ? Math.round((convertedStudents.length / visitors.length) * 1000) / 10 : 0,
    consecutiveVisitCandidatesCount: consecutiveVisitCandidates.length,
    visitorsRequiringFollowUp: visitorsNeedingFollowUp.length,
    evangelismReferralsCount: totalEvangelismReferrals,
    trend: analyzeTrend({
      currentValue: visitorReturnMetric.rate,
      previousValue: null,
      periodLabel: `Quarter ${quarterNumber}`,
      previousPeriodLabel: 'Previous Quarter',
    }),
    confidence: visitors.length >= 5 ? 'HIGH' : visitors.length > 0 ? 'MEDIUM' : 'INSUFFICIENT_DATA',
    explanation: visitors.length > 0
      ? `${returningVisitors.length} of ${visitors.length} recorded visitors returned for subsequent lessons (${visitorReturnMetric.rate}% return rate).`
      : 'No visitors recorded in current quarter rosters.',
    evidence: {
      id: `evidence_visitors_q${quarterNumber}`,
      targetType: 'SCHOOL',
      targetId: `visitors_q${quarterNumber}`,
      metricName: 'Visitor Progression & Return Rate',
      calculatedValue: `${visitorReturnMetric.rate}%`,
      calculationFormula: 'Return Rate = (Returning Visitors ÷ Total Visitors) × 100',
      periodLabel: `Quarter ${quarterNumber}`,
      supportingRecordCount: visitors.length,
      confidence: visitors.length >= 5 ? 'HIGH' : 'MEDIUM',
      confidenceReason: `Verified from ${visitors.length} visitor profile records across ${classes.length} classes.`,
      limitations: ['Visitor return tracking depends on class secretary attendance marking.'],
    },
    classBreakdown: classes.map(c => {
      const cv = visitors.filter(v => v.classId === c.id);
      const cr = cv.filter(v => (v.consecutiveVisits || 0) >= 2 || v.conversionStatus === 'APPROVED').length;
      return {
        classId: c.id,
        className: c.className,
        visitorCount: cv.length,
        returnRate: cv.length > 0 ? Math.round((cr / cv.length) * 1000) / 10 : 0,
      };
    }),
  };

  // 5. Follow-Up Intelligence
  const requiredFollowUps = absenceLogs.filter(a => a.consecutiveWeeksAbsent >= 2).length;
  const completedFollowUps = absenceLogs.filter(a => a.consecutiveWeeksAbsent >= 2 && a.decisionMade).length;
  const followUpMetric = calculateFollowUpRate(completedFollowUps, requiredFollowUps);

  const urgencyCounts = {
    yellow: absenceLogs.filter(a => a.urgencyLevel === 'YELLOW').length,
    orange: absenceLogs.filter(a => a.urgencyLevel === 'ORANGE').length,
    red: absenceLogs.filter(a => a.urgencyLevel === 'RED').length,
    critical: absenceLogs.filter(a => a.urgencyLevel === 'CRITICAL').length,
  };

  const classesWithGaps = classes.map(cls => {
    const classAbs = absenceLogs.filter(a => a.classId === cls.id && a.consecutiveWeeksAbsent >= 2);
    const missing = classAbs.filter(a => !a.decisionMade).length;
    return { classId: cls.id, className: cls.className, missingCount: missing };
  }).filter(c => c.missingCount > 0);

  const followUpIntelligence: FollowUpIntelligenceResult = {
    quarterNumber,
    requiredFollowUps,
    completedFollowUps,
    completionRate: followUpMetric.rate,
    outstandingFollowUps: Math.max(0, requiredFollowUps - completedFollowUps),
    urgencyBreakdown: urgencyCounts,
    trend: analyzeTrend({
      currentValue: followUpMetric.rate,
      previousValue: null,
      periodLabel: `Quarter ${quarterNumber}`,
      previousPeriodLabel: 'Previous Quarter',
    }),
    classesWithGaps,
    confidence: requiredFollowUps > 0 ? 'HIGH' : 'MEDIUM',
    explanation: requiredFollowUps > 0
      ? `${completedFollowUps} of ${requiredFollowUps} mandatory pastoral follow-ups were completed (${followUpMetric.rate}%).`
      : 'No prolonged student absences were flagged for follow-up.',
    evidence: {
      id: `evidence_followup_q${quarterNumber}`,
      targetType: 'SCHOOL',
      targetId: `followup_q${quarterNumber}`,
      metricName: 'Pastoral Follow-Up Completion',
      calculatedValue: `${followUpMetric.rate}%`,
      calculationFormula: 'Completion Rate = (Executed Follow-ups ÷ Required Follow-ups) × 100',
      periodLabel: `Quarter ${quarterNumber}`,
      supportingRecordCount: absenceLogs.length,
      confidence: 'HIGH',
      confidenceReason: `Verified from ${absenceLogs.length} total absence care log records.`,
      limitations: ['Phone calls and in-person visits must be recorded in system to count towards verified completion.'],
    },
  };

  // 6. Department Intelligence
  const departmentNames = Array.from(new Set(classes.map(c => c.department || 'General')));
  const departmentResults: DepartmentIntelResult[] = departmentNames.map(deptName => {
    const deptClasses = classHealthResults.filter(c => (c.department || 'General') === deptName);
    const deptClassProfiles = classes.filter(c => (c.department || 'General') === deptName);
    const deptMembers = members.filter(m => deptClassProfiles.some(c => c.id === m.classId));
    const deptStudents = deptMembers.filter(m => m.memberType === 'STUDENT');
    const deptVisitors = deptMembers.filter(m => m.memberType === 'VISITOR');

    const avgAttendance = deptClasses.length > 0
      ? Math.round((deptClasses.reduce((sum, c) => sum + c.attendanceRate, 0) / deptClasses.length) * 10) / 10
      : 0;

    const avgHealth = deptClasses.length > 0
      ? Math.round(deptClasses.reduce((sum, c) => sum + c.healthScore, 0) / deptClasses.length)
      : 0;

    const sortedDeptClasses = [...deptClasses].sort((a, b) => b.healthScore - a.healthScore);
    const strongest = sortedDeptClasses[0]?.className || 'N/A';
    const attentionNeed = sortedDeptClasses[sortedDeptClasses.length - 1]?.className || 'N/A';

    const deptAttentionStudents = studentAttentionItems.filter(i => (i.department || 'General') === deptName).length;
    const deptFollowUpsRequired = absenceLogs.filter(a => deptClassProfiles.some(c => c.id === a.classId) && a.consecutiveWeeksAbsent >= 2).length;
    const deptFollowUpsCompleted = absenceLogs.filter(a => deptClassProfiles.some(c => c.id === a.classId) && a.consecutiveWeeksAbsent >= 2 && a.decisionMade).length;
    const deptFollowUpRate = deptFollowUpsRequired > 0 ? Math.round((deptFollowUpsCompleted / deptFollowUpsRequired) * 100) : 100;

    const positiveDevelopments: string[] = [];
    const concerns: string[] = [];
    if (avgAttendance >= 80) positiveDevelopments.push(`Healthy department attendance rate of ${avgAttendance}%.`);
    if (avgHealth >= 75) positiveDevelopments.push(`Strong composite department health score of ${avgHealth}%.`);
    if (deptAttentionStudents >= 3) concerns.push(`${deptAttentionStudents} students require pastoral attention.`);
    if (deptFollowUpRate < 60) concerns.push(`Follow-up completion is below target (${deptFollowUpRate}%).`);

    return {
      departmentName: deptName,
      classCount: deptClasses.length,
      totalStudents: deptStudents.length,
      totalVisitors: deptVisitors.length,
      averageAttendanceRate: avgAttendance,
      averageHealthScore: avgHealth,
      trend: analyzeTrend({
        currentValue: avgAttendance,
        previousValue: null,
        periodLabel: `Quarter ${quarterNumber}`,
        previousPeriodLabel: 'Previous Quarter',
      }),
      attentionStudentCount: deptAttentionStudents,
      followUpRate: deptFollowUpRate,
      confidence: deptClasses.length >= 2 ? 'HIGH' : 'MEDIUM',
      strongestClass: strongest,
      classRequiringAttention: attentionNeed,
      positiveDevelopments,
      concerns,
    };
  });

  // 7. Anomalies
  const anomalies = detectAnomalies({ classes, members, grades, absenceLogs });

  // 8. Overall School Health Score
  const avgClassHealth = classHealthResults.length > 0
    ? Math.round(classHealthResults.reduce((sum, c) => sum + c.healthScore, 0) / classHealthResults.length)
    : 70;

  const schoolHealthComponents: ScoreComponentBreakdown[] = [
    {
      label: 'Average Class Health',
      value: avgClassHealth,
      weight: 0.40,
      weightedContribution: Math.round(avgClassHealth * 0.40 * 10) / 10,
      status: avgClassHealth >= 75 ? 'STRONG' : avgClassHealth >= 60 ? 'ACCEPTABLE' : 'WEAK',
      explanation: `Calculated across ${classes.length} active Sunday School classes.`,
    },
    {
      label: 'School-Wide Attendance Rate',
      value: schoolAttendanceMetric.rate,
      weight: 0.30,
      weightedContribution: Math.round(schoolAttendanceMetric.rate * 0.30 * 10) / 10,
      status: schoolAttendanceMetric.rate >= 80 ? 'STRONG' : schoolAttendanceMetric.rate >= 60 ? 'ACCEPTABLE' : 'WEAK',
      explanation: `${schoolAttendanceMetric.rate}% overall student attendance.`,
    },
    {
      label: 'Pastoral Follow-Up Rate',
      value: followUpMetric.rate,
      weight: 0.20,
      weightedContribution: Math.round(followUpMetric.rate * 0.20 * 10) / 10,
      status: followUpMetric.rate >= 75 ? 'STRONG' : 'WEAK',
      explanation: `${followUpMetric.rate}% completion of required absence follow-up records.`,
    },
    {
      label: 'Visitor Return & Retention',
      value: visitorReturnMetric.rate,
      weight: 0.10,
      weightedContribution: Math.round(visitorReturnMetric.rate * 0.10 * 10) / 10,
      status: visitorReturnMetric.rate >= 50 ? 'STRONG' : 'ACCEPTABLE',
      explanation: `${visitorReturnMetric.rate}% visitor return rate.`,
    },
  ];

  const totalSchoolWeighted = schoolHealthComponents.reduce((sum, c) => sum + c.weightedContribution, 0);
  const schoolHealthScore = Math.min(100, Math.max(0, Math.round(totalSchoolWeighted)));

  const schoolHealthPositives: string[] = [];
  const schoolHealthNegatives: string[] = [];

  if (schoolAttendanceMetric.rate >= 75) schoolHealthPositives.push(`High attendance rate of ${schoolAttendanceMetric.rate}%.`);
  else schoolHealthNegatives.push(`Attendance rate of ${schoolAttendanceMetric.rate}% is below the 75% benchmark.`);

  if (followUpMetric.rate >= 75) schoolHealthPositives.push(`Reliable follow-up completion (${followUpMetric.rate}%).`);
  else if (requiredFollowUps > 0) schoolHealthNegatives.push(`Follow-up gap: ${requiredFollowUps - completedFollowUps} absences pending action.`);

  if (classesNeedingAttention.length === 0) schoolHealthPositives.push('All classes meet health baseline thresholds.');
  else schoolHealthNegatives.push(`${classesNeedingAttention.length} class(es) flagged as requiring attention.`);

  const schoolHealthExplanation: ScoreExplanation = {
    targetId: 'school_wide_health',
    targetName: 'GOFAMINT Sunday School',
    scoreName: 'Overall School Health Score',
    finalScore: schoolHealthScore,
    maxScore: 100,
    calculationFormula: 'School Health = (Avg Class Health × 40%) + (Attendance × 30%) + (Follow-Up × 20%) + (Visitor Return × 10%)',
    components: schoolHealthComponents,
    positiveContributors: schoolHealthPositives,
    negativeContributors: schoolHealthNegatives,
    trend: schoolAttendanceTrend.direction,
    confidence: classHealthResults.length >= 3 ? 'HIGH' : 'MEDIUM',
    confidenceReason: `Aggregated from ${classes.length} classes, ${members.length} members, and ${grades.length} grade entries.`,
    limitations: ['School health reflects current active quarter records and requires regular attendance synchronization.'],
    evidenceIds: classHealthResults.map(c => c.classId),
    recommendedAction: schoolHealthNegatives.length > 0 ? schoolHealthNegatives[0] : 'Maintain current church-wide attendance standards.',
  };

  // 9. Action Center Cards
  const actionCenter: ActionItem[] = [];

  if (criticalAttentionCount > 0) {
    actionCenter.push({
      id: 'action_critical_absences',
      category: 'URGENT',
      title: 'Critical Student Absences',
      subtitle: `${criticalAttentionCount} student(s) have missed 3+ consecutive lessons`,
      whyExplanation: 'Students with 3+ consecutive absences have a high probability of dropping out without immediate pastoral contact.',
      priority: 'CRITICAL',
      confidence: 'HIGH',
      impactedCount: criticalAttentionCount,
      targetPortal: 'CLASS_REGISTER',
      actionLabel: 'Open Welfare Follow-Up',
      evidenceId: 'evidence_student_attention',
    });
  }

  if (classesNeedingAttention.length > 0) {
    actionCenter.push({
      id: 'action_classes_attention',
      category: 'WATCH',
      title: 'Classes Requiring Directorate Oversight',
      subtitle: `${classesNeedingAttention.map(c => c.className).join(', ')} health scores require review`,
      whyExplanation: 'Composite metrics indicate attendance declines or incomplete follow-up in these classes.',
      priority: 'HIGH',
      confidence: 'HIGH',
      impactedCount: classesNeedingAttention.length,
      targetPortal: 'ADMIN',
      actionLabel: 'Inspect in Admin Portal',
      evidenceId: 'evidence_class_health',
    });
  }

  if (consecutiveVisitCandidates.length > 0) {
    actionCenter.push({
      id: 'action_visitor_conversion',
      category: 'POSITIVE',
      title: 'Eligible Visitors Ready for Transition',
      subtitle: `${consecutiveVisitCandidates.length} visitor(s) achieved 3+ consecutive Sunday visits`,
      whyExplanation: 'According to GOFAMINT Sunday School rules, visitors with 3 consecutive visits qualify for full student enrollment.',
      priority: 'MODERATE',
      confidence: 'HIGH',
      impactedCount: consecutiveVisitCandidates.length,
      targetPortal: 'ADMIN',
      actionLabel: 'Enrollment Officer Review',
      evidenceId: 'evidence_visitors',
    });
  }

  actionCenter.push({
    id: 'action_quarter_readiness',
    category: 'INFORMATION',
    title: `Quarter ${quarterNumber} Curriculum Active`,
    subtitle: `${classes.length} classes active with ${recordedWeeks.length} recorded lesson week(s)`,
    whyExplanation: 'Routine status report on Sunday Bible School curriculum coverage.',
    priority: 'LOW',
    confidence: 'HIGH',
    impactedCount: classes.length,
    evidenceId: 'evidence_quarter',
  });

  // 10. Data Quality Audit
  const expectedTotalGrades = Math.max(1, recordedWeeks.length * members.length);
  const dataQualityScore = Math.min(100, Math.round((grades.length / expectedTotalGrades) * 100));

  const dataQuality: SIBDataQualityResult = {
    quarterNumber,
    overallQualityScore: dataQualityScore,
    totalClassesEvaluated: classes.length,
    classesWithCompleteAttendance: classes.filter(c => {
      const cg = grades.filter(g => g.classId === c.id);
      return cg.length >= recordedWeeks.length;
    }).length,
    missingAttendanceWeeksCount: Math.max(0, classes.length * recordedWeeks.length - grades.length),
    totalGradesRecorded: grades.length,
    totalExpectedGrades: expectedTotalGrades,
    unrecordedGradesCount: Math.max(0, expectedTotalGrades - grades.length),
    missingFollowUpLogsCount: Math.max(0, requiredFollowUps - completedFollowUps),
    dataGaps: classesWithGaps.map(g => ({
      classId: g.classId,
      className: g.className,
      description: `${g.missingCount} absence follow-up records pending completion.`,
      severity: g.missingCount >= 3 ? 'HIGH' : 'MEDIUM',
    })),
    sufficiencyStatus: grades.length >= 10 ? 'SUFFICIENT' : 'MODERATE',
    limitationsNotice: grades.length < 10
      ? 'Limited historical grade volume: continue submitting weekly registers to enhance analytical accuracy.'
      : 'Data volume is sufficient for reliable operational intelligence.',
  };

  // 11. Top Priority Selection
  let topPriorityTitle = 'Maintain Sunday School Excellence';
  let topPriorityDesc = 'All core Sunday School metrics are operating above baseline thresholds.';
  let topPriorityLevel: PriorityLevel = 'LOW';
  let topPriorityWhy = 'No urgent anomalies or critical absence patterns are currently active.';
  let topPriorityNext = 'Continue weekly attendance marking and curriculum distribution.';

  if (criticalAttentionCount > 0) {
    topPriorityTitle = `Pastoral Follow-Up for ${criticalAttentionCount} Prolonged Absence(s)`;
    topPriorityDesc = `${criticalAttentionCount} student(s) have been absent for 3 or more consecutive lessons without logged resolution.`;
    topPriorityLevel = 'CRITICAL';
    topPriorityWhy = 'Prolonged absence without contact is the primary cause of student disengagement.';
    topPriorityNext = 'Direct the General Secretary and relevant Class Secretaries to execute and log pastoral care contact.';
  } else if (classesNeedingAttention.length > 0) {
    const target = classesNeedingAttention[0];
    topPriorityTitle = `Address Attendance Decline in ${target.className}`;
    topPriorityDesc = `${target.className} health score is ${target.healthScore}% with ${target.attendanceTrend.direction.toLowerCase()} attendance trend.`;
    topPriorityLevel = 'HIGH';
    topPriorityWhy = target.concerns[0] || 'Class performance has fallen below the department average.';
    topPriorityNext = 'Review class roster and consult with the class teacher in the Directorate Council.';
  }

  const topPriorityEvidence = SIBEvidenceRegistry.getEvidence('evidence_followup_q' + quarterNumber) || {
    id: 'top_priority_evidence',
    targetType: 'SCHOOL',
    targetId: 'top_priority',
    metricName: 'Top Leadership Priority',
    calculatedValue: topPriorityLevel,
    calculationFormula: 'Calculated from highest urgency score in Priority Engine',
    periodLabel: `Quarter ${quarterNumber}`,
    supportingRecordCount: criticalAttentionCount,
    confidence: 'HIGH',
    confidenceReason: 'Derived directly from verified attendance and absence records.',
    limitations: [],
  };

  return {
    quarterNumber,
    ruleVersion: SIB_CONFIG.version,
    calculatedAt: new Date().toISOString(),
    schoolHealthScore,
    schoolHealthExplanation,
    attendance: {
      currentRate: schoolAttendanceMetric.rate,
      previousRate: schoolAttendanceTrend.previousValue,
      trend: schoolAttendanceTrend,
      totalPresent: presentCount,
      totalEligible: eligibleCount,
    },
    studentAttention: {
      totalRequiringAttention: studentAttentionItems.length,
      criticalCount: criticalAttentionCount,
      highCount: highAttentionCount,
      moderateCount: moderateAttentionCount,
      items: studentAttentionItems,
    },
    classes: {
      totalClasses: classes.length,
      strongestClasses,
      classesNeedingAttention,
      allClassHealth: sortedClasses,
    },
    departments: departmentResults,
    visitors: visitorIntelligence,
    followUp: followUpIntelligence,
    anomalies,
    actionCenter,
    dataQuality,
    positiveDevelopments: schoolHealthPositives,
    topPriority: {
      title: topPriorityTitle,
      description: topPriorityDesc,
      priority: topPriorityLevel,
      confidence: 'HIGH',
      whyExplanation: topPriorityWhy,
      evidence: topPriorityEvidence,
      recommendedNextStep: topPriorityNext,
    },
  };
}
