import {
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  HardWorkStats,
  CategoryReportStats,
  WeekSummaryMetrics,
  AbsenceUrgency,
  VisitorQualification
} from '../types';

export interface AwardWinnerDetails {
  member: Member;
  scoreObtained: number;
  maxObtainable: number;
  eligibleLessons: number;
  percentage: number;
  totalScore?: number;
  validOpportunities?: number;
  averagePunctuality?: number;
  averageParticipation?: number;
  consistencyScore?: number;
}

export interface QuarterAwardsSummary {
  memoryVerseWinner: AwardWinnerDetails | null;
  punctualityWinner: AwardWinnerDetails | null;
  participationWinner: AwardWinnerDetails | null;
  overallDiligentWinner: {
    member: Member;
    stats: HardWorkStats;
  } | null;
}

/**
 * Calculates a specific report-card category performance using the formula:
 * Percentage = Total Score Obtained ÷ (Maximum Score Per Lesson × Number of Eligible Lessons) × 100
 */
export function calculateCategoryScore(
  scoreObtained: number,
  maxPerLesson: number,
  eligibleLessons: number
): CategoryReportStats {
  const maxObtainable = maxPerLesson * Math.max(0, eligibleLessons);
  const rawPercentage = maxObtainable > 0 ? (scoreObtained / maxObtainable) * 100 : 0;
  // Round to 2 decimal places (e.g. 83.33%, 88.89%)
  const percentage = Math.round(rawPercentage * 100) / 100;

  return {
    scoreObtained,
    maxObtainable,
    eligibleLessons,
    percentage
  };
}

/**
 * Calculates the fair "Hard Work Rate" & comprehensive metrics for a member.
 * Strictly uses individualized eligible lessons based on enrollment period.
 * Strictly excludes NO RECORD weeks from denominators and formulas.
 */
