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
  if (parts.length === 3 && parts.every(part => /^\d+$/.test(part))) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const parsed = new Date(y, m, d, 12, 0, 0);
    if (
      !isNaN(parsed.getTime()) &&
      parsed.getFullYear() === y &&
      parsed.getMonth() === m &&
      parsed.getDate() === d
    ) return parsed;
    return fallback;
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
  const monthByQuarter = [8, 11, 2, 5];
  const calendarYear = quarterNumber <= 2 ? yearNum : yearNum + 1;
  const month = monthByQuarter[quarterNumber - 1];
  const firstOfMonth = new Date(calendarYear, month, 1, 12, 0, 0);
  const daysUntilSunday = (7 - firstOfMonth.getDay()) % 7;
  firstOfMonth.setDate(1 + daysUntilSunday);
  return firstOfMonth;
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
    const generatedSun13 = new Date(baseSunday);
    generatedSun13.setDate(baseSunday.getDate() + 12 * 7);
    const lastLessonSunday = new Date(baseSunday);
    lastLessonSunday.setDate(baseSunday.getDate() + 11 * 7);

    // Older records may retain a sharing date from a previous year after Week 1
    // is changed. Never let that stale value move Week 13 behind the lesson weeks.
    const configuredSun13 = quarter.sharingAdmonitionDate
      ? parseDateSafe(quarter.sharingAdmonitionDate, generatedSun13)
      : generatedSun13;
    const sun13 = configuredSun13 > lastLessonSunday && configuredSun13.getDay() === 0
      ? configuredSun13
      : generatedSun13;
    const thurs13 = new Date(sun13);
    thurs13.setDate(sun13.getDate() - 3);

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
  const workers = activeWorkers.filter(worker => worker.status === 'ACTIVE');
  const totalActive = workers.length;

  return schedule.map(item => {
    // Sunday Metrics
    const sunRecords = sundayAttendance.filter(a => a.serviceDate === item.sundayDate);
    const sunMap = new Map<string, WorkerAttendanceRecord>();
    sunRecords.forEach(r => sunMap.set(r.workerId, r));

    let sunPresent = 0;
    let sunLate = 0;
    let sunAbsent = 0;

    workers.forEach(w => {
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

    workers.forEach(w => {
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
  const eligibleWorkers = activeWorkers.filter(w => w.status === 'ACTIVE' && !w.exemptFromHonors);

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

/**
 * Computes the calendar-appropriate active week for a given quarter.
 * Aligns perfectly with the weekly schedule derived by getQuarterWeeklySchedule,
 * supporting week1SundayDate, startDate, and default quarter dates.
 * Clamped between 1 and totalWeeks (default 12 or 13).
 */
export function getCurrentCalendarWeek(quarter?: QuarterData | null, now: Date = new Date()): number {
  if (!quarter) return 1;
  const schedule = getQuarterWeeklySchedule(quarter, now.getFullYear());
  if (!schedule || schedule.length === 0) return 1;

  const todayIso = formatDateISO(now);

  // 1. Direct match on Sunday date
  const sundayMatch = schedule.find(s => s.sundayDate === todayIso);
  if (sundayMatch) return sundayMatch.weekNumber;

  // 2. Direct match on Prep Thursday date
  const prepMatch = schedule.find(s => s.prepDate === todayIso);
  if (prepMatch) return prepMatch.weekNumber;

  // 3. Range check: Monday through Sunday of each scheduled week
  for (const item of schedule) {
    const sunDate = parseDateSafe(item.sundayDate);
    const monDate = new Date(sunDate);
    monDate.setDate(sunDate.getDate() - 6);
    monDate.setHours(0, 0, 0, 0);
    const endOfSun = new Date(sunDate);
    endOfSun.setHours(23, 59, 59, 999);
    if (now >= monDate && now <= endOfSun) {
      return item.weekNumber;
    }
  }

  // 4. If before the first scheduled week, return week 1
  const firstSun = parseDateSafe(schedule[0].sundayDate);
  if (now < firstSun) return 1;

  // 5. If after the last scheduled week, return the last week
  return schedule[schedule.length - 1].weekNumber;
}

/**
 * Nigeria Local Timezone (Africa/Lagos, UTC+1).
 * Nigeria is strictly UTC+1 year-round without daylight saving adjustments.
 */
export function getNigeriaDate(date: Date = new Date()): Date {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 1)); // UTC+1
}

export function getNigeriaDateISO(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    return formatDateISO(getNigeriaDate(date));
  }
}

export function getNigeriaTimeParts(date: Date = new Date()): {
  isoDate: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 4 = Thu, 6 = Sat
  hours: number;
  minutes: number;
  timeString: string;
} {
  const ngDate = getNigeriaDate(date);
  return {
    isoDate: getNigeriaDateISO(date),
    dayOfWeek: ngDate.getDay(),
    hours: ngDate.getHours(),
    minutes: ngDate.getMinutes(),
    timeString: ngDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  };
}

/**
 * PHASE 1.1 - SUNDAY START
 * Checks whether the Sunday register for a given week is open.
 * The Sunday register strictly opens at Sunday 12:00 AM (00:00:00 Africa/Lagos).
 * Before Sunday (Monday - Saturday), it returns false.
 */
export function isSundayRegisterOpenForWeek(
  arg1: number | QuarterData | null | undefined,
  arg2?: number | QuarterData | null,
  now: Date = new Date()
): boolean {
  let weekNumber: number;
  let quarter: QuarterData | null | undefined;
  if (typeof arg1 === 'number') {
    weekNumber = arg1;
    quarter = arg2 as QuarterData | null | undefined;
  } else {
    quarter = arg1 as QuarterData | null | undefined;
    weekNumber = typeof arg2 === 'number' ? arg2 : 1;
  }

  if (!quarter) return true;
  const schedule = getQuarterWeeklySchedule(quarter, now.getFullYear());
  const item = schedule.find(s => s.weekNumber === weekNumber);
  if (!item) return false;

  const todayIso = getNigeriaDateISO(now);
  // If today in Nigeria is on or after the scheduled Sunday date, register is open!
  return todayIso >= item.sundayDate;
}

/**
 * PHASE 1.3 & 1.5 - ACTIVE REGISTER WEEK
 * Returns the currently active OPEN Sunday register week.
 * If the current calendar week's Sunday has arrived (Sunday 12:00 AM onwards),
 * returns current calendar week.
 * If the current calendar week is e.g. Week 4, but Week 4 Sunday has NOT arrived
 * (today is Tuesday - Saturday), the active open register is Week 3!
 */
export function getActiveSundayRegisterWeek(
  quarter?: QuarterData | null,
  now: Date = new Date()
): {
  currentCalendarWeek: number;
  activeRegisterWeek: number;
  isRegisterOpenForCalendarWeek: boolean;
  scheduledSundayDate?: string;
  explanation?: string;
} {
  const calWeek = getCurrentCalendarWeek(quarter, now);
  if (!quarter) {
    return {
      currentCalendarWeek: calWeek,
      activeRegisterWeek: calWeek,
      isRegisterOpenForCalendarWeek: true
    };
  }

  const schedule = getQuarterWeeklySchedule(quarter, now.getFullYear());
  const item = schedule.find(s => s.weekNumber === calWeek);
  const isOpen = isSundayRegisterOpenForWeek(calWeek, quarter, now);

  if (isOpen) {
    return {
      currentCalendarWeek: calWeek,
      activeRegisterWeek: calWeek,
      isRegisterOpenForCalendarWeek: true,
      scheduledSundayDate: item?.sundayDate
    };
  }

  // Before Sunday of the current calendar week:
  // Week 4 is the calendar week, but register is LOCKED.
  // Active completed/working register is Week 3 (or 1 if Week 1).
  const activeWeek = Math.max(1, calWeek - 1);
  return {
    currentCalendarWeek: calWeek,
    activeRegisterWeek: activeWeek,
    isRegisterOpenForCalendarWeek: false,
    scheduledSundayDate: item?.sundayDate,
    explanation: `Week ${calWeek} register will open on Sunday.`
  };
}

/**
 * PHASE 1.4 - FOLLOW-UP DEFAULT WEEK
 * Follow-up must NOT automatically use the calendar's future active week.
 * Before Week 4 Sunday arrives, FOLLOW-UP = Week 3.
 * Returns the latest completed Sunday with a valid register.
 */
export function getLatestCompletedSundayWeek(
  quarter?: QuarterData | null,
  now: Date = new Date()
): number {
  const info = getActiveSundayRegisterWeek(quarter, now);
  return info.activeRegisterWeek;
}

/**
 * PHASE 3 & 3.1 - THURSDAY DATE + TIME SECURITY
 * Checks BOTH DATE and TIME.
 * Verifies that Today = the actual Thursday belonging to that week.
 * If Week 5 Thursday has not arrived: Week 5 Thursday clocking = LOCKED,
 * even if current time falls inside normal clocking window.
 */
export function getThursdayClockInSecurity(
  targetPrepDate: string,
  configOrDate?: { thursdayOpenTime?: string; thursdayCloseTime?: string } | Date,
  nowInput?: Date,
  adminTestOverride: boolean = false
): {
  allowed: boolean;
  isOpen: boolean;
  isDateMatch: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  status: 'OPEN' | 'DATE_MISMATCH' | 'BEFORE_WINDOW' | 'AFTER_WINDOW' | 'TEST_MODE';
  reason: string;
} {
  const config = (configOrDate instanceof Date ? {} : configOrDate) || {};
  const now = (configOrDate instanceof Date ? configOrDate : nowInput) || new Date();

  if (adminTestOverride) {
    return {
      allowed: true,
      isOpen: true,
      isDateMatch: true,
      isToday: true,
      isPast: false,
      isFuture: false,
      status: 'TEST_MODE',
      reason: 'Admin Rehearsal / Test Mode Active'
    };
  }

  const todayIso = getNigeriaDateISO(now);
  const isToday = todayIso === targetPrepDate;
  const isPast = todayIso > targetPrepDate;
  const isFuture = todayIso < targetPrepDate;

  if (isFuture) {
    return {
      allowed: false,
      isOpen: false,
      isDateMatch: false,
      isToday: false,
      isPast: false,
      isFuture: true,
      status: 'DATE_MISMATCH',
      reason: `Thursday Preparatory Class for this week has not arrived yet. Scheduled date: ${targetPrepDate}. Clock-in remains locked.`
    };
  }

  if (isPast) {
    return {
      allowed: false,
      isOpen: false,
      isDateMatch: false,
      isToday: false,
      isPast: true,
      isFuture: false,
      status: 'DATE_MISMATCH',
      reason: `Thursday Preparatory Class date (${targetPrepDate}) has passed. Live clock-in is closed; past attendance can be reviewed or recorded manually.`
    };
  }

  // Today is the actual scheduled Thursday
  const ngParts = getNigeriaTimeParts(now);
  const openTime = config.thursdayOpenTime || '16:00';
  const closeTime = config.thursdayCloseTime || '19:00';
  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);
  const openMinutes = oH * 60 + oM;
  const closeMinutes = cH * 60 + cM;
  const nowMinutes = ngParts.hours * 60 + ngParts.minutes;

  if (nowMinutes < openMinutes) {
    return {
      allowed: false,
      isOpen: false,
      isDateMatch: true,
      isToday: true,
      isPast: false,
      isFuture: false,
      status: 'BEFORE_WINDOW',
      reason: `Thursday Clock-In window is not yet open. Opens at ${openTime} ahead of preparatory meeting.`
    };
  }

  if (nowMinutes > closeMinutes) {
    return {
      allowed: false,
      isOpen: false,
      isDateMatch: true,
      isToday: true,
      isPast: false,
      isFuture: false,
      status: 'AFTER_WINDOW',
      reason: `Thursday Clock-In window closed at ${closeTime}. Manual attendance remains available for authorized coordinators.`
    };
  }

  return {
    allowed: true,
    isOpen: true,
    isDateMatch: true,
    isToday: true,
    isPast: false,
    isFuture: false,
    status: 'OPEN',
    reason: 'Thursday Preparatory Session Active'
  };
}

/**
 * PHASE 4 - ATTENDANCE SECURITY (Sunday & Thursday)
 * Controls manual attendance (Present / Late / Absent / Excused) and live clock-in.
 */
export function getAttendanceSecurityState(
  serviceDate: string,
  openTime: string = '07:00',
  closeTime: string = '11:30',
  now: Date = new Date(),
  adminTestOverride: boolean = false
): {
  isFuture: boolean;
  isToday: boolean;
  isPast: boolean;
  clockingAllowed: boolean;
  canClockIn: boolean;
  manualAttendanceAllowed: boolean;
  canTakeManualAttendance: boolean;
  status: 'LOCKED_FUTURE' | 'BEFORE_WINDOW' | 'OPEN' | 'AFTER_WINDOW_MANUAL_OPEN' | 'PAST_MANUAL_OPEN' | 'TEST_MODE';
  lockReason?: string;
} {
  if (adminTestOverride) {
    return {
      isFuture: false,
      isToday: true,
      isPast: false,
      clockingAllowed: true,
      canClockIn: true,
      manualAttendanceAllowed: true,
      canTakeManualAttendance: true,
      status: 'TEST_MODE'
    };
  }

  const todayIso = getNigeriaDateISO(now);
  const isFuture = todayIso < serviceDate;
  const isPast = todayIso > serviceDate;
  const isToday = todayIso === serviceDate;

  // PHASE 4.1: Future attendance is NEVER enterable
  if (isFuture) {
    return {
      isFuture: true,
      isToday: false,
      isPast: false,
      clockingAllowed: false,
      canClockIn: false,
      manualAttendanceAllowed: false,
      canTakeManualAttendance: false,
      status: 'LOCKED_FUTURE',
      lockReason: `Attendance is LOCKED for future date (${serviceDate}). Attendance cannot be recorded before the date arrives.`
    };
  }

  // PHASE 4.3: Past dates can be reviewed/edited according to permissions
  if (isPast) {
    return {
      isFuture: false,
      isToday: false,
      isPast: true,
      clockingAllowed: false,
      canClockIn: false,
      manualAttendanceAllowed: true,
      canTakeManualAttendance: true,
      status: 'PAST_MANUAL_OPEN',
      lockReason: undefined
    };
  }

  // PHASE 4.2: Current date
  const ngParts = getNigeriaTimeParts(now);
  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);
  const openMinutes = oH * 60 + oM;
  const closeMinutes = cH * 60 + cM;
  const nowMinutes = ngParts.hours * 60 + ngParts.minutes;

  if (nowMinutes < openMinutes) {
    return {
      isFuture: false,
      isToday: true,
      isPast: false,
      clockingAllowed: false,
      canClockIn: false,
      manualAttendanceAllowed: false,
      canTakeManualAttendance: false,
      status: 'BEFORE_WINDOW',
      lockReason: `Attendance is LOCKED before the clocking window opens at ${openTime}.`
    };
  }

  if (nowMinutes > closeMinutes) {
    return {
      isFuture: false,
      isToday: true,
      isPast: false,
      clockingAllowed: false,
      canClockIn: false,
      manualAttendanceAllowed: true,
      canTakeManualAttendance: true,
      status: 'AFTER_WINDOW_MANUAL_OPEN',
      lockReason: undefined
    };
  }

  return {
    isFuture: false,
    isToday: true,
    isPast: false,
    clockingAllowed: true,
    canClockIn: true,
    manualAttendanceAllowed: true,
    canTakeManualAttendance: true,
    status: 'OPEN',
    lockReason: undefined
  };
}

