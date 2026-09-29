import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  ClassProfile,
  VisitationCandidate,
  VisitationPriority,
  VisitationStatus,
  VisitationAssignmentRecord,
  ClassFollowUpReportRecord
} from '../types';
import { getConsecutiveAbsences } from './calculations';

export const VISITATION_TARGET_PER_CLASS_PER_WEEK = 3;
export const VISITATION_MAX_PER_CLASS_PER_WEEK = 4;
export const VISITATION_COOLDOWN_WEEKS = 4;

/**
 * Checks if a member has a completed visit record within the last 4 weeks.
 * Returns cooldown status and details.
 */
export function getMemberVisitationCooldown(
  memberId: string,
  currentWeek: number,
  absenceLogs: AbsenceLogRecord[] = [],
  visitationAssignments: Record<string, VisitationAssignmentRecord> = {}
): {
  isInCooldown: boolean;
  cooldownWeeksRemaining: number;
  lastVisitedWeek?: number;
  lastVisitedDate?: string;
} {
  // Check completed visits from absence logs (contactMethod === 'PASTORAL_VISIT')
  const completedLogs = absenceLogs.filter(l => 
    l.memberId === memberId && 
    (l.contactMethod === 'PASTORAL_VISIT' || (l as any).contactMethod === 'IN_PERSON')
  );

  // Also check assignments with status === 'COMPLETED'
  const completedAssignments = Object.values(visitationAssignments).filter(a =>
    a.memberId === memberId && a.status === 'COMPLETED'
  );

  let lastWeek: number | undefined;
  let lastDate: string | undefined;

  for (const log of completedLogs) {
    if (log.weekNumber && (lastWeek === undefined || log.weekNumber > lastWeek)) {
      lastWeek = log.weekNumber;
      lastDate = log.loggedAt || log.decisionDate;
    }
  }

  for (const ass of completedAssignments) {
    if (ass.weekNumber && (lastWeek === undefined || ass.weekNumber > lastWeek)) {
      lastWeek = ass.weekNumber;
      lastDate = ass.completedAt || ass.updatedAt;
    }
  }

  if (lastWeek === undefined) {
    return {
      isInCooldown: false,
      cooldownWeeksRemaining: 0
    };
  }

  // 4-Week Cooldown: If currentWeek is within lastWeek + 4
  const cooldownEndWeek = lastWeek + VISITATION_COOLDOWN_WEEKS;
  const isInCooldown = currentWeek <= cooldownEndWeek;
  const cooldownWeeksRemaining = Math.max(0, cooldownEndWeek - currentWeek);

  return {
    isInCooldown,
    cooldownWeeksRemaining,
    lastVisitedWeek: lastWeek,
    lastVisitedDate: lastDate
  };
}

/**
 * Evaluates weekly visitation eligibility and priority for a single member.
 */
export function evaluateMemberVisitationEligibility(
  member: Member,
  currentWeek: number,
  grades: WeeklyGradeRecord[] = [],
  absenceLogs: AbsenceLogRecord[] = [],
  visitationAssignments: Record<string, VisitationAssignmentRecord> = {}
): VisitationCandidate | null {
  if (member.status === 'LEFT_CLASS') return null;

  const consecutiveWeeksAbsent = getConsecutiveAbsences(
    member.id,
    currentWeek,
    grades,
    member.firstLessonWeek || 1
  );

  // Present or not absent -> not eligible
  if (consecutiveWeeksAbsent <= 0) return null;

  // Determine priority
  let priority: VisitationPriority;
  let priorityRank: 1 | 2 | 3;
  let eligibilityReason: string;

  if (consecutiveWeeksAbsent >= 3) {
    priority = 'HIGH';
    priorityRank = 1;
    eligibilityReason = `${consecutiveWeeksAbsent} consecutive weeks absent (Highest Priority)`;
  } else if (consecutiveWeeksAbsent === 2) {
    priority = 'MEDIUM';
    priorityRank = 2;
    eligibilityReason = '2 consecutive weeks absent (Second Priority)';
  } else {
    priority = 'LOW';
    priorityRank = 3;
    eligibilityReason = '1 week absent (Lower Priority / Monitored)';
  }

  // Check 4-week cooldown
  const cooldown = getMemberVisitationCooldown(member.id, currentWeek, absenceLogs, visitationAssignments);

  // Check existing assignment for this week
  const assignmentKey = `${member.classId || ''}_w${currentWeek}_m${member.id}`;
  const existingAssignment = Object.values(visitationAssignments).find(a =>
    a.memberId === member.id && a.weekNumber === currentWeek
  );

  return {
    memberId: member.id,
    fullName: member.fullName,
    phone: member.phone || '',
    address: member.address || '',
    memberType: member.memberType,
    classId: member.classId || '',
    consecutiveWeeksAbsent,
    priority,
    priorityRank,
    eligibilityReason,
    lastVisitedDate: cooldown.lastVisitedDate,
    lastVisitedWeek: cooldown.lastVisitedWeek,
    isInCooldown: cooldown.isInCooldown,
    cooldownWeeksRemaining: cooldown.cooldownWeeksRemaining,
    assignedStaffId: existingAssignment?.assignedStaffId,
    assignedStaffName: existingAssignment?.assignedStaffName,
    assignedStaffRole: existingAssignment?.assignedStaffRole,
    assignedStaffPhone: existingAssignment?.assignedStaffPhone,
    visitStatus: existingAssignment?.status || 'PENDING',
    notes: existingAssignment?.outcome || undefined
  };
}