export function calculateMemberStats(
  member: Member,
  allGrades: WeeklyGradeRecord[],
  currentMaxWeek: number = 12,
  noRecordWeeks: number[] = []
): HardWorkStats {
  const memberGrades = allGrades.filter(g => g.memberId === member.id);
  
  // Determine effective starting week (student joining week)
  const sortedRecorded = memberGrades
    .filter(g => !g.isNoRecordWeek && !noRecordWeeks.includes(g.weekNumber))
    .filter(g => g.attendance === 'PRESENT' || g.attendance === 'ABSENT')
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const effectiveFirstWeek = member.firstLessonWeek || 
    (sortedRecorded.length > 0 ? sortedRecorded[0].weekNumber : 1);

  let totalPointsEarned = 0;
  let attendedWeeks = 0;
  let exemptWeeks = 0;
  let absentWeeks = 0;
  let eligibleLessonsCount = 0;
  let sumPunctuality = 0;
  let sumMemoryVerse = 0;
  let sumParticipation = 0;
  let prayerAttendanceCount = 0;
  let statusPostCount = 0;

  for (let w = 1; w <= currentMaxWeek; w++) {
    // 1. Exclude weeks designated globally as NO RECORD
    if (noRecordWeeks.includes(w)) {
      continue;
    }

    const grade = memberGrades.find(g => g.weekNumber === w);

    // 2. Exclude individual grade marked as NO RECORD
    if (grade?.isNoRecordWeek) {
      continue;
    }

    // 3. Exclude weeks before student joined/became eligible
    if (w < effectiveFirstWeek) {
      exemptWeeks++;
      continue;
    }

    // 4. Exclude explicitly EXEMPT weeks
    if (grade && grade.attendance === 'EXEMPT') {
      exemptWeeks++;
      continue;
    }

    // Week is eligible for this student
    eligibleLessonsCount++;

    if (grade && grade.attendance === 'PRESENT') {
      attendedWeeks++;
      const pScore = Number(grade.punctuality) || 0;
      const mvScore = Number(grade.memoryVerse) || 0;
      const partScore = Number(grade.classParticipation) || 0;
      const totScore = Number(grade.lessonTotal) || (pScore + mvScore + partScore);

      sumPunctuality += pScore;
      sumMemoryVerse += mvScore;
      sumParticipation += partScore;
      totalPointsEarned += totScore;

      if (grade.joinedPrayerMeeting) prayerAttendanceCount++;
      if (grade.postedStatusInsight) statusPostCount++;
    } else if (grade && grade.attendance === 'ABSENT') {
      absentWeeks++;
      // 0 marks obtained for absence in eligible lesson
    } else {
      // Unrecorded week within active eligibility
    }
  }

  // 1. Punctuality (15 marks maximum per eligible lesson)
  const punctualityStats = calculateCategoryScore(sumPunctuality, 15, eligibleLessonsCount);

  // 2. Memory Verse (15 marks maximum per eligible lesson)
  const memoryVerseStats = calculateCategoryScore(sumMemoryVerse, 15, eligibleLessonsCount);

  // 3. Class Participation (20 marks maximum per eligible lesson)
  const participationStats = calculateCategoryScore(sumParticipation, 20, eligibleLessonsCount);

  // Overall Diligence / Hard Work Rate (50 marks maximum per eligible lesson)
  const totalPossiblePoints = 50 * eligibleLessonsCount;
  const hardWorkRate = totalPossiblePoints > 0
    ? Math.round((totalPointsEarned / totalPossiblePoints) * 100 * 100) / 100
    : 0;

  return {
    memberId: member.id,
    fullName: member.fullName,
    memberType: member.memberType,
    firstLessonWeek: effectiveFirstWeek,
    eligibleLessonsCount,
    weeksRecorded: attendedWeeks + absentWeeks,
    attendedWeeks,
    exemptWeeks,
    absentWeeks,
    totalPointsEarned,
    totalPossiblePointsSinceFirst: totalPossiblePoints,
    totalScoreEarned: totalPointsEarned,
    totalPossibleScore: totalPossiblePoints,
    hardWorkRate,

    // Report-Card Objects
    punctualityStats,
    memoryVerseStats,
    participationStats,

    // Direct percentage and score getters
    punctualityScoreObtained: punctualityStats.scoreObtained,
    punctualityMaxObtainable: punctualityStats.maxObtainable,
    punctualityPercentage: punctualityStats.percentage,

    memoryVerseScoreObtained: memoryVerseStats.scoreObtained,
    memoryVerseMaxObtainable: memoryVerseStats.maxObtainable,
    memoryVersePercentage: memoryVerseStats.percentage,

    participationScoreObtained: participationStats.scoreObtained,
    participationMaxObtainable: participationStats.maxObtainable,
    participationPercentage: participationStats.percentage,

    // Formatted percentage values for UI consistency
    avgPunctuality: punctualityStats.percentage,
    avgMemoryVerse: memoryVerseStats.percentage,
    avgParticipation: participationStats.percentage,

    totalReferrals: member.evangelismReferralCount || 0,
    prayerAttendanceCount,
    statusPostCount
  };
}

/**
 * Calculates consecutive absences ending at targetWeek, skipping No-Record weeks
 */
export function getConsecutiveAbsences(
  memberId: string,
  targetWeek: number,
  allGrades: WeeklyGradeRecord[],
  memberFirstWeek: number = 1,
  noRecordWeeks: number[] = []
): number {
  const memberGrades = allGrades.filter(g => g.memberId === memberId);
  let count = 0;

  for (let w = targetWeek; w >= memberFirstWeek; w--) {
    if (noRecordWeeks.includes(w)) continue;

    const grade = memberGrades.find(g => g.weekNumber === w);
    if (grade?.isNoRecordWeek) continue;

    if (!grade || grade.attendance === 'ABSENT') {
      count++;
    } else if (grade.attendance === 'PRESENT' || grade.attendance === 'EXEMPT') {
      break;
    }
  }

  return count;
}

/**
 * Calculates consecutive recorded visits for a visitor, skipping No-Record weeks
 */
export function getConsecutiveVisits(
  memberId: string,
  targetWeek: number,
  allGrades: WeeklyGradeRecord[],
  noRecordWeeks: number[] = []
): number {
  const memberGrades = allGrades.filter(g => g.memberId === memberId);
  let count = 0;

  for (let w = targetWeek; w >= 1; w--) {
    if (noRecordWeeks.includes(w)) continue;

    const grade = memberGrades.find(g => g.weekNumber === w);
    if (grade?.isNoRecordWeek) continue;

    if (grade && grade.attendance === 'PRESENT') {
      count++;
    } else if (grade && (grade.attendance === 'ABSENT' || grade.attendance === 'EXEMPT')) {
      break;
    }
  }

  return count;
}

