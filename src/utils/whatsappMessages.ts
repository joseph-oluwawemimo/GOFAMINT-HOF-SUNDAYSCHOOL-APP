import { LessonInfo } from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';

export interface AbsenceFollowUpOptions {
  memberName: string;
  className?: string;
  staffName?: string;
}

export interface VisitorWeeklyFollowUpOptions {
  visitorName: string;
  lesson?: LessonInfo;
  lessonTopic?: string;
  scriptureReading?: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  lessonSummary?: string;
  weekNumber?: number;
  className?: string;
  staffName?: string;
  customLessons?: LessonInfo[];
}

export interface StudentWeeklyReminderOptions {
  studentName: string;
  className?: string;
  lesson?: LessonInfo;
  lessonTopic?: string;
  scriptureReading?: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  lessonSummary?: string;
  weekNumber?: number;
  staffName?: string;
  customLessons?: LessonInfo[];
}

export interface ChildStudentFollowUpOptions {
  childName: string;
  parentName?: string;
  className?: string;
  lesson?: LessonInfo;
  lessonTopic?: string;
  scriptureReading?: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  lessonSummary?: string;
  weekNumber?: number;
  staffName?: string;
  isAbsence?: boolean;
  customLessons?: LessonInfo[];
}

export interface StudentCheckInFollowUpOptions {
  studentName: string;
  className?: string;
  lesson?: LessonInfo;
  lessonTopic?: string;
  scriptureReading?: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  weekNumber?: number;
  weeksAbsent?: number;
  staffName?: string;
  customLessons?: LessonInfo[];
}

export interface StaffAssignedFollowUpOptions {
  memberName: string;
  staffName: string;
  className?: string;
  isVisitor?: boolean;
  lesson?: LessonInfo;
  lessonTopic?: string;
  scriptureReading?: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  weekNumber?: number;
  customLessons?: LessonInfo[];
}

/**
 * Helper to resolve lesson info given an optional lesson object, custom pool,
 * or cached General Secretary distributed curriculum.
 */
export function getLessonByWeek(weekNumber?: number, customLessons?: LessonInfo[]): LessonInfo {
  // 1. Explicitly supplied custom lessons (e.g. from active Sunday School Year / distributed store)
  if (customLessons && customLessons.length > 0) {
    if (!weekNumber) return customLessons[0];
    const found = customLessons.find(l => l.weekNumber === weekNumber);
    if (found) return found;
  }

  // 2. Authoritative General Secretary distributed curriculum cached in browser storage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = window.localStorage.getItem('gofamint_distributed_lessons');
      if (cached) {
        const parsed = JSON.parse(cached) as LessonInfo[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!weekNumber) return parsed[0];
          const found = parsed.find(l => l.weekNumber === weekNumber);
          if (found) return found;
        }
      }
    }
  } catch {
    // Ignore browser storage access exceptions
  }

  // 3. Fallback pool
  const pool = GOFAMINT_HOF_12_LESSONS;
  if (!weekNumber) return pool[0];
  const found = pool.find(l => l.weekNumber === weekNumber);
  return found || pool[0];
}

/**
 * 1. ABSENCE FOLLOW-UP MESSAGE
 * Generates a warm, natural, human conversational message for absent/late students.
 * NEVER includes percentages, scores, internal metrics, or database information.
 */
export function generateAbsenceFollowUpMessage(options: AbsenceFollowUpOptions): string {
  const name = options.memberName.trim() || 'beloved';
  const staffSignoff = options.staffName ? `\n\nWarm regards,\n${options.staffName}${options.className ? ` (${options.className})` : ''}` : '';
  
  return `Hello ${name}, we didn't see you in Sunday School last Sunday and we wanted to check on you. We hope you're doing well. We missed having you with us and would love to know how you're doing.${staffSignoff}`;
}

/**
 * 2. VISITOR WEEKLY FOLLOW-UP
 * Intelligently incorporates current week's lesson topic, lesson text (scripture reading),
 * memory verse, and a warm invitation to fellowship without exposing technical metadata.
 * Grounded in the curriculum distributed by the General Secretary.
 */
