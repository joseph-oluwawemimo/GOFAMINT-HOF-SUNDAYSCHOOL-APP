/**
 * GOFAMINT SIB Read-Only Data Access Layer
 * 
 * Strict Read-Only Policy:
 * This layer contains ONLY read queries. No insert, update, delete, or upsert
 * statements are permitted here.
 */

import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  WeeklyOfferingRecord,
  SundaySchoolYear,
  QuarterNumber
} from '../../types';

import {
  getAllClassesDirectory,
  getAllMembers,
  getAllGrades,
  getAllAbsenceLogs,
  getAllOfferings,
  getSundaySchoolYear,
} from '../../db/indexedDB';

import {
  fetchCollection,
  fetchCollectionScoped,
} from '../../services/supabaseDatabase';

export interface SIBRawDataset {
  classes: ClassProfile[];
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  offerings: WeeklyOfferingRecord[];
  year: SundaySchoolYear | null;
  quarterNumber: QuarterNumber;
}

/**
 * Loads the complete dataset for SIB analysis.
 * Prioritizes Supabase cloud records with graceful IndexedDB fallback.
 */
export async function loadSIBRawDataset(targetQuarter?: QuarterNumber): Promise<SIBRawDataset> {
  let classes: ClassProfile[] = [];
  let members: Member[] = [];
  let grades: WeeklyGradeRecord[] = [];
  let absenceLogs: AbsenceLogRecord[] = [];
  let offerings: WeeklyOfferingRecord[] = [];
  let year: SundaySchoolYear | null = null;

  // 1. Try to fetch directly from Supabase client if available and online
  try {
    const [cloudClasses, cloudMembers, cloudGrades, cloudAbsences, cloudOfferings, cloudYears] = await Promise.all([
      fetchCollection<ClassProfile>('classes').catch(() => null),
      fetchCollection<Member>('members').catch(() => null),
      fetchCollection<WeeklyGradeRecord>('grades').catch(() => null),
      fetchCollection<AbsenceLogRecord>('absenceLogs').catch(() => null),
      fetchCollection<WeeklyOfferingRecord>('offerings').catch(() => null),
      fetchCollection<SundaySchoolYear>('sundaySchoolYear').catch(() => null),
    ]);

    if (cloudClasses) classes = cloudClasses;
    if (cloudMembers) members = cloudMembers;
    if (cloudGrades) grades = cloudGrades;
    if (cloudAbsences) absenceLogs = cloudAbsences;
    if (cloudOfferings) offerings = cloudOfferings;
    if (cloudYears && cloudYears.length > 0) year = cloudYears[0];
  } catch (cloudErr) {
    console.warn('[SIB DataAccess] Cloud fetch had errors, falling back to local store:', cloudErr);
  }

  // 2. Fall back to IndexedDB if any collection is empty (e.g. offline mode)
  if (classes.length === 0) {
    try { classes = await getAllClassesDirectory(false); } catch { /* ignore */ }
  }
  if (members.length === 0) {
    try { members = await getAllMembers(); } catch { /* ignore */ }
  }
  if (grades.length === 0) {
    try { grades = await getAllGrades(); } catch { /* ignore */ }
  }
  if (absenceLogs.length === 0) {
    try { absenceLogs = await getAllAbsenceLogs(); } catch { /* ignore */ }
  }
  if (offerings.length === 0) {
    try { offerings = await getAllOfferings(); } catch { /* ignore */ }
  }
  if (!year) {
    try { year = await getSundaySchoolYear(); } catch { /* ignore */ }
  }

  const activeQuarterNumber = (targetQuarter || year?.activeQuarterNumber || 1) as QuarterNumber;

  // Filter records to the requested quarter when quarterNumber is present on records
  const quarterGrades = grades.filter(g => !g.quarterNumber || g.quarterNumber === activeQuarterNumber);
  const quarterAbsences = absenceLogs.filter(a => !a.quarterNumber || a.quarterNumber === activeQuarterNumber);
  const quarterOfferings = offerings.filter(o => !o.quarterNumber || o.quarterNumber === activeQuarterNumber);

  return {
    classes,
    members,
    grades: quarterGrades,
    absenceLogs: quarterAbsences,
    offerings: quarterOfferings,
    year,
    quarterNumber: activeQuarterNumber,
  };
}

/**
 * Read-only helper: retrieves members belonging to a specific class
 */
export function getMembersForClass(members: Member[], classId: string): Member[] {
  return members.filter(m => m.classId === classId);
}

/**
 * Read-only helper: retrieves grades belonging to a specific class
 */
export function getGradesForClass(grades: WeeklyGradeRecord[], classId: string): WeeklyGradeRecord[] {
  return grades.filter(g => g.classId === classId);
}

/**
 * Read-only helper: retrieves absence logs belonging to a specific class
 */
export function getAbsenceLogsForClass(absenceLogs: AbsenceLogRecord[], classId: string): AbsenceLogRecord[] {
  return absenceLogs.filter(a => a.classId === classId);
}