/**
 * Computes the prioritized visitation candidates for a class for a specific week.
 * Applies the 4-week cooldown filter, deterministic priority sorting, and 3-4 weekly cap.
 */
export function getClassWeeklyVisitationCandidates(
  members: Member[],
  currentWeek: number,
  grades: WeeklyGradeRecord[] = [],
  absenceLogs: AbsenceLogRecord[] = [],
  visitationAssignments: Record<string, VisitationAssignmentRecord> = {},
  options?: {
    includeCooldown?: boolean;
    maxCap?: number;
  }
): {
  candidates: VisitationCandidate[];
  totalEligibleBeforeCap: number;
  excludedByCooldownCount: number;
} {
  const includeCooldown = options?.includeCooldown ?? false;
  const maxCap = options?.maxCap ?? VISITATION_MAX_PER_CLASS_PER_WEEK;

  const allEvaluated: VisitationCandidate[] = [];
  let excludedByCooldownCount = 0;

  for (const member of members) {
    const candidate = evaluateMemberVisitationEligibility(
      member,
      currentWeek,
      grades,
      absenceLogs,
      visitationAssignments
    );

    if (candidate) {
      if (candidate.isInCooldown && !includeCooldown) {
        excludedByCooldownCount++;
      } else {
        allEvaluated.push(candidate);
      }
    }
  }

  // Deterministic sorting:
  // 1. Priority Rank (1 = Highest, 2 = Medium, 3 = Low)
  // 2. Longest consecutive absences descending
  // 3. Member full name ascending
  allEvaluated.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    if (b.consecutiveWeeksAbsent !== a.consecutiveWeeksAbsent) {
      return b.consecutiveWeeksAbsent - a.consecutiveWeeksAbsent;
    }
    return a.fullName.localeCompare(b.fullName);
  });

  const totalEligibleBeforeCap = allEvaluated.length;
  const cappedCandidates = allEvaluated.slice(0, maxCap);

  return {
    candidates: cappedCandidates,
    totalEligibleBeforeCap,
    excludedByCooldownCount
  };
}

/**
 * Generates an authoritative follow-up & visitation summary for a single class.
 */
