import type { Member, WeeklyGradeRecord } from '../types';
import { isMemberStudentAtWeek, getEffectiveStudentActivationWeek } from './calculations';

/**
 * CONFIGURABLE CONSTANTS FOR SUNDAY SCHOOL SCORING & FAIRNESS SYSTEM
 */
export const FAIRNESS_RELIABILITY_K = 6; // Reliability shrinkage strength (default: 6)
export const MAX_PUNCTUALITY_PER_LESSON = 15;
export const MAX_MEMORY_VERSE_PER_LESSON = 15;
export const MAX_PARTICIPATION_PER_LESSON = 20;
export const MAX_POINTS_PER_LESSON = 50;
export const MAX_TOTAL_POINTS_12_LESSONS = 600;
export const DEFAULT_NEUTRAL_REFERENCE_RATE = 70.0;

export type PerformanceCategory =
  | 'OVERALL'
  | 'MEMORY_VERSE'
  | 'PUNCTUALITY'
  | 'PARTICIPATION';

export interface CategoryRates {
  rawRate: number;
  adjustedRate: number;
  scoreObtained: number;
  maxObtainable: number;
  referenceRate: number;
}

export interface WeekClusterPoint {
  weekNumber: number;
  attendance: 'PRESENT' | 'ABSENT' | 'EXEMPT' | 'NOT_ELIGIBLE';
  isEligible: boolean;
  points: number;
  punctuality: number;
  memoryVerse: number;
  participation: number;
  cumulativePoints: number;
  cumulativeMaxPoints: number;
  diligenceRate: number;
}

export interface MemberFairnessMetrics {
  memberId: string;
  fullName: string;
  memberType: 'STUDENT' | 'VISITOR';
  isAwardEligible: boolean;
  awardEligibilityLabel: 'Eligible for Awards' | 'Not Eligible for Awards';
  joinLesson: number;
  eligibleLessons: number;
  attendedWeeks: number;
  absentWeeks: number;
  exemptWeeks: number;
  attendanceRate: number; // attendedWeeks / eligibleLessons * 100
  totalPointsEarned: number;
  maxAvailablePoints: number;
  overall: CategoryRates;
  memoryVerse: CategoryRates;
  punctuality: CategoryRates;
  participation: CategoryRates;
  rankings: {
    overall: number;
    memoryVerse: number;
    punctuality: number;
    participation: number;
    totalInClass: number;
    totalEligibleInClass: number;
  };
  clusterWeeks: WeekClusterPoint[];
}

export interface ClassFairnessSummary {
  classId: string;
  totalMembers: number;
  eligibleMembersCount: number;
  awardEligibleCount: number;
  classAverages: {
    overallRaw: number;
    memoryRaw: number;
    punctualityRaw: number;
    participationRaw: number;
  };
  memberMetrics: MemberFairnessMetrics[];
  awardWinners: {
    overall: MemberFairnessMetrics | null;
    memoryVerse: MemberFairnessMetrics | null;
    punctuality: MemberFairnessMetrics | null;
    participation: MemberFairnessMetrics | null;
  };
}

/**
 * Clamps numeric values to a safe range and rejects non-finite values.
 */
function clampScore(val: unknown, maxVal: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? Math.min(maxVal, Math.max(0, n)) : 0;
}

/**
 * Calculates raw percentage rate: (score / maxScore) * 100
 * Retains full floating point precision internally.
 */
export function calculateRawRate(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return 0;
  }
  const pct = (score / maxScore) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Empirical Bayes shrinkage / reliability-adjusted score formula:
 * AdjustedRate = (n * RawRate + k * ReferenceRate) / (n + k)
 *
 * Where:
 * n = number of eligible lessons
 * RawRate = person's actual percentage
 * ReferenceRate = class reference rate for that category
 * k = reliability shrinkage factor (default: 6)
 */
export function calculateAdjustedRate(
  n: number,
  rawRate: number,
  referenceRate: number,
  k: number = FAIRNESS_RELIABILITY_K
): number {
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  const safeRaw = Number.isFinite(rawRate) ? Math.min(100, Math.max(0, rawRate)) : 0;
  const safeRef = Number.isFinite(referenceRate) ? Math.min(100, Math.max(0, referenceRate)) : DEFAULT_NEUTRAL_REFERENCE_RATE;
  const safeK = Number.isFinite(k) && k >= 0 ? k : FAIRNESS_RELIABILITY_K;

  const adjusted = (n * safeRaw + safeK * safeRef) / (n + safeK);
  return Math.min(100, Math.max(0, adjusted));
}