export function generateVisitorWeeklyFollowUpMessage(options: VisitorWeeklyFollowUpOptions): string {
  const name = options.visitorName.trim() || 'friend';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber, options.customLessons);
  const staffSignoff = options.staffName ? `\n\nWarm regards,\n${options.staffName}${options.className ? ` (${options.className})` : ''}` : '';

  const topic = options.lessonTopic || lesson.topic;
  const scripture = options.scriptureReading || lesson.scriptureReading;
  const mv = options.memoryVerse || lesson.memoryVerse;
  const mvRef = options.memoryVerseRef || lesson.memoryVerseRef;

  const scriptureLine = scripture ? `\n📖 Lesson Text: ${scripture}` : '';
  const verseText = mv ? `\n💎 Memory Verse: "${mv}"${mvRef ? ` (${mvRef})` : ''}` : '';
  const summary = options.lessonSummary || (lesson.aim 
    ? `\n🎯 Spiritual Aim: ${lesson.aim.replace(/^To\s+/i, 'To ')}` 
    : '');

  return `Hello ${name}, we hope you're having a blessed week! We are warmly checking in from GOFAMINT House of Favour Sunday School.

This Sunday, our lesson is:
📌 Topic: "${topic}"${scriptureLine}${verseText}${summary}

We would love to have you fellowship with us again. Sunday School starts promptly at 8:00 a.m. We'll be glad to have you with us!${staffSignoff}`;
}

/**
 * 3. STUDENT — WEEKLY REMINDER
 * Generates a pre-Sunday reminder for students about upcoming lesson, class, start time (8:00 a.m.).
 * Prominently includes the Lesson Topic, Lesson Text (Scripture Reading), and Memory Verse
 * distributed by the General Secretary.
 */
export function generateStudentWeeklyReminderMessage(options: StudentWeeklyReminderOptions): string {
  const name = options.studentName.trim() || 'beloved';
  const className = options.className || 'Sunday School';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber, options.customLessons);
  const staffSignoff = options.staffName ? `\n\nWith love,\n${options.staffName}` : '';

  const topic = options.lessonTopic || lesson.topic;
  const scripture = options.scriptureReading || lesson.scriptureReading;
  const mv = options.memoryVerse || lesson.memoryVerse;
  const mvRef = options.memoryVerseRef || lesson.memoryVerseRef;

  const scriptureLine = scripture ? `\n📖 Lesson Text: ${scripture}` : '';
  const verseText = mv ? `\n💎 Memory Verse: "${mv}"${mvRef ? ` (${mvRef})` : ''}` : '';
  const summary = options.lessonSummary || (lesson.aim 
    ? `\n🎯 Aim: ${lesson.aim.replace(/^To\s+/i, 'To ')}` 
    : '');

  return `Hello ${name}, just a quick reminder about Sunday School this week at GOFAMINT House of Favour!

We'll be studying:
📌 Topic: "${topic}"${scriptureLine}${verseText}${summary}

You're a valued part of our ${className} class, and we'd love to have you with us. Please do your best to come early. Sunday School starts at 8:00 a.m.

We look forward to seeing you!${staffSignoff}`;
}

/**
 * 4. CHILD STUDENT — FOLLOW-UP & REMINDER
 * Generates a warm, loving message for child students and their parents/guardians,
 * featuring the lesson topic, scripture reading, and memory verse to practice at home.
 */
