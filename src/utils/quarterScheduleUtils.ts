import { 
  SundaySchoolYear, 
  QuarterData, 
  QuarterNumber, 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord 
} from '../types';

export interface WeekScheduleInfo {
  weekNumber: number;
  sundayDate: string; // YYYY-MM-DD
  prepDate: string; // Thursday before Sunday (YYYY-MM-DD)
  topic?: string;
  scriptureReading?: string;
  memoryVerse?: string;
  isSharingAdmonitionWeek?: boolean;
}

export interface WeeklyMetricsSummary {
  weekNumber: number;
  sundayDate: string;
  prepDate: string;
  topic?: string;
  isSharingAdmonitionWeek?: boolean;
  // Sunday metrics
  sundayTotalActive: number;
  sundayTurnoutCount: number;
  sundayOnTimeCount: number;
  sundayLateCount: number;
  sundayAbsentCount: number;
  sundayTurnoutRate: number; // %
  sundayPunctualityRate: number; // %
  // Prep metrics
  prepTotalActive: number;
  prepTurnoutCount: number;
  prepOnTimeCount: number;
  prepLateCount: number;
  prepAbsentCount: number;
  prepTurnoutRate: number; // %
  prepPunctualityRate: number; // %
}

export interface WorkerPunctualityHonor {
  rank: 1 | 2 | 3;
  workerId: string;
  workerName: string;
  department: string;
  phone: string;
  photoBase64?: string;
  attendedCount: number;
  onTimeCount: number;
  lateCount: number;
  punctualityRate: number; // %
  totalQuarterWeeks: number;
  admonitionCitation: string;
}

