import { 
  Member, 
  WeeklyGradeRecord, 
  LessonInfo, 
  ClassProfile 
} from '../types';
import { getLessonByWeek } from './whatsappMessages.js';
import { normalizePhoneNumber, buildWhatsAppDirectLink } from './phoneUtils.js';

export interface SSSRGenerateOptions {
  member: Member;
  weekNumber: number;
  classProfile?: ClassProfile | null;
  lesson?: LessonInfo;
  grade?: WeeklyGradeRecord | null;
  customKeyPoints?: [string, string, string] | string[];
  appBaseUrl?: string;
}

export interface SSSRReportResult {
  memberId: string;
  memberName: string;
  memberPhone: string;
  memberType: 'STUDENT' | 'VISITOR';
  isOneTimeVisitor: boolean;
  isPresent: boolean;
  weekNumber: number;
  lessonTopic: string;
  memoryVerse: string;
  memoryVerseRef: string;
  keyPoints: [string, string, string];
  punctualityScore?: number;
  memoryVerseScore?: number;
  participationScore?: number;
  totalScore?: number;
  registrationPercentage: number;
  registrationLink: string;
  studentProfileLink: string;
  formattedMessage: string;
  whatsAppDirectLink: string;
}

/**
 * Calculates a person's registration completion percentage (0 - 100%).
 */
export function calculateRegistrationPercentage(member: Member): number {
  if (member.isProfileCompleted) return 100;

  const fieldsToCheck: Array<unknown> = [
    member.fullName,
    member.phone,
    member.address,
    member.occupation,
    member.gender,
    member.dateOfBirth,
    member.nextOfKinName,
    member.nextOfKinPhone,
    member.prayerRequests
  ];

  let completed = 0;
  for (const field of fieldsToCheck) {
    if (typeof field === 'string' && field.trim().length > 0 && field.trim() !== '—') {
      completed++;
    } else if (field !== undefined && field !== null && field !== '') {
      completed++;
    }
  }

  return Math.min(100, Math.round((completed / fieldsToCheck.length) * 100));
}

/**
 * Resolves 3 key points entered by the class secretary for that week,
 * falling back to structured points derived from lesson metadata if not yet entered.
 */
export function resolveWeeklyKeyPoints(
  weekNumber: number,
  classProfile?: ClassProfile | null,
  customKeyPoints?: string[],
  lesson?: LessonInfo
): [string, string, string] {
  // 1. Explicitly passed customKeyPoints
  if (customKeyPoints && customKeyPoints.length >= 3 && customKeyPoints[0].trim()) {
    return [
      customKeyPoints[0].trim(),
      customKeyPoints[1].trim(),
      customKeyPoints[2].trim()
    ];
  }

  // 2. Class profile stored key points entered by Secretary: `w${weekNumber}`
  const profilePoints = classProfile?.weeklyLessonKeyPoints?.[`w${weekNumber}`];
  if (profilePoints && profilePoints.length >= 3 && profilePoints[0].trim()) {
    return [
      profilePoints[0].trim(),
      profilePoints[1].trim(),
      profilePoints[2].trim()
    ];
  }

  // 3. Sensible structured points derived from lesson aim/topic
  const topic = lesson?.topic || 'The Word of God';
  const scripture = lesson?.scriptureReading || lesson?.scriptureReferences || 'the Holy Scriptures';
  const aim = lesson?.aim || 'To deepen our spiritual walk and understanding';

  return [
    `God's Revealed Word: Deepening our understanding of "${topic}".`,
    `Scriptural Truth: Walking in obedience through ${scripture}.`,
    `Spiritual Fruit: ${aim.replace(/^To\s+/i, 'Living to ')}.`
  ];
}

/**
 * Generates the Personalized Sunday School Summary Report (SSSR) matching all 7 operational sections.
 */
