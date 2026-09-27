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
  lessonSummary?: string;
  memoryVerse?: string;
  weekNumber?: number;
  className?: string;
  staffName?: string;
}

export interface StudentWeeklyReminderOptions {
  studentName: string;
  className?: string;
  lesson?: LessonInfo;
  lessonTopic?: string;
  lessonSummary?: string;
  memoryVerse?: string;
  weekNumber?: number;
  staffName?: string;
}

export interface StaffAssignedFollowUpOptions {
  memberName: string;
  staffName: string;
  className?: string;
  isVisitor?: boolean;
  lesson?: LessonInfo;
  lessonTopic?: string;
  weekNumber?: number;
}

/**
 * Helper to resolve lesson info given an optional lesson object or week number.
 */
export function getLessonByWeek(weekNumber?: number, customLessons?: LessonInfo[]): LessonInfo {
  const pool = customLessons && customLessons.length > 0 ? customLessons : GOFAMINT_HOF_12_LESSONS;
  if (!weekNumber) return pool[0];
  const found = pool.find(l => l.weekNumber === weekNumber);
  return found || pool[0];
}

/**
 * 1. FIX THE WHATSAPP FOLLOW-UP MESSAGE
 * Generates a warm, natural, human conversational message for absent/late students.
 * NEVER includes percentages, scores, internal metrics, or database information.
 */
export function generateAbsenceFollowUpMessage(options: AbsenceFollowUpOptions): string {
  const name = options.memberName.trim() || 'beloved';
  const staffSignoff = options.staffName ? `\n\nWarm regards,\n${options.staffName}${options.className ? ` (${options.className})` : ''}` : '';
  
  return `Hello ${name}, we didn't see you in Sunday School last Sunday and we wanted to check on you. We hope you're doing well. We missed having you with us and would love to know how you're doing.${staffSignoff}`;
}

/**
 * 3. ONE-TIME VISITOR — ONE-CLICK WEEKLY FOLLOW-UP
 * Intelligently incorporates current week's lesson topic, summary, memory verse,
 * and a warm invitation to fellowship without exposing technical metadata.
 */
export function generateVisitorWeeklyFollowUpMessage(options: VisitorWeeklyFollowUpOptions): string {
  const name = options.visitorName.trim() || 'friend';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber);
  const staffSignoff = options.staffName ? `\n\nWarm regards,\n${options.staffName}${options.className ? ` (${options.className})` : ''}` : '';

  const topic = options.lessonTopic || lesson.topic;
  const summary = options.lessonSummary || (lesson.aim 
    ? lesson.aim.replace(/^To\s+/i, 'how to ')
    : 'growing deeper in God\'s Word together');

  const mv = options.memoryVerse || lesson.memoryVerse;
  const verseText = mv ? ` Our memory verse is: "${mv}"${lesson.memoryVerseRef ? ` (${lesson.memoryVerseRef})` : ''}.` : '';

  return `Hello ${name}, we hope you're doing well. We're currently studying "${topic}" in Sunday School this week.\n\nWe'll be learning about ${summary}.${verseText}\n\nWe'd love to have you fellowship with us again. If you're around the area this Sunday, please feel free to join us. Sunday School starts at 8:00 a.m. We'll be glad to have you with us!${staffSignoff}`;
}

/**
 * 4. STUDENT — WEEKLY REMINDER
 * Generates a pre-Sunday reminder for students about upcoming lesson, class, start time (8:00 a.m.).
 */
export function generateStudentWeeklyReminderMessage(options: StudentWeeklyReminderOptions): string {
  const name = options.studentName.trim() || 'beloved';
  const className = options.className || 'Sunday School';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber);
  const staffSignoff = options.staffName ? `\n\nWith love,\n${options.staffName}` : '';

  const topic = options.lessonTopic || lesson.topic;
  const summary = options.lessonSummary || (lesson.aim 
    ? `We'll be exploring ${lesson.aim.replace(/^To\s+/i, 'how to ')}.` 
    : 'It promises to be a deeply enriching time in God\'s presence.');

  const mv = options.memoryVerse || lesson.memoryVerse;
  const verseText = mv ? `\n\nMemory Verse: "${mv}"${lesson.memoryVerseRef ? ` (${lesson.memoryVerseRef})` : ''}` : '';

  return `Hello ${name}, just a quick reminder about Sunday School this week.\n\nWe'll be learning about "${topic}", and it promises to be a great lesson. ${summary}${verseText}\n\nYou're part of the ${className} class, and we'd love to have you with us. Please do your best to come early. Sunday School starts at 8:00 a.m.\n\nWe look forward to seeing you!${staffSignoff}`;
}

/**
 * 10. STAFF IDENTITY IN FOLLOW-UP
 * Follow-up generated from the Staff Assignment console, identifying responsible teacher/staff.
 */
export function generateStaffAssignedFollowUpMessage(options: StaffAssignedFollowUpOptions): string {
  const name = options.memberName.trim() || 'beloved';
  const staff = options.staffName.trim() || 'Your Sunday School Teacher';
  const className = options.className || 'our Sunday School class';
  const lesson = options.lesson || getLessonByWeek(options.weekNumber);
  const topic = options.lessonTopic || lesson.topic;

  return `Hello ${name}, this is ${staff} from ${className}. I wanted to warmly check on you to see how your week is going.\n\nWe're preparing for our lesson on "${topic}" this coming Sunday at 8:00 a.m. and I'd really love to see you there. How are things with you and your family? Please let me know if there's anything we can pray about together!`;
}