/**
 * Formats a rate to 1 decimal place string (e.g. 82.9%)
 */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '0.0%';
  return `${rate.toFixed(1)}%`;
}

/**
 * Determines a person's effective join lesson / week in the quarter.
 */
export function getMemberJoinLesson(
  member: Member,
  memberGrades: WeeklyGradeRecord[] = [],
  currentMaxWeek: number = 12
): number {
  if (member.firstLessonWeek && member.firstLessonWeek >= 1 && member.firstLessonWeek <= 12) {
    return member.firstLessonWeek;
  }
  // Check quarterEnrollments if present
  const enrollments = (member as any)?.quarterEnrollments;
  if (enrollments && typeof enrollments === 'object') {
    for (const qNum of Object.keys(enrollments)) {
      const qe = enrollments[qNum];
      if (qe?.firstLessonWeek && qe.firstLessonWeek >= 1 && qe.firstLessonWeek <= 12) {
        return qe.firstLessonWeek;
      }
    }
  }
  // Inferred from earliest attendance or score record
  const recorded = (memberGrades || [])
    .filter(g => !g.isNoRecordWeek && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT'))
    .map(g => g.weekNumber)
    .filter(w => w >= 1 && w <= currentMaxWeek)
    .sort((a, b) => a - b);

  if (recorded.length > 0) {
    return recorded[0];
  }

  // Fallback to 1
  return 1;
}

/**
 * Computes raw performance metrics and weekly cluster for an individual member.
 */
export function computeRawMemberMetrics(
  member: Member,
  allGrades: WeeklyGradeRecord[],
  currentMaxWeek: number = 12,
  noRecordWeeks: number[] = []
): {
  joinLesson: number;
  eligibleLessons: number;
  attendedWeeks: number;
  absentWeeks: number;
  exemptWeeks: number;
  attendanceRate: number;
  totalPointsEarned: number;
  maxAvailablePoints: number;
  rawOverallRate: number;
  totalMemoryPoints: number;
  maxMemoryPoints: number;
  rawMemoryRate: number;
  totalPunctualityPoints: number;
  maxPunctualityPoints: number;
  rawPunctualityRate: number;
  totalParticipationPoints: number;
  maxParticipationPoints: number;
  rawParticipationRate: number;
  clusterWeeks: WeekClusterPoint[];
} {
  const memberGrades = allGrades.filter(g => g.memberId === member.id);
  const joinLesson = getMemberJoinLesson(member, memberGrades, currentMaxWeek);

  let attendedWeeks = 0;
  let absentWeeks = 0;
  let exemptWeeks = 0;
  let eligibleLessons = 0;

  let totalPointsEarned = 0;
  let totalPunctualityPoints = 0;
  let totalMemoryPoints = 0;
  let totalParticipationPoints = 0;

  const clusterWeeks: WeekClusterPoint[] = [];
  let rollingPoints = 0;
  let rollingEligible = 0;

  for (let w = 1; w <= 12; w++) {
    // Determine status of this lesson
    const isGlobalNoRecord = noRecordWeeks.includes(w);
    const grade = memberGrades.find(g => g.weekNumber === w);
    const isIndividualNoRecord = Boolean(grade?.isNoRecordWeek);

    if (w > currentMaxWeek) {
      // Future lesson: N/A until that lesson occurs
      clusterWeeks.push({
        weekNumber: w,
        attendance: 'NOT_ELIGIBLE',
        isEligible: false,
        points: 0,
        punctuality: 0,
        memoryVerse: 0,
        participation: 0,
        cumulativePoints: rollingPoints,
        cumulativeMaxPoints: rollingEligible * MAX_POINTS_PER_LESSON,
        diligenceRate: rollingEligible > 0 ? (rollingPoints / (rollingEligible * MAX_POINTS_PER_LESSON)) * 100 : 0
      });
      continue;
    }

    if (w < joinLesson) {
      // Before joining: N/A / NOT ELIGIBLE. Must NOT count as absent or 0 marks.
      exemptWeeks++;
      clusterWeeks.push({
        weekNumber: w,
        attendance: 'NOT_ELIGIBLE',
        isEligible: false,
        points: 0,
        punctuality: 0,
        memoryVerse: 0,
        participation: 0,
        cumulativePoints: rollingPoints,
        cumulativeMaxPoints: rollingEligible * MAX_POINTS_PER_LESSON,
        diligenceRate: rollingEligible > 0 ? (rollingPoints / (rollingEligible * MAX_POINTS_PER_LESSON)) * 100 : 0
      });
      continue;
    }

    if (isGlobalNoRecord || isIndividualNoRecord || grade?.attendance === 'EXEMPT') {
      // Explicitly exempt or no-record
      exemptWeeks++;
      clusterWeeks.push({
        weekNumber: w,
        attendance: 'EXEMPT',
        isEligible: false,
        points: 0,
        punctuality: 0,
        memoryVerse: 0,
        participation: 0,
        cumulativePoints: rollingPoints,
        cumulativeMaxPoints: rollingEligible * MAX_POINTS_PER_LESSON,
        diligenceRate: rollingEligible > 0 ? (rollingPoints / (rollingEligible * MAX_POINTS_PER_LESSON)) * 100 : 0
      });
      continue;
    }

    // Lesson occurred after joining and is an eligible lesson
    eligibleLessons++;
    rollingEligible++;

    let weekPoints = 0;
    let pScore = 0;
    let mvScore = 0;
    let partScore = 0;
    let attStatus: 'PRESENT' | 'ABSENT' = 'ABSENT';

    if (grade && grade.attendance === 'PRESENT') {
      attendedWeeks++;
      attStatus = 'PRESENT';

      pScore = clampScore(grade.punctuality, MAX_PUNCTUALITY_PER_LESSON);
      mvScore = clampScore(grade.memoryVerse, MAX_MEMORY_VERSE_PER_LESSON);
      partScore = clampScore(grade.classParticipation, MAX_PARTICIPATION_PER_LESSON);

      weekPoints = pScore + mvScore + partScore;
      totalPunctualityPoints += pScore;
      totalMemoryPoints += mvScore;
      totalParticipationPoints += partScore;
      totalPointsEarned += weekPoints;
    } else {
      // Absent after joining: counts in denominator with 0 marks
      absentWeeks++;
      attStatus = 'ABSENT';
    }

    rollingPoints += weekPoints;

    clusterWeeks.push({
      weekNumber: w,
      attendance: attStatus,
      isEligible: true,
      points: weekPoints,
      punctuality: pScore,
      memoryVerse: mvScore,
      participation: partScore,
      cumulativePoints: rollingPoints,
      cumulativeMaxPoints: rollingEligible * MAX_POINTS_PER_LESSON,
      diligenceRate: rollingEligible > 0 ? (rollingPoints / (rollingEligible * MAX_POINTS_PER_LESSON)) * 100 : 0
    });
  }

  const maxAvailablePoints = eligibleLessons * MAX_POINTS_PER_LESSON;
  const maxMemoryPoints = eligibleLessons * MAX_MEMORY_VERSE_PER_LESSON;
  const maxPunctualityPoints = eligibleLessons * MAX_PUNCTUALITY_PER_LESSON;
  const maxParticipationPoints = eligibleLessons * MAX_PARTICIPATION_PER_LESSON;

  const attendanceRate = eligibleLessons > 0 ? (attendedWeeks / eligibleLessons) * 100 : 0;
  const rawOverallRate = calculateRawRate(totalPointsEarned, maxAvailablePoints);
  const rawMemoryRate = calculateRawRate(totalMemoryPoints, maxMemoryPoints);
  const rawPunctualityRate = calculateRawRate(totalPunctualityPoints, maxPunctualityPoints);
  const rawParticipationRate = calculateRawRate(totalParticipationPoints, maxParticipationPoints);

  return {
    joinLesson,
    eligibleLessons,
    attendedWeeks,
    absentWeeks,
    exemptWeeks,
    attendanceRate,
    totalPointsEarned,
    maxAvailablePoints,
    rawOverallRate,
    totalMemoryPoints,
    maxMemoryPoints,
    rawMemoryRate,
    totalPunctualityPoints,
    maxPunctualityPoints,
    rawPunctualityRate,
    totalParticipationPoints,
    maxParticipationPoints,
    rawParticipationRate,
    clusterWeeks
  };
}

/**
 * Convenience helper to extract the 12-week cluster data for a member.
 */
export function generateMemberClusterWeeks(
  member: Member,
  allGrades: WeeklyGradeRecord[],
  currentMaxWeek: number = 12
): WeekClusterPoint[] {
  return computeRawMemberMetrics(member, allGrades, currentMaxWeek).clusterWeeks;
}

/**
 * Computes leave-one-out reference rates for a specific member among their classmates.
 *
 * Fallback order:
 * 1. Leave-one-out class average (all classmates j != i with eligibleLessons > 0)
 * 2. Full class average (including i, if leave-one-out has no comparison members)
 * 3. Neutral configured fallback rate (70.0%)
 * 4. Member's own raw rate
 */
export function calculateLeaveOneOutReferenceRates(
  targetMemberId: string,
  classRawMetrics: Array<{
    memberId: string;
    eligibleLessons: number;
    rawOverallRate: number;
    rawMemoryRate: number;
    rawPunctualityRate: number;
    rawParticipationRate: number;
  }>
): {
  overall: number;
  memory: number;
  punctuality: number;
  participation: number;
} {
  // 1. Leave-one-out classmates (when comparison population >= k to ensure strictly monotonic shrinkage)
  const peers = classRawMetrics.filter(m => m.memberId !== targetMemberId && m.eligibleLessons > 0);

  if (peers.length >= FAIRNESS_RELIABILITY_K) {
    const avgOverall = peers.reduce((acc, p) => acc + p.rawOverallRate, 0) / peers.length;
    const avgMemory = peers.reduce((acc, p) => acc + p.rawMemoryRate, 0) / peers.length;
    const avgPunct = peers.reduce((acc, p) => acc + p.rawPunctualityRate, 0) / peers.length;
    const avgPart = peers.reduce((acc, p) => acc + p.rawParticipationRate, 0) / peers.length;

    return {
      overall: Number.isFinite(avgOverall) ? avgOverall : DEFAULT_NEUTRAL_REFERENCE_RATE,
      memory: Number.isFinite(avgMemory) ? avgMemory : DEFAULT_NEUTRAL_REFERENCE_RATE,
      punctuality: Number.isFinite(avgPunct) ? avgPunct : DEFAULT_NEUTRAL_REFERENCE_RATE,
      participation: Number.isFinite(avgPart) ? avgPart : DEFAULT_NEUTRAL_REFERENCE_RATE
    };
  }

  // 2. Full class average fallback (used when comparison population is small or leave-one-out is unavailable)
  const allEligible = classRawMetrics.filter(m => m.eligibleLessons > 0);
  if (allEligible.length > 0) {
    const avgOverall = allEligible.reduce((acc, p) => acc + p.rawOverallRate, 0) / allEligible.length;
    const avgMemory = allEligible.reduce((acc, p) => acc + p.rawMemoryRate, 0) / allEligible.length;
    const avgPunct = allEligible.reduce((acc, p) => acc + p.rawPunctualityRate, 0) / allEligible.length;
    const avgPart = allEligible.reduce((acc, p) => acc + p.rawParticipationRate, 0) / allEligible.length;

    return {
      overall: Number.isFinite(avgOverall) ? avgOverall : DEFAULT_NEUTRAL_REFERENCE_RATE,
      memory: Number.isFinite(avgMemory) ? avgMemory : DEFAULT_NEUTRAL_REFERENCE_RATE,
      punctuality: Number.isFinite(avgPunct) ? avgPunct : DEFAULT_NEUTRAL_REFERENCE_RATE,
      participation: Number.isFinite(avgPart) ? avgPart : DEFAULT_NEUTRAL_REFERENCE_RATE
    };
  }

  // 3. Neutral configured fallback
  return {
    overall: DEFAULT_NEUTRAL_REFERENCE_RATE,
    memory: DEFAULT_NEUTRAL_REFERENCE_RATE,
    punctuality: DEFAULT_NEUTRAL_REFERENCE_RATE,
    participation: DEFAULT_NEUTRAL_REFERENCE_RATE
  };
}

/**
 * Computes full fairness metrics, rankings, and award eligibility for an entire class.
 */
export function computeClassFairnessRankings(
  classMembers: Member[],
  allGrades: WeeklyGradeRecord[],
  currentMaxWeek: number = 12,
  noRecordWeeks: number[] = [],
  k: number = FAIRNESS_RELIABILITY_K
): ClassFairnessSummary {
  // Step 1: Compute raw metrics for all class members
  const rawList = classMembers.map(member => {
    const raw = computeRawMemberMetrics(member, allGrades, currentMaxWeek, noRecordWeeks);
    return {
      member,
      ...raw
    };
  });

  // Step 2: Compute leave-one-out reference rates & adjusted rates for each member
  const rawMetricsForRef = rawList.map(r => ({
    memberId: r.member.id,
    eligibleLessons: r.eligibleLessons,
    rawOverallRate: r.rawOverallRate,
    rawMemoryRate: r.rawMemoryRate,
    rawPunctualityRate: r.rawPunctualityRate,
    rawParticipationRate: r.rawParticipationRate
  }));

  const metricsWithAdjusted = rawList.map(r => {
    const ref = calculateLeaveOneOutReferenceRates(r.member.id, rawMetricsForRef);

    const adjustedOverallRate = calculateAdjustedRate(r.eligibleLessons, r.rawOverallRate, ref.overall, k);
    const adjustedMemoryRate = calculateAdjustedRate(r.eligibleLessons, r.rawMemoryRate, ref.memory, k);
    const adjustedPunctualityRate = calculateAdjustedRate(r.eligibleLessons, r.rawPunctualityRate, ref.punctuality, k);
    const adjustedParticipationRate = calculateAdjustedRate(r.eligibleLessons, r.rawParticipationRate, ref.participation, k);

    // Existing Student / Visitor logic source of truth
    const isStudent = isMemberStudentAtWeek(r.member, currentMaxWeek);
    const memberType: 'STUDENT' | 'VISITOR' = isStudent ? 'STUDENT' : 'VISITOR';
    const isAwardEligible = isStudent;
    const awardEligibilityLabel: 'Eligible for Awards' | 'Not Eligible for Awards' = isAwardEligible
      ? 'Eligible for Awards'
      : 'Not Eligible for Awards';

    return {
      memberId: r.member.id,
      fullName: r.member.fullName,
      memberType,
      isAwardEligible,
      awardEligibilityLabel,
      joinLesson: r.joinLesson,
      eligibleLessons: r.eligibleLessons,
      attendedWeeks: r.attendedWeeks,
      absentWeeks: r.absentWeeks,
      exemptWeeks: r.exemptWeeks,
      attendanceRate: r.attendanceRate,
      totalPointsEarned: r.totalPointsEarned,
      maxAvailablePoints: r.maxAvailablePoints,
      overall: {
        rawRate: r.rawOverallRate,
        adjustedRate: adjustedOverallRate,
        scoreObtained: r.totalPointsEarned,
        maxObtainable: r.maxAvailablePoints,
        referenceRate: ref.overall
      },
      memoryVerse: {
        rawRate: r.rawMemoryRate,
        adjustedRate: adjustedMemoryRate,
        scoreObtained: r.totalMemoryPoints,
        maxObtainable: r.maxMemoryPoints,
        referenceRate: ref.memory
      },
      punctuality: {
        rawRate: r.rawPunctualityRate,
        adjustedRate: adjustedPunctualityRate,
        scoreObtained: r.totalPunctualityPoints,
        maxObtainable: r.maxPunctualityPoints,
        referenceRate: ref.punctuality
      },
      participation: {
        rawRate: r.rawParticipationRate,
        adjustedRate: adjustedParticipationRate,
        scoreObtained: r.totalParticipationPoints,
        maxObtainable: r.maxParticipationPoints,
        referenceRate: ref.participation
      },
      rankings: {
        overall: 1,
        memoryVerse: 1,
        punctuality: 1,
        participation: 1,
        totalInClass: classMembers.length,
        totalEligibleInClass: rawList.filter(m => m.eligibleLessons > 0).length
      },
      clusterWeeks: r.clusterWeeks
    };
  });

  // Step 3: Compute deterministic rankings for all 4 categories
  // Tie-breaking order:
  // 1. Higher Adjusted Rate
  // 2. Higher Raw Rate
  // 3. Greater number of Eligible Lessons
  // 4. Equal rank (tie)
  const assignCategoryRankings = (
    category: 'overall' | 'memoryVerse' | 'punctuality' | 'participation'
  ) => {
    const sorted = [...metricsWithAdjusted].sort((a, b) => {
      const aAdj = a[category].adjustedRate;
      const bAdj = b[category].adjustedRate;
      if (Math.abs(bAdj - aAdj) > 0.00001) return bAdj - aAdj;

      const aRaw = a[category].rawRate;
      const bRaw = b[category].rawRate;
      if (Math.abs(bRaw - aRaw) > 0.00001) return bRaw - aRaw;

      if (b.eligibleLessons !== a.eligibleLessons) return b.eligibleLessons - a.eligibleLessons;
      return a.fullName.localeCompare(b.fullName);
    });

    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const prevAdj = prev[category].adjustedRate;
        const currAdj = curr[category].adjustedRate;
        const prevRaw = prev[category].rawRate;
        const currRaw = curr[category].rawRate;

        // If not tied on both adjusted rate, raw rate, and eligible lessons, advance rank to index + 1
        if (
          Math.abs(prevAdj - currAdj) > 0.00001 ||
          Math.abs(prevRaw - currRaw) > 0.00001 ||
          prev.eligibleLessons !== curr.eligibleLessons
        ) {
          currentRank = i + 1;
        }
      }
      sorted[i].rankings[category] = currentRank;
    }
  };

  assignCategoryRankings('overall');
  assignCategoryRankings('memoryVerse');
  assignCategoryRankings('punctuality');
  assignCategoryRankings('participation');

  // Step 4: Determine Award Winners among Award-Eligible members only!
  const getCategoryWinner = (category: 'overall' | 'memoryVerse' | 'punctuality' | 'participation') => {
    const eligiblePool = metricsWithAdjusted.filter(m => m.isAwardEligible && m.eligibleLessons > 0);
    if (eligiblePool.length === 0) return null;

    eligiblePool.sort((a, b) => {
      const aAdj = a[category].adjustedRate;
      const bAdj = b[category].adjustedRate;
      if (Math.abs(bAdj - aAdj) > 0.00001) return bAdj - aAdj;

      const aRaw = a[category].rawRate;
      const bRaw = b[category].rawRate;
      if (Math.abs(bRaw - aRaw) > 0.00001) return bRaw - aRaw;

      return b.eligibleLessons - a.eligibleLessons;
    });

    return eligiblePool[0] || null;
  };

  const eligibleCount = metricsWithAdjusted.filter(m => m.eligibleLessons > 0).length;
  const awardEligibleCount = metricsWithAdjusted.filter(m => m.isAwardEligible).length;

  const sumOverallRaw = metricsWithAdjusted.reduce((acc, m) => acc + m.overall.rawRate, 0);
  const sumMemoryRaw = metricsWithAdjusted.reduce((acc, m) => acc + m.memoryVerse.rawRate, 0);
  const sumPunctRaw = metricsWithAdjusted.reduce((acc, m) => acc + m.punctuality.rawRate, 0);
  const sumPartRaw = metricsWithAdjusted.reduce((acc, m) => acc + m.participation.rawRate, 0);

  const classAverages = {
    overallRaw: classMembers.length > 0 ? sumOverallRaw / classMembers.length : 0,
    memoryRaw: classMembers.length > 0 ? sumMemoryRaw / classMembers.length : 0,
    punctualityRaw: classMembers.length > 0 ? sumPunctRaw / classMembers.length : 0,
    participationRaw: classMembers.length > 0 ? sumPartRaw / classMembers.length : 0
  };

  return {
    classId: classMembers[0]?.classId || '',
    totalMembers: classMembers.length,
    eligibleMembersCount: eligibleCount,
    awardEligibleCount,
    classAverages,
    memberMetrics: metricsWithAdjusted,
    awardWinners: {
      overall: getCategoryWinner('overall'),
      memoryVerse: getCategoryWinner('memoryVerse'),
      punctuality: getCategoryWinner('punctuality'),
      participation: getCategoryWinner('participation')
    }
  };
}