export function computeClassFollowUpSummary(
  classProfile: ClassProfile,
  members: Member[],
  currentWeek: number,
  quarterNumber: number,
  grades: WeeklyGradeRecord[] = [],
  absenceLogs: AbsenceLogRecord[] = [],
  visitationAssignments: Record<string, VisitationAssignmentRecord> = {}
): ClassFollowUpReportRecord {
  const classMembers = members.filter(m => m.classId === classProfile.id && m.status !== 'LEFT_CLASS');
  const activeWeekGrades = grades.filter(g => g.classId === classProfile.id && g.weekNumber === currentWeek);

  let presentCount = 0;
  let absentCount = 0;

  for (const member of classMembers) {
    const grade = activeWeekGrades.find(g => g.memberId === member.id);
    if (grade && grade.attendance === 'PRESENT') {
      presentCount++;
    } else {
      absentCount++;
    }
  }

  // Count members requiring follow up (absent for 1+ weeks)
  let membersRequiringFollowUp = 0;
  for (const member of classMembers) {
    const weeksAbsent = getConsecutiveAbsences(member.id, currentWeek, grades, member.firstLessonWeek || 1);
    if (weeksAbsent >= 1) {
      membersRequiringFollowUp++;
    }
  }

  // Visitation candidates not in cooldown
  const { candidates, totalEligibleBeforeCap } = getClassWeeklyVisitationCandidates(
    classMembers,
    currentWeek,
    grades,
    absenceLogs,
    visitationAssignments,
    { includeCooldown: false, maxCap: VISITATION_MAX_PER_CLASS_PER_WEEK }
  );
  const membersRequiringVisitation = totalEligibleBeforeCap;

  // Completed follow-ups this week
  const weekAbsenceLogs = absenceLogs.filter(l => l.classId === classProfile.id && l.weekNumber === currentWeek);
  const followUpCompleted = weekAbsenceLogs.length;

  // Completed visits this week
  const completedVisitsLogs = weekAbsenceLogs.filter(l => 
    l.contactMethod === 'PASTORAL_VISIT' || (l as any).contactMethod === 'IN_PERSON'
  );
  const completedVisitsAssignments = Object.values(visitationAssignments).filter(a =>
    a.classId === classProfile.id && a.weekNumber === currentWeek && a.status === 'COMPLETED'
  );
  const visitationCompleted = Math.max(completedVisitsLogs.length, completedVisitsAssignments.length);

  const pendingFollowUp = Math.max(0, membersRequiringFollowUp - followUpCompleted);
  const pendingVisitation = Math.max(0, candidates.length - visitationCompleted);

  // Check if class has an existing submitted report in profile
  const existingReport = classProfile.followUpReports?.[`${classProfile.id}_q${quarterNumber}_w${currentWeek}`];

  return {
    id: `${classProfile.id}_q${quarterNumber}_w${currentWeek}`,
    classId: classProfile.id,
    className: classProfile.className,
    department: classProfile.department,
    quarterNumber,
    weekNumber: currentWeek,
    submittedAt: existingReport?.submittedAt || new Date().toISOString(),
    submittedBy: existingReport?.submittedBy || classProfile.secretaryName || 'Class Secretary',
    totalClassMembers: classMembers.length,
    present: presentCount,
    absent: absentCount,
    membersRequiringFollowUp,
    membersRequiringVisitation,
    followUpCompleted,
    visitationCompleted,
    pendingFollowUp,
    pendingVisitation,
    status: existingReport?.status || 'DRAFT',
    notes: existingReport?.notes
  };
}

/**
 * Computes Cross-Class Follow-Up Intelligence derived strictly from real application data.
 */