export function generateSSSRReport(options: SSSRGenerateOptions): SSSRReportResult {
  const {
    member,
    weekNumber,
    classProfile,
    lesson: providedLesson,
    grade,
    customKeyPoints,
    appBaseUrl
  } = options;

  const lesson = providedLesson || getLessonByWeek(weekNumber);
  const topic = lesson.topic || 'Sunday School Lesson';
  const mv = lesson.memoryVerse || 'Thy word is a lamp unto my feet, and a light unto my path.';
  const mvRef = lesson.memoryVerseRef || lesson.memoryVerseReference || 'Psalm 119:105';
  const className = classProfile?.className || 'Sunday School';
  const memberName = member.fullName.trim() || 'Beloved';
  const isOneTimeVisitor = Boolean(member.isOneTimeVisitor);
  const isPresent = grade?.attendance === 'PRESENT';

  const keyPoints = resolveWeeklyKeyPoints(weekNumber, classProfile, customKeyPoints, lesson);
  const regPercentage = calculateRegistrationPercentage(member);

  const baseUrl = appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://gofamint-hof-sundayschool.web.app');
  const tokenParam = member.reportCardToken?.token || member.oneTimeProfileToken?.token || member.id;
  const registrationLink = `${baseUrl}/#student-profile?token=${tokenParam}&action=register`;
  const studentProfileLink = `${baseUrl}/#student-profile?token=${tokenParam}`;

  let punctualityScore: number | undefined;
  let memoryVerseScore: number | undefined;
  let participationScore: number | undefined;
  let totalScore: number | undefined;

  let message = '';

  if (isPresent) {
    punctualityScore = Number(grade?.punctuality ?? 0);
    memoryVerseScore = Number(grade?.memoryVerse ?? 0);
    participationScore = Number(grade?.classParticipation ?? 0);
    totalScore = Number(grade?.lessonTotal ?? (punctualityScore + memoryVerseScore + participationScore));

    // Qualitative punctuality feedback (no numerical scores in text)
    const punctualityFeedback = punctualityScore >= 10
      ? 'Thank you for arriving on time.'
      : 'We encourage prompt arrival by 8:00 a.m. next Sunday.';

    // Qualitative memory verse feedback
    const mvFeedback = memoryVerseScore >= 10
      ? 'Great job reciting your memory verse!'
      : 'We warmly encourage you to study your memory verse before next week.';

    // Qualitative participation feedback
    const partFeedback = participationScore >= 12
      ? 'You participated well in class, we are so proud of you!'
      : 'We encourage you to share your thoughts in class discussions next week.';

    // Registration link rule:
    // If 100%: only view record link. If < 100%: update registration & view score link.
    const linkLine = regPercentage >= 100
      ? `You can view your Sunday School attendance and performance record here:\n${studentProfileLink}`
      : `Your registration is still pending at ${regPercentage}%, please use this link to update your record and view your score:\n${registrationLink}`;

    // Two-paragraph concise report (<= 10 lines)
    const paragraph1 = `Hello ${memberName}, thanks for attending this past Sunday School. Your presence was a blessing to our class! ${punctualityFeedback} ${mvFeedback} ${partFeedback}\n${linkLine}`;

    const paragraph2 = `Keep meditating on God's Word from our lesson on "${topic}". Memory Verse: "${mv}" (${mvRef}). Your week is blessed! With love in Christ, ${className} Team · GOFAMINT House of Favour.`;

    message = `${paragraph1}\n\n${paragraph2}`;
  } else {
    // Absent Person Report: 2 paragraphs, warm check-in, no scores
    const linkLine = regPercentage >= 100
      ? `You can view your Sunday School attendance and performance record here:\n${studentProfileLink}`
      : `Your registration is still pending at ${regPercentage}%, please use this link to update your record and view your score:\n${registrationLink}`;

    const paragraph1 = `Hello ${memberName}, we missed having you in Sunday School this past Sunday and pray that all is well with you and your family. If you have any prayer requests, please let us know!\n${linkLine}`;

    const paragraph2 = `Keep meditating on God's Word from our lesson on "${topic}". Memory Verse: "${mv}" (${mvRef}). Your week is blessed, and we look forward to seeing you this Sunday at 8:00 a.m.! With love in Christ, ${className} Team · GOFAMINT House of Favour.`;

    message = `${paragraph1}\n\n${paragraph2}`;
  }

  const phoneDigits = normalizePhoneNumber(member.phone || '');
  const whatsAppDirectLink = buildWhatsAppDirectLink(phoneDigits, message);

  return {
    memberId: member.id,
    memberName,
    memberPhone: member.phone || '',
    memberType: member.memberType,
    isOneTimeVisitor,
    isPresent,
    weekNumber,
    lessonTopic: topic,
    memoryVerse: mv,
    memoryVerseRef: mvRef,
    keyPoints,
    punctualityScore,
    memoryVerseScore,
    participationScore,
    totalScore,
    registrationPercentage: regPercentage,
    registrationLink,
    studentProfileLink,
    formattedMessage: message,
    whatsAppDirectLink
  };
}