/**
 * Check intelligent Absence/Relegation status for a Student
 */
export function checkStudentAbsenceCare(
  member: Member,
  allGrades: WeeklyGradeRecord[],
  currentWeek: number,
  noRecordWeeks: number[] = []
): {
  isStudent: boolean;
  consecutiveAbsences: number;
  shouldPromptRelegation: boolean;
  promptMessage?: string;
} {
  if (member.memberType === 'VISITOR') {
    // Visitor cannot be relegated again!
    return {
      isStudent: false,
      consecutiveAbsences: 0,
      shouldPromptRelegation: false
    };
  }

  const consecutive = getConsecutiveAbsences(member.id, currentWeek, allGrades, member.firstLessonWeek || 1, noRecordWeeks);

  if (consecutive >= 3) {
    return {
      isStudent: true,
      consecutiveAbsences: consecutive,
      shouldPromptRelegation: true,
      promptMessage: `${member.fullName} has been absent for ${consecutive} consecutive weeks. Consider reclassifying to Visitor status.`
    };
  }

  return {
    isStudent: true,
    consecutiveAbsences: consecutive,
    shouldPromptRelegation: false
  };
}

/**
 * Check intelligent Visitor Restoration or Prolonged Exit Review
 */
export function checkVisitorStatusReview(
  member: Member,
  allGrades: WeeklyGradeRecord[],
  currentWeek: number,
  noRecordWeeks: number[] = []
): {
  isVisitor: boolean;
  consecutiveVisits: number;
  consecutiveAbsences: number;
  shouldPromptUpgradeToStudent: boolean;
  shouldPromptExitReview: boolean;
  promptMessage?: string;
} {
  if (member.memberType !== 'VISITOR') {
    return {
      isVisitor: false,
      consecutiveVisits: 0,
      consecutiveAbsences: 0,
      shouldPromptUpgradeToStudent: false,
      shouldPromptExitReview: false
    };
  }

  const consecutiveVisits = getConsecutiveVisits(member.id, currentWeek, allGrades, noRecordWeeks);
  const consecutiveAbsences = getConsecutiveAbsences(member.id, currentWeek, allGrades, 1, noRecordWeeks);

  // Upgrade prompt after 3 consecutive attendances
  if (consecutiveVisits >= 3) {
    return {
      isVisitor: true,
      consecutiveVisits,
      consecutiveAbsences,
      shouldPromptUpgradeToStudent: true,
      shouldPromptExitReview: false,
      promptMessage: `${member.fullName} has attended ${consecutiveVisits} consecutive times. Upgrade to Student?`
    };
  }

  // Prolonged absence exit review after 6 consecutive weeks absent
  if (consecutiveAbsences >= 6) {
    return {
      isVisitor: true,
      consecutiveVisits,
      consecutiveAbsences,
      shouldPromptUpgradeToStudent: false,
      shouldPromptExitReview: true,
      promptMessage: `This visitor (${member.fullName}) has been absent for ${consecutiveAbsences} consecutive weeks. Has this person exited the class? (Travelled, Relocated, Moved abroad, etc.)`
    };
  }

  return {
    isVisitor: true,
    consecutiveVisits,
    consecutiveAbsences,
    shouldPromptUpgradeToStudent: false,
    shouldPromptExitReview: false
  };
}

/**
 * Computes official quarter award winners based on report-card percentages.
 * MANDATORY: ONLY STUDENTS are eligible for awards (Visitors are strictly excluded).
 */
