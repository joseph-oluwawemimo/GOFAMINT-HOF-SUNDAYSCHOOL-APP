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
import { getConsecutiveAbsences } from './calculations.js';

export const VISITATION_TARGET_PER_CLASS_PER_WEEK = 3;
export const VISITATION_MAX_PER_CLASS_PER_WEEK = 4;
export const VISITATION_COOLDOWN_WEEKS = 4;

/** Merge snapshots without letting an old device undo a completed visit. */
export function mergeVisitationAssignments(
  ...snapshots: Array<Record<string, VisitationAssignmentRecord> | undefined>
): Record<string, VisitationAssignmentRecord> {
  const merged: Record<string, VisitationAssignmentRecord> = {};
  for (const snapshot of snapshots) {
    for (const [id, incoming] of Object.entries(snapshot || {})) {
      const existing = merged[id];
      if (!existing) {
        merged[id] = incoming;
        continue;
      }
      const existingTime = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
      const incomingTime = Date.parse(incoming.updatedAt || incoming.createdAt || '') || 0;
      const newest = incomingTime >= existingTime ? incoming : existing;
      const older = newest === incoming ? existing : incoming;
      merged[id] = {
        ...older,
        ...newest,
        selectedSlotIndex: existing.selectedSlotIndex ?? incoming.selectedSlotIndex,
        status: existing.status === 'COMPLETED' || incoming.status === 'COMPLETED' ? 'COMPLETED' : newest.status,
        completedAt: newest.completedAt || older.completedAt
      };
    }
  }
  return merged;
}

export function getWeeklyVisitationAssignments(
  assignments: Record<string, VisitationAssignmentRecord>,
  weekNumber: number,
  quarterNumber?: number
): VisitationAssignmentRecord[] {
  return Object.values(mergeVisitationAssignments(...Object.values(assignments)
    .filter(record => record.weekNumber === weekNumber &&
      (quarterNumber === undefined || record.quarterNumber === undefined || record.quarterNumber === quarterNumber))
    .map(record => ({ [record.memberId]: record }))))
    .sort((a, b) => (a.selectedSlotIndex || 999) - (b.selectedSlotIndex || 999) || a.id.localeCompare(b.id));
}