export function generateChildStudentFollowUpMessage(options: ChildStudentFollowUpOptions): string {
  const child = options.childName.trim() || 'our dear student';
  const parentSalutation = options.parentName?.trim() ? `Dear ${options.parentName.trim()}, ` : 'Hello! ';
  const className = options.className || 'Children Sunday School';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber, options.customLessons);
  const staffSignoff = options.staffName ? `\n\nWarm regards in Christ,\n${options.staffName}${options.className ? ` (${options.className})` : ''}` : '';

  const topic = options.lessonTopic || lesson.topic;
  const scripture = options.scriptureReading || lesson.scriptureReading;
  const mv = options.memoryVerse || lesson.memoryVerse;
  const mvRef = options.memoryVerseRef || lesson.memoryVerseRef;

  const scriptureLine = scripture ? `\n📖 Scripture Reading: ${scripture}` : '';
  const verseText = mv ? `\n💎 Memory Verse: "${mv}"${mvRef ? ` (${mvRef})` : ''}` : '';
  const summary = options.lessonSummary || (lesson.aim 
    ? `\n🎯 Lesson Aim: ${lesson.aim.replace(/^To\s+/i, 'To ')}` 
    : '');

  if (options.isAbsence) {
    return `${parentSalutation}we warmly missed having ${child} with us in ${className} last Sunday. We pray all is well with your family!

We wanted to share the upcoming Sunday School lesson with you so ${child} can prepare ahead:
📌 Topic: "${topic}"${scriptureLine}${verseText}${summary}

Sunday School starts at 8:00 a.m. We can't wait to see ${child} this coming Sunday!${staffSignoff}`;
  }

  return `${parentSalutation}warm greetings from GOFAMINT House of Favour! This is a quick note to encourage ${child} for Sunday School this coming Sunday in the ${className} class.

Here is our upcoming lesson to study and practice together at home:
📌 Topic: "${topic}"${scriptureLine}${verseText}${summary}

Please help ${child} memorize the verse before Sunday. Class starts at 8:00 a.m. We look forward to a joyful time together!${staffSignoff}`;
}

/**
 * 5. CERTIFIED STUDENT — PASTORAL FOLLOW-UP / CARE CHECK-IN
 * Follow-up for regular students who missed class or need pastoral encouragement,
 * providing the Sunday School topic, lesson text, and memory verse.
 */
export function generateStudentCheckInFollowUpMessage(options: StudentCheckInFollowUpOptions): string {
  const name = options.studentName.trim() || 'beloved';
  const className = options.className || 'Sunday School';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber, options.customLessons);
  const staffSignoff = options.staffName ? `\n\nWith love and prayers,\n${options.staffName}${options.className ? ` (${options.className})` : ''}` : '';

  const topic = options.lessonTopic || lesson.topic;
  const scripture = options.scriptureReading || lesson.scriptureReading;
  const mv = options.memoryVerse || lesson.memoryVerse;
  const mvRef = options.memoryVerseRef || lesson.memoryVerseRef;

  const scriptureLine = scripture ? `\n📖 Lesson Text: ${scripture}` : '';
  const verseText = mv ? `\n💎 Memory Verse: "${mv}"${mvRef ? ` (${mvRef})` : ''}` : '';

  const absencePrefix = (options.weeksAbsent && options.weeksAbsent > 0)
    ? `We missed having you with us in Sunday School recently and wanted to check in on you to make sure everything is okay.`
    : `We are thinking of you and praying for God's blessings upon your week!`;

  return `Hello ${name}, warm Christian greetings from ${className} at GOFAMINT House of Favour.

${absencePrefix}

Here is our upcoming Sunday School lesson:
📌 Topic: "${topic}"${scriptureLine}${verseText}

We would love to see you this Sunday at 8:00 a.m. Please let us know if there is anything we can uphold you in prayer for!${staffSignoff}`;
}

/**
 * 6. STAFF ASSIGNED FOLLOW-UP
 * Follow-up generated from the Staff Assignment console, identifying responsible teacher/staff
 * and including the General Secretary's distributed topic, text, and memory verse.
 */
export function generateStaffAssignedFollowUpMessage(options: StaffAssignedFollowUpOptions): string {
  const name = options.memberName.trim() || 'beloved';
  const staff = options.staffName.trim() || 'Your Sunday School Teacher';
  const className = options.className || 'our Sunday School class';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber, options.customLessons);
  const topic = options.lessonTopic || lesson.topic;
  const scripture = options.scriptureReading || lesson.scriptureReading;
  const mv = options.memoryVerse || lesson.memoryVerse;
  const mvRef = options.memoryVerseRef || lesson.memoryVerseRef;

  const scriptureLine = scripture ? `\n📖 Scripture: ${scripture}` : '';
  const verseText = mv ? `\n💎 Memory Verse: "${mv}"${mvRef ? ` (${mvRef})` : ''}` : '';

  return `Hello ${name}, this is ${staff} from ${className}. I wanted to warmly check on you to see how your week is going.

We're preparing for our lesson on "${topic}"${scriptureLine}${verseText} this coming Sunday at 8:00 a.m. and I'd really love to see you there. How are things with you and your family? Please let me know if there's anything we can pray about together!`;
}