export function calculateQuarterAwards(
  members: Member[],
  allGrades: WeeklyGradeRecord[],
  totalWeeks: number = 12,
  noRecordWeeks: number[] = []
): QuarterAwardsSummary {
  // Step 1 & 2 & 3: Filter for Students only
  const eligibleStudents = (members || []).filter(m => m.memberType === 'STUDENT' && m.status !== 'LEFT_CLASS');

  if (eligibleStudents.length === 0) {
    return {
      memoryVerseWinner: null,
      punctualityWinner: null,
      participationWinner: null,
      overallDiligentWinner: null
    };
  }

  // Calculate stats for all eligible students
  const studentStats = eligibleStudents.map(student => ({
    student,
    stats: calculateMemberStats(student, allGrades, totalWeeks, noRecordWeeks)
  })).filter(item => item.stats.eligibleLessonsCount > 0);

  if (studentStats.length === 0) {
    return {
      memoryVerseWinner: null,
      punctualityWinner: null,
      participationWinner: null,
      overallDiligentWinner: null
    };
  }

  // 1. Punctuality Winner (Ranked by punctuality percentage)
  const punctualityRanked = [...studentStats].sort((a, b) => {
    if (b.stats.punctualityPercentage !== a.stats.punctualityPercentage) {
      return b.stats.punctualityPercentage - a.stats.punctualityPercentage;
    }
    if (b.stats.punctualityScoreObtained !== a.stats.punctualityScoreObtained) {
      return b.stats.punctualityScoreObtained - a.stats.punctualityScoreObtained;
    }
    return b.stats.eligibleLessonsCount - a.stats.eligibleLessonsCount;
  });

  const bestPunct = punctualityRanked[0];
  const punctualityWinner: AwardWinnerDetails | null = bestPunct ? {
    member: bestPunct.student,
    scoreObtained: bestPunct.stats.punctualityScoreObtained,
    maxObtainable: bestPunct.stats.punctualityMaxObtainable,
    eligibleLessons: bestPunct.stats.eligibleLessonsCount,
    percentage: bestPunct.stats.punctualityPercentage,
    totalScore: bestPunct.stats.punctualityScoreObtained,
    validOpportunities: bestPunct.stats.eligibleLessonsCount,
    averagePunctuality: bestPunct.stats.punctualityPercentage
  } : null;

  // 2. Memory Verse Winner (Ranked by memory verse percentage)
  const memoryVerseRanked = [...studentStats].sort((a, b) => {
    if (b.stats.memoryVersePercentage !== a.stats.memoryVersePercentage) {
      return b.stats.memoryVersePercentage - a.stats.memoryVersePercentage;
    }
    if (b.stats.memoryVerseScoreObtained !== a.stats.memoryVerseScoreObtained) {
      return b.stats.memoryVerseScoreObtained - a.stats.memoryVerseScoreObtained;
    }
    return b.stats.eligibleLessonsCount - a.stats.eligibleLessonsCount;
  });

  const bestMv = memoryVerseRanked[0];
  const memoryVerseWinner: AwardWinnerDetails | null = bestMv ? {
    member: bestMv.student,
    scoreObtained: bestMv.stats.memoryVerseScoreObtained,
    maxObtainable: bestMv.stats.memoryVerseMaxObtainable,
    eligibleLessons: bestMv.stats.eligibleLessonsCount,
    percentage: bestMv.stats.memoryVersePercentage,
    totalScore: bestMv.stats.memoryVerseScoreObtained,
    validOpportunities: bestMv.stats.eligibleLessonsCount,
    consistencyScore: bestMv.stats.memoryVersePercentage
  } : null;

  // 3. Class Participation Winner (Ranked by participation percentage)
  const participationRanked = [...studentStats].sort((a, b) => {
    if (b.stats.participationPercentage !== a.stats.participationPercentage) {
      return b.stats.participationPercentage - a.stats.participationPercentage;
    }
    if (b.stats.participationScoreObtained !== a.stats.participationScoreObtained) {
      return b.stats.participationScoreObtained - a.stats.participationScoreObtained;
    }
    return b.stats.eligibleLessonsCount - a.stats.eligibleLessonsCount;
  });

  const bestPart = participationRanked[0];
  const participationWinner: AwardWinnerDetails | null = bestPart ? {
    member: bestPart.student,
    scoreObtained: bestPart.stats.participationScoreObtained,
    maxObtainable: bestPart.stats.participationMaxObtainable,
    eligibleLessons: bestPart.stats.eligibleLessonsCount,
    percentage: bestPart.stats.participationPercentage,
    totalScore: bestPart.stats.participationScoreObtained,
    validOpportunities: bestPart.stats.eligibleLessonsCount,
    averageParticipation: bestPart.stats.participationPercentage
  } : null;

  // 4. Overall Diligent Winner (Ranked by Hard Work Rate)
  const diligentRanked = [...studentStats].sort((a, b) => {
    if (b.stats.hardWorkRate !== a.stats.hardWorkRate) {
      return b.stats.hardWorkRate - a.stats.hardWorkRate;
    }
    return b.stats.totalPointsEarned - a.stats.totalPointsEarned;
  });

  const bestDiligent = diligentRanked[0];
  const overallDiligentWinner = bestDiligent ? {
    member: bestDiligent.student,
    stats: bestDiligent.stats
  } : null;

  return {
    memoryVerseWinner,
    punctualityWinner,
    participationWinner,
    overallDiligentWinner
  };
}