/** Persist all selected people together before any single slot can be completed. */
export function freezeWeeklyVisitationSlate(
  classId: string,
  quarterNumber: number,
  weekNumber: number,
  candidates: VisitationCandidate[],
  assignments: Record<string, VisitationAssignmentRecord>,
  now = new Date().toISOString()
): Record<string, VisitationAssignmentRecord> {
  const next = { ...assignments };
  for (const [index, candidate] of candidates.slice(0, VISITATION_MAX_PER_CLASS_PER_WEEK).entries()) {
    const existing = getWeeklyVisitationAssignments(assignments, weekNumber, quarterNumber).find(record => record.classId === classId && record.memberId === candidate.memberId);
    if (existing?.selectedSlotIndex !== undefined) continue;
    const id = existing?.id || `${classId}_q${quarterNumber}_w${weekNumber}_m${candidate.memberId}`;
    next[id] = {
      id, classId, quarterNumber, weekNumber,
      memberId: candidate.memberId,
      memberName: candidate.fullName,
      assignedStaffName: '',
      priority: candidate.priority,
      slotType: candidate.slotType,
      status: 'PENDING',
      createdAt: now,
      ...existing,
      selectedSlotIndex: index + 1,
      updatedAt: now
    };
  }
  return next;
}

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
    l.weekNumber <= currentWeek &&
    (l.contactMethod === 'PASTORAL_VISIT' || (l as any).contactMethod === 'IN_PERSON')
  );

  // Also check assignments with status === 'COMPLETED'
  const completedAssignments = Object.values(visitationAssignments).filter(a =>
    a.memberId === memberId && a.status === 'COMPLETED' && a.weekNumber <= currentWeek
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
  // One-time visitors are excluded from automatic visitation selection
  if (member.isOneTimeVisitor) return null;

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
    slotType: 'PRIORITY_NEED',
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
 * Follows the 4-slot operational visitation rule:
 * - Up to 2 spots for Priority Need (urgent absentees: 3+ weeks, 2 weeks, 1 week)
 * - 1 spot for Consistent Student Encouragement (present for a long time)
 * - 1 spot for Newly Onboarded Student (joined last week)
 * Applies the 4-week cooldown filter, one-time visitor exclusion, and 3-4 weekly cap.
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
    purePrioritySort?: boolean;
    quarterNumber?: number;
  }
): {
  candidates: VisitationCandidate[];
  totalEligibleBeforeCap: number;
  excludedByCooldownCount: number;
} {
  const includeCooldown = options?.includeCooldown ?? false;
  const maxCap = Math.max(0, Math.min(VISITATION_MAX_PER_CLASS_PER_WEEK, options?.maxCap ?? VISITATION_MAX_PER_CLASS_PER_WEEK));
  const purePrioritySort = options?.purePrioritySort ?? false;
  if (options?.quarterNumber !== undefined) {
    visitationAssignments = Object.fromEntries(Object.entries(visitationAssignments).filter(([, record]) =>
      record.quarterNumber === undefined || record.quarterNumber === options.quarterNumber));
  }

  const allEvaluated: VisitationCandidate[] = [];
  let excludedByCooldownCount = 0;

  for (const member of members) {
    if (member.isOneTimeVisitor || member.status === 'LEFT_CLASS') {
      continue;
    }
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

  // Deterministic sorting of absentee candidates:
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

  // If pure priority sort is explicitly requested (e.g. legacy tests)
  if (purePrioritySort && !Object.values(visitationAssignments).some(assignment => assignment.weekNumber === currentWeek &&
    (options?.quarterNumber === undefined || assignment.quarterNumber === undefined || assignment.quarterNumber === options.quarterNumber))) {
    const totalEligibleBeforeCap = allEvaluated.length;
    const cappedCandidates = allEvaluated.slice(0, maxCap);
    return {
      candidates: cappedCandidates,
      totalEligibleBeforeCap,
      excludedByCooldownCount
    };
  }

  // =========================================================================
  // THE 4-SLOT OPERATIONAL STRUCTURE
  // 1 & 2: Top 2 Priority Need (Urgent Absentees)
  // 3: 1 slot for Consistent Student Encouragement
  // 4: 1 slot for Newly Onboarded Student (joined last week)
  // =========================================================================

  // Slot 1 & 2: Up to 2 Priority Need Candidates
  const prioritySlotCandidates = allEvaluated.slice(0, 2).map(c => ({
    ...c,
    slotType: 'PRIORITY_NEED' as const
  }));
  const selectedMemberIds = new Set(prioritySlotCandidates.map(c => c.memberId));

  // Slot 3: Consistent Student Encouragement (1 slot)
  let consistentCandidate: VisitationCandidate | null = null;
  const eligibleConsistentMembers: Array<{ member: Member; streak: number; totalAttended: number }> = [];

  for (const m of members) {
    if (m.isOneTimeVisitor || m.status === 'LEFT_CLASS' || selectedMemberIds.has(m.id)) {
      continue;
    }
    const cooldown = getMemberVisitationCooldown(m.id, currentWeek, absenceLogs, visitationAssignments);
    if (cooldown.isInCooldown && !includeCooldown) {
      continue;
    }

    // Must be present in current week or have 0 consecutive absences
    const consecutiveAbsent = getConsecutiveAbsences(m.id, currentWeek, grades, m.firstLessonWeek || 1);
    if (consecutiveAbsent > 0) {
      continue;
    }

    // Calculate presence streak up to currentWeek
    let streak = 0;
    for (let w = currentWeek; w >= (m.firstLessonWeek || 1); w--) {
      const g = grades.find(grade => grade.memberId === m.id && grade.weekNumber === w);
      if (g && g.attendance === 'PRESENT') {
        streak++;
      } else {
        break;
      }
    }

    // Calculate total attended weeks
    const totalAttended = grades.filter(
      grade => grade.memberId === m.id && grade.attendance === 'PRESENT' && grade.weekNumber <= currentWeek
    ).length;

    if (streak >= 1 || totalAttended >= 1) {
      eligibleConsistentMembers.push({ member: m, streak, totalAttended });
    }
  }

  eligibleConsistentMembers.sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    if (b.totalAttended !== a.totalAttended) return b.totalAttended - a.totalAttended;
    return a.member.fullName.localeCompare(b.member.fullName);
  });

  if (eligibleConsistentMembers.length > 0) {
    const top = eligibleConsistentMembers[0];
    const m = top.member;
    const cooldown = getMemberVisitationCooldown(m.id, currentWeek, absenceLogs, visitationAssignments);
    const existingAssignment = Object.values(visitationAssignments).find(
      a => a.memberId === m.id && a.weekNumber === currentWeek
    );

    consistentCandidate = {
      memberId: m.id,
      fullName: m.fullName,
      phone: m.phone || '',
      address: m.address || '',
      memberType: m.memberType,
      classId: m.classId || '',
      consecutiveWeeksAbsent: 0,
      priority: 'LOW',
      priorityRank: 3,
      slotType: 'CONSISTENT_STUDENT',
      eligibilityReason: `Consistent Student Encouragement (Present for ${top.streak} consecutive week${top.streak > 1 ? 's' : ''})`,
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
    selectedMemberIds.add(m.id);
  }

  // Slot 4: Newly Onboarded Student (1 slot)
  let newlyOnboardedCandidate: VisitationCandidate | null = null;
  const eligibleNewMembers: Member[] = [];

  for (const m of members) {
    if (m.isOneTimeVisitor || m.status === 'LEFT_CLASS' || selectedMemberIds.has(m.id)) {
      continue;
    }
    const cooldown = getMemberVisitationCooldown(m.id, currentWeek, absenceLogs, visitationAssignments);
    if (cooldown.isInCooldown && !includeCooldown) {
      continue;
    }

    // Student that just joined last week (currentWeek - 1) or recently (within 1-2 lessons)
    const joinedWeek = m.firstLessonWeek || 1;
    const isJoinedLastWeek = joinedWeek === currentWeek - 1;
    const isJoinedCurrentWeek = joinedWeek === currentWeek;

    if (isJoinedLastWeek || isJoinedCurrentWeek) {
      eligibleNewMembers.push(m);
    }
  }

  eligibleNewMembers.sort((a, b) => {
    // Prefer joined last week (currentWeek - 1) first
    const aLastWeek = (a.firstLessonWeek || 1) === currentWeek - 1 ? 1 : 0;
    const bLastWeek = (b.firstLessonWeek || 1) === currentWeek - 1 ? 1 : 0;
    if (bLastWeek !== aLastWeek) return bLastWeek - aLastWeek;
    return a.fullName.localeCompare(b.fullName);
  });

  if (eligibleNewMembers.length > 0) {
    const m = eligibleNewMembers[0];
    const cooldown = getMemberVisitationCooldown(m.id, currentWeek, absenceLogs, visitationAssignments);
    const existingAssignment = Object.values(visitationAssignments).find(
      a => a.memberId === m.id && a.weekNumber === currentWeek
    );
    const consecutiveAbsent = getConsecutiveAbsences(m.id, currentWeek, grades, m.firstLessonWeek || 1);

    newlyOnboardedCandidate = {
      memberId: m.id,
      fullName: m.fullName,
      phone: m.phone || '',
      address: m.address || '',
      memberType: m.memberType,
      classId: m.classId || '',
      consecutiveWeeksAbsent: consecutiveAbsent,
      priority: 'MEDIUM',
      priorityRank: 2,
      slotType: 'NEWLY_ONBOARDED',
      eligibilityReason: `Newly Onboarded Student (Joined in Week ${m.firstLessonWeek || currentWeek - 1})`,
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
    selectedMemberIds.add(m.id);
  }

  // Combine the freshly evaluated list (max 4, target 3).
  const evaluatedCandidates: VisitationCandidate[] = (purePrioritySort ? allEvaluated : [
    ...prioritySlotCandidates,
    ...(consistentCandidate ? [consistentCandidate] : []),
    ...(newlyOnboardedCandidate ? [newlyOnboardedCandidate] : [])
  ]).slice(0, maxCap);

  // A week's slate is immutable once records exist. Completed visits remain in
  // their original slots and must never be replaced by newly eligible people.
  const frozenAssignments = getWeeklyVisitationAssignments(visitationAssignments, currentWeek, options?.quarterNumber);
  const frozenCandidates: VisitationCandidate[] = frozenAssignments.flatMap(assignment => {
    const member = members.find(item => item.id === assignment.memberId);
    const fallback = evaluatedCandidates.find(item => item.memberId === assignment.memberId);
    const cooldown = getMemberVisitationCooldown(assignment.memberId, currentWeek, absenceLogs, visitationAssignments);
    return [{
      memberId: assignment.memberId,
      fullName: member?.fullName || assignment.memberName || 'Member record unavailable',
      phone: member?.phone || '',
      address: member?.address || '',
      memberType: member?.memberType || 'STUDENT',
      classId: member?.classId || assignment.classId,
      consecutiveWeeksAbsent: fallback?.consecutiveWeeksAbsent ?? getConsecutiveAbsences(assignment.memberId, currentWeek, grades, member?.firstLessonWeek || 1),
      priority: assignment.priority || fallback?.priority || 'LOW',
      priorityRank: fallback?.priorityRank || (assignment.priority === 'HIGH' ? 1 : assignment.priority === 'MEDIUM' ? 2 : 3),
      slotType: assignment.slotType || fallback?.slotType || 'PRIORITY_NEED',
      eligibilityReason: fallback?.eligibilityReason || 'Fixed weekly visitation candidate',
      lastVisitedDate: cooldown.lastVisitedDate,
      lastVisitedWeek: cooldown.lastVisitedWeek,
      isInCooldown: cooldown.isInCooldown,
      cooldownWeeksRemaining: cooldown.cooldownWeeksRemaining,
      assignedStaffId: assignment.assignedStaffId,
      assignedStaffName: assignment.assignedStaffName,
      assignedStaffRole: assignment.assignedStaffRole,
      assignedStaffPhone: assignment.assignedStaffPhone,
      visitStatus: assignment.status,
      notes: assignment.outcome
    }];
  });
  const frozenIds = new Set(frozenCandidates.map(candidate => candidate.memberId));
  const finalCandidates = [
    ...frozenCandidates,
    // Legacy assignments are upgraded to a complete slate once. A persisted
    // slate (identified by slot order) never acquires replacement candidates.
    ...(!frozenAssignments.some(assignment => assignment.selectedSlotIndex !== undefined)
      ? evaluatedCandidates.filter(candidate => !frozenIds.has(candidate.memberId)) : [])
  ].slice(0, maxCap);

  const totalEligibleBeforeCap = allEvaluated.length +
    (consistentCandidate ? 1 : 0) +
    (newlyOnboardedCandidate ? 1 : 0);

  return {
    candidates: finalCandidates,
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
    { includeCooldown: false, maxCap: VISITATION_MAX_PER_CLASS_PER_WEEK, purePrioritySort: true, quarterNumber }
  );
  const membersRequiringVisitation = candidates.length;

  // Completed follow-ups this week
  const weekAbsenceLogs = absenceLogs.filter(l => l.classId === classProfile.id && l.weekNumber === currentWeek &&
    (l.quarterNumber === undefined || l.quarterNumber === quarterNumber));
  const followUpCompleted = weekAbsenceLogs.length;

  // Completed visits this week
  const completedVisitsLogs = weekAbsenceLogs.filter(l => 
    l.contactMethod === 'PASTORAL_VISIT' || (l as any).contactMethod === 'IN_PERSON'
  );
  const completedVisitsAssignments = getWeeklyVisitationAssignments(visitationAssignments, currentWeek, quarterNumber).filter(a =>
    a.classId === classProfile.id && a.status === 'COMPLETED'
  );
  const selectedMemberIds = new Set(candidates.map(candidate => candidate.memberId));
  const visitationCompleted = new Set([
    ...completedVisitsLogs.map(log => log.memberId),
    ...completedVisitsAssignments.map(assignment => assignment.memberId)
  ].filter(memberId => selectedMemberIds.has(memberId))).size;

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
