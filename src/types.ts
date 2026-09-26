export type DepartmentType = 
  | 'Adult'
  | 'Youth'
  | 'Teenagers'
  | 'Children' 
  | 'Teens' 
  | 'Young Adults' 
  | 'Men Fellowship' 
  | 'Women Fellowship' 
  | 'Elders' 
  | 'Searchers / Believers'
  | string;

export type AdminRoleType =
  | 'SUPER_ADMIN'
  | 'GENERAL_SUPERINTENDENT'
  | 'DEPARTMENT_SUPERINTENDENT'
  | 'GENERAL_SECRETARY'
  | 'TREASURER'
  | 'RECORD_OFFICER'
  | 'ENROLLMENT_OFFICER'
  | 'ASST_GENERAL_SECRETARY'
  | 'ASSISTANT_GENERAL_SECRETARY';

export interface AdminProfile {
  id: string; // role identifier e.g. 'GENERAL_SUPERINTENDENT'
  roleType: AdminRoleType;
  title: string; // e.g. 'General Superintendent'
  profileName: string; // Name of the officer e.g. 'Pastor Dr. E.O. Abina'
  username: string; // Auto-generated: e.g. 'gs_admin', 'gsec_admin', 'treasurer_admin', 'record_admin', 'enrollment_admin', etc.
  photoBase64?: string;
  /** Required for a Departmental Superintendent; stores the exact department id/name. */
  departmentId?: string;
  firebaseUid?: string; // Legacy import field; Supabase profile.id is the active identity.
  isApproved: boolean; // General Superintendent & General Secretary are auto-approved; others require GS approval
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuarterNumber = 1 | 2 | 3 | 4;
export type QuarterStatus = 'UPCOMING' | 'ACTIVE' | 'ARCHIVED';

export interface QuarterLesson {
  weekNumber: number; // 1 to 12 or 13, and mandatory Sharing & Admonition Week
  isSharingAdmonitionWeek?: boolean;
  topic: string;
  scriptureReading: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  aim?: string;
  lessonContent?: string;
}

export interface QuarterData {
  id: string; // e.g. 'Q1_2026'
  quarterNumber: QuarterNumber;
  quarterName: string; // 'First Quarter', 'Second Quarter', 'Third Quarter', 'Fourth Quarter'
  quarterTheme: string;
  startDate?: string; // Configurable start date
  endDate?: string; // Configurable end date
  week1ThursdayDate?: string; // Week 1 Preparatory Class date (Thursday)
  week1SundayDate?: string; // Week 1 Sunday School date (Sunday)
  sharingAdmonitionDate?: string; // Configurable Sharing & Admonition date
  totalLessonWeeks: 12 | 13;
  hasSharingAdmonitionWeek: boolean; // Always true: mandatory extra week
  status: QuarterStatus; // ACTIVE, ARCHIVED (Read-Only), UPCOMING
  isDistributed?: boolean; // True when General Secretary clicks LOAD & DISTRIBUTE ACROSS ALL CLASSES
  distributedAt?: string;
  lessons: QuarterLesson[];
  archivedAt?: string;
  /** Temporary executive override; the quarter remains historically archived while corrections are made. */
  archiveEditUnlocked?: boolean;
  archiveEditUnlockedAt?: string;
  archiveEditUnlockedBy?: string;
  updatedAt: string;
}

export interface SundaySchoolYear {
  id: string; // e.g. 'YEAR_2026'
  yearName: string; // e.g. '2025–2026'
  overallTheme: string;
  startDate?: string;
  endDate?: string;
  activeQuarterNumber: QuarterNumber;
  isInitialized?: boolean;
  quarters: QuarterData[];
  departments: string[]; // Custom and standard departments list
  archivedDepartments?: string[]; // Safely archived departments list
  updatedAt: string;
}

export type SystemSetupState = 'FRESH_SETUP' | 'SAMPLE_LOADED';

export type MemberType = 'STUDENT' | 'VISITOR';

export type MemberStatus = 
  | 'ACTIVE' 
  | 'LEFT_CLASS' 
  | 'RELEGATED_VISITOR' 
  | 'HIGH_PROBABILITY';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXEMPT';

export type AbsenceUrgency = 'YELLOW' | 'ORANGE' | 'RED' | 'CRITICAL';

export type AbsenceReasonCategory = 
  | 'ILLNESS' 
  | 'TRAVEL' 
  | 'PERSONAL' 
  | 'WORK_SCHOOL' 
  | 'RELOCATION' 
  | 'FAMILY_EMERGENCY' 
  | 'OTHER';

export type EscalationDecision = 
  | 'LEFT_CLASS' 
  | 'RELEGATED_VISITOR' 
  | 'HIGH_PROBABILITY';

export type ExitReviewOutcome =
  | 'CONTINUE_MONITORING'
  | 'TEMPORARY_EXIT'
  | 'PERMANENT_EXIT';

export interface TeacherInfo {
  id: string;
  name: string;
  phone: string;
  isHeadTeacher?: boolean;
}

export interface MemberQuarterEnrollment {
  quarterNumber: QuarterNumber;
  memberType: MemberType;
  status: MemberStatus;
  firstLessonWeek?: number;
  enrolledDate?: string;
  exitNote?: string;
  forwardedFromQuarter?: QuarterNumber;
  forwardedAt?: string;
  /** Consecutive PRESENT attendances carried from the end of the prior quarter. */
  consecutiveVisitsCarried?: number;
}

export interface ClassProfile {
  id: string;
  className: string; // serves as username
  department: DepartmentType;
  secretaryName: string;
  secretaryPhone: string;
  teachers: TeacherInfo[];
  quarterTitle: string;
  year: number;
  currencySymbol: string;
  isSetupComplete: boolean;
  approvalStatus?: 'APPROVED' | 'PENDING_APPROVAL' | 'PENDING_REGISTRATION';
  password?: string;
  approvedBy?: string;
  approvedAt?: string;
  quarter?: QuarterNumber;
  serverIp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisitorQualification {
  isQualified: boolean;
  reason: 'CONSECUTIVE_VISITS' | 'ATTENDANCE_PERCENTAGE' | null;
  description: string;
  consecutiveVisits: number;
  attendancePercentage: number;
  attendedWeeks: number;
}

export interface MemberStatusHistoryItem {
  fromStatus: string;
  toStatus: string;
  date: string;
  reason?: string;
  authorizedBy?: string;
}

export interface Member {
  id: string;
  classId?: string;
  className?: string;
  department?: string;
  fullName: string;
  phone: string;
  address: string;
  occupation: string;
  gender?: 'MALE' | 'FEMALE';
  dateOfBirth?: string;
  ageGroup?: string;
  memberType: MemberType;
  status: MemberStatus;
  statusHistory?: MemberStatusHistoryItem[];
  quarterEnrollments?: Partial<Record<QuarterNumber, MemberQuarterEnrollment>>;
  isBornAgain?: boolean;
  isWaterBaptized?: boolean;
  isHolyGhostBaptized?: boolean;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  prayerRequests: string;
  notes: string;
  photoBase64?: string;
  firstLessonWeek: number; // 1 to 13
  consecutiveVisits?: number;
  consecutiveAbsences?: number;
  convertedFromVisitorAtLesson?: number;
  referredByMemberId?: string;
  sponsorName?: string;
  evangelismReferralCount: number;
  enrolledDate?: string;
  certifiedBy?: string;
  certifiedAt?: string;
  exitNote?: string;
  exitReviewOutcome?: ExitReviewOutcome;
  exitReviewAt?: string;
  departureDate?: string;
  departureQuarter?: QuarterNumber;
  departureWeek?: number;
  departureReason?: string;
  temporaryExitSince?: string;
  exclusionType?: 'TEMPORARY' | 'PERMANENT';
  isOneTimeVisitor?: boolean;
  conversionStatus?: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'DENIED';
  conversionRequestedAt?: string;
  conversionRequestedBy?: string;
  displayOrder?: number;
  oneTimeProfileToken?: {
    token: string;
    expiresAt: string;
    isUsed: boolean;
    usedAt?: string;
  };
  reportCardToken?: {
    token: string;
    createdAt: string;
  };
  transferHistory?: StudentTransferRecord[];
  createdAt: string;
  updatedAt: string;
}

export type TransferRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StudentTransferRecord {
  id: string; // `transfer_${memberId}_${Date.now()}`
  memberId: string;
  memberType?: 'STUDENT' | 'VISITOR';
  studentId?: string; // alias
  memberName: string;
  studentName?: string; // alias
  previousDepartment: string;
  fromDepartment?: string; // alias
  previousClassId: string;
  fromClassId?: string; // alias
  previousClassName: string;
  fromClassName?: string; // alias
  destinationDepartment: string;
  toDepartment?: string; // alias
  destinationClassId: string;
  toClassId?: string; // alias
  destinationClassName: string;
  toClassName?: string; // alias
  status: TransferRequestStatus;
  reason: string;
  effectiveDate?: string;
  effectiveQuarter?: QuarterNumber;
  effectiveWeekNumber: number; // Lesson week from which student joins destination class
  effectiveWeek?: number; // alias
  requestingOfficer: string;
  requestedBy?: string; // alias
  requestedAt: string;
  approvingOfficer?: string;
  reviewedBy?: string; // alias
  approvalDate?: string;
  reviewedAt?: string; // alias
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================
// =============================================================
// RECORD OFFICER & ENROLLMENT OFFICER REPORTING INTERFACES
// =============================================================

export interface RecordOfficerClassRow {
  classId: string;
  className: string;
  department: string;
  teachersInCharge: string;
  // Class Membership Breakdown: TOTAL CLASS MEMBERS = STUDENTS + VISITORS
  studentsCount: number;
  visitorsCount: number;
  totalClassMembers: number;
  // Concise Weekly Attendance: TOTAL PRESENT + TOTAL ABSENT = TOTAL CLASS MEMBERS
  studentPresent: number;
  visitorPresent: number;
  totalPresent: number; // studentPresent + visitorPresent
  studentAbsent: number;
  visitorAbsent: number;
  totalAbsent: number; // studentAbsent + visitorAbsent
  offering: number;
  // Compatibility & inspection fields
  currentVisitorPresent: number;
  newVisitors: number;
  classMembersAbsent: number;
  registeredClassMembers: number; // Students + Existing Visitors before this week's new intake
  onboarded: number; // New Visitors formally onboarded into class this week
  endingActiveClassMembers: number; // Registered Class Members + Onboarded - Exited
  transfersIn?: number;
  transfersOut?: number;
  transferNotes?: string[];
  notes?: string;
}

export interface RecordOfficerWeeklyCollation {
  quarterNumber: number;
  weekNumber: number;
  rows: RecordOfficerClassRow[];
  totalStudentsCount: number;
  totalVisitorsCount: number;
  totalClassMembers: number;
  totalStudentPresent: number;
  totalVisitorPresent: number;
  grandTotalPresent: number;
  totalStudentAbsent: number;
  totalVisitorAbsent: number;
  totalClassMembersAbsent: number;
  totalOffering: number;
  // Compatibility fields
  totalCurrentVisitorPresent?: number;
  totalNewVisitors?: number;
  totalRegisteredClassMembers?: number;
  totalOnboarded?: number;
  totalEndingActiveClassMembers?: number;
}

export interface ConvertedStudentAudit {
  memberId: string;
  fullName: string;
  classId: string;
  className: string;
  department: string;
  quarterNumber: number;
  conversionWeek: number;
  previousStatus: 'VISITOR';
  currentStatus: 'STUDENT';
  firstLessonWeek: number;
  attendedWeeks: number[];
  consecutiveVisits: number;
  attendanceRate: number;
  conversionDate: string;
  certifiedBy?: string;
  certifiedAt?: string;
  phone?: string;
  occupation?: string;
  address?: string;
}

export interface EligibleVisitorCandidate {
  member: Member;
  classId: string;
  className: string;
  department: string;
  quarterNumber: number;
  consecutiveVisits: number;
  attendedWeeks: number[];
  attendanceRate: number;
  isEligible: boolean;
  eligibilityReason: string;
  firstLessonWeek: number;
}

export interface EnrollmentOfficerClassRow {
  weekNumber: number;
  classId: string;
  className: string;
  department: string;
  // LEFT SIDE — ONBOARDING (Intake History)
  newlyOnboarded: number;
  previouslyOnboarded: number;
  totalOnboarded: number; // newlyOnboarded + previouslyOnboarded
  // RIGHT SIDE — STATUS: VISITORS
  newVisitors: number; // = newlyOnboarded
  currentVisitors: number; // prev. total visitors - newly enrolled
  totalVisitors: number; // newVisitors + currentVisitors
  // RIGHT SIDE — STATUS: ENROLLMENT
  newlyEnrolled: number;
  previouslyEnrolled: number;
  totalEnrolled: number; // newlyEnrolled + previouslyEnrolled
  // Converted Audit Records
  convertedMembers: ConvertedStudentAudit[];
  // Compatibility fields
  broughtForwardStudents: number;
  previouslyEnrolledStudents: number;
  onboarded: number;
  visitorToStudent: number;
  currentStudentCount: number;
  currentVisitorCount: number;
  totalActiveClassMembers: number;
  transfersIn?: number;
  transfersOut?: number;
  transferNotes?: string[];
}

export interface EnrollmentOfficerWeeklyCollation {
  quarterNumber: number;
  selectedWeek: number;
  rows: EnrollmentOfficerClassRow[];
  weeklyTotals: {
    // Left side: Onboarding
    newlyOnboarded: number;
    previouslyOnboarded: number;
    totalOnboarded: number;
    // Right side: Status - Visitors
    newVisitors: number;
    currentVisitors: number;
    totalVisitors: number;
    // Right side: Status - Enrollment
    newlyEnrolled: number;
    previouslyEnrolled: number;
    totalEnrolled: number;
    // Compatibility fields
    broughtForwardStudents: number;
    previouslyEnrolledStudents: number;
    onboarded: number;
    visitorToStudent: number;
  };
  cumulativeTotals: {
    cumulativeOnboarded: number;
    cumulativeEnrollment: number;
    currentStudentPopulation: number;
    currentVisitorPopulation: number;
    totalActiveClassMembers: number;
  };
}

export interface EnrollmentCertificationRecord {
  id: string; // `cert_${memberId}_w${weekNumber}_q${quarterNumber}`
  memberId: string;
  memberName: string;
  classId: string;
  className: string;
  department?: string;
  quarterNumber: number;
  weekNumber: number;
  certifiedByOfficerId: string;
  certifiedByOfficerName: string;
  certifiedAt: string;
  reason?: string;
  notes?: string;
}

export interface WeeklyClassReturn {
  classId: string;
  className: string;
  department: string;
  teachersInCharge: string;
  enrolledCount: number;
  presentCount: number;
  absentCount: number;
  visitorCount: number;
  newVisitors: number;
  returningVisitors: number;
  totalAttendance: number;
  biblesBrought: number;
  workbooksUsed: number;
  offeringAmount: number;
  avgScore: number;
  notes?: string;
}

export interface WeeklyGeneralRecord {
  id: string;
  weekNumber: number;
  quarterNumber: number;
  yearName: string;
  sundayDate: string;
  topic: string;
  scriptureReading: string;
  memoryVerse: string;
  memoryVerseRef: string;
  totalClassesReporting: number;
  totalEnrolled: number;
  totalStudentsPresent: number;
  totalStudentsAbsent: number;
  totalVisitors: number;
  grandTotalAttendance: number;
  attendancePercentage: number;
  totalBibles: number;
  totalWorkbooks: number;
  totalOffering: number;
  overallAverageScore: number;
  classReturns: WeeklyClassReturn[];
  compiledBy: string;
  compiledAt: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface WeeklyGradeRecord {
  id: string; // `${memberId}_week_${weekNumber}` or `${classId}_${quarterNumber}_${memberId}_week_${weekNumber}`
  classId?: string;
  quarterNumber?: number;
  memberId: string;
  weekNumber: number; // 1-13
  attendance: AttendanceStatus;
  punctuality: number; // 0-15
  memoryVerse: number; // 0-15
  classParticipation: number; // 0-20
  lessonTotal: number; // 0-50
  joinedPrayerMeeting: boolean;
  postedStatusInsight: boolean;
  invitedSomeone: boolean;
  isNoRecordWeek?: boolean;
  notes?: string;
  updatedAt: string;
}

export type RemittanceStatus = 'PENDING_REMITTANCE' | 'REMITTED' | 'AUDITED';

export interface WeeklyOfferingRecord {
  id: string; // `week_${weekNumber}` or `${classId}_${quarterNumber}_week_${weekNumber}`
  classId?: string;
  quarterNumber?: number;
  weekNumber: number;
  amount: number;
  isNoRecordWeek?: boolean;
  remittanceStatus?: RemittanceStatus;
  remittedBy?: string;
  remittedAt?: string;
  auditedBy?: string;
  auditedAt?: string;
  auditedAmount?: number;
  recordedBy?: string;
  recordedAt?: string;
  notes?: string;
  changesAudit?: Array<{
    originalAmount: number;
    newAmount: number;
    timestamp: string;
    actor?: string;
    reason?: string;
  }>;
  isChildrenAccount?: boolean;
  accountType?: 'GENERAL' | 'CHILDREN';
  updatedAt: string;
}

export interface AbsenceLogRecord {
  id: string;
  classId?: string;
  quarterNumber?: number;
  memberId: string;
  weekNumber: number;
  consecutiveWeeksAbsent: number;
  urgencyLevel: AbsenceUrgency;
  contactMethod: 'WHATSAPP' | 'PHONE_CALL' | 'PASTORAL_VISIT' | 'IN_PERSON';
  reasonCategory?: AbsenceReasonCategory;
  escalationDecision?: EscalationDecision;
  decisionMade?: boolean;
  decisionDate?: string;
  exitNote?: string;
  notes: string;
  loggedAt: string;
}

export type ActiveTab = 
  | 'GRADING_MATRIX'
  | 'ROSTER_MANAGEMENT'
  | 'WELFARE_FOLLOW_UP'
  | 'QUARTER_ANALYSIS'
  | 'QR_PORTAL'
  | 'CLASS_DISCUSSION'
  | 'REPORT_CARD'
  | 'AI_ASSISTANT'
  | 'DATABASE_SETTINGS';

export type FollowUpActionType = 'WHATSAPP' | 'PHONE_CALL' | 'PASTORAL_VISITATION' | 'PROLONGED_EXIT_REVIEW';
export type FollowUpStatus = 'PENDING' | 'EXECUTED';

export interface FollowUpTask {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone?: string;
  memberType: MemberType;
  classId: string;
  quarterNumber: number;
  initialAbsentWeek: number;
  consecutiveWeeksAbsent: number;
  actionType: FollowUpActionType;
  actionLabel: string;
  status: FollowUpStatus;
  urgency: AbsenceUrgency;
  executedAt?: string;
  executedBy?: string;
  notes?: string;
  exitReason?: string;
  customReason?: string;
  exitDecision?: 'EXEMPT' | 'EXITED' | 'CONTINUE_MONITORING';
  createdAt: string;
  updatedAt: string;
}

export interface AdminComment {
  id: string;
  classId: string;
  className?: string;
  quarterNumber?: number;
  recordType: 'CLASS' | 'STUDENT' | 'WEEK' | 'GENERAL';
  recordId?: string;
  targetName?: string;
  authorName: string;
  authorRole: string; // e.g. 'General Superintendent', 'General Secretary', 'Class Secretary', 'Teacher', 'Treasurer', etc.
  authorId?: string;
  comment: string;
  replyToId?: string;
  createdAt: string;
  isRead?: boolean;
  isResolved?: boolean;
  responseStatus?: 'UNRESPONDED' | 'RESPONDED' | 'RESOLVED';
  respondedAt?: string;
  respondedBy?: string;
}

export type ExpenditureCategory =
  | 'STATIONERY_CURRICULUM'
  | 'SUNDAY_SCHOOL_EVENT'
  | 'AWARDS_PRIZES'
  | 'TRAINING_LOGISTICS'
  | 'WELFARE_BENEVOLENCE'
  | 'EQUIPMENT_MAINTENANCE'
  | 'OTHER_APPROVED_EXPENSE';

export interface TreasuryExpenditure {
  id: string;
  title: string;
  category: ExpenditureCategory;
  amount: number; // in NGN
  date: string; // YYYY-MM-DD
  quarterNumber?: number;
  authorizedBy: string;
  receiptNumber?: string;
  notes?: string;
  isChildrenAccount?: boolean;
  accountType?: 'GENERAL' | 'CHILDREN';
  createdAt: string;
}

export interface EvangelismReferralRecord {
  id: string;
  sponsorMemberId: string;
  visitorMemberId: string;
  weekIntroduced: number;
  dateCreated: string;
}

export interface LessonInfo {
  weekNumber: number;
  topic: string;
  scriptureReading: string;
  memoryVerse: string;
  memoryVerseRef: string;
  aim: string;
}

export interface CategoryReportStats {
  scoreObtained: number;
  maxObtainable: number;
  eligibleLessons: number;
  percentage: number; // 0 - 100 with 2 decimal places (e.g. 83.33)
}

export interface HardWorkStats {
  memberId: string;
  fullName: string;
  memberType: MemberType;
  firstLessonWeek: number;
  eligibleLessonsCount: number;
  weeksRecorded: number;
  attendedWeeks: number;
  exemptWeeks: number;
  absentWeeks: number;
  totalPointsEarned: number;
  totalPossiblePointsSinceFirst: number;
  totalScoreEarned?: number;
  totalPossibleScore?: number;
  hardWorkRate: number; // Percentage (0-100)

  // Formal Report-Card Scoring Categories
  punctualityStats: CategoryReportStats;
  memoryVerseStats: CategoryReportStats;
  participationStats: CategoryReportStats;

  // Direct percentage and score getters for transparent display
  punctualityScoreObtained: number;
  punctualityMaxObtainable: number;
  punctualityPercentage: number;
  memoryVerseScoreObtained: number;
  memoryVerseMaxObtainable: number;
  memoryVersePercentage: number;
  participationScoreObtained: number;
  participationMaxObtainable: number;
  participationPercentage: number;

  // Numerical averages preserved for compatibility
  avgPunctuality: number;
  avgMemoryVerse: number;
  avgParticipation: number;

  totalReferrals: number;
  prayerAttendanceCount: number;
  statusPostCount: number;
}

export interface SyncQueueItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'CLASS_PROFILE' | 'MEMBER' | 'GRADE' | 'OFFERING' | 'ABSENCE_LOG';
  data: any;
  createdAt: string;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  syncQueueCount: number;
  syncStatusText: string;
  realtimeStatus?: 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'ERROR' | 'IDLE';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}


export interface WeekSummaryMetrics {
  weekNumber: number;
  totalAttendance: number;
  studentCount: number;
  visitorCount: number;
  newVisitorCount: number;
  returningVisitorCount: number;
  offeringAmount: number;
  classAverageScore: number;
}

export interface SyncPayload {
  classProfile: ClassProfile | null;
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  absenceLogs: AbsenceLogRecord[];
  referrals: EvangelismReferralRecord[];
  timestamp: string;
  sourceClient: string;
}

// -------------------------------------------------------------
// WORKERS MODULE TYPES
// -------------------------------------------------------------

export type WorkerStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface WorkerCategoryDef {
  id: string;
  name: string;
  department: string;
  description?: string;
  isStandard?: boolean;
}

export interface WorkerProfile {
  id: string;
  sn?: number | string; // S/N (Serial Number)
  fullName: string; // Name
  gender?: 'MALE' | 'FEMALE'; // Sex
  department: string; // Department
  assignedClass?: string; // Class (e.g. Adult English, Beginner 1, Teens)
  duty?: string; // Duty / Primary Role (e.g. Class Teacher, Assistant Teacher, Usher, Choir Master)
  categories: string[]; // multi-role / multi-category array e.g. ['General Superintendent', 'Sunday School Teacher']
  phone: string; // Phone number
  whatsappNumber: string; // WhatsApp number
  address: string; // Address
  status: WorkerStatus;
  exemptFromHonors?: boolean; // When true, excluded from 12-week honorary rankings (e.g. Pastors) while keeping performance records
  exemptionReason?: string; // Reason for exemption from 12-week award ranking (e.g. Pastoral Council, Transferred, Health/Leave)
  archivedAt?: string; // If permanently archived
  archiveReason?: string;
  reassignmentReason?: string;
  email?: string;
  qrCodeToken: string; // Unique quick-scan identification code
  notes?: string;
  photoBase64?: string;
  joinedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type SundayAttendanceStatus = 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';

export interface WorkerAttendanceRecord {
  id: string; // `${workerId}_${serviceDate}`
  workerId: string;
  workerName: string;
  department: string;
  serviceDate: string; // YYYY-MM-DD
  serviceName: string; // 'Sunday Morning Service'
  clockInTime: string; // '08:17:24 AM'
  timestamp: number;
  status: SundayAttendanceStatus;
  isLate: boolean;
  method: 'QR_SCAN' | 'NAME_SEARCH' | 'DEPT_QUICK_ACCESS' | 'MANUAL_OVERRIDE';
  /** Week within the quarter (1–13). Optional on legacy records; always set on new clock-ins. */
  weekNumber?: number;
  /** Quarter within the Sunday School year. Optional on legacy records; always set on new clock-ins. */
  quarterNumber?: QuarterNumber;
  notes?: string;
  createdAt: string;
}

export type PrepAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface WorkerPrepAttendanceRecord {
  id: string; // `${workerId}_${prepDate}`
  workerId: string;
  workerName: string;
  department: string;
  prepDate: string; // YYYY-MM-DD
  sessionTitle: string; // 'Thursday Preparatory Class'
  weekNumber?: number;
  status: PrepAttendanceStatus;
  syllabusPrepared?: boolean;
  clockInTime?: string;
  clockInMethod?: string;
  markedBy?: string;
  notes?: string;
  updatedAt: string;
}

export interface ClockInConfig {
  id: string;
  serviceStartTime: string; // Default '07:45' (workers prayer) or '08:00'
  gracePeriodMinutes: number; // 15
  serviceDate: string; // YYYY-MM-DD
  serviceName: string; // 'Sunday Morning Service'
  autoSoundFeedback: boolean;
  showCelebration: boolean;

  // Sunday Service Configurable Windows
  sundayOpenTime?: string; // '07:00'
  sundayCloseTime?: string; // '11:30'
  sundayPrayerStartTime?: string; // '07:45'
  sundayLateCutoffTime?: string; // '08:00'

  // Thursday Prep Class Configurable Windows
  thursdayOpenTime?: string; // '16:00'
  thursdayCloseTime?: string; // '19:00'
  thursdayMeetingStartTime?: string; // '18:00'
  thursdayLateCutoffTime?: string; // '18:15'

  // Past Weeks Manual Lock & Controlled Change Requests
  // Key format: `${sessionType}_${quarterNumber}_${weekNumber}` (e.g. 'THURSDAY_1_3', 'SUNDAY_1_3')
  lockedWeeks?: Record<string, WeekLockRecord>;
}

export interface AttendanceChangeRequestRecord {
  id: string;
  sessionType: 'THURSDAY' | 'SUNDAY';
  quarterNumber: QuarterNumber;
  weekNumber: number;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reviewedBy?: string;
  reviewedAt?: string;
  completedAt?: string;
}

export interface WeekLockRecord {
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  activeChangeRequest?: AttendanceChangeRequestRecord;
  changeHistory?: AttendanceChangeRequestRecord[];
}

export type WorkersActiveTab = 
  | 'DIRECTORY'
  | 'CATEGORIES'
  | 'PREP_CLASS'
  | 'SUNDAY_CLOCK_IN'
  | 'SPECIAL_EVENTS'
  | 'MY_ATTENDANCE'
  | 'DASHBOARD';

// ==========================================
// SPECIAL WORKERS TRAINING & EVENTS MODULE
// ==========================================

export type SpecialEventType = 
  | 'WORKERS_TRAINING'
  | 'NEW_SESSION_WORKERS_TRAINING'
  | 'WORKERS_RETREAT'
  | 'WORKERS_MEETING'
  | 'SPECIAL_WORKERS_PROGRAM'
  | 'OTHER_COMPULSORY_EVENT';

export interface SpecialEventDaySchedule {
  date: string; // YYYY-MM-DD
  dayLabel: string; // 'Thursday', 'Friday', 'Saturday', 'Sunday', etc.
  programStartTime: string; // e.g. '17:00' (5:00 PM)
  clockInOpenTime: string; // e.g. '16:00' (4:00 PM)
  notes?: string;
}

export interface SpecialWorkersEvent {
  id: string;
  name: string;
  eventType: SpecialEventType;
  customTypeName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  venue?: string;
  description?: string;
  daySchedules: SpecialEventDaySchedule[];
  status: 'UPCOMING' | 'ACTIVE' | 'CONCLUDED' | 'ARCHIVED';
  isArchived?: boolean;
  archivedAt?: string;
  includeInPunctualityHonors?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialEventAttendanceRecord {
  id: string; // `${workerId}_${eventId}_${date}`
  workerId: string;
  workerName: string;
  department: string;
  eventId: string;
  eventName: string;
  date: string; // YYYY-MM-DD
  clockInTime: string; // e.g. '04:45:12 PM'
  timestamp: number;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  method: 'NAME_SEARCH' | 'QR_SCAN' | 'DEPT_LIST' | 'MANUAL';
  notes?: string;
  markedBy?: string;
  createdAt: string;
}
