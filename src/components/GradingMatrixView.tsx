import React, { useState, useEffect } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  Calendar,
  BookOpen,
  Coins,
  Users,
  UserPlus,
  Check,
  X,
  Minus,
  Sparkles,
  HelpCircle,
  Share2,
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageCircle,
  Edit2,
  Save,
  PlusCircle,
  Printer,
  Copy,
  FileText,
  Star,
  Zap,
  PhoneCall,
  ShieldCheck,
  Lock,
  HandCoins,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  LessonInfo,
  AttendanceStatus,
  ClassProfile,
  AdminComment
} from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import { OfficialReturnPrintModal } from './OfficialReturnPrintModal';
import { saveAdminComment } from '../db/indexedDB';
import {
  calculateWeekSummary,
  checkVisitorQualification,
  calculateCumulativeOffering,
  checkStudentAbsenceCare,
  checkVisitorStatusReview
} from '../utils/calculations';

interface GradingMatrixViewProps {
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  lessons?: LessonInfo[];
  classProfile?: ClassProfile | null;
  adminComments?: AdminComment[];
  noRecordWeeks?: number[];
  totalWeeks?: number;
  quarterStatus?: 'ACTIVE' | 'ARCHIVED' | 'UPCOMING';
  selectedQuarter?: number;
  onOpenQuarterTransition?: () => void;
  onToggleNoRecordWeek?: (weekNumber: number) => void;
  onUpdateGrade: (grade: WeeklyGradeRecord) => void | Promise<void>;
  onUpdateOffering: (offering: WeeklyOfferingRecord) => void | Promise<void>;
  onUpdateLessonTopic?: (weekNumber: number, topic: string) => void | Promise<void>;
  onOpenAddVisitorWithReferral: (sponsorMemberId: string) => void;
  onQuickAddMember?: (fullName: string, phone: string, memberType: 'STUDENT' | 'VISITOR') => void | Promise<void>;
  onConvertVisitorToStudent?: (memberId: string) => void;
  onNavigateToRoster?: () => void;
  currencySymbol?: string;
}

interface ScoreInputProps {
  id?: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  className?: string;
  'aria-label'?: string;
}

const ScoreInput: React.FC<ScoreInputProps> = ({ id, value, max, disabled, onChange, className, 'aria-label': ariaLabel }) => {
  const [draft, setDraft] = useState<string | null>(null);

  const displayVal = draft !== null ? draft : (value === 0 ? '' : String(value));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
      const allScoreInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-score-input="true"]:not(:disabled)'));
      const currentIndex = allScoreInputs.indexOf(e.currentTarget);
      if (currentIndex !== -1) {
        if ((e.key === 'Enter' || e.key === 'ArrowDown') && currentIndex + 3 < allScoreInputs.length) {
          e.preventDefault();
          allScoreInputs[currentIndex + 3]?.focus();
          allScoreInputs[currentIndex + 3]?.select();
        } else if (e.key === 'ArrowUp' && currentIndex - 3 >= 0) {
          e.preventDefault();
          allScoreInputs[currentIndex - 3]?.focus();
          allScoreInputs[currentIndex - 3]?.select();
        } else if (e.key === 'ArrowRight' && currentIndex + 1 < allScoreInputs.length) {
          e.preventDefault();
          allScoreInputs[currentIndex + 1]?.focus();
          allScoreInputs[currentIndex + 1]?.select();
        } else if (e.key === 'ArrowLeft' && currentIndex - 1 >= 0) {
          e.preventDefault();
          allScoreInputs[currentIndex - 1]?.focus();
          allScoreInputs[currentIndex - 1]?.select();
        }
      }
    }
  };

  return (
    <input
      id={id}
      data-score-input="true"
      aria-label={ariaLabel || id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      disabled={disabled}
      value={displayVal}
      placeholder="0"
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        setDraft(value === 0 ? '' : String(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const valStr = e.target.value.replace(/[^0-9]/g, '');
        setDraft(valStr);
        if (valStr === '') {
          onChange(0);
          return;
        }
        const num = parseInt(valStr, 10);
        if (!isNaN(num)) {
          const clamped = Math.max(0, Math.min(max, num));
          onChange(clamped);
        }
      }}
      onBlur={() => {
        if (draft !== null) {
          const num = parseInt(draft, 10);
          const clamped = Math.max(0, Math.min(max, isNaN(num) ? 0 : num));
          onChange(clamped);
          setDraft(null);
        }
      }}
      className={className}
    />
  );
};