// Format Date helper
export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateSafe(dateStr: string, fallback: Date = new Date()): Date {
  if (!dateStr) return fallback;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const parsed = new Date(y, m, d, 12, 0, 0);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * Format date nicely for human display, e.g. "04 Jan 2026" or "Sun, 04 Jan 2026"
 */
export function formatDateDisplay(
  dateStr?: string, 
  options: { showDayOfWeek?: boolean; shortMonth?: boolean } = {}
): string {
  if (!dateStr) return '—';
  const d = parseDateSafe(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const dayName = days[d.getDay()];
  const dayNum = String(d.getDate()).padStart(2, '0');
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();

  if (options.showDayOfWeek) {
    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  }
  return `${dayNum} ${monthName} ${year}`;
}

/**
 * Given a Sunday Service date (YYYY-MM-DD), calculate the Thursday Ministerial Preparatory Class date (-3 days)
 */
export function calculatePrepDateFromSunday(sundayDateStr: string): string {
  const sun = parseDateSafe(sundayDateStr);
  const thurs = new Date(sun);
  thurs.setDate(sun.getDate() - 3);
  return formatDateISO(thurs);
}

/**
 * Given a Thursday Preparatory Class date (YYYY-MM-DD), calculate the corresponding Sunday Service date (+3 days)
 */
export function calculateSundayFromPrepDate(prepDateStr: string): string {
  const thurs = parseDateSafe(prepDateStr);
  const sun = new Date(thurs);
  sun.setDate(thurs.getDate() + 3);
  return formatDateISO(sun);
}

/**
 * Format a week with its date badge, e.g. "Week 1 • Sun 04 Jan 2026 (Prep: Thu 01 Jan)"
 */
export function formatWeekWithDates(
  weekNumber: number, 
  sundayDateStr?: string, 
  prepDateStr?: string
): string {
  if (!sundayDateStr) return `Week ${weekNumber}`;
  const sunFormatted = formatDateDisplay(sundayDateStr, { showDayOfWeek: true });
  if (prepDateStr) {
    const prepFormatted = formatDateDisplay(prepDateStr, { showDayOfWeek: true });
    return `Week ${weekNumber} • ${sunFormatted} (Prep: ${prepFormatted})`;
  }
  return `Week ${weekNumber} • ${sunFormatted}`;
}

// Get fallback default start date for a Quarter
export function getDefaultQuarterStartDate(quarterNumber: QuarterNumber, yearNum: number = 2025): Date {
  if (quarterNumber === 1) {
    return new Date(2025, 8, 7, 12, 0, 0); // 07 September 2025 (Week 1 Sunday, Prep is 04 Sep 2025)
  } else if (quarterNumber === 2) {
    return new Date(2025, 11, 7, 12, 0, 0); // 07 December 2025 (Week 1 Sunday, Prep is 04 Dec 2025)
  } else if (quarterNumber === 3) {
    return new Date(2026, 2, 8, 12, 0, 0); // 08 March 2026 (Week 1 Sunday, Prep is 05 Mar 2026)
  } else {
    return new Date(2026, 5, 7, 12, 0, 0); // 07 June 2026 (Week 1 Sunday, Prep is 04 Jun 2026)
  }
}

export interface GeneratedQuarterPreview {
  quarterNumber: QuarterNumber;
  quarterName: string;
  startDate: string; // Week 1 Sunday
  endDate: string; // Week 12 Sunday
  sharingAdmonitionDate: string; // Week 13 Sunday
  firstPrepDate: string; // Week 1 Thursday
  lastPrepDate: string; // Week 13 Thursday
  totalWeeks: number;
}

/**
 * Auto-generate full 4 quarters (Q1 to Q4) calendar from the 1st Quarter 1st Sunday (or 1st Thursday Prep)
 * Each quarter has 13 weeks (12 lesson weeks + 1 sharing & admonition week).
 * Quarter 2 begins the Sunday right after Quarter 1 Week 13.
 */
export function generateFullYearQuarterPreviews(
  firstSundayDateStr: string
): GeneratedQuarterPreview[] {
  const baseSunday = parseDateSafe(firstSundayDateStr);
  const previews: GeneratedQuarterPreview[] = [];

  const quarterNames = ['First Quarter', 'Second Quarter', 'Third Quarter', 'Fourth Quarter'];

  for (let q = 1; q <= 4; q++) {
    // Week offset from Q1 start: (q - 1) * 13 weeks
    const quarterStartSun = new Date(baseSunday);
    quarterStartSun.setDate(baseSunday.getDate() + (q - 1) * 13 * 7);

    // Week 12 Sunday
    const quarterEndSun = new Date(quarterStartSun);
    quarterEndSun.setDate(quarterStartSun.getDate() + 11 * 7);

    // Week 13 Sunday (Sharing & Admonition)
    const quarterSharingSun = new Date(quarterStartSun);
    quarterSharingSun.setDate(quarterStartSun.getDate() + 12 * 7);

    // First Thursday Prep (Week 1 Sunday - 3 days)
    const firstPrep = new Date(quarterStartSun);
    firstPrep.setDate(quarterStartSun.getDate() - 3);

    // Last Thursday Prep (Week 13 Sunday - 3 days)
    const lastPrep = new Date(quarterSharingSun);
    lastPrep.setDate(quarterSharingSun.getDate() - 3);

    previews.push({
      quarterNumber: q as QuarterNumber,
      quarterName: quarterNames[q - 1],
      startDate: formatDateISO(quarterStartSun),
      endDate: formatDateISO(quarterEndSun),
      sharingAdmonitionDate: formatDateISO(quarterSharingSun),
      firstPrepDate: formatDateISO(firstPrep),
      lastPrepDate: formatDateISO(lastPrep),
      totalWeeks: 13
    });
  }

  return previews;
}

/**
 * Synchronize and apply generated 4-quarter dates into a full SundaySchoolYear structure
 */
export function applyGeneratedDatesToYear(
  existingYear: SundaySchoolYear,
  firstSundayDateStr: string,
  options: { yearName?: string; overallTheme?: string } = {}
): SundaySchoolYear {
  const previews = generateFullYearQuarterPreviews(firstSundayDateStr);

  const updatedQuarters = existingYear.quarters.map(q => {
    const preview = previews.find(p => p.quarterNumber === q.quarterNumber);
    if (!preview) return q;

    return {
      ...q,
      startDate: preview.startDate,
      endDate: preview.endDate,
      sharingAdmonitionDate: preview.sharingAdmonitionDate,
      totalLessonWeeks: 12 as const,
      hasSharingAdmonitionWeek: true,
      updatedAt: new Date().toISOString()
    };
  });

  const q1Preview = previews[0];
  const q4Preview = previews[3];

  const yearNum = parseDateSafe(firstSundayDateStr).getFullYear();
  const defaultYearName = `${yearNum}–${yearNum + 1} Sunday School Year`;

  return {
    ...existingYear,
    yearName: options.yearName || existingYear.yearName || defaultYearName,
    overallTheme: options.overallTheme || existingYear.overallTheme || 'Walking in Divine Light and Truth (1 John 1:7)',
    startDate: q1Preview.startDate,
    endDate: q4Preview.sharingAdmonitionDate,
    isInitialized: true,
    quarters: updatedQuarters,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Generate 12-week (or 13-week) schedule for a quarter
 * Calculates Sunday date and the Thursday Preparatory class date for that week (Sunday - 3 days)
 */
export function getQuarterWeeklySchedule(
  quarter: QuarterData, 
  yearNum: number = 2026
): WeekScheduleInfo[] {
  let baseSunday: Date;
  let baseThursday: Date;

  if (quarter.week1SundayDate) {
    baseSunday = parseDateSafe(quarter.week1SundayDate);
  } else if (quarter.startDate) {
    baseSunday = parseDateSafe(quarter.startDate);
  } else {
    baseSunday = getDefaultQuarterStartDate(quarter.quarterNumber, yearNum);
  }

  if (quarter.week1ThursdayDate) {
    baseThursday = parseDateSafe(quarter.week1ThursdayDate);
  } else {
    baseThursday = new Date(baseSunday);
    baseThursday.setDate(baseSunday.getDate() - 3);
  }

  const weeksCount = quarter.totalLessonWeeks || 12;
  const schedule: WeekScheduleInfo[] = [];

  for (let w = 1; w <= weeksCount; w++) {
    const sun = new Date(baseSunday);
    sun.setDate(baseSunday.getDate() + (w - 1) * 7);

    const thurs = new Date(baseThursday);
    thurs.setDate(baseThursday.getDate() + (w - 1) * 7);

    const lesson = quarter.lessons?.find(l => l.weekNumber === w);

    schedule.push({
      weekNumber: w,
      sundayDate: formatDateISO(sun),
      prepDate: formatDateISO(thurs),
      topic: lesson?.topic || `Lesson ${w}`,
      scriptureReading: lesson?.scriptureReading,
      memoryVerse: lesson?.memoryVerse,
      isSharingAdmonitionWeek: lesson?.isSharingAdmonitionWeek || w === 13
    });
  }

  // If quarter has sharing admonition week (week 13) and not yet included
  if (quarter.hasSharingAdmonitionWeek && weeksCount === 12) {
    const sun13 = quarter.sharingAdmonitionDate 
      ? parseDateSafe(quarter.sharingAdmonitionDate)
      : new Date(baseSunday.getTime() + 12 * 7 * 86400000);
    const thurs13 = new Date(baseThursday.getTime() + 12 * 7 * 86400000);

    const lesson13 = quarter.lessons?.find(l => l.weekNumber === 13);

    schedule.push({
      weekNumber: 13,
      sundayDate: formatDateISO(sun13),
      prepDate: formatDateISO(thurs13),
      topic: lesson13?.topic || 'Sharing, Admonition & Quarterly Love Feast',
      scriptureReading: lesson13?.scriptureReading || 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
      memoryVerse: lesson13?.memoryVerse || 'Let us consider one another in order to stir up love and good works.',
      isSharingAdmonitionWeek: true
    });
  }

  return schedule;
}

/**
 * Compute weekly metrics for all 12 weeks of a quarter
 */
export function computeQuarterWeeklyMetrics(
  schedule: WeekScheduleInfo[],
  activeWorkers: WorkerProfile[],
  sundayAttendance: WorkerAttendanceRecord[],
  prepAttendance: WorkerPrepAttendanceRecord[]
): WeeklyMetricsSummary[] {
  const totalActive = activeWorkers.length;

  return schedule.map(item => {
    // Sunday Metrics
    const sunRecords = sundayAttendance.filter(a => a.serviceDate === item.sundayDate);
    const sunMap = new Map<string, WorkerAttendanceRecord>();
    sunRecords.forEach(r => sunMap.set(r.workerId, r));

    let sunPresent = 0;
    let sunLate = 0;
    let sunAbsent = 0;

    activeWorkers.forEach(w => {
      const rec = sunMap.get(w.id);
      if (!rec) {
        sunAbsent++;
      } else if (rec.status === 'LATE' || rec.isLate) {
        sunLate++;
      } else if (rec.status === 'PRESENT') {
        sunPresent++;
      } else {
        sunAbsent++;
      }
    });

    const sundayTurnoutCount = sunPresent + sunLate;
    const sundayTurnoutRate = totalActive > 0 ? Math.round((sundayTurnoutCount / totalActive) * 100) : 0;
    const sundayPunctualityRate = sundayTurnoutCount > 0 ? Math.round((sunPresent / sundayTurnoutCount) * 100) : 0;

    // Prep Metrics
    const prepRecords = prepAttendance.filter(p => p.prepDate === item.prepDate);
    const prepMap = new Map<string, WorkerPrepAttendanceRecord>();
    prepRecords.forEach(p => prepMap.set(p.workerId, p));

    let prepPresent = 0;
    let prepLate = 0;
    let prepAbsent = 0;

    activeWorkers.forEach(w => {
      const rec = prepMap.get(w.id);
      if (!rec || rec.status === 'ABSENT') {
        prepAbsent++;
      } else if (rec.status === 'LATE') {
        prepLate++;
      } else if (rec.status === 'PRESENT') {
        prepPresent++;
      } else {
        prepAbsent++;
      }
    });

    const prepTurnoutCount = prepPresent + prepLate;
    const prepTurnoutRate = totalActive > 0 ? Math.round((prepTurnoutCount / totalActive) * 100) : 0;
    const prepPunctualityRate = prepTurnoutCount > 0 ? Math.round((prepPresent / prepTurnoutCount) * 100) : 0;

    return {
      weekNumber: item.weekNumber,
      sundayDate: item.sundayDate,
      prepDate: item.prepDate,
      topic: item.topic,
      isSharingAdmonitionWeek: item.isSharingAdmonitionWeek,
      sundayTotalActive: totalActive,
      sundayTurnoutCount,
      sundayOnTimeCount: sunPresent,
      sundayLateCount: sunLate,
      sundayAbsentCount: sunAbsent,
      sundayTurnoutRate,
      sundayPunctualityRate,
      prepTotalActive: totalActive,
      prepTurnoutCount,
      prepOnTimeCount: prepPresent,
      prepLateCount: prepLate,
      prepAbsentCount: prepAbsent,
      prepTurnoutRate,
      prepPunctualityRate
    };
  });
}

/**
 * Calculate Top 3 Workers with Highest Punctuality Rate across the 12 weeks
 * For Preparatory Class and Sunday Service SEPARATELY
 */
export interface WorkerQuarterPerformance {
  worker: WorkerProfile;
  prepAttended: number;
  prepOnTime: number;
  prepLate: number;
  prepPunctualityRate: number;
  sunAttended: number;
  sunOnTime: number;
  sunLate: number;
  sunPunctualityRate: number;
  overallPunctualityRate: number;
  isExempt: boolean;
  exemptionReason?: string;
}

/**
 * Computes comprehensive 12-week quarter performance for ALL active workers,
 * retaining full attendance & punctuality metrics regardless of exemption status.
 */
export function computeAllWorkersQuarterPerformance(
  workers: WorkerProfile[],
  schedule: WeekScheduleInfo[],
  sundayAttendance: WorkerAttendanceRecord[],
  prepAttendance: WorkerPrepAttendanceRecord[]
): WorkerQuarterPerformance[] {
  const lessonWeeks = schedule.filter(s => !s.isSharingAdmonitionWeek).slice(0, 12);
  const sundayDates = new Set(lessonWeeks.map(w => w.sundayDate));
  const prepDates = new Set(lessonWeeks.map(w => w.prepDate));

  return workers
    .filter(w => w.status === 'ACTIVE')
    .map(w => {
      let prepAttended = 0;
      let prepOnTime = 0;
      let prepLate = 0;

      prepAttendance
        .filter(p => p.workerId === w.id && prepDates.has(p.prepDate))
        .forEach(rec => {
          if (rec.status === 'PRESENT') {
            prepAttended++;
            prepOnTime++;
          } else if (rec.status === 'LATE') {
            prepAttended++;
            prepLate++;
          }
        });

      const prepPunctualityRate = prepAttended > 0 ? Math.round((prepOnTime / prepAttended) * 100) : 0;

      let sunAttended = 0;
      let sunOnTime = 0;
      let sunLate = 0;

      sundayAttendance
        .filter(a => a.workerId === w.id && sundayDates.has(a.serviceDate))
        .forEach(rec => {
          if (rec.status === 'PRESENT' && !rec.isLate) {
            sunAttended++;
            sunOnTime++;
          } else if (rec.status === 'LATE' || rec.isLate) {
            sunAttended++;
            sunLate++;
          }
        });

      const sunPunctualityRate = sunAttended > 0 ? Math.round((sunOnTime / sunAttended) * 100) : 0;

      const totalTurnout = prepAttended + sunAttended;
      const totalOnTime = prepOnTime + sunOnTime;
      const overallPunctualityRate = totalTurnout > 0 ? Math.round((totalOnTime / totalTurnout) * 100) : 0;

      return {
        worker: w,
        prepAttended,
        prepOnTime,
        prepLate,
        prepPunctualityRate,
        sunAttended,
        sunOnTime,
        sunLate,
        sunPunctualityRate,
        overallPunctualityRate,
        isExempt: !!w.exemptFromHonors,
        exemptionReason: w.exemptionReason
      };
    })
    .sort((a, b) => {
      // Sort non-exempt higher than exempt, then by overall punctuality rate descending
      if (a.isExempt !== b.isExempt) return a.isExempt ? 1 : -1;
      return b.overallPunctualityRate - a.overallPunctualityRate;
    });
}

export function computeTop3PunctualityHonors(
  activeWorkers: WorkerProfile[],
  schedule: WeekScheduleInfo[],
  sundayAttendance: WorkerAttendanceRecord[],
  prepAttendance: WorkerPrepAttendanceRecord[]
): {
  top3PrepClass: WorkerPunctualityHonor[];
  top3SundayService: WorkerPunctualityHonor[];
} {
  const lessonWeeks = schedule.filter(s => !s.isSharingAdmonitionWeek).slice(0, 12);
  const totalWeeks = lessonWeeks.length || 12;
  const sundayDates = new Set(lessonWeeks.map(w => w.sundayDate));
  const prepDates = new Set(lessonWeeks.map(w => w.prepDate));

  // Eligible workers for rankings (exclude exempted workers e.g. Pastors)
  const eligibleWorkers = activeWorkers.filter(w => !w.exemptFromHonors);

  // 1. Calculate Preparatory Class Punctuality for each eligible active worker
  const prepScores = eligibleWorkers.map(w => {
    let attended = 0;
    let onTime = 0;
    let late = 0;

    prepAttendance
      .filter(p => p.workerId === w.id && prepDates.has(p.prepDate))
      .forEach(rec => {
        if (rec.status === 'PRESENT') {
          attended++;
          onTime++;
        } else if (rec.status === 'LATE') {
          attended++;
          late++;
        }
      });

    const punctualityRate = attended > 0 ? Math.round((onTime / attended) * 100) : 0;
    // Score weighted by on-time attendance and punctuality percentage
    const compositeScore = punctualityRate * 1000 + onTime * 10 + attended;

    return {
      worker: w,
      attended,
      onTime,
      late,
      punctualityRate,
      compositeScore
    };
  });

  // Sort descending by score
  prepScores.sort((a, b) => b.compositeScore - a.compositeScore);

  const top3PrepClass: WorkerPunctualityHonor[] = prepScores.slice(0, 3).map((item, idx) => {
    const rank = (idx + 1) as 1 | 2 | 3;
    let citation = 'Diligent student of the Word and prompt at ministerial preparation.';
    if (rank === 1) citation = 'Gold Punctuality Laureate: Exemplary steadfastness & early arrival at Ministerial Preparatory Class. (2 Timothy 2:15)';
    else if (rank === 2) citation = 'Silver Punctuality Laureate: Outstanding commitment and punctuality in lesson preparation. (Proverbs 22:29)';
    else citation = 'Bronze Punctuality Laureate: Commendable diligence in weekly teacher study sessions. (Colossians 3:23)';

    return {
      rank,
      workerId: item.worker.id,
      workerName: item.worker.fullName,
      department: item.worker.department,
      phone: item.worker.phone,
      photoBase64: item.worker.photoBase64,
      attendedCount: item.attended,
      onTimeCount: item.onTime,
      lateCount: item.late,
      punctualityRate: item.punctualityRate,
      totalQuarterWeeks: totalWeeks,
      admonitionCitation: citation
    };
  });

  // 2. Calculate Sunday Service Punctuality for each eligible active worker
  const sundayScores = eligibleWorkers.map(w => {
    let attended = 0;
    let onTime = 0;
    let late = 0;

    sundayAttendance
      .filter(a => a.workerId === w.id && sundayDates.has(a.serviceDate))
      .forEach(rec => {
        if (rec.status === 'PRESENT' && !rec.isLate) {
          attended++;
          onTime++;
        } else if (rec.status === 'LATE' || rec.isLate) {
          attended++;
          late++;
        }
      });

    const punctualityRate = attended > 0 ? Math.round((onTime / attended) * 100) : 0;
    const compositeScore = punctualityRate * 1000 + onTime * 10 + attended;

    return {
      worker: w,
      attended,
      onTime,
      late,
      punctualityRate,
      compositeScore
    };
  });

  sundayScores.sort((a, b) => b.compositeScore - a.compositeScore);

  const top3SundayService: WorkerPunctualityHonor[] = sundayScores.slice(0, 3).map((item, idx) => {
    const rank = (idx + 1) as 1 | 2 | 3;
    let citation = 'Faithful early watchman in the Lord’s house every Sunday morning.';
    if (rank === 1) citation = 'Gold Punctuality Laureate: Prime punctuality vanguard at the Lord’s Sunday Sanctuary Services. (Psalm 122:1)';
    else if (rank === 2) citation = 'Silver Punctuality Laureate: Dedicated early arrival and faithful service in ministry duties. (Hebrews 6:10)';
    else citation = 'Bronze Punctuality Laureate: Commendable timeliness and devotion to sanctuary worship. (Ecclesiastes 3:1)';

    return {
      rank,
      workerId: item.worker.id,
      workerName: item.worker.fullName,
      department: item.worker.department,
      phone: item.worker.phone,
      photoBase64: item.worker.photoBase64,
      attendedCount: item.attended,
      onTimeCount: item.onTime,
      lateCount: item.late,
      punctualityRate: item.punctualityRate,
      totalQuarterWeeks: totalWeeks,
      admonitionCitation: citation
    };
  });

  return {
    top3PrepClass,
    top3SundayService
  };
}
