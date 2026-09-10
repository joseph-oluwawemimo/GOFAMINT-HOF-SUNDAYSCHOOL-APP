import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  EvangelismReferralRecord,
  AdminProfile,
  SundaySchoolYear,
  WorkerProfile,
  WorkerAttendanceRecord,
  WorkerPrepAttendanceRecord,
  ClockInConfig,
  WorkerCategoryDef,
  SpecialWorkersEvent,
  SpecialEventAttendanceRecord,
  AdminComment,
  TreasuryExpenditure,
  LessonInfo,
  QuarterNumber
} from '../types';
import {
  getClassProfile,
  getAllClassesDirectory,
  getAllMembers,
  getAllGrades,
  getAllOfferings,
  getAllAbsenceLogs,
  getAllReferrals,
  getAllLessons,
  getAllAdminProfiles,
  getSundaySchoolYear,
  getAllDepartmentsList,
  getAllWorkers,
  getAllWorkerAttendance,
  getAllWorkerPrepAttendance,
  getClockInConfig,
  getAllWorkerCategories,
  getAllSpecialEvents,
  getAllSpecialEventAttendance,
  getAllAdminComments,
  getAllTreasuryExpenditures,
  getSyncQueue,
  getDB,
  saveLocalBrowserSnapshot
} from '../db/indexedDB';

export interface DataBackupSummary {
  totalAdminProfiles: number;
  totalClasses: number;
  totalStudents: number;
  totalVisitors: number;
  totalMembers: number;
  totalWorkers: number;
  totalGrades: number;
  totalOfferings: number;
  totalAbsenceLogs: number;
  totalReferrals: number;
  totalWorkerAttendance: number;
  totalWorkerPrepAttendance: number;
  totalSpecialEvents: number;
  totalSpecialEventAttendance: number;
  totalAdminComments: number;
  totalTreasuryExpenditures: number;
  totalDepartments: number;
  totalWorkerCategories: number;
  totalLessons: number;
  className: string;
  department: string;
  yearTheme?: string;
  yearName?: string;
}

export interface DataOnlyBackupPackage {
  _type: 'GOFAMINT_HOF_DATA_BACKUP';
  backupFormat: 'DATA_ONLY_V1' | 'DATA_ONLY_V2';
  application: string;
  exportDate: string;
  schemaVersion: string;
  metadata: {
    description: string;
    churchName: string;
    exportedBy?: string;
    note?: string;
  };
  summary: DataBackupSummary;
  records: {
    adminProfiles: AdminProfile[];
    classProfile: ClassProfile | null;
    allClasses: ClassProfile[];
    members: Member[];
    grades: WeeklyGradeRecord[];
    offerings: WeeklyOfferingRecord[];
    absenceLogs: AbsenceLogRecord[];
    referrals: EvangelismReferralRecord[];
    adminComments: AdminComment[];
    treasuryExpenditures: TreasuryExpenditure[];
    sundaySchoolYear: SundaySchoolYear | null;
    departments: string[];
    workers: WorkerProfile[];
    workerAttendance: WorkerAttendanceRecord[];
    workerPrepAttendance: WorkerPrepAttendanceRecord[];
    workerCategories: WorkerCategoryDef[];
    specialEvents: SpecialWorkersEvent[];
    specialEventAttendance: SpecialEventAttendanceRecord[];
    clockInConfig: ClockInConfig | null;
    lessons: LessonInfo[];
    syncQueue: any[];
  };
}

export interface ValidationPreviewResult {
  isValid: boolean;
  errorMessage?: string;
  backupDate?: string;
  schemaVersion?: string;
  backupFormat?: string;
  summary: DataBackupSummary;
  normalizedRecords: DataOnlyBackupPackage['records'];
}

export interface DataImportResult {
  success: boolean;
  message: string;
  safetySnapshotId?: string;
  mode: 'REPLACE_DATA' | 'MERGE_DATA';
  restoredCounts: DataBackupSummary;
}

/**
 * Gather pure persistent church records from IndexedDB.
 * STRICTLY EXCLUDES: UI state, active tab, component code, framework configs, temporary session flags.
 */