/**
 * Checks if a visitor meets the qualification criteria to be converted into a Student:
 * Qualification 1: 3 Consecutive Weekly Visits
 * OR
 * Qualification 2: 50% Attendance over quarter
 */
export function checkVisitorQualification(
  member: Member,
  allGrades: WeeklyGradeRecord[],
  currentWeek: number = 12,
  noRecordWeeks: number[] = []
): VisitorQualification {
  if (member.memberType === 'STUDENT') {
    return {
      isQualified: true,
      reason: null,
      description: 'Already a registered student',
      consecutiveVisits: 0,
      attendancePercentage: 100,
      attendedWeeks: 0
    };
  }

  const memberGrades = allGrades.filter(
    g => g.memberId === member.id && !g.isNoRecordWeek && !noRecordWeeks.includes(g.weekNumber)
  );
  const presentGrades = memberGrades.filter(g => g.attendance === 'PRESENT');
  const attendedWeeks = presentGrades.length;

  const currentConsecutive = getConsecutiveVisits(member.id, currentWeek, allGrades, noRecordWeeks);

  const firstWeek = member.firstLessonWeek || 1;
  const elapsedWeeks = Math.max(1, currentWeek - firstWeek + 1);
  const percentageOverQuarter = Math.round((attendedWeeks / Math.max(1, currentWeek)) * 100);
  const percentageOverElapsed = Math.round((attendedWeeks / elapsedWeeks) * 100);
  const bestPercentage = Math.max(percentageOverQuarter, percentageOverElapsed);

  // Qualification 1: 3 Consecutive Visits
  if (currentConsecutive >= 3) {
    return {
      isQualified: true,
      reason: 'CONSECUTIVE_VISITS',
      description: `Qualified: ${currentConsecutive} Consecutive Visits Achieved (Min. 3 required)`,
      consecutiveVisits: currentConsecutive,
      attendancePercentage: bestPercentage,
      attendedWeeks
    };
  }

  // Qualification 2: 50% Attendance over elapsed period with min 3 visits
  if (attendedWeeks >= 3 && bestPercentage >= 50) {
    return {
      isQualified: true,
      reason: 'ATTENDANCE_PERCENTAGE',
      description: `Qualified: ${bestPercentage}% Attendance Achieved (50%+ required)`,
      consecutiveVisits: currentConsecutive,
      attendancePercentage: bestPercentage,
      attendedWeeks
    };
  }

  return {
    isQualified: false,
    reason: null,
    description: `Requires 3 consecutive visits (${currentConsecutive}/3) or 50% attendance (${bestPercentage}%/50%)`,
    consecutiveVisits: currentConsecutive,
    attendancePercentage: bestPercentage,
    attendedWeeks
  };
}

/**
 * Returns absence urgency level based on consecutive weeks absent
 */