export function computeFollowUpIntelligence(
  classes: ClassProfile[],
  allMembers: Member[],
  currentWeek: number,
  quarterNumber: number,
  allGrades: WeeklyGradeRecord[] = [],
  allAbsenceLogs: AbsenceLogRecord[] = []
): {
  classWithHighestNeed: { className: string; department: string; count: number } | null;
  classWithMostPersistentAbsences: { className: string; department: string; count: number } | null;
  immediateVisitationRequired: VisitationCandidate[];
  overdueVisitsCount: number;
  classesWithCompletedWeeklyVisitation: string[];
  classesWithOutstandingFollowUp: Array<{ className: string; department: string; pending: number }>;
  peopleFollowedUpThisWeek: number;
  visitationsCompletedThisWeek: number;
  returnedAfterFollowUp: number;
  totalMembersNeedingFollowUp: number;
  totalMembersNeedingVisitation: number;
  overallFollowUpCompletionRate: number;
} {
  const classSummaries = classes.map(cls =>
    computeClassFollowUpSummary(
      cls,
      allMembers,
      currentWeek,
      quarterNumber,
      allGrades,
      allAbsenceLogs,
      cls.visitationAssignments || {}
    )
  );

  // Class with highest follow-up need
  let highestNeedClass: { className: string; department: string; count: number } | null = null;
  for (const summary of classSummaries) {
    if (!highestNeedClass || summary.membersRequiringFollowUp > highestNeedClass.count) {
      if (summary.membersRequiringFollowUp > 0) {
        highestNeedClass = {
          className: summary.className,
          department: summary.department,
          count: summary.membersRequiringFollowUp
        };
      }
    }
  }

  // Class with most persistent absences (3+ weeks)
  const class3PlusCounts: Record<string, { className: string; department: string; count: number }> = {};
  const immediateVisitationList: VisitationCandidate[] = [];

  for (const member of allMembers) {
    if (member.status === 'LEFT_CLASS') continue;
    const cid = member.classId || 'unassigned';
    const cls = classes.find(c => c.id === cid);
    const candidate = evaluateMemberVisitationEligibility(
      member,
      currentWeek,
      allGrades,
      allAbsenceLogs,
      cls?.visitationAssignments || {}
    );

    if (candidate) {
      if (candidate.priorityRank === 1 && !candidate.isInCooldown) {
        immediateVisitationList.push(candidate);
      }
      if (candidate.consecutiveWeeksAbsent >= 3) {
        if (!class3PlusCounts[cid]) {
          class3PlusCounts[cid] = {
            className: cls?.className || cid,
            department: cls?.department || 'General',
            count: 0
          };
        }
        class3PlusCounts[cid].count++;
      }
    }
  }

  let mostPersistentClass: { className: string; department: string; count: number } | null = null;
  for (const item of Object.values(class3PlusCounts)) {
    if (!mostPersistentClass || item.count > mostPersistentClass.count) {
      if (item.count > 0) {
        mostPersistentClass = item;
      }
    }
  }

  // Classes that completed weekly visitation (visitationCompleted >= 3 or >= all needed)
  const classesWithCompletedWeeklyVisitation: string[] = [];
  const classesWithOutstandingFollowUp: Array<{ className: string; department: string; pending: number }> = [];

  let totalFollowUpNeeded = 0;
  let totalFollowUpDone = 0;
  let totalVisitsNeeded = 0;
  let totalVisitsDone = 0;

  for (const s of classSummaries) {
    totalFollowUpNeeded += s.membersRequiringFollowUp;
    totalFollowUpDone += s.followUpCompleted;
    totalVisitsNeeded += s.membersRequiringVisitation;
    totalVisitsDone += s.visitationCompleted;

    const target = Math.min(VISITATION_TARGET_PER_CLASS_PER_WEEK, s.membersRequiringVisitation);
    if (target > 0 && s.visitationCompleted >= target) {
      classesWithCompletedWeeklyVisitation.push(s.className);
    }

    if (s.pendingFollowUp > 0) {
      classesWithOutstandingFollowUp.push({
        className: s.className,
        department: s.department,
        pending: s.pendingFollowUp
      });
    }
  }

  // Count visits completed this week across all classes
  const weekLogs = allAbsenceLogs.filter(l => l.weekNumber === currentWeek);
  const peopleFollowedUpThisWeek = weekLogs.length;
  const visitationsCompletedThisWeek = weekLogs.filter(l => 
    l.contactMethod === 'PASTORAL_VISIT' || (l as any).contactMethod === 'IN_PERSON'
  ).length;

  // Returned after follow-up:
  // Members who had a follow-up log in week (currentWeek - 1) and are PRESENT in currentWeek
  let returnedAfterFollowUp = 0;
  if (currentWeek > 1) {
    const prevWeekLogs = allAbsenceLogs.filter(l => l.weekNumber === currentWeek - 1);
    const prevFollowedUpMemberIds = new Set(prevWeekLogs.map(l => l.memberId));

    for (const memId of prevFollowedUpMemberIds) {
      const currentGrade = allGrades.find(g => g.memberId === memId && g.weekNumber === currentWeek);
      if (currentGrade && currentGrade.attendance === 'PRESENT') {
        returnedAfterFollowUp++;
      }
    }
  }

  const overallFollowUpCompletionRate = totalFollowUpNeeded > 0
    ? Math.min(100, Math.round((totalFollowUpDone / totalFollowUpNeeded) * 100))
    : 100;

  return {
    classWithHighestNeed: highestNeedClass,
    classWithMostPersistentAbsences: mostPersistentClass,
    immediateVisitationRequired: immediateVisitationList,
    overdueVisitsCount: 0,
    classesWithCompletedWeeklyVisitation,
    classesWithOutstandingFollowUp,
    peopleFollowedUpThisWeek,
    visitationsCompletedThisWeek,
    returnedAfterFollowUp,
    totalMembersNeedingFollowUp: totalFollowUpNeeded,
    totalMembersNeedingVisitation: totalVisitsNeeded,
    overallFollowUpCompletionRate
  };
}