export const GradingMatrixView: React.FC<GradingMatrixViewProps> = ({
  selectedWeek,
  onSelectWeek,
  members,
  grades,
  offerings,
  lessons = GOFAMINT_HOF_12_LESSONS,
  classProfile,
  adminComments = [],
  noRecordWeeks = [],
  totalWeeks = 12,
  quarterStatus = 'ACTIVE',
  selectedQuarter = 1,
  onOpenQuarterTransition,
  onToggleNoRecordWeek,
  onUpdateGrade,
  onUpdateOffering,
  onUpdateLessonTopic,
  onOpenAddVisitorWithReferral,
  onQuickAddMember,
  onConvertVisitorToStudent,
  onNavigateToRoster,
  currencySymbol = '₦'
}) => {
  const isReadOnly = quarterStatus === 'ARCHIVED' || quarterStatus === 'UPCOMING';
  const isUpcoming = quarterStatus === 'UPCOMING';
  useScrollRestoration('grading_matrix');
  const [searchFilter, setSearchFilter] = usePersistedState<string>('gofamint_grading_search', '');
  const [typeFilter, setTypeFilter] = usePersistedState<'ALL' | 'STUDENT' | 'VISITOR'>('gofamint_grading_type', 'ALL');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  
  // Lesson Topic Editing State & Fallback to official curriculum
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const defaultQuarterLesson = GOFAMINT_HOF_12_LESSONS.find(l => l.weekNumber === selectedWeek);
  const foundLesson = lessons.find(l => l.weekNumber === selectedWeek);
  const isGenericTopic = !foundLesson?.topic || /^Lesson\s+\d+\s+Topic$/i.test(foundLesson.topic.trim());
  const resolvedTopic = isGenericTopic
    ? (defaultQuarterLesson?.topic || `Lesson ${selectedWeek} Topic`)
    : foundLesson.topic;

  const currentLesson: LessonInfo = {
    ...(defaultQuarterLesson || {
      weekNumber: selectedWeek,
      topic: resolvedTopic,
      scriptureReading: '',
      memoryVerse: '',
      memoryVerseRef: '',
      aim: ''
    }),
    ...(foundLesson || {}),
    topic: resolvedTopic,
    memoryVerse: foundLesson?.memoryVerse || defaultQuarterLesson?.memoryVerse || '',
    memoryVerseRef: foundLesson?.memoryVerseRef || defaultQuarterLesson?.memoryVerseRef || '',
    scriptureReading: foundLesson?.scriptureReading || defaultQuarterLesson?.scriptureReading || ''
  };
  const [topicDraft, setTopicDraft] = useState(currentLesson.topic);

  useEffect(() => {
    setTopicDraft(currentLesson.topic);
  }, [currentLesson.topic, selectedWeek]);

  // Quick Add Member Inline State (Default & only to Visitor)
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorPhone, setNewVisitorPhone] = useState('');
  const [newVisitorSponsorId, setNewVisitorSponsorId] = useState('');

  // Weekly Secretary Return Share Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showOfficialPrintModal, setShowOfficialPrintModal] = useState(false);
  const [copiedReturn, setCopiedReturn] = useState(false);
  const [showRemitConfirmModal, setShowRemitConfirmModal] = useState(false);
  const [isRemitting, setIsRemitting] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const persistWithoutBlockingInput = (label: string, operation: () => void | Promise<void>) => {
    setPersistenceError(null);
    void Promise.resolve()
      .then(operation)
      .then(() => {
        setLastSavedTimestamp(Date.now());
      })
      .catch((error: any) => {
        console.error(`Could not save ${label}:`, error);
        setPersistenceError(`Could not save ${label}: ${error?.message || 'Unknown database error.'}`);
      });
  };

  const currentOffering: WeeklyOfferingRecord = offerings.find(o => o.weekNumber === selectedWeek) || {
    id: `week_${selectedWeek}`,
    weekNumber: selectedWeek,
    amount: 0,
    isNoRecordWeek: false,
    updatedAt: new Date().toISOString()
  };

  const isRemittedOrAudited = currentOffering.remittanceStatus === 'REMITTED' || currentOffering.remittanceStatus === 'AUDITED';
  const isWeekLocked = isReadOnly || isRemittedOrAudited;

  const isCurrentWeekNoRecord = noRecordWeeks.includes(selectedWeek) || currentOffering.isNoRecordWeek || false;
  const cumulativeOfferingTotal = calculateCumulativeOffering(offerings);

  const handleToggleNoRecord = () => {
    if (isWeekLocked) {
      alert(`Week ${selectedWeek} register is locked because the offering has been remitted.`);
      return;
    }
    if (onToggleNoRecordWeek) {
      onToggleNoRecordWeek(selectedWeek);
    } else {
      // Toggle offering & grade records
      const newStatus = !isCurrentWeekNoRecord;
      persistWithoutBlockingInput('the no-record setting', () => onUpdateOffering({
        ...currentOffering,
        isNoRecordWeek: newStatus,
        updatedAt: new Date().toISOString()
      }));
    }
  };

  const weekSummary = calculateWeekSummary(selectedWeek, members, grades, offerings);

  const handleSaveTopic = async () => {
    if (!onUpdateLessonTopic) {
      setIsEditingTopic(false);
      return;
    }
    setPersistenceError(null);
    try {
      await onUpdateLessonTopic(selectedWeek, topicDraft);
      setIsEditingTopic(false);
    } catch (error: any) {
      console.error('Could not save the lesson topic:', error);
      setPersistenceError(`Could not save the lesson topic: ${error?.message || 'Unknown database error.'}`);
    }
  };

  const handleStartEditTopic = () => {
    setTopicDraft(currentLesson.topic);
    setIsEditingTopic(true);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isWeekLocked) {
      alert(`Week ${selectedWeek} register is locked because the offering has been remitted.`);
      return;
    }
    if (!newVisitorName.trim()) return;
    if (!onQuickAddMember) return;
    setPersistenceError(null);
    try {
      await onQuickAddMember(newVisitorName.trim(), newVisitorPhone.trim(), 'VISITOR');
      setNewVisitorName('');
      setNewVisitorPhone('');
      setShowQuickAdd(false);
    } catch (error: any) {
      console.error('Could not add the visitor:', error);
      setPersistenceError(`Could not add the visitor: ${error?.message || 'Unknown database error.'}`);
    }
  };

  // Filtered members list
  const filteredMembers = members.filter(m => {
    const filterTerm = (searchFilter || '').toLowerCase();
    const matchesSearch = (m.fullName || '').toLowerCase().includes(filterTerm) ||
      (m.phone || '').includes(searchFilter || '') ||
      (m.occupation || '').toLowerCase().includes(filterTerm);
    const matchesType = typeFilter === 'ALL' || m.memberType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getMemberGrade = (memberId: string): WeeklyGradeRecord => {
    const existing = grades.find(g => g.memberId === memberId && g.weekNumber === selectedWeek);
    if (existing) return existing;

    const member = members.find(m => m.id === memberId);
    const isExemptBeforeJoin = member && selectedWeek < (member.firstLessonWeek || 1);

    return {
      id: `${memberId}_week_${selectedWeek}`,
      memberId,
      weekNumber: selectedWeek,
      attendance: isExemptBeforeJoin ? 'EXEMPT' : 'PRESENT',
      punctuality: 0,
      memoryVerse: 0,
      classParticipation: 0,
      lessonTotal: 0,
      joinedPrayerMeeting: false,
      postedStatusInsight: false,
      invitedSomeone: false,
      updatedAt: new Date().toISOString()
    };
  };

  const handleAttendanceChange = (member: Member, newStatus: AttendanceStatus) => {
    if (isWeekLocked) return;
    const current = getMemberGrade(member.id);
    let updated: WeeklyGradeRecord = {
      ...current,
      attendance: newStatus
    };

    if (newStatus === 'PRESENT') {
      // Default initial score if currently zero
      if (updated.punctuality === 0 && updated.memoryVerse === 0 && updated.classParticipation === 0) {
        updated.punctuality = 15;
        updated.memoryVerse = 15;
        updated.classParticipation = 20;
        updated.lessonTotal = 50;
      }
    } else if (newStatus === 'ABSENT' || newStatus === 'EXEMPT') {
      updated.punctuality = 0;
      updated.memoryVerse = 0;
      updated.classParticipation = 0;
      updated.lessonTotal = 0;
    }

    persistWithoutBlockingInput('attendance', () => onUpdateGrade(updated));
  };

  const handleScoreChange = (
    memberId: string,
    field: 'punctuality' | 'memoryVerse' | 'classParticipation',
    val: number,
    maxVal: number
  ) => {
    if (isWeekLocked) return;
    const current = getMemberGrade(memberId);
    const clamped = Math.max(0, Math.min(maxVal, isNaN(val) ? 0 : val));
    const updated = {
      ...current,
      attendance: 'PRESENT' as AttendanceStatus,
      [field]: clamped
    };
    persistWithoutBlockingInput(`${field} score`, () => onUpdateGrade(updated));
  };

  const handleChecklistChange = (
    memberId: string,
    field: 'joinedPrayerMeeting' | 'postedStatusInsight' | 'invitedSomeone',
    val: boolean
  ) => {
    if (isWeekLocked) return;
    const current = getMemberGrade(memberId);
    persistWithoutBlockingInput('weekly checklist', () => onUpdateGrade({
      ...current,
      [field]: val
    }));
  };

  const handleBatchScorePreset = (punct: number, verse: number, part: number) => {
    if (isWeekLocked) return;
    const total = punct + verse + part;
    for (const member of members) {
      if (selectedWeek >= (member.firstLessonWeek || 1)) {
        const current = getMemberGrade(member.id);
        persistWithoutBlockingInput('batch scores', () => onUpdateGrade({
          ...current,
          attendance: 'PRESENT',
          punctuality: punct,
          memoryVerse: verse,
          classParticipation: part,
          lessonTotal: total
        }));
      }
    }
  };

  const handleMemberQuickPreset = (memberId: string, punct: number, verse: number, part: number) => {
    if (isWeekLocked) return;
    const current = getMemberGrade(memberId);
    const total = punct + verse + part;
    persistWithoutBlockingInput('score preset', () => onUpdateGrade({
      ...current,
      attendance: 'PRESENT',
      punctuality: punct,
      memoryVerse: verse,
      classParticipation: part,
      lessonTotal: total
    }));
  };

  const [remitSuccessMsg, setRemitSuccessMsg] = useState<string | null>(null);

  const handleOfferingAmountChange = (val: number) => {
    if (isRemittedOrAudited || isReadOnly) return;
    const rawAmt = isNaN(val) ? 0 : val;
    persistWithoutBlockingInput('the weekly offering', () => onUpdateOffering({
      ...currentOffering,
      amount: rawAmt,
      remittanceStatus: currentOffering.remittanceStatus === 'AUDITED' ? 'AUDITED' : (rawAmt > 0 ? (currentOffering.remittanceStatus || 'PENDING_REMITTANCE') : undefined),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleRemitOffering = () => {
    if (isWeekLocked) {
      setPersistenceError(`Week ${selectedWeek} offering cannot be remitted while this quarter is ${quarterStatus.toLowerCase()} or the week is already locked.`);
      return;
    }
    const rawAmt = Number(currentOffering.amount) || 0;
    if (rawAmt <= 0) {
      alert('Please enter a valid weekly offering amount before remitting to the Sunday School Treasurer.');
      return;
    }
    setShowRemitConfirmModal(true);
  };

  const executeRemitOffering = async () => {
    if (isWeekLocked) {
      setShowRemitConfirmModal(false);
      setPersistenceError(`Week ${selectedWeek} offering cannot be remitted while this quarter is ${quarterStatus.toLowerCase()} or the week is already locked.`);
      return;
    }
    const rawAmt = Number(currentOffering.amount) || 0;
    const secretaryTitle = classProfile?.secretaryName || classProfile?.className || 'Class Secretary';
    const updatedOffering: WeeklyOfferingRecord = {
      ...currentOffering,
      amount: rawAmt,
      remittanceStatus: 'REMITTED',
      remittedBy: secretaryTitle,
      remittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setPersistenceError(null);
    setIsRemitting(true);
    let notificationSaved = true;
    try {
      await onUpdateOffering(updatedOffering);
    } catch (error: any) {
      console.error('Could not persist offering remittance:', error);
      setPersistenceError(`Could not remit this offering: ${error?.message || 'Unknown database error.'}`);
      setIsRemitting(false);
      return;
    }

    try {
      await saveAdminComment({
        id: `remit_notif_${classProfile?.id || 'class'}_w${selectedWeek}_q${selectedQuarter || 1}_${Date.now()}`,
        classId: classProfile?.id || 'default_class',
        className: classProfile?.className || 'Sunday School Class',
        quarterNumber: selectedQuarter || 1,
        recordType: 'WEEK',
        targetName: `Week ${selectedWeek} Offering Remittance`,
        authorName: secretaryTitle,
        authorRole: 'Class Secretary',
        comment: `🔔 ${classProfile?.className || 'Class'} — Week ${selectedWeek}: ₦${rawAmt.toLocaleString()} has been remitted to Treasury. Please verify physical receipt.`,
        createdAt: new Date().toISOString(),
        isRead: false,
        isResolved: false,
        responseStatus: 'UNRESPONDED'
      });
    } catch (notificationError) {
      notificationSaved = false;
      console.error('Offering was remitted, but its Treasury notification could not be saved:', notificationError);
    }

    setShowRemitConfirmModal(false);
    setIsRemitting(false);
    setRemitSuccessMsg(notificationSaved
      ? `Week ${selectedWeek} offering of ${currencySymbol}${rawAmt.toLocaleString()} successfully marked as REMITTED! The Sunday School Treasurer has been notified for physical verification.`
      : `Week ${selectedWeek} offering was remitted, but the Treasurer notification could not be saved.`);
    setTimeout(() => setRemitSuccessMsg(null), 6000);
  };

  // Top Scoring Students of the Week
  const presentGrades = members
    .filter(m => selectedWeek >= (m.firstLessonWeek || 1))
    .map(m => ({
      member: m,
      grade: getMemberGrade(m.id)
    }))
    .filter(item => item.grade.attendance === 'PRESENT')
    .sort((a, b) => (b.grade.lessonTotal || 0) - (a.grade.lessonTotal || 0));

  const topScorers = presentGrades.slice(0, 3);

  // Generate Official GOFAMINT_HOF Weekly Sunday School Return
  const generateReturnText = () => {
    const className = classProfile?.className || 'Sunday School Class';
    const dept = classProfile?.department || 'Bible Class';
    const secretary = classProfile?.secretaryName || 'Secretary';
    const totalMembers = members.length;
    const absenteesCount = Math.max(0, totalMembers - weekSummary.totalAttendance);
    const attendancePct = totalMembers > 0 ? Math.round((weekSummary.totalAttendance / totalMembers) * 100) : 0;

    const lines = [
      `*THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR)*`,
      `📖 *SUNDAY SCHOOL DEPARTMENT*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 *WEEKLY SECRETARY RETURN*`,
      `• *Class:* ${className}`,
      `• *Department:* ${dept}`,
      `• *Lesson:* Week ${selectedWeek} of 12`,
      `• *Topic:* "${currentLesson.topic}"`,
      currentLesson.scriptureReading && currentLesson.scriptureReading !== 'Scripture to be assigned' ? `• *Scripture:* ${currentLesson.scriptureReading}` : null,
      currentLesson.memoryVerseRef ? `• *M Vars Ref:* ${currentLesson.memoryVerseRef}` : null,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 *ATTENDANCE & STATISTICS*`,
      `• Total on Roll: ${totalMembers}`,
      `• Students Present: ${weekSummary.studentCount}`,
      `• Visitors Present: ${weekSummary.visitorCount} (${weekSummary.newVisitorCount} New)`,
      `• *Total Attendance:* ${weekSummary.totalAttendance} (${attendancePct}%)`,
      `• Absentees: ${absenteesCount}`,
      `• Class Avg Score: ${weekSummary.classAverageScore} / 50`,
      `💰 *Offering Collected:* ${currencySymbol}${currentOffering.amount ? Number(currentOffering.amount).toLocaleString() : '0.00'}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      topScorers.length > 0 ? `🌟 *TOP SCORERS OF THE WEEK:*` : null,
      ...topScorers.map((s, idx) => `  ${idx + 1}. ${s.member.fullName} — *${s.grade.lessonTotal}/50 pts* (${s.member.memberType})`),
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `✍️ _Submitted by:_ *${secretary}*`,
      `_Status: Recorded via GOFAMINT_HOF Sunday School Secretary Console_`
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleCopyReturn = () => {
    const text = generateReturnText();
    navigator.clipboard.writeText(text);
    setCopiedReturn(true);
    setTimeout(() => setCopiedReturn(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = generateReturnText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendDirectCareWhatsApp = (member: Member) => {
    const text = `Calvary greetings in Christ ${member.fullName}! 🙏\n\nWe dearly missed your warm presence in our GOFAMINT_HOF Sunday School class today (*${classProfile?.className || 'Bible Class'}*).\n\nOur Week ${selectedWeek} lesson topic was: *"${currentLesson.topic}"*.\n\nWe pray God's divine favor, good health, and peace over you throughout this week. Looking forward to rejoicing together in class next Sunday!\n\n_With love and prayers,_\n*${classProfile?.secretaryName || 'Sunday School Secretary'}*`;
    const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-5 animate-fade-in print:bg-white print:text-black">
      {persistenceError && (
        <div role="alert" className="print:hidden flex items-start justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
          <span>{persistenceError}</span>
          <button
            type="button"
            onClick={() => setPersistenceError(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Archive & Upcoming Status Banners */}
      {quarterStatus === 'ARCHIVED' && (
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                HISTORICAL QUARTER ARCHIVE — READ ONLY
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Viewing Quarter {selectedQuarter} historical records. All scores, attendance markings, and offerings are permanently locked for archival integrity.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-800 border border-slate-600 text-slate-300 text-xs font-mono font-bold rounded-md">
            LOCKED (ARCHIVE)
          </span>
        </div>
      )}

      {quarterStatus === 'UPCOMING' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 shadow-sm text-center space-y-3 animate-fade-in print:hidden">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900 uppercase tracking-tight">Quarter {selectedQuarter} Not Yet Released</h3>
            <p className="text-xs text-amber-800 max-w-lg mx-auto mt-1">
              Quarter {selectedQuarter} curriculum is awaiting distribution and activation from the General Secretary. Once published, this register will unlock automatically for attendance and grading.
            </p>
          </div>
        </div>
      )}

      {/* Remitted & Locked Banner */}
      {isRemittedOrAudited && quarterStatus === 'ACTIVE' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-4 shadow-md border border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  WEEK {selectedWeek} REGISTER LOCKED — OFFERING REMITTED
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentOffering.remittanceStatus === 'AUDITED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {currentOffering.remittanceStatus === 'AUDITED' ? 'AUDITED' : 'REMITTED'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Class offering of {currencySymbol}{Number(currentOffering.amount).toLocaleString()} has been remitted {currentOffering.remittedBy ? `by ${currentOffering.remittedBy}` : ''} {currentOffering.remittedAt ? `at ${new Date(currentOffering.remittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}. Attendance markings, scores, and offering are locked to maintain administrative and financial integrity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 text-indigo-200 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>{currentOffering.remittanceStatus === 'AUDITED' ? 'FINANCIALLY AUDITED' : 'LOCKED (REMITTED)'}</span>
            </span>
          </div>
        </div>
      )}

      {/* Quarter Forwarding Prompt for Newly Activated Quarters */}
      {members.length === 0 && selectedQuarter > 1 && quarterStatus === 'ACTIVE' && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-6 shadow-sm text-center space-y-3 animate-fade-in print:hidden">
          <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-emerald-950 uppercase tracking-tight">Ready to Initialize Quarter {selectedQuarter} Register</h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto mt-1 leading-relaxed">
              Forward your active students and visitors from Quarter {selectedQuarter - 1} into this new quarter with fresh 12-week grading matrices. Quarter {selectedQuarter - 1} history will remain safely preserved.
            </p>
          </div>
          {onOpenQuarterTransition && (
            <button
              id={`btn-initialize-quarter-${selectedQuarter}`}
              onClick={onOpenQuarterTransition}
              className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2.5 border border-emerald-600 cursor-pointer active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>YES — INITIALIZE QUARTER {selectedQuarter}</span>
            </button>
          )}
        </div>
      )}

      {/* 12-Lesson Week Switcher Carousel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs print:hidden">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              12-Lesson Quarter Matrix Selector
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSelectWeek(Math.max(1, selectedWeek - 1))}
              disabled={selectedWeek <= 1}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-700 transition"
              title="Previous Lesson"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-blue-900 px-2">
              Week {selectedWeek} of {totalWeeks}
            </span>
            <button
              onClick={() => onSelectWeek(Math.min(totalWeeks, selectedWeek + 1))}
              disabled={selectedWeek >= totalWeeks}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-700 transition"
              title="Next Lesson"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Week Pill Tabs */}
        <div className={`grid grid-cols-6 ${totalWeeks >= 13 ? 'sm:grid-cols-13' : 'sm:grid-cols-12'} gap-1.5`}>
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((wk) => {
            const isSelected = wk === selectedWeek;
            const weekStats = calculateWeekSummary(wk, members, grades, offerings);
            const isNoRec = noRecordWeeks.includes(wk);
            return (
              <button
                key={wk}
                id={`btn-week-pill-${wk}`}
                onClick={() => onSelectWeek(wk)}
                className={`py-2 px-1 rounded-lg text-center transition flex flex-col items-center justify-center border ${
                  isSelected
                    ? 'bg-blue-900 border-blue-900 text-white shadow-xs'
                    : isNoRec
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400">Wk</span>
                <span className="text-sm font-black">{wk}</span>
                <span className={`text-[9px] font-bold mt-0.5 ${
                  isNoRec
                    ? 'text-amber-700 font-black'
                    : weekStats.totalAttendance > 0
                    ? (isSelected ? 'text-green-300' : 'text-emerald-600')
                    : 'text-slate-400'
                }`}>
                  {isNoRec ? 'NO REC' : weekStats.totalAttendance > 0 ? `${weekStats.totalAttendance} att` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Admin-Published Curriculum Lesson Topic & Memory Verse */}
      <div className="bg-white border-2 border-slate-200 border-l-4 border-l-blue-900 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider bg-blue-900 text-amber-300 px-2.5 py-0.5 rounded-md shadow-xs">
                WEEK {currentLesson.weekNumber} LESSON TOPIC
              </span>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-700" />
                <span>Admin-Published Curriculum</span>
              </span>
            </div>

            <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              {currentLesson.topic}
            </h3>

            {currentLesson.memoryVerse ? (
              <div className="pt-1 text-xs sm:text-sm text-slate-700 font-medium italic">
                <span className="font-black not-italic text-blue-950 uppercase tracking-wider text-[11px] mr-1.5">Memory Verse:</span>
                "{currentLesson.memoryVerse}" {currentLesson.memoryVerseRef ? `(${currentLesson.memoryVerseRef})` : ''}
              </div>
            ) : null}
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <button
              id="btn-quick-add-student"
              onClick={() => {
                if (isWeekLocked) {
                  alert(`Week ${selectedWeek} register is locked because the offering has been remitted.`);
                  return;
                }
                setShowQuickAdd(!showQuickAdd);
              }}
              disabled={isWeekLocked}
              className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>+ Add New Visitor</span>
            </button>

            <button
              id="btn-open-return-modal"
              onClick={() => setShowReturnModal(true)}
              className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-amber-300" />
              <span>Share Return</span>
            </button>

            <button
              id="btn-print-official-return"
              onClick={() => setShowOfficialPrintModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
              title="Print formatted official weekly Sunday School return for pastors and superintendents"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Return</span>
            </button>

            {/* Subtle More Actions Menu for "Mark as No Record" (Item 17) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreActions(!showMoreActions)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border border-slate-300 transition cursor-pointer"
                title="More weekly options"
              >
                •••
              </button>
              {showMoreActions && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in">
                  <button
                    onClick={() => {
                      setShowMoreActions(false);
                      handleToggleNoRecord();
                    }}
                    disabled={isWeekLocked}
                    className={`w-full px-3.5 py-2 text-left text-xs font-bold flex items-center gap-2 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer ${
                      isCurrentWeekNoRecord ? 'text-amber-700' : 'text-slate-700'
                    }`}
                  >
                    <span>{isCurrentWeekNoRecord ? '⚠️ Remove No-Record Flag' : 'Mark Week as No Record'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* No Record Week Banner */}
      {isCurrentWeekNoRecord && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 flex items-center gap-3 text-amber-900 shadow-xs animate-fade-in">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-bold text-sm text-amber-950">NO RECORD WEEK (WEEK {selectedWeek})</h4>
            <p className="text-xs text-amber-800">
              This week is designated as a No Record Week. All members are excused from attendance denominators, average calculations, and awards penalties for this session.
            </p>
          </div>
        </div>
      )}

      {/* Admin Feedback / Comments Panel */}
      {adminComments && adminComments.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 shadow-xs animate-fade-in space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-900" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900">
                Official Directorate Feedback & Admin Notes ({adminComments.length})
              </h4>
            </div>
            <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-bold">Admin Directorate</span>
          </div>

          <div className="space-y-2">
            {adminComments.slice(0, 3).map((cmt) => (
              <div key={cmt.id} className="bg-white p-3 rounded-lg border border-blue-200 text-xs shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900">{cmt.authorName}</span>
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-bold">
                      {cmt.authorRole}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(cmt.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-700 font-medium">{cmt.comment || (cmt as any).commentText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Add Inline Form (For Visitors) */}
      {showQuickAdd && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4 sm:p-5 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-700" />
              <h4 className="font-bold text-sm text-purple-950">
                Fast Visitor Registration (Week {selectedWeek})
              </h4>
            </div>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="text-purple-700 hover:text-purple-900 text-xs font-bold"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleQuickAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              required
              placeholder="Visitor Full Name *"
              value={newVisitorName}
              onChange={(e) => setNewVisitorName(e.target.value)}
              className="flex-1 bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
              autoFocus
            />
            <input
              type="tel"
              placeholder="WhatsApp / Phone Number"
              value={newVisitorPhone}
              onChange={(e) => setNewVisitorPhone(e.target.value)}
              className="w-full sm:w-48 bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
            />
            <select
              value={newVisitorSponsorId}
              onChange={(e) => setNewVisitorSponsorId(e.target.value)}
              className="w-full sm:w-56 bg-white border border-purple-300 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600 cursor-pointer"
            >
              <option value="">Invited By (Optional Sponsor)</option>
              {members.filter(m => m.status !== 'LEFT_CLASS').map(m => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.memberType === 'STUDENT' ? 'Student' : 'Visitor'})</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
              <span>Register Visitor</span>
            </button>
          </form>
        </div>
      )}

      {/* Geometric Balance 4-Column Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Attendance */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-blue-900 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Attendance</span>
            <Users className="w-4 h-4 text-blue-900" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{weekSummary.totalAttendance}</span>
            <span className="text-sm font-normal text-slate-500">/ {members.length}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-semibold">
            Avg Score: <strong className="text-blue-900">{weekSummary.classAverageScore}</strong> / 50
          </p>
        </div>

        {/* Registration Section Split */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-purple-600 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registration Section</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <div>
              <span className="text-2xl font-black text-slate-900">{weekSummary.studentCount}</span>
              <span className="text-[10px] text-slate-500 ml-1 font-bold">Students</span>
            </div>
            <span className="text-slate-300">/</span>
            <div>
              <span className="text-xl font-black text-purple-600">{weekSummary.visitorCount}</span>
              <span className="text-[10px] text-slate-500 ml-1 font-bold">Visitors</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-semibold">
            Ratio: {weekSummary.totalAttendance > 0 ? Math.round((weekSummary.studentCount / weekSummary.totalAttendance) * 100) : 0}% Students
          </p>
        </div>

        {/* Visitor Retention */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visitors (Today)</span>
            <UserPlus className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{weekSummary.visitorCount}</span>
            <span className="text-sm font-normal text-slate-500">({weekSummary.newVisitorCount} New)</span>
          </div>
          <p className="text-[10px] text-emerald-700 mt-1 font-bold">
            {weekSummary.returningVisitorCount > 0 ? `${weekSummary.returningVisitorCount} Returning (Progression Ready)` : 'Welcoming new souls'}
          </p>
        </div>

        {/* Total Weekly Offering Input (Nigerian Naira ₦) & Remittance Engine */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 p-4 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weekly Offering</span>
            <span className="text-xs font-black text-amber-700">₦ Offering</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-slate-800">{currencySymbol}</span>
            <div className="relative w-full">
              <input
                id="weekly-offering-amount-input"
                type="number"
                min="0"
                step="100"
                disabled={isRemittedOrAudited || isReadOnly}
                value={currentOffering.amount || ''}
                onChange={(e) => handleOfferingAmountChange(parseFloat(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
                className={`w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 px-2.5 text-base font-black text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  isRemittedOrAudited ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-300 pr-16' : ''
                }`}
              />
              {(isRemittedOrAudited || isReadOnly) && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 flex items-center gap-1 text-[10px] font-bold bg-slate-200/90 px-1.5 py-0.5 rounded shadow-2xs">
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span>Locked</span>
                </span>
              )}
            </div>
          </div>

          {/* Remittance Status Indicator & Action */}
          <div className="pt-1 border-t border-slate-100">
            {currentOffering.remittanceStatus === 'AUDITED' ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 px-2 text-[10px]">
                <span className="font-bold text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Audited: {currencySymbol}{(currentOffering.auditedAmount ?? currentOffering.amount).toLocaleString()}</span>
                </span>
                <span className="text-emerald-700 font-semibold truncate max-w-[110px]">
                  {currentOffering.auditedBy ? `By ${currentOffering.auditedBy}` : 'Verified'}
                </span>
              </div>
            ) : currentOffering.remittanceStatus === 'REMITTED' ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-1.5 px-2 text-[10px]">
                <span className="font-bold text-blue-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Remitted (Awaiting Audit)</span>
                </span>
                <span className="text-blue-600 font-semibold text-[9px]">
                  {currentOffering.remittedAt ? new Date(currentOffering.remittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sent'}
                </span>
              </div>
            ) : (Number(currentOffering.amount) || 0) > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Recorded</span>
                </span>
                <button
                  id="btn-remit-offering"
                  type="button"
                  onClick={handleRemitOffering}
                  disabled={isWeekLocked}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-black text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 shrink-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
                  title={isWeekLocked ? 'This quarter or week is locked read-only.' : 'Hand over cash and mark as Remitted to Sunday School Treasurer'}
                >
                  <HandCoins className="w-3 h-3" />
                  <span>REMIT {currencySymbol}{Number(currentOffering.amount).toLocaleString()}</span>
                </button>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic">
                Enter amount collected in class
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-0.5">
            <span>Week {selectedWeek} Offering</span>
            <span className="font-bold text-amber-900">Cumul: {currencySymbol}{cumulativeOfferingTotal.toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* Remit Notification Feedback Banner */}
      {remitSuccessMsg && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{remitSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRemitSuccessMsg(null)}
            className="text-emerald-200 hover:text-white text-xs underline font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Roster Table Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search member by name, phone, occupation..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full sm:w-80 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
          />
          {lastSavedTimestamp && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 animate-fade-in" title="Latest grade entry saved to local database">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Saved locally</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              typeFilter === 'ALL' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            All ({members.length})
          </button>
          <button
            onClick={() => setTypeFilter('STUDENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              typeFilter === 'STUDENT' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Students ({members.filter(m => m.memberType === 'STUDENT').length})
          </button>
          <button
            onClick={() => setTypeFilter('VISITOR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              typeFilter === 'VISITOR' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Visitors ({members.filter(m => m.memberType === 'VISITOR').length})
          </button>
        </div>
      </div>

      {/* 12-Lesson Member Grading Cards List */}
      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 shadow-xs">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-400" />
            <p className="font-bold text-sm text-slate-700">
              {members.length === 0 ? 'No students or visitors registered in this class yet' : 'No members found matching your filter.'}
            </p>
            {members.length === 0 && onNavigateToRoster && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onNavigateToRoster}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Go to Roster to Mass Import Class (Name & Phone)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredMembers.map((member) => {
            const grade = getMemberGrade(member.id);
            const isLateJoiner = member.firstLessonWeek > 1;
            const qualification = member.memberType === 'VISITOR' ? checkVisitorQualification(member, grades, selectedWeek) : null;

            return (
              <div
                key={member.id}
                id={`grading-card-${member.id}`}
                className={`bg-white border rounded-xl p-4 sm:p-5 transition shadow-xs ${
                  grade.attendance === 'PRESENT'
                    ? 'border-slate-200 border-l-4 border-l-emerald-600'
                    : grade.attendance === 'ABSENT'
                    ? 'border-slate-200 border-l-4 border-l-[#5c2c16] opacity-90'
                    : 'border-slate-200 border-l-4 border-l-red-600'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Member Profile Avatar & Info */}
                  <div className="flex items-center gap-3.5 min-w-[240px]">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      {member.photoBase64 ? (
                        <img
                          src={member.photoBase64}
                          alt={member.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-black text-slate-700">
                          {member.fullName.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                          {member.fullName}
                        </h4>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          member.memberType === 'STUDENT'
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-purple-100 text-purple-900 border border-purple-300'
                        }`}>
                          {member.memberType}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{member.occupation || 'Visitor'}</span>
                        {member.phone && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">{member.phone}</span>
                          </>
                        )}
                        {isLateJoiner && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                            Joined Wk {member.firstLessonWeek}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Attendance Selector Buttons with Specific Color Coding */}
                  {/* Present: Emerald Green | Absent: Deep Brown | Exempt: Red */}
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`att-present-${member.id}`}
                      onClick={() => handleAttendanceChange(member, 'PRESENT')}
                      disabled={isWeekLocked}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                        grade.attendance === 'PRESENT'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>PRESENT</span>
                    </button>

                    <button
                      id={`att-absent-${member.id}`}
                      onClick={() => handleAttendanceChange(member, 'ABSENT')}
                      disabled={isWeekLocked}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                        grade.attendance === 'ABSENT'
                          ? 'bg-[#5c2c16] border-[#5c2c16] text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ABSENT</span>
                    </button>

                    <button
                      id={`att-exempt-${member.id}`}
                      onClick={() => handleAttendanceChange(member, 'EXEMPT')}
                      disabled={isWeekLocked}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                        grade.attendance === 'EXEMPT'
                          ? 'bg-red-600 border-red-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>EXEMPT</span>
                    </button>
                  </div>

                  {/* 4-Tier Grading Inputs (Punctuality 0-15, M Vars 0-15, C Participation 0-20, Total 50) */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    
                    {/* Punctuality (0-15) */}
                    <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200 text-center min-w-[76px]">
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Punctuality</span>
                      <div className="flex items-center justify-center gap-1">
                        <ScoreInput
                          id={`score-punctuality-${member.id}`}
                          aria-label={`${member.fullName} - Punctuality score out of 15`}
                          max={15}
                          disabled={grade.attendance !== 'PRESENT' || isWeekLocked}
                          value={grade.attendance === 'PRESENT' ? grade.punctuality : 0}
                          onChange={(val) => handleScoreChange(member.id, 'punctuality', val, 15)}
                          className="w-12 h-10 bg-white border-2 border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/15</span>
                      </div>
                    </div>

                    {/* M Vars (0-15) */}
                    <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200 text-center min-w-[76px]">
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">M Vars</span>
                      <div className="flex items-center justify-center gap-1">
                        <ScoreInput
                          id={`score-memoryverse-${member.id}`}
                          aria-label={`${member.fullName} - Memory Verse score out of 15`}
                          max={15}
                          disabled={grade.attendance !== 'PRESENT' || isWeekLocked}
                          value={grade.attendance === 'PRESENT' ? grade.memoryVerse : 0}
                          onChange={(val) => handleScoreChange(member.id, 'memoryVerse', val, 15)}
                          className="w-12 h-10 bg-white border-2 border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/15</span>
                      </div>
                    </div>

                    {/* C Participation (0-20) */}
                    <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200 text-center min-w-[76px]">
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">C Part.</span>
                      <div className="flex items-center justify-center gap-1">
                        <ScoreInput
                          id={`score-participation-${member.id}`}
                          aria-label={`${member.fullName} - Class Participation score out of 20`}
                          max={20}
                          disabled={grade.attendance !== 'PRESENT' || isWeekLocked}
                          value={grade.attendance === 'PRESENT' ? grade.classParticipation : 0}
                          onChange={(val) => handleScoreChange(member.id, 'classParticipation', val, 20)}
                          className="w-12 h-10 bg-white border-2 border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/20</span>
                      </div>
                    </div>

                    {/* Auto-Calculated Total (Max 50) */}
                    <div className="bg-blue-50 p-2 sm:p-2.5 rounded-lg border border-blue-200 text-center min-w-[80px]">
                      <span className="text-[10px] font-bold text-blue-900 block mb-0.5">Total Score</span>
                      <div className="flex items-baseline justify-center gap-0.5">
                        <span className="text-base font-black text-blue-900">
                          {grade.attendance === 'PRESENT' ? grade.lessonTotal : 0}
                        </span>
                        <span className="text-[10px] text-blue-600 font-bold">/50</span>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Quick Score Presets & Absent Care Action Bar */}
                {/* 50: Deep Purple | 40: Royal Blue | 30: Sky Blue */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  
                  {/* Left: Quick Score Presets with Required Colors */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Score:</span>
                    <button
                      id={`btn-score-50-${member.id}`}
                      onClick={() => handleMemberQuickPreset(member.id, 15, 15, 20)}
                      disabled={isWeekLocked || grade.attendance !== 'PRESENT'}
                      className="px-3 py-1.5 min-h-[36px] min-w-[44px] bg-[#3b0764] hover:bg-[#2e0854] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white border border-purple-900 rounded-lg text-xs font-black shadow-xs transition duration-150 flex items-center justify-center cursor-pointer"
                      title="Set 15 + 15 + 20 = 50 pts"
                    >
                      🌟 50
                    </button>
                    <button
                      id={`btn-score-40-${member.id}`}
                      onClick={() => handleMemberQuickPreset(member.id, 10, 15, 15)}
                      disabled={isWeekLocked || grade.attendance !== 'PRESENT'}
                      className="px-3 py-1.5 min-h-[36px] min-w-[44px] bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white border border-blue-700 rounded-lg text-xs font-bold shadow-xs transition duration-150 flex items-center justify-center cursor-pointer"
                      title="Set 10 + 15 + 15 = 40 pts"
                    >
                      40
                    </button>
                    <button
                      id={`btn-score-30-${member.id}`}
                      onClick={() => handleMemberQuickPreset(member.id, 10, 10, 10)}
                      disabled={isWeekLocked || grade.attendance !== 'PRESENT'}
                      className="px-3 py-1.5 min-h-[36px] min-w-[44px] bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white border border-sky-500 rounded-lg text-xs font-bold shadow-xs transition duration-150 flex items-center justify-center cursor-pointer"
                      title="Set 10 + 10 + 10 = 30 pts"
                    >
                      30
                    </button>
                  </div>

                  {/* Visitor Qualification & Conversion Action */}
                  {member.memberType === 'VISITOR' && qualification && (
                    <div className="flex items-center gap-2">
                      {member.conversionStatus === 'PENDING_APPROVAL' ? (
                        <div className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>Awaiting Approval from Enrollment Officer</span>
                        </div>
                      ) : qualification.isQualified ? (
                        <button
                          id={`btn-convert-visitor-${member.id}`}
                          onClick={() => onConvertVisitorToStudent && onConvertVisitorToStudent(member.id)}
                          disabled={isWeekLocked}
                          className="px-3 py-1 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm border border-purple-400 transition"
                          title="Click to request promotion of this visitor to Student status from the Enrollment Officer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Mark as Student (Request Approval)</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-3 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-not-allowed"
                          title={qualification.description}
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Convert to Student (Requires 3 Consecutive Visits / 50% Att.)</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Right: Spiritual Checklist or Absent WhatsApp Care */}
                  <div className="flex flex-wrap items-center gap-3">
                    {grade.attendance === 'ABSENT' ? (
                      <button
                        onClick={() => handleSendDirectCareWhatsApp(member)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition"
                        title="Send warm WhatsApp pastoral follow-up to this absent member"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Send WhatsApp Pastoral Follow-Up</span>
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 text-slate-600">
                        <label className={`flex items-center gap-1.5 ${isWeekLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-slate-900'}`}>
                          <input
                            type="checkbox"
                            disabled={isWeekLocked}
                            checked={grade.joinedPrayerMeeting || false}
                            onChange={(e) => handleChecklistChange(member.id, 'joinedPrayerMeeting', e.target.checked)}
                            className="rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-0 w-3.5 h-3.5 disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold text-[11px]">Prayer Mtg</span>
                        </label>

                        <label className={`flex items-center gap-1.5 ${isWeekLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-slate-900'}`}>
                          <input
                            type="checkbox"
                            disabled={isWeekLocked}
                            checked={grade.postedStatusInsight || false}
                            onChange={(e) => handleChecklistChange(member.id, 'postedStatusInsight', e.target.checked)}
                            className="rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-0 w-3.5 h-3.5 disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold text-[11px]">WhatsApp Status</span>
                        </label>

                        <label className={`flex items-center gap-1.5 ${isWeekLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-slate-900'}`}>
                          <input
                            type="checkbox"
                            disabled={isWeekLocked}
                            checked={grade.invitedSomeone || false}
                            onChange={(e) => handleChecklistChange(member.id, 'invitedSomeone', e.target.checked)}
                            className="rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-0 w-3.5 h-3.5 disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold text-[11px]">Invited Someone</span>
                        </label>
                      </div>
                    )}

                    {/* Evangelism Referral Button */}
                    <button
                      id={`btn-referral-${member.id}`}
                      onClick={() => {
                        if (!isWeekLocked) onOpenAddVisitorWithReferral(member.id);
                      }}
                      disabled={isWeekLocked}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition shrink-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-purple-50"
                      title={isWeekLocked ? 'This quarter or week is locked read-only.' : 'Register a new visitor introduced by this student'}
                    >
                      <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                      <span>+ Brought Visitor ({member.evangelismReferralCount || 0})</span>
                    </button>
                  </div>

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Weekly Return Share Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-900" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide font-['Cinzel',serif]">
                  Weekly Secretary Return — Week {selectedWeek}
                </h3>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Formatted official return ready to be sent to your Sunday School Superintendent, Church Pastor, or Sunday School WhatsApp group:
            </p>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
              {generateReturnText()}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setShowOfficialPrintModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Printer className="w-4 h-4" />
                <span>Open Printable Official Return (A4)</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCopyReturn}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  {copiedReturn ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedReturn ? 'Copied!' : 'Copy Text'}</span>
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Return Printable Modal */}
      <OfficialReturnPrintModal
        isOpen={showOfficialPrintModal}
        onClose={() => setShowOfficialPrintModal(false)}
        classProfile={classProfile || null}
        selectedWeek={selectedWeek}
        quarterNumber={classProfile?.quarter || 1}
        lesson={currentLesson}
        members={members}
        grades={grades}
        offerings={offerings}
        isNoRecordWeek={isCurrentWeekNoRecord}
      />

      {/* Remittance Confirmation Modal (Item 15) */}
      {showRemitConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-900">
              <HandCoins className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Do you want to remit {currencySymbol}{Number(currentOffering.amount).toLocaleString()}?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Confirm your Sunday School offering collection for Week {selectedWeek}. Once remitted, the Sunday School Treasurer is alerted for verification.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRemitConfirmModal(false)}
                disabled={isRemitting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-remit-offering"
                onClick={() => void executeRemitOffering()}
                disabled={isRemitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isRemitting ? 'Saving Remittance…' : `Yes, Remit ${currencySymbol}${Number(currentOffering.amount).toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