export function getAbsenceUrgency(consecutiveWeeks: number): {
  level: AbsenceUrgency;
  label: string;
  badgeClass: string;
  actionRequired: string;
} {
  if (consecutiveWeeks === 1) {
    return {
      level: 'YELLOW',
      label: '1 Week Absent (Soft Check-in)',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      actionRequired: 'Send warm WhatsApp check-in message'
    };
  } else if (consecutiveWeeks === 2) {
    return {
      level: 'ORANGE',
      label: '2 Weeks Absent (Phone Call Log)',
      badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      actionRequired: 'Mandatory phone call log (Illness, Travel, Personal)'
    };
  } else if (consecutiveWeeks === 3) {
    return {
      level: 'RED',
      label: '3 Weeks Absent (Pastoral Alert & Escalation)',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse',
      actionRequired: 'Pastoral escalation decision required (Left / Relegate / High Probability)'
    };
  } else if (consecutiveWeeks >= 4) {
    return {
      level: 'CRITICAL',
      label: `${consecutiveWeeks} Weeks Absent (Critical Care)`,
      badgeClass: 'bg-rose-600/30 text-rose-200 border-rose-500/60 font-bold',
      actionRequired: 'Class Status Decision Required [Left Class / Relegate]'
    };
  }

  return {
    level: 'YELLOW',
    label: 'Normal Attendance',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    actionRequired: 'None'
  };
}

/**
 * Calculates Week Summary Header Bar Metrics from real data
 */
export function calculateWeekSummary(
  weekNumber: number,
  members: Member[],
  grades: WeeklyGradeRecord[],
  offerings: WeeklyOfferingRecord[],
  isNoRecordWeek: boolean = false
): WeekSummaryMetrics {
  if (isNoRecordWeek) {
    return {
      weekNumber,
      totalAttendance: 0,
      studentCount: 0,
      visitorCount: 0,
      newVisitorCount: 0,
      returningVisitorCount: 0,
      offeringAmount: 0,
      classAverageScore: 0
    };
  }

  const weekGrades = grades.filter(
    g => g.weekNumber === weekNumber && g.attendance === 'PRESENT' && !g.isNoRecordWeek
  );
  
  let studentCount = 0;
  let visitorCount = 0;
  let newVisitorCount = 0;
  let returningVisitorCount = 0;
  let totalScoreSum = 0;

  for (const grade of weekGrades) {
    const member = members.find(m => m.id === grade.memberId);
    if (!member) continue;

    totalScoreSum += (grade.lessonTotal || 0);

    if (member.memberType === 'STUDENT') {
      studentCount++;
    } else {
      visitorCount++;
      const priorVisits = grades.filter(
        g => g.memberId === member.id && g.weekNumber < weekNumber && g.attendance === 'PRESENT' && !g.isNoRecordWeek
      ).length;

      if (priorVisits === 0) {
        newVisitorCount++;
      } else {
        returningVisitorCount++;
      }
    }
  }

  const offering = offerings.find(o => o.weekNumber === weekNumber && !o.isNoRecordWeek);
  const offeringAmount = offering ? offering.amount : 0;
  const totalAttendance = studentCount + visitorCount;
  const classAverageScore = totalAttendance > 0
    ? Math.round((totalScoreSum / totalAttendance) * 10) / 10
    : 0;

  return {
    weekNumber,
    totalAttendance,
    studentCount,
    visitorCount,
    newVisitorCount,
    returningVisitorCount,
    offeringAmount,
    classAverageScore
  };
}

/**
 * Calculates cumulative offering across all weeks from real records
 */
export function calculateCumulativeOffering(offerings: WeeklyOfferingRecord[]): number {
  return offerings
    .filter(o => !o.isNoRecordWeek)
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
}

/**
 * Generates 2D Trend Data (+Y Students, -Y Visitors) across all 12 weeks
 */
export function generate2DTrendData(
  members: Member[],
  grades: WeeklyGradeRecord[],
  maxWeek: number = 12
) {
  const weeksData = [];

  for (let w = 1; w <= maxWeek; w++) {
    const weekPresentGrades = grades.filter(g => g.weekNumber === w && g.attendance === 'PRESENT');
    
    let students = 0;
    let visitors = 0;

    for (const g of weekPresentGrades) {
      const m = members.find(mem => mem.id === g.memberId);
      if (m?.memberType === 'STUDENT') {
        students++;
      } else if (m?.memberType === 'VISITOR') {
        visitors++;
      }
    }

    weeksData.push({
      week: w,
      students,
      visitors,
      total: students + visitors,
      netShift: students - visitors
    });
  }

  return weeksData;
}