export async function generateDataOnlyBackup(note?: string, exportedBy?: string): Promise<DataOnlyBackupPackage> {
  const [
    classProfile,
    allClasses,
    members,
    grades,
    offerings,
    absenceLogs,
    referrals,
    lessons,
    adminProfiles,
    sundaySchoolYear,
    departments,
    workers,
    workerAttendance,
    workerPrepAttendance,
    clockInConfig,
    workerCategories,
    specialEvents,
    specialEventAttendance,
    adminComments,
    treasuryExpenditures,
    syncQueue
  ] = await Promise.all([
    getClassProfile(),
    getAllClassesDirectory(),
    getAllMembers(),
    getAllGrades(),
    getAllOfferings(),
    getAllAbsenceLogs(),
    getAllReferrals(),
    getAllLessons(),
    getAllAdminProfiles(),
    getSundaySchoolYear(),
    getAllDepartmentsList(),
    getAllWorkers(),
    getAllWorkerAttendance(),
    getAllWorkerPrepAttendance(),
    getClockInConfig(),
    getAllWorkerCategories(),
    getAllSpecialEvents(),
    getAllSpecialEventAttendance(),
    getAllAdminComments(),
    getAllTreasuryExpenditures(),
    getSyncQueue()
  ]);

  const students = members.filter(m => m.memberType === 'STUDENT');
  const visitors = members.filter(m => m.memberType === 'VISITOR');

  const summary: DataBackupSummary = {
    totalAdminProfiles: adminProfiles.length,
    totalClasses: allClasses.length || (classProfile ? 1 : 0),
    totalStudents: students.length,
    totalVisitors: visitors.length,
    totalMembers: members.length,
    totalWorkers: workers.length,
    totalGrades: grades.length,
    totalOfferings: offerings.length,
    totalAbsenceLogs: absenceLogs.length,
    totalReferrals: referrals.length,
    totalWorkerAttendance: workerAttendance.length,
    totalWorkerPrepAttendance: workerPrepAttendance.length,
    totalSpecialEvents: specialEvents.length,
    totalSpecialEventAttendance: specialEventAttendance.length,
    totalAdminComments: adminComments.length,
    totalTreasuryExpenditures: treasuryExpenditures.length,
    totalDepartments: departments.length,
    totalWorkerCategories: workerCategories.length,
    totalLessons: lessons.length,
    className: classProfile?.className || 'General Directorate',
    department: classProfile?.department || 'General',
    yearTheme: sundaySchoolYear?.overallTheme,
    yearName: sundaySchoolYear?.yearName
  };

  const backupPackage: DataOnlyBackupPackage = {
    _type: 'GOFAMINT_HOF_DATA_BACKUP',
    backupFormat: 'DATA_ONLY_V2',
    application: 'The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF) Sunday School & Workers Management System',
    exportDate: new Date().toISOString(),
    schemaVersion: '2.0',
    metadata: {
      description: 'Persistent church records data-only backup. Contains NO application code, UI state, or framework runtime.',
      churchName: 'The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF)',
      exportedBy: exportedBy || 'Sunday School Directorate',
      note: note?.trim() || undefined
    },
    summary,
    records: {
      adminProfiles,
      classProfile,
      allClasses,
      members,
      grades,
      offerings,
      absenceLogs,
      referrals,
      adminComments,
      treasuryExpenditures,
      sundaySchoolYear,
      departments,
      workers,
      workerAttendance,
      workerPrepAttendance,
      workerCategories,
      specialEvents,
      specialEventAttendance,
      clockInConfig,
      lessons,
      syncQueue
    }
  };

  return backupPackage;
}

/**
 * Triggers browser download of a clean JSON data-only backup file.
 * Filename format: gofamint-data-backup-YYYY-MM-DD.json
 */
export async function downloadDataOnlyBackupFile(customNote?: string): Promise<{ filename: string; sizeBytes: number; summary: DataBackupSummary }> {
  const backupPackage = await generateDataOnlyBackup(customNote);
  const jsonString = JSON.stringify(backupPackage, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const noteTag = customNote ? `-${customNote.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  const filename = `gofamint-data-backup-${year}-${month}-${day}${noteTag}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    filename,
    sizeBytes: blob.size,
    summary: backupPackage.summary
  };
}

/**
 * Validates any uploaded GOFAMINT_HOF JSON backup file (handles modern Data-Only format, v1-v4 snapshot packages, and flat legacy formats).
 * Maps and normalizes raw data into the current schema without modifying the database.
 */
