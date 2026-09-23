/**
 * GOFAMINT SIB Student Attention & Pastoral Care Engine
 * 
 * Strict Principle:
 * Identifies students needing pastoral care based on repeated absences,
 * lateness, participation drop, and follow-up gaps.
 * Every classification explains WHY with verified facts.
 * Protects student privacy (no unnecessary personal details exposed).
 */

import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  ClassProfile
} from '../../types';

import { SIB_CONFIG } from '../config/sibConfig';
import {
  StudentAttentionItem,
  AttentionLevel,
  PriorityLevel,
  ConfidenceLevel
} from '../types/sibTypes';

import { evaluatePriority } from './priorityEngine';
import { evaluateConfidence } from './confidenceEngine';

export interface StudentAttentionInput {
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  classes: ClassProfile[];
}

export function computeStudentAttentionList(input: StudentAttentionInput): StudentAttentionItem[] {
  const { members, grades, absenceLogs, classes } = input;
  const classMap = new Map(classes.map(c => [c.id, c]));

  const attentionList: StudentAttentionItem[] = [];

  for (const member of members) {
    if (member.status === 'LEFT_CLASS') continue;

    const classProfile = classMap.get(member.classId || '');
    const memberGrades = grades
      .filter(g => g.memberId === member.id && !g.isNoRecordWeek)
      .sort((a, b) => a.weekNumber - b.weekNumber);

    const memberAbsences = absenceLogs
      .filter(a => a.memberId === member.id)
      .sort((a, b) => b.weekNumber - a.weekNumber);

    // 1. Calculate consecutive absences from recent grade records
    let currentStreak = 0;
    const recentPattern: Array<'PRESENT' | 'ABSENT' | 'EXEMPT' | 'UNRECORDED'> = [];

    // Look at last 6 lessons
    const maxWeek = memberGrades.length > 0 ? Math.max(...memberGrades.map(g => g.weekNumber)) : 0;
    const startWindow = Math.max(1, maxWeek - 5);

    for (let w = maxWeek; w >= startWindow; w--) {
      const g = memberGrades.find(record => record.weekNumber === w);
      if (!g) {
        recentPattern.unshift('UNRECORDED');
      } else {
        recentPattern.unshift(g.attendance);
      }
    }

    // Determine active trailing absence streak
    for (let i = memberGrades.length - 1; i >= 0; i--) {
      if (memberGrades[i].attendance === 'ABSENT') {
        currentStreak++;
      } else if (memberGrades[i].attendance === 'PRESENT' || memberGrades[i].attendance === 'EXEMPT') {
        break;
      }
    }

    // Also consider member's stored consecutive absences if grades list is partial
    const effectiveStreak = Math.max(currentStreak, member.consecutiveAbsences || 0);

    // 2. Attendance rate
    const attendedCount = memberGrades.filter(g => g.attendance === 'PRESENT').length;
    const totalEligible = memberGrades.filter(g => g.attendance === 'PRESENT' || g.attendance === 'ABSENT').length;
    const overallRate = totalEligible > 0 ? Math.round((attendedCount / totalEligible) * 1000) / 10 : 100;

    // 3. Follow-up status
    const recentLog = memberAbsences[0];
    const hasRecentFollowUp = !!recentLog && !!recentLog.decisionMade;

    // 4. Determine Attention Level & Reasons
    const contributingFactors: string[] = [];
    let primaryReason = 'Routine student monitoring';
    let riskScore = 10;

    if (effectiveStreak >= 3) {
      primaryReason = `Critical absence: ${effectiveStreak} consecutive lessons missed.`;
      contributingFactors.push(`Missed ${effectiveStreak} consecutive lessons.`);
      riskScore += 60;
    } else if (effectiveStreak === 2) {
      primaryReason = 'Repeated absence: 2 consecutive lessons missed.';
      contributingFactors.push('Missed 2 consecutive lessons.');
      riskScore += 40;
    }

    if (overallRate < 60 && totalEligible >= 3) {
      contributingFactors.push(`Low cumulative attendance rate (${overallRate}%).`);
      riskScore += 25;
    }

    if (effectiveStreak >= 2 && !hasRecentFollowUp) {
      contributingFactors.push('No pastoral follow-up record logged for prolonged absence.');
      riskScore += 25;
    }

    // Filter to only students requiring attention
    if (effectiveStreak < 2 && overallRate >= 70) {
      continue;
    }

    let attentionLevel: AttentionLevel = 'LOW';
    if (riskScore >= 75 || effectiveStreak >= 3) {
      attentionLevel = 'CRITICAL';
    } else if (riskScore >= 50 || effectiveStreak === 2) {
      attentionLevel = 'HIGH';
    } else if (riskScore >= 30 || overallRate < 70) {
      attentionLevel = 'MODERATE';
    }

    // Recommended action
    let recommendedCareAction = 'Check in with student during Sunday Bible School.';
    if (effectiveStreak >= 3) {
      recommendedCareAction = 'Immediate pastoral visitation and executive follow-up recommended.';
    } else if (effectiveStreak === 2) {
      recommendedCareAction = 'Phone call or WhatsApp follow-up by Class Secretary recommended.';
    } else if (!hasRecentFollowUp) {
      recommendedCareAction = 'Log pastoral contact in welfare follow-up console.';
    }

    const priorityResult = evaluatePriority({
      severityScore: riskScore,
      impactedCount: 1,
      consecutiveOccurrences: effectiveStreak,
      isUrgentCareNeeded: effectiveStreak >= 3,
    });

    const confidenceResult = evaluateConfidence({
      recordCount: memberGrades.length,
      periodDurationLessons: memberGrades.length,
      hasRecentData: memberGrades.length > 0,
    });

    attentionList.push({
      studentId: member.id,
      fullName: member.fullName,
      classId: member.classId || '',
      className: classProfile?.className || 'Assigned Class',
      department: classProfile?.department || member.department || 'General',
      memberType: member.memberType,
      consecutiveAbsences: effectiveStreak,
      recentAttendancePattern: recentPattern,
      overallAttendanceRate: overallRate,
      hasRecentFollowUp,
      lastFollowUpDate: recentLog?.loggedAt,
      lastFollowUpOutcome: recentLog?.escalationDecision,
      attentionLevel,
      priority: priorityResult.level,
      confidence: confidenceResult.level,
      whyBreakdown: {
        primaryReason,
        contributingFactors,
        riskScore: Math.min(100, riskScore),
      },
      recommendedCareAction,
    });
  }

  // Sort by risk score / attention level descending
  return attentionList.sort((a, b) => b.whyBreakdown.riskScore - a.whyBreakdown.riskScore);
}