export function validateAndPreviewDataBackup(rawJson: any): ValidationPreviewResult {
  if (!rawJson || typeof rawJson !== 'object') {
    return {
      isValid: false,
      errorMessage: 'The selected file is empty or not a valid JSON document.',
      summary: createEmptySummary(),
      normalizedRecords: createEmptyRecords()
    };
  }

  // Extract source container
  const rawRecords = rawJson.records || rawJson.data || rawJson;

  // Basic sanity validation
  const hasMembers = Array.isArray(rawRecords.members);
  const hasGrades = Array.isArray(rawRecords.grades);
  const hasWorkers = Array.isArray(rawRecords.workers);
  const hasClasses = Array.isArray(rawRecords.allClasses) || !!rawRecords.classProfile;
  const hasAdmins = Array.isArray(rawRecords.adminProfiles);
  const hasYear = !!rawRecords.sundaySchoolYear;

  if (!hasMembers && !hasGrades && !hasWorkers && !hasClasses && !hasAdmins && !hasYear) {
    return {
      isValid: false,
      errorMessage: 'File does not contain valid GOFAMINT_HOF church data records (No members, grades, workers, or classes detected).',
      summary: createEmptySummary(),
      normalizedRecords: createEmptyRecords()
    };
  }

  // Normalize each table to guarantee complete fields according to current application types
  const normalizedAdminProfiles: AdminProfile[] = Array.isArray(rawRecords.adminProfiles)
    ? rawRecords.adminProfiles.map((p: any) => ({
        id: p.id || `admin_${Date.now()}`,
        roleType: p.roleType || 'GENERAL_SUPERINTENDENT',
        title: p.title || 'Administrative Officer',
        profileName: p.profileName || 'Admin Officer',
        username: p.username || 'admin',
        photoBase64: p.photoBase64 || undefined,
        
        isApproved: p.isApproved !== undefined ? p.isApproved : true,
        approvedBy: p.approvedBy || undefined,
        approvedAt: p.approvedAt || undefined,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedClassProfile: ClassProfile | null = rawRecords.classProfile
    ? {
        id: rawRecords.classProfile.id || 'class_1',
        className: rawRecords.classProfile.className || 'Sunday School Class',
        department: rawRecords.classProfile.department || 'Young Adults',
        secretaryName: rawRecords.classProfile.secretaryName || '',
        secretaryPhone: rawRecords.classProfile.secretaryPhone || '',
        teachers: Array.isArray(rawRecords.classProfile.teachers) ? rawRecords.classProfile.teachers : [],
        
        quarterTitle: rawRecords.classProfile.quarterTitle || 'First Quarter',
        year: rawRecords.classProfile.year || 2026,
        currencySymbol: rawRecords.classProfile.currencySymbol || '₦',
        isSetupComplete: rawRecords.classProfile.isSetupComplete !== undefined ? rawRecords.classProfile.isSetupComplete : true,
        // A backup without explicit approval evidence must not grant access.
        approvalStatus: rawRecords.classProfile.approvalStatus || 'PENDING_APPROVAL',
        serverIp: rawRecords.classProfile.serverIp || undefined,
        createdAt: rawRecords.classProfile.createdAt || new Date().toISOString(),
        updatedAt: rawRecords.classProfile.updatedAt || new Date().toISOString()
      }
    : null;

  const normalizedAllClasses: ClassProfile[] = Array.isArray(rawRecords.allClasses)
    ? rawRecords.allClasses.map((c: any) => ({
        id: c.id || `class_${Date.now()}`,
        className: c.className || 'Class',
        department: c.department || 'Young Adults',
        secretaryName: c.secretaryName || '',
        secretaryPhone: c.secretaryPhone || '',
        teachers: Array.isArray(c.teachers) ? c.teachers : [],
        
        quarterTitle: c.quarterTitle || 'First Quarter',
        year: c.year || 2026,
        currencySymbol: c.currencySymbol || '₦',
        isSetupComplete: c.isSetupComplete !== undefined ? c.isSetupComplete : true,
        approvalStatus: c.approvalStatus || 'PENDING_APPROVAL',
        serverIp: c.serverIp || undefined,
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString()
      }))
    : normalizedClassProfile
    ? [normalizedClassProfile]
    : [];

  const normalizedMembers: Member[] = Array.isArray(rawRecords.members)
    ? rawRecords.members.map((m: any, idx: number) => ({
        id: m.id || `member_${Date.now()}_${idx}`,
        classId: m.classId || normalizedClassProfile?.id || undefined,
        fullName: m.fullName || 'Unnamed Member',
        phone: m.phone || '',
        address: m.address || '',
        occupation: m.occupation || '',
        gender: m.gender || undefined,
        dateOfBirth: m.dateOfBirth || undefined,
        ageGroup: m.ageGroup || undefined,
        memberType: m.memberType === 'VISITOR' ? 'VISITOR' : 'STUDENT',
        status: m.status || 'ACTIVE',
        statusHistory: Array.isArray(m.statusHistory) ? m.statusHistory : [],
        isBornAgain: !!m.isBornAgain,
        isWaterBaptized: !!m.isWaterBaptized,
        isHolyGhostBaptized: !!m.isHolyGhostBaptized,
        nextOfKinName: m.nextOfKinName || '',
        nextOfKinPhone: m.nextOfKinPhone || '',
        nextOfKinRelationship: m.nextOfKinRelationship || '',
        prayerRequests: m.prayerRequests || '',
        notes: m.notes || '',
        photoBase64: m.photoBase64 || undefined,
        firstLessonWeek: Number(m.firstLessonWeek) || 1,
        consecutiveVisits: Number(m.consecutiveVisits) || 0,
        consecutiveAbsences: Number(m.consecutiveAbsences) || 0,
        convertedFromVisitorAtLesson: m.convertedFromVisitorAtLesson ? Number(m.convertedFromVisitorAtLesson) : undefined,
        referredByMemberId: m.referredByMemberId || undefined,
        sponsorName: m.sponsorName || undefined,
        evangelismReferralCount: Number(m.evangelismReferralCount) || 0,
        enrolledDate: m.enrolledDate || undefined,
        exitNote: m.exitNote || undefined,
        createdAt: m.createdAt || new Date().toISOString(),
        updatedAt: m.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedGrades: WeeklyGradeRecord[] = Array.isArray(rawRecords.grades)
    ? rawRecords.grades.map((g: any, idx: number) => ({
        id: g.id || `${g.memberId || 'm'}_week_${g.weekNumber || idx}`,
        classId: g.classId || normalizedClassProfile?.id || undefined,
        quarterNumber: Number(g.quarterNumber) || 1,
        memberId: g.memberId || `unknown_member_${idx}`,
        weekNumber: Number(g.weekNumber) || 1,
        attendance: (g.attendance === 'ABSENT' || g.attendance === 'EXEMPT') ? g.attendance : 'PRESENT',
        punctuality: Math.min(15, Math.max(0, Number(g.punctuality) || 0)),
        memoryVerse: Math.min(15, Math.max(0, Number(g.memoryVerse) || 0)),
        classParticipation: Math.min(20, Math.max(0, Number(g.classParticipation) || 0)),
        lessonTotal: Math.min(50, Math.max(0, Number(g.lessonTotal) || (Number(g.punctuality || 0) + Number(g.memoryVerse || 0) + Number(g.classParticipation || 0)))),
        joinedPrayerMeeting: !!g.joinedPrayerMeeting,
        postedStatusInsight: !!g.postedStatusInsight,
        invitedSomeone: !!g.invitedSomeone,
        isNoRecordWeek: !!g.isNoRecordWeek,
        notes: g.notes || '',
        updatedAt: g.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedOfferings: WeeklyOfferingRecord[] = Array.isArray(rawRecords.offerings)
    ? rawRecords.offerings.map((o: any, idx: number) => ({
        id: o.id || `offering_${o.weekNumber || idx}`,
        classId: o.classId || normalizedClassProfile?.id || undefined,
        quarterNumber: Number(o.quarterNumber) || 1,
        weekNumber: Number(o.weekNumber) || 1,
        amount: Number(o.amount) || 0,
        isNoRecordWeek: !!o.isNoRecordWeek,
        notes: o.notes || '',
        recordedBy: o.recordedBy || undefined,
        updatedAt: o.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedAbsenceLogs: AbsenceLogRecord[] = Array.isArray(rawRecords.absenceLogs)
    ? rawRecords.absenceLogs.map((a: any, idx: number) => ({
        id: a.id || `absence_${Date.now()}_${idx}`,
        classId: a.classId || normalizedClassProfile?.id || undefined,
        quarterNumber: Number(a.quarterNumber) || 1,
        memberId: a.memberId || '',
        weekNumber: Number(a.weekNumber) || 1,
        consecutiveWeeksAbsent: Number(a.consecutiveWeeksAbsent) || 1,
        urgencyLevel: a.urgencyLevel || 'YELLOW',
        contactMethod: a.contactMethod || 'PHONE_CALL',
        reasonCategory: a.reasonCategory || undefined,
        escalationDecision: a.escalationDecision || undefined,
        decisionMade: !!a.decisionMade,
        decisionDate: a.decisionDate || undefined,
        exitNote: a.exitNote || undefined,
        notes: a.notes || '',
        loggedAt: a.loggedAt || new Date().toISOString()
      }))
    : [];

  const normalizedReferrals: EvangelismReferralRecord[] = Array.isArray(rawRecords.referrals)
    ? rawRecords.referrals.map((r: any, idx: number) => ({
        id: r.id || `ref_${Date.now()}_${idx}`,
        sponsorMemberId: r.sponsorMemberId || '',
        visitorMemberId: r.visitorMemberId || '',
        weekIntroduced: Number(r.weekIntroduced) || 1,
        dateCreated: r.dateCreated || new Date().toISOString()
      }))
    : [];

  const normalizedWorkers: WorkerProfile[] = Array.isArray(rawRecords.workers)
    ? rawRecords.workers.map((w: any, idx: number) => ({
        id: w.id || `worker_${Date.now()}_${idx}`,
        sn: w.sn !== undefined ? w.sn : idx + 1,
        fullName: w.fullName || 'Worker Name',
        gender: w.gender || undefined,
        department: w.department || 'General Workers',
        assignedClass: w.assignedClass || undefined,
        duty: w.duty || 'Worker',
        categories: Array.isArray(w.categories) && w.categories.length > 0 ? w.categories : [w.duty || 'Sunday School Worker'],
        phone: w.phone || '',
        whatsappNumber: w.whatsappNumber || w.phone || '',
        address: w.address || '',
        status: w.status || 'ACTIVE',
        exemptFromHonors: !!w.exemptFromHonors,
        exemptionReason: w.exemptionReason || undefined,
        archivedAt: w.archivedAt || undefined,
        archiveReason: w.archiveReason || undefined,
        reassignmentReason: w.reassignmentReason || undefined,
        email: w.email || undefined,
        qrCodeToken: w.qrCodeToken || `GOFAMINT_HOF-WRK-${Date.now().toString(36).toUpperCase()}-${idx}`,
        notes: w.notes || '',
        photoBase64: w.photoBase64 || undefined,
        joinedDate: w.joinedDate || undefined,
        createdAt: w.createdAt || new Date().toISOString(),
        updatedAt: w.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedWorkerAttendance: WorkerAttendanceRecord[] = Array.isArray(rawRecords.workerAttendance)
    ? rawRecords.workerAttendance.map((wa: any, idx: number) => ({
        id: wa.id || `${wa.workerId || 'w'}_${wa.serviceDate || idx}`,
        workerId: wa.workerId || '',
        workerName: wa.workerName || '',
        department: wa.department || 'General',
        serviceDate: wa.serviceDate || new Date().toISOString().split('T')[0],
        serviceName: wa.serviceName || 'Sunday Morning Service',
        clockInTime: wa.clockInTime || '08:00:00 AM',
        timestamp: Number(wa.timestamp) || Date.now(),
        status: wa.status || 'PRESENT',
        isLate: !!wa.isLate,
        method: wa.method || 'NAME_SEARCH',
        notes: wa.notes || '',
        createdAt: wa.createdAt || new Date().toISOString()
      }))
    : [];

  const normalizedWorkerPrepAttendance: WorkerPrepAttendanceRecord[] = Array.isArray(rawRecords.workerPrepAttendance)
    ? rawRecords.workerPrepAttendance.map((pa: any, idx: number) => ({
        id: pa.id || `${pa.workerId || 'w'}_${pa.prepDate || idx}`,
        workerId: pa.workerId || '',
        workerName: pa.workerName || '',
        department: pa.department || 'General',
        prepDate: pa.prepDate || new Date().toISOString().split('T')[0],
        sessionTitle: pa.sessionTitle || 'Thursday Preparatory Class',
        weekNumber: Number(pa.weekNumber) || 1,
        status: pa.status || 'PRESENT',
        syllabusPrepared: pa.syllabusPrepared !== undefined ? !!pa.syllabusPrepared : true,
        markedBy: pa.markedBy || undefined,
        notes: pa.notes || '',
        updatedAt: pa.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedWorkerCategories: WorkerCategoryDef[] = Array.isArray(rawRecords.workerCategories)
    ? rawRecords.workerCategories.map((wc: any, idx: number) => ({
        id: wc.id || `cat_${Date.now()}_${idx}`,
        name: wc.name || 'Category',
        department: wc.department || 'General',
        description: wc.description || '',
        isStandard: !!wc.isStandard
      }))
    : [];

  const normalizedSpecialEvents: SpecialWorkersEvent[] = Array.isArray(rawRecords.specialEvents)
    ? rawRecords.specialEvents.map((se: any, idx: number) => ({
        id: se.id || `event_${Date.now()}_${idx}`,
        name: se.name || 'Special Event',
        eventType: se.eventType || 'WORKERS_TRAINING',
        customTypeName: se.customTypeName || undefined,
        startDate: se.startDate || new Date().toISOString().split('T')[0],
        endDate: se.endDate || new Date().toISOString().split('T')[0],
        venue: se.venue || undefined,
        description: se.description || '',
        daySchedules: Array.isArray(se.daySchedules) ? se.daySchedules : [],
        status: se.status || 'ACTIVE',
        createdAt: se.createdAt || new Date().toISOString(),
        updatedAt: se.updatedAt || new Date().toISOString()
      }))
    : [];

  const normalizedSpecialEventAttendance: SpecialEventAttendanceRecord[] = Array.isArray(rawRecords.specialEventAttendance)
    ? rawRecords.specialEventAttendance.map((sa: any, idx: number) => ({
        id: sa.id || `${sa.workerId}_${sa.eventId}_${sa.date || idx}`,
        workerId: sa.workerId || '',
        workerName: sa.workerName || '',
        department: sa.department || 'General',
        eventId: sa.eventId || '',
        eventName: sa.eventName || '',
        date: sa.date || new Date().toISOString().split('T')[0],
        clockInTime: sa.clockInTime || '08:00:00 AM',
        timestamp: Number(sa.timestamp) || Date.now(),
        status: sa.status || 'PRESENT',
        method: sa.method || 'NAME_SEARCH',
        notes: sa.notes || '',
        markedBy: sa.markedBy || undefined,
        createdAt: sa.createdAt || new Date().toISOString()
      }))
    : [];

  const normalizedAdminComments: AdminComment[] = Array.isArray(rawRecords.adminComments)
    ? rawRecords.adminComments.map((ac: any, idx: number) => ({
        id: ac.id || `comment_${Date.now()}_${idx}`,
        classId: ac.classId || 'GENERAL',
        className: ac.className || undefined,
        recordType: ac.recordType || 'GENERAL',
        recordId: ac.recordId || undefined,
        targetName: ac.targetName || undefined,
        authorName: ac.authorName || 'Officer',
        authorRole: ac.authorRole || 'General Superintendent',
        comment: ac.comment || '',
        replyToId: ac.replyToId || undefined,
        createdAt: ac.createdAt || new Date().toISOString()
      }))
    : [];

  const normalizedTreasuryExpenditures: TreasuryExpenditure[] = Array.isArray(rawRecords.treasuryExpenditures)
    ? rawRecords.treasuryExpenditures.map((te: any, idx: number) => ({
        id: te.id || `exp_${Date.now()}_${idx}`,
        title: te.title || 'Expenditure',
        category: te.category || 'OTHER_APPROVED_EXPENSE',
        amount: Number(te.amount) || 0,
        date: te.date || new Date().toISOString().split('T')[0],
        authorizedBy: te.authorizedBy || 'General Superintendent',
        receiptNumber: te.receiptNumber || undefined,
        notes: te.notes || '',
        createdAt: te.createdAt || new Date().toISOString()
      }))
    : [];

  const normalizedDepartments: string[] = Array.isArray(rawRecords.departments)
    ? rawRecords.departments.map((d: any) => typeof d === 'string' ? d : (d.name || 'General'))
    : [];

  const rawQNum = Number(rawRecords.sundaySchoolYear?.activeQuarterNumber);
  const safeQNum: QuarterNumber = (rawQNum === 1 || rawQNum === 2 || rawQNum === 3 || rawQNum === 4) ? rawQNum : 1;

  const normalizedSundaySchoolYear: SundaySchoolYear | null = rawRecords.sundaySchoolYear
    ? {
        id: rawRecords.sundaySchoolYear.id || 'YEAR_2026',
        yearName: rawRecords.sundaySchoolYear.yearName || '2025–2026',
        overallTheme: rawRecords.sundaySchoolYear.overallTheme || 'Walking in the Light and Power of God',
        startDate: rawRecords.sundaySchoolYear.startDate || undefined,
        endDate: rawRecords.sundaySchoolYear.endDate || undefined,
        activeQuarterNumber: safeQNum,
        isInitialized: rawRecords.sundaySchoolYear.isInitialized !== undefined ? !!rawRecords.sundaySchoolYear.isInitialized : true,
        quarters: Array.isArray(rawRecords.sundaySchoolYear.quarters) ? rawRecords.sundaySchoolYear.quarters : [],
        departments: Array.isArray(rawRecords.sundaySchoolYear.departments) ? rawRecords.sundaySchoolYear.departments : normalizedDepartments,
        updatedAt: rawRecords.sundaySchoolYear.updatedAt || new Date().toISOString()
      }
    : null;

  const normalizedClockInConfig: ClockInConfig | null = rawRecords.clockInConfig
    ? {
        id: rawRecords.clockInConfig.id || 'SUNDAY_SERVICE_CONFIG',
        serviceStartTime: rawRecords.clockInConfig.serviceStartTime || '08:00',
        gracePeriodMinutes: Number(rawRecords.clockInConfig.gracePeriodMinutes) || 15,
        serviceDate: rawRecords.clockInConfig.serviceDate || new Date().toISOString().split('T')[0],
        serviceName: rawRecords.clockInConfig.serviceName || 'Sunday Morning Service',
        autoSoundFeedback: rawRecords.clockInConfig.autoSoundFeedback !== undefined ? !!rawRecords.clockInConfig.autoSoundFeedback : true,
        showCelebration: rawRecords.clockInConfig.showCelebration !== undefined ? !!rawRecords.clockInConfig.showCelebration : true
      }
    : null;

  const normalizedLessons: LessonInfo[] = Array.isArray(rawRecords.lessons)
    ? rawRecords.lessons
    : [];

  const normalizedSyncQueue: any[] = Array.isArray(rawRecords.syncQueue) ? rawRecords.syncQueue : [];

  const students = normalizedMembers.filter(m => m.memberType === 'STUDENT');
  const visitors = normalizedMembers.filter(m => m.memberType === 'VISITOR');

  const summary: DataBackupSummary = {
    totalAdminProfiles: normalizedAdminProfiles.length,
    totalClasses: normalizedAllClasses.length,
    totalStudents: students.length,
    totalVisitors: visitors.length,
    totalMembers: normalizedMembers.length,
    totalWorkers: normalizedWorkers.length,
    totalGrades: normalizedGrades.length,
    totalOfferings: normalizedOfferings.length,
    totalAbsenceLogs: normalizedAbsenceLogs.length,
    totalReferrals: normalizedReferrals.length,
    totalWorkerAttendance: normalizedWorkerAttendance.length,
    totalWorkerPrepAttendance: normalizedWorkerPrepAttendance.length,
    totalSpecialEvents: normalizedSpecialEvents.length,
    totalSpecialEventAttendance: normalizedSpecialEventAttendance.length,
    totalAdminComments: normalizedAdminComments.length,
    totalTreasuryExpenditures: normalizedTreasuryExpenditures.length,
    totalDepartments: normalizedDepartments.length,
    totalWorkerCategories: normalizedWorkerCategories.length,
    totalLessons: normalizedLessons.length,
    className: normalizedClassProfile?.className || rawJson.summary?.className || 'General Directorate',
    department: normalizedClassProfile?.department || rawJson.summary?.department || 'General',
    yearTheme: normalizedSundaySchoolYear?.overallTheme || rawJson.summary?.yearTheme,
    yearName: normalizedSundaySchoolYear?.yearName || rawJson.summary?.yearName
  };

  return {
    isValid: true,
    backupDate: rawJson.exportDate || rawJson.exportedAt || undefined,
    schemaVersion: rawJson.schemaVersion || rawJson.version || '1.0',
    backupFormat: rawJson.backupFormat || 'LEGACY_PACKAGE',
    summary,
    normalizedRecords: {
      adminProfiles: normalizedAdminProfiles,
      classProfile: normalizedClassProfile,
      allClasses: normalizedAllClasses,
      members: normalizedMembers,
      grades: normalizedGrades,
      offerings: normalizedOfferings,
      absenceLogs: normalizedAbsenceLogs,
      referrals: normalizedReferrals,
      adminComments: normalizedAdminComments,
      treasuryExpenditures: normalizedTreasuryExpenditures,
      sundaySchoolYear: normalizedSundaySchoolYear,
      departments: normalizedDepartments,
      workers: normalizedWorkers,
      workerAttendance: normalizedWorkerAttendance,
      workerPrepAttendance: normalizedWorkerPrepAttendance,
      workerCategories: normalizedWorkerCategories,
      specialEvents: normalizedSpecialEvents,
      specialEventAttendance: normalizedSpecialEventAttendance,
      clockInConfig: normalizedClockInConfig,
      lessons: normalizedLessons,
      syncQueue: normalizedSyncQueue
    }
  };
}

/**
 * Executes a verified pure data import into the database.
 * NEVER restores old application code, versions, UI, or configuration.
 * Maps old data cleanly into current application models.
 */
export async function executeDataOnlyImport(
  rawJson: any,
  mode: 'REPLACE_DATA' | 'MERGE_DATA' = 'REPLACE_DATA',
  onProgressStep?: (stepText: string, progressPct: number) => void
): Promise<DataImportResult> {
  const validation = validateAndPreviewDataBackup(rawJson);
  if (!validation.isValid) {
    throw new Error(validation.errorMessage || 'Invalid data backup file provided.');
  }

  onProgressStep?.('🛡️ Creating automatic safety snapshot of current data before import...', 15);

  // 1. Automatic Safety Snapshot
  let safetySnapshotId: string | undefined;
  try {
    const existingSnap = await saveLocalBrowserSnapshot(`Pre-Import Auto Safety Backup (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
    safetySnapshotId = existingSnap.id;
  } catch (snapErr) {
    console.warn('Auto safety snapshot notice:', snapErr);
  }

  const { normalizedRecords, summary } = validation;
  const db = await getDB();

  const putInStore = async (storeName: string, item: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  };

  // If REPLACE_DATA mode: clean out only data tables, keeping application 100% intact
  if (mode === 'REPLACE_DATA') {
    onProgressStep?.('🧹 Preparing fresh data storage records...', 30);
    const dataStores = [
      'classProfile',
      'members',
      'grades',
      'offerings',
      'absenceLogs',
      'referrals',
      'lessons',
      'adminProfiles',
      'sundaySchoolYear',
      'allClasses',
      'departments',
      'workers',
      'workerAttendance',
      'workerPrepAttendance',
      'clockInConfig',
      'workerCategories',
      'specialEvents',
      'specialEventAttendance',
      'adminComments',
      'treasuryExpenditures'
    ];

    for (const storeName of dataStores) {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
      } catch (e) {
        console.warn(`Clean store note (${storeName}):`, e);
      }
      try {
        localStorage.removeItem(`gofamint_${storeName}`);
      } catch (e) {
        // ignore
      }
    }
  }

  // 2. Write Admin Profiles & Credentials
  onProgressStep?.('🔐 Populating administrative accounts, titles & login permissions...', 45);
  for (const ap of normalizedRecords.adminProfiles) {
    await putInStore('adminProfiles', ap);
  }

  // 3. Write Class Profiles & Classes Directory
  if (normalizedRecords.classProfile) {
    await putInStore('classProfile', normalizedRecords.classProfile);
  }
  for (const c of normalizedRecords.allClasses) {
    await putInStore('allClasses', c);
  }

  // 4. Write Sunday School Year, Quarters & Departments
  onProgressStep?.('📚 Populating Sunday School year, 4 quarters & curriculum themes...', 60);
  if (normalizedRecords.sundaySchoolYear) {
    await putInStore('sundaySchoolYear', normalizedRecords.sundaySchoolYear);
  }
  for (const d of normalizedRecords.departments) {
    await putInStore('departments', { name: d });
  }
  for (const l of normalizedRecords.lessons) {
    await putInStore('lessons', l);
  }

  // 5. Write Members, 12-Week Grades, Offerings & Follow-up Logs
  onProgressStep?.('👥 Populating student rosters, visitor tracking, weekly scores & offerings...', 75);
  for (const m of normalizedRecords.members) {
    await putInStore('members', m);
  }
  for (const g of normalizedRecords.grades) {
    await putInStore('grades', g);
  }
  for (const o of normalizedRecords.offerings) {
    await putInStore('offerings', o);
  }
  for (const a of normalizedRecords.absenceLogs) {
    await putInStore('absenceLogs', a);
  }
  for (const r of normalizedRecords.referrals) {
    await putInStore('referrals', r);
  }
  for (const ac of normalizedRecords.adminComments) {
    await putInStore('adminComments', ac);
  }
  for (const te of normalizedRecords.treasuryExpenditures) {
    await putInStore('treasuryExpenditures', te);
  }

  // 6. Write Workers, Attendance, Categories & Special Events
  onProgressStep?.('👔 Populating workers directory, clock-in logs & preparatory attendances...', 90);
  for (const w of normalizedRecords.workers) {
    await putInStore('workers', w);
  }
  for (const wa of normalizedRecords.workerAttendance) {
    await putInStore('workerAttendance', wa);
  }
  for (const wpa of normalizedRecords.workerPrepAttendance) {
    await putInStore('workerPrepAttendance', wpa);
  }
  for (const wc of normalizedRecords.workerCategories) {
    await putInStore('workerCategories', wc);
  }
  for (const se of normalizedRecords.specialEvents) {
    await putInStore('specialEvents', se);
  }
  for (const sea of normalizedRecords.specialEventAttendance) {
    await putInStore('specialEventAttendance', sea);
  }
  if (normalizedRecords.clockInConfig) {
    await putInStore('clockInConfig', normalizedRecords.clockInConfig);
  }

  // Finalize system status
  localStorage.removeItem('gofamint_scratch_mode');
  if (normalizedRecords.classProfile?.approvalStatus === 'APPROVED') {
    sessionStorage.setItem('gofamint_unlocked', 'true');
  }

  onProgressStep?.('✅ Data import finalized and verified!', 100);

  return {
    success: true,
    message: `Data import successful! Populated ${summary.totalMembers} members (${summary.totalStudents} students, ${summary.totalVisitors} visitors), ${summary.totalGrades} score records, ${summary.totalWorkers} workers, ${summary.totalClasses} classes, and ${summary.totalAdminProfiles} administrative profiles.`,
    safetySnapshotId,
    mode,
    restoredCounts: summary
  };
}

function createEmptySummary(): DataBackupSummary {
  return {
    totalAdminProfiles: 0,
    totalClasses: 0,
    totalStudents: 0,
    totalVisitors: 0,
    totalMembers: 0,
    totalWorkers: 0,
    totalGrades: 0,
    totalOfferings: 0,
    totalAbsenceLogs: 0,
    totalReferrals: 0,
    totalWorkerAttendance: 0,
    totalWorkerPrepAttendance: 0,
    totalSpecialEvents: 0,
    totalSpecialEventAttendance: 0,
    totalAdminComments: 0,
    totalTreasuryExpenditures: 0,
    totalDepartments: 0,
    totalWorkerCategories: 0,
    totalLessons: 0,
    className: 'N/A',
    department: 'N/A'
  };
}

function createEmptyRecords(): DataOnlyBackupPackage['records'] {
  return {
    adminProfiles: [],
    classProfile: null,
    allClasses: [],
    members: [],
    grades: [],
    offerings: [],
    absenceLogs: [],
    referrals: [],
    adminComments: [],
    treasuryExpenditures: [],
    sundaySchoolYear: null,
    departments: [],
    workers: [],
    workerAttendance: [],
    workerPrepAttendance: [],
    workerCategories: [],
    specialEvents: [],
    specialEventAttendance: [],
    clockInConfig: null,
    lessons: [],
    syncQueue: []
  };
}
