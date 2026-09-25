import React, { useState, useEffect, useMemo } from 'react';
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
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageCircle,
  Edit2,
  Save,
  PlusCircle,
  Printer,
  Star,
  Zap,
  PhoneCall,
  ShieldCheck,
  Lock,
  HandCoins,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Search,
  ClipboardCheck,
  AlertTriangle
} from 'lucide-react';
import { backgroundStateManager } from '../utils/backgroundStateManager';
import {
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  LessonInfo,
  AttendanceStatus,
  ClassProfile,
  AdminComment,
  SundaySchoolYear
} from '../types';
import { getCurrentCalendarWeek, isSundayRegisterOpenForWeek, getActiveSundayRegisterWeek } from '../utils/quarterScheduleUtils';
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
  onUpdateMember?: (member: Member) => Promise<void> | void;
  onSaveBulkMembers?: (members: Member[]) => Promise<void> | void;
  currencySymbol?: string;
  sundaySchoolYear?: SundaySchoolYear;
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
  onUpdateMember,
  onSaveBulkMembers,
  currencySymbol = '₦',
  sundaySchoolYear
}) => {
  const isReadOnly = quarterStatus === 'ARCHIVED' || quarterStatus === 'UPCOMING';
  const isUpcoming = quarterStatus === 'UPCOMING';
  useScrollRestoration('grading_matrix');

  // Date-aware Active Week & Schedule Intelligence (Phases 1, 7 & 19)
  const activeQuarterObj = sundaySchoolYear?.quarters.find(q => q.quarterNumber === selectedQuarter);
  const activeCalendarWeek = useMemo(() => {
    return getCurrentCalendarWeek(activeQuarterObj, new Date());
  }, [activeQuarterObj]);

  const sundayRegisterIntel = useMemo(() => {
    return getActiveSundayRegisterWeek(activeQuarterObj, new Date());
  }, [activeQuarterObj]);

  const isCurrentWeekRegisterOpen = useMemo(() => {
    return isSundayRegisterOpenForWeek(selectedWeek, activeQuarterObj, new Date());
  }, [selectedWeek, activeQuarterObj]);

  const isFutureRegisterLocked = !isCurrentWeekRegisterOpen;

  const handleSelectWeek = (wk: number) => {
    if (wk > activeCalendarWeek) {
      alert(`Week ${wk} is a future Sunday School week and is not yet available.`);
      return;
    }
    onSelectWeek(wk);
  };

  const [searchFilter, setSearchFilter] = usePersistedState<string>('gofamint_grading_search', '');
  const [typeFilter, setTypeFilter] = usePersistedState<'ALL' | 'STUDENT' | 'VISITOR'>('gofamint_grading_type', 'ALL');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  
  // Remittance Changes Mode
  const [isChangesModeActive, setIsChangesModeActive] = useState(false);
  const [isConfirmChangesModalOpen, setIsConfirmChangesModalOpen] = useState(false);

  // Register Reordering Mode
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<Member[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  useEffect(() => {
    setIsChangesModeActive(false);
    setIsReorderMode(false);
    setIsFilterDropdownOpen(false);
  }, [selectedWeek]);

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

  const [showOfficialPrintModal, setShowOfficialPrintModal] = useState(false);
  const [showRemitConfirmModal, setShowRemitConfirmModal] = useState(false);
  const [isRemitting, setIsRemitting] = useState(false);
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
  const isOfferingLocked = isReadOnly || (currentOffering.remittanceStatus === 'AUDITED') || (currentOffering.remittanceStatus === 'REMITTED' && !isChangesModeActive) || isFutureRegisterLocked;
  const isWeekLocked = isReadOnly || isFutureRegisterLocked || (isRemittedOrAudited && !isChangesModeActive);

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

  const getMemberGrade = (memberId: string): WeeklyGradeRecord => {
    const existing = grades.find(g => g.memberId === memberId && g.weekNumber === selectedWeek);
    const drafts = backgroundStateManager.getScoreDrafts(classProfile?.id || 'default_class', selectedWeek);
    const memberDraft = drafts[memberId];
    const member = members.find(m => m.id === memberId);

    const isAutoExempt = member && (
      selectedWeek < (member.firstLessonWeek || 1) || 
      member.status === 'LEFT_CLASS'
    );

    const baseRecord: WeeklyGradeRecord = existing || (() => {
      return {
        id: `${memberId}_week_${selectedWeek}`,
        memberId,
        weekNumber: selectedWeek,
        attendance: isAutoExempt ? 'EXEMPT' : 'ABSENT',
        punctuality: 0,
        memoryVerse: 0,
        classParticipation: 0,
        lessonTotal: 0,
        joinedPrayerMeeting: false,
        postedStatusInsight: false,
        invitedSomeone: false,
        updatedAt: new Date().toISOString()
      };
    })();

    let resolvedAttendance = baseRecord.attendance;
    if (member?.status === 'LEFT_CLASS' && baseRecord.attendance !== 'PRESENT') {
      resolvedAttendance = 'EXEMPT';
    } else if (member && selectedWeek < (member.firstLessonWeek || 1) && baseRecord.attendance !== 'PRESENT') {
      resolvedAttendance = 'EXEMPT';
    }

    if (!memberDraft) {
      return {
        ...baseRecord,
        attendance: resolvedAttendance
      };
    }

    const punct = memberDraft.punctuality !== undefined ? memberDraft.punctuality : baseRecord.punctuality;
    const verse = memberDraft.memoryVerse !== undefined ? memberDraft.memoryVerse : baseRecord.memoryVerse;
    const part = memberDraft.classParticipation !== undefined ? memberDraft.classParticipation : baseRecord.classParticipation;
    const att = (memberDraft.attendance as AttendanceStatus) || resolvedAttendance;

    return {
      ...baseRecord,
      attendance: att,
      punctuality: punct,
      memoryVerse: verse,
      classParticipation: part,
      lessonTotal: punct + verse + part
    };
  };

  const weekSummary = calculateWeekSummary(selectedWeek, members, grades, offerings);

  // Eligible members for selectedWeek: EXEMPT members (joined later, archived, or explicitly exempt)
  // are excluded from the attendance and register denominator!
  const eligibleMembers = useMemo(() => {
    return members.filter(m => {
      const grade = getMemberGrade(m.id);
      if (grade.attendance === 'EXEMPT') return false;
      if ((m.firstLessonWeek || 1) > selectedWeek) return false;
      if (m.status === 'LEFT_CLASS' && grade.attendance !== 'PRESENT') return false;
      return true;
    });
  }, [members, selectedWeek, grades]);

  const eligibleCount = eligibleMembers.length;
  const exemptCount = members.length - eligibleCount;

  const recordedMemberIds = new Set(
    grades
      .filter(grade => grade.weekNumber === selectedWeek)
      .map(grade => grade.memberId)
  );
  const recordedCount = eligibleMembers.filter(member => recordedMemberIds.has(member.id)).length;
  const attendanceRate = eligibleCount > 0
    ? Math.round((weekSummary.totalAttendance / eligibleCount) * 100)
    : 0;
  const registerCompletionRate = eligibleCount > 0
    ? Math.round((recordedCount / eligibleCount) * 100)
    : 0;

  // 12-Week Attendance & Absence Trends for the top bar graph
  // Line 1: Present attendees (came to Sunday School)
  // Line 2: Absent students (active enrolled students absent, excluding exempt)
  const weeklyAttendanceTrends = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const wk = i + 1;
      const wkEligible = members.filter(m => {
        const grade = grades.find(g => g.memberId === m.id && g.weekNumber === wk);
        if (grade?.attendance === 'EXEMPT') return false;
        if ((m.firstLessonWeek || 1) > wk) return false;
        if (m.status === 'LEFT_CLASS' && grade?.attendance !== 'PRESENT') return false;
        return true;
      });

      const presentCount = members.filter(m => {
        const grade = grades.find(g => g.memberId === m.id && g.weekNumber === wk);
        return grade?.attendance === 'PRESENT';
      }).length;

      const absentCount = Math.max(0, wkEligible.length - presentCount);

      return {
        week: wk,
        present: presentCount,
        absent: absentCount,
        eligible: wkEligible.length
      };
    });
  }, [members, grades]);

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

  // Sort members: Active members first (custom order / alphabetical), Archived & One-time visitors ALWAYS at the bottom
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const isArchivedA = a.status === 'LEFT_CLASS';
      const isArchivedB = b.status === 'LEFT_CLASS';
      if (isArchivedA !== isArchivedB) {
        return isArchivedA ? 1 : -1;
      }
      const orderA = a.displayOrder !== undefined ? a.displayOrder : 99999;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : 99999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [members]);

  // Filtered members list
  const filteredMembers = sortedMembers.filter(m => {
    const filterTerm = (searchFilter || '').toLowerCase();
    const matchesSearch = (m.fullName || '').toLowerCase().includes(filterTerm) ||
      (m.phone || '').includes(searchFilter || '') ||
      (m.occupation || '').toLowerCase().includes(filterTerm);
    const matchesType = typeFilter === 'ALL' || m.memberType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleStartReorder = () => {
    setReorderList([...sortedMembers]);
    setIsReorderMode(true);
  };

  const handleMoveMember = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reorderList.length) return;
    const copy = [...reorderList];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setReorderList(copy);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    setPersistenceError(null);
    try {
      const updated = reorderList.map((m, idx) => ({
        ...m,
        displayOrder: idx + 1,
        updatedAt: new Date().toISOString()
      }));

      if (onSaveBulkMembers) {
        await onSaveBulkMembers(updated);
      } else if (onUpdateMember) {
        for (const m of updated) {
          await onUpdateMember(m);
        }
      }
      setIsReorderMode(false);
    } catch (err: any) {
      console.error('Failed to save register order:', err);
      setPersistenceError(`Could not save register order: ${err?.message || 'Unknown database error.'}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleRestoreAndMarkPresent = async (member: Member) => {
    if (isWeekLocked) return;
    const updated: Member = {
      ...member,
      status: 'ACTIVE',
      departureDate: undefined,
      departureReason: undefined,
      departureWeek: undefined,
      updatedAt: new Date().toISOString()
    };
    if (onUpdateMember) {
      await onUpdateMember(updated);
    } else if (onSaveBulkMembers) {
      await onSaveBulkMembers([updated]);
    }
    handleAttendanceChange(member, 'PRESENT');
  };

  const handleAttendanceChange = (member: Member, newStatus: AttendanceStatus) => {
    if (isWeekLocked) return;
    const current = getMemberGrade(member.id);
    let updated: WeeklyGradeRecord = {
      ...current,
      attendance: newStatus
    };

    if (newStatus === 'PRESENT') {
      // Leave scores as-is so teacher inputs actual scores (validated on remit)
    } else if (newStatus === 'ABSENT' || newStatus === 'EXEMPT') {
      updated.punctuality = 0;
      updated.memoryVerse = 0;
      updated.classParticipation = 0;
      updated.lessonTotal = 0;
    }

    backgroundStateManager.saveScoreDraft(classProfile?.id || 'default_class', selectedWeek, member.id, {
      attendance: newStatus,
      punctuality: updated.punctuality,
      memoryVerse: updated.memoryVerse,
      classParticipation: updated.classParticipation
    });

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
    updated.lessonTotal = updated.punctuality + updated.memoryVerse + updated.classParticipation;

    backgroundStateManager.saveScoreDraft(classProfile?.id || 'default_class', selectedWeek, memberId, {
      [field]: clamped,
      attendance: 'PRESENT'
    });

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
    if ((isRemittedOrAudited && !isChangesModeActive) || isReadOnly) return;
    const rawAmt = isNaN(val) ? 0 : val;
    persistWithoutBlockingInput('the weekly offering', () => onUpdateOffering({
      ...currentOffering,
      amount: rawAmt,
      remittanceStatus: currentOffering.remittanceStatus === 'AUDITED' ? 'AUDITED' : (rawAmt > 0 ? (currentOffering.remittanceStatus || 'PENDING_REMITTANCE') : undefined),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleFinishChangesMode = () => {
    const rawAmt = Number(currentOffering.amount) || 0;
    const secretaryTitle = classProfile?.secretaryName || classProfile?.className || 'Class Secretary';
    const auditItem = {
      originalAmount: currentOffering.amount,
      newAmount: rawAmt,
      timestamp: new Date().toISOString(),
      actor: secretaryTitle,
      reason: 'Remit corrections completed in Changes Mode'
    };

    persistWithoutBlockingInput('changes mode completion', () => onUpdateOffering({
      ...currentOffering,
      amount: rawAmt,
      changesAudit: [...(currentOffering.changesAudit || []), auditItem],
      updatedAt: new Date().toISOString()
    }));

    setIsChangesModeActive(false);
    setRemitSuccessMsg(`Changes to Week ${selectedWeek} offering and register saved. Week ${selectedWeek} is locked again.`);
  };

  const handleRemitOffering = () => {
    if (isWeekLocked) {
      setPersistenceError(`Week ${selectedWeek} offering cannot be remitted while this quarter is ${quarterStatus.toLowerCase()} or the week is already locked.`);
      return;
    }

    // Phase 5.1 Validation: Ensure students marked Present have completed required scores
    const presentMembers = members.filter(m => {
      const g = getMemberGrade(m.id);
      return g.attendance === 'PRESENT';
    });

    const studentsWithMissingScores = presentMembers.filter(m => {
      const g = getMemberGrade(m.id);
      return (Number(g.lessonTotal) || 0) <= 0;
    });

    if (studentsWithMissingScores.length > 0) {
      const names = studentsWithMissingScores.map(s => `• ${s.fullName}`).join('\n');
      alert(
        `Some students marked Present do not yet have their required scores. Complete them before submitting the register.\n\nAffected Students:\n${names}`
      );
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

  const handleSendDirectCareWhatsApp = (member: Member) => {
    const text = `Calvary greetings in Christ ${member.fullName}! 🙏\n\nWe dearly missed your warm presence in our GOFAMINT_HOF Sunday School class today (*${classProfile?.className || 'Bible Class'}*).\n\nOur Week ${selectedWeek} lesson topic was: *"${currentLesson.topic}"*.\n\nWe pray God's divine favor, good health, and peace over you throughout this week. Looking forward to rejoicing together in class next Sunday!\n\n_With love and prayers,_\n*${classProfile?.secretaryName || 'Sunday School Secretary'}*`;
    const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in print:bg-white print:text-black">
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

      {/* Future Register Locked Banner (Phase 1.3) */}
      {isFutureRegisterLocked && quarterStatus === 'ACTIVE' && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-600 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                WEEK {selectedWeek} REGISTER: LOCKED — OPENS SUNDAY
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Week {selectedWeek} register will open on Sunday (12:00 AM Africa/Lagos time). Attendance and grading cannot be entered ahead of time.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-mono font-bold rounded-md shrink-0">
            OPENS SUNDAY
          </span>
        </div>
      )}

      {/* Remitted & Locked Banner / Changes Mode Banner */}
      {isRemittedOrAudited && quarterStatus === 'ACTIVE' && (
        isChangesModeActive ? (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-in print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 shadow-sm">
                <Edit2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">Week {selectedWeek} · Changes mode</h4>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">Editing</span>
                </div>
                <p className="text-xs text-amber-900 mt-0.5">Correct the register, then save and lock it again.</p>
              </div>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                id="btn-done-changes-mode"
                onClick={handleFinishChangesMode}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save & lock</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-[#081a3b] via-indigo-950 to-[#111a3c] text-white rounded-2xl p-3.5 sm:p-4 shadow-md border border-indigo-500/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-in print:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Week {selectedWeek} locked</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    currentOffering.remittanceStatus === 'AUDITED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {currentOffering.remittanceStatus === 'AUDITED' ? 'AUDITED' : 'REMITTED'}
                  </span>
                </div>
                <p className="text-xs text-indigo-100/80 mt-0.5 truncate sm:whitespace-normal">
                  {currencySymbol}{Number(currentOffering.amount).toLocaleString()} remitted{currentOffering.remittedBy ? ` by ${currentOffering.remittedBy}` : ''}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {currentOffering.remittanceStatus === 'AUDITED' ? (
                <div className="w-full sm:w-auto min-h-[42px] px-3 py-2 bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Audited & locked</span>
                </div>
              ) : (
                <button
                  type="button"
                  id="btn-enter-changes-mode"
                  onClick={() => setIsConfirmChangesModalOpen(true)}
                  className="w-full sm:w-auto min-h-[42px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Make changes</span>
                </button>
              )}
            </div>
          </div>
        )
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

      {/* Compact 12-week switcher: the same controls on phone and desktop. */}
      <section aria-labelledby="week-selector-heading" className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-950 text-amber-300 flex items-center justify-center shrink-0 shadow-sm">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 id="week-selector-heading" className="text-sm font-black text-slate-950">Register week</h3>
              <p className="text-[11px] text-slate-500 truncate">
                Week {selectedWeek} of {totalWeeks} · {selectedWeek === activeCalendarWeek ? 'Current' : selectedWeek > activeCalendarWeek ? 'Upcoming' : 'Past'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectWeek(Math.max(1, selectedWeek - 1))}
              disabled={selectedWeek <= 1}
              aria-label="Previous register week"
              className="w-10 h-10 grid place-items-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSelectWeek(Math.min(totalWeeks, selectedWeek + 1))}
              disabled={selectedWeek >= totalWeeks || selectedWeek >= activeCalendarWeek}
              aria-label="Next register week"
              className="w-10 h-10 grid place-items-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-6 ${totalWeeks >= 13 ? 'lg:grid-cols-13' : 'sm:grid-cols-12'} gap-1.5`}>
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((wk) => {
            const isSelected = wk === selectedWeek;
            const weekStats = calculateWeekSummary(wk, members, grades, offerings);
            const isNoRec = noRecordWeeks.includes(wk);
            const isWkOpen = isSundayRegisterOpenForWeek(wk, activeQuarterObj, new Date());
            const isAct = wk === sundayRegisterIntel.activeRegisterWeek && isWkOpen;
            const isCalCurrent = wk === activeCalendarWeek;
            const isFut = !isWkOpen;

            return (
              <button
                key={wk}
                id={`btn-week-pill-${wk}`}
                onClick={() => handleSelectWeek(wk)}
                aria-label={`Select week ${wk}${isAct ? ', open' : isFut ? ', locked' : ''}`}
                aria-current={isSelected ? 'true' : undefined}
                className={`min-h-[48px] sm:min-h-[54px] py-1.5 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                  isSelected
                    ? 'bg-blue-950 border-blue-950 text-white shadow-sm ring-2 ring-blue-500/30'
                    : isAct
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-400 text-emerald-950 font-black'
                    : isFut
                    ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                    : isNoRec
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <span className={`text-[9px] uppercase font-black ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>Wk</span>
                <span className="text-sm font-black leading-none">{wk}</span>
                <span className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  isNoRec ? 'bg-amber-500' : isAct ? 'bg-emerald-500' : isFut || (isCalCurrent && !isWkOpen) ? 'bg-slate-400' : weekStats.totalAttendance > 0 ? 'bg-blue-500' : 'bg-slate-200'
                }`} />
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500" aria-label="Week status legend">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Recorded</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Locked</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> No record</span>
        </div>
      </section>

      {/* Admin-Published Curriculum Lesson Topic & Memory Verse */}
      <section aria-labelledby="lesson-topic-heading" className="relative overflow-hidden bg-gradient-to-br from-[#071b3d] via-[#0d3470] to-[#281b57] border border-blue-700/60 rounded-2xl p-4 sm:p-6 shadow-xl shadow-blue-950/10">
        <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-amber-300/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-24 w-48 h-48 rounded-full bg-cyan-300/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.13em] bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg shadow-sm">
                Week {currentLesson.weekNumber} · Class register
              </span>
              <span className="text-[10px] font-bold bg-white/10 text-blue-100 border border-white/20 px-2 py-1 rounded-lg flex items-center gap-1 backdrop-blur-sm">
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
                <span>Admin-Published Curriculum</span>
              </span>
            </div>

            <h3 id="lesson-topic-heading" className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight max-w-3xl">
              {currentLesson.topic}
            </h3>

            {currentLesson.memoryVerse ? (
              <div className="pt-1 text-xs sm:text-sm text-blue-100/90 font-medium italic max-w-3xl leading-relaxed">
                <span className="font-black not-italic text-amber-300 uppercase tracking-wider text-[11px] mr-1.5">Memory Verse:</span>
                "{currentLesson.memoryVerse}" {currentLesson.memoryVerseRef ? `(${currentLesson.memoryVerseRef})` : ''}
              </div>
            ) : null}
          </div>

          {/* Quick Action Toolbar */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1 lg:pt-0 lg:justify-end">
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
              className="min-h-[44px] px-3.5 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-white/20 shadow-sm transition cursor-pointer backdrop-blur-sm"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>Add visitor</span>
            </button>

            <button
              id="btn-print-official-return"
              onClick={() => setShowOfficialPrintModal(true)}
              className="min-h-[44px] px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
              title="Print formatted official weekly Sunday School return for pastors and superintendents"
            >
              <Printer className="w-4 h-4" />
              <span>Print return</span>
            </button>

            <button
              type="button"
              id="btn-toggle-no-record"
              onClick={handleToggleNoRecord}
              disabled={isWeekLocked}
              className={`col-span-2 sm:col-span-1 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                isCurrentWeekNoRecord
                  ? 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <Minus className="w-4 h-4" />
              <span>{isCurrentWeekNoRecord ? 'Restore week' : 'No record'}</span>
            </button>
          </div>
        </div>
      </section>

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

      {/* 2-Section Top Bar: 1) Attendance & Absence Trend Graph, 2) Register Pulse Metrics & Offering */}
      <section aria-label="Week summary" className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        
        {/* Section 1: 12-Week Attendance vs Absence Trend Graph (7 cols on desktop) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-800" />
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Quarter Attendance Trend
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif] mt-0.5">
                Weekly Attendees vs Absentees (Weeks 1–12)
              </h3>
            </div>

            {/* Two-Line Legend */}
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                <span>Absent</span>
              </div>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full overflow-x-auto pt-1">
            {(() => {
              const maxVal = Math.max(8, ...weeklyAttendanceTrends.map(t => Math.max(t.present, t.absent))) + 2;
              const svgWidth = 520;
              const svgHeight = 150;
              const padLeft = 35;
              const padRight = 20;
              const padTop = 15;
              const padBottom = 28;
              const chartWidth = svgWidth - padLeft - padRight;
              const chartHeight = svgHeight - padTop - padBottom;

              const getX = (week: number) => padLeft + ((week - 1) / 11) * chartWidth;
              const getY = (val: number) => padTop + chartHeight - (val / maxVal) * chartHeight;

              const presentPoints = weeklyAttendanceTrends.map(t => `${getX(t.week)},${getY(t.present)}`).join(' ');
              const absentPoints = weeklyAttendanceTrends.map(t => `${getX(t.week)},${getY(t.absent)}`).join(' ');

              return (
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[480px] h-36 select-none">
                  {/* Grid horizontal guidelines */}
                  {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                    const y = padTop + chartHeight * (1 - ratio);
                    const labelVal = Math.round(maxVal * ratio);
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                        <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="#94a3b8">
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Active week column highlight */}
                  {(() => {
                    const selX = getX(selectedWeek);
                    return (
                      <rect
                        x={selX - 16}
                        y={padTop - 5}
                        width={32}
                        height={chartHeight + 10}
                        rx={6}
                        fill="#eff6ff"
                        stroke="#bfdbfe"
                        strokeWidth="1"
                      />
                    );
                  })()}

                  {/* Line 1: Present (Emerald solid line) */}
                  <polyline
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={presentPoints}
                  />

                  {/* Line 2: Absent (Rose dashed line) */}
                  <polyline
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={absentPoints}
                  />

                  {/* Points and click hotspots */}
                  {weeklyAttendanceTrends.map((t) => {
                    const x = getX(t.week);
                    const yP = getY(t.present);
                    const yA = getY(t.absent);
                    const isSelected = t.week === selectedWeek;

                    return (
                      <g key={t.week} className="cursor-pointer" onClick={() => onSelectWeek(t.week)}>
                        {/* Present Point */}
                        <circle cx={x} cy={yP} r={isSelected ? 5.5 : 4} fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
                        {/* Absent Point */}
                        <circle cx={x} cy={yA} r={isSelected ? 5.5 : 4} fill="#e11d48" stroke="#ffffff" strokeWidth="1.5" />

                        {/* Labels for selected week */}
                        {isSelected && (
                          <>
                            <text x={x} y={Math.max(12, yP - 8)} textAnchor="middle" fontSize="10" fontWeight="900" fill="#047857">
                              {t.present}P
                            </text>
                            <text x={x} y={Math.min(chartHeight + 10, yA + 12)} textAnchor="middle" fontSize="10" fontWeight="900" fill="#be123c">
                              {t.absent}A
                            </text>
                          </>
                        )}

                        {/* Week Label on X Axis */}
                        <text
                          x={x}
                          y={svgHeight - 8}
                          textAnchor="middle"
                          fontSize={isSelected ? "11" : "9.5"}
                          fontWeight={isSelected ? "900" : "700"}
                          fill={isSelected ? "#1e3a8a" : "#64748b"}
                        >
                          W{t.week}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Week {selectedWeek} Active View</span>
            <span className="font-semibold text-blue-900">
              {weeklyAttendanceTrends[selectedWeek - 1]?.present || 0} Present · {weeklyAttendanceTrends[selectedWeek - 1]?.absent || 0} Absent (out of {weeklyAttendanceTrends[selectedWeek - 1]?.eligible || 0} eligible)
            </span>
          </div>
        </div>

        {/* Section 2: Register Metrics & Offering (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          
          {/* Card: Attendance & Register Progress Pulse */}
          <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-sm space-y-3.5">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Register Pulse • Week {selectedWeek}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-950">{weekSummary.totalAttendance}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-500">of {eligibleCount} eligible</span>
                  {exemptCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {exemptCount} exempt excluded
                    </span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Attendance Rate Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Class Attendance</span>
                <span className="text-blue-900 font-black">{attendanceRate}% present</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${Math.min(100, attendanceRate)}%` }} />
              </div>
            </div>

            {/* Register Completion Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Roster Progress</span>
                <span className="text-violet-800 font-black">{recordedCount} of {eligibleCount} ({registerCompletionRate}%)</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${Math.min(100, registerCompletionRate)}%` }} />
              </div>
            </div>

            {/* Visitors & Breakdown */}
            <div className="flex items-center justify-between pt-1 text-xs text-slate-600 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900">{weekSummary.visitorCount} visitors today</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">({weekSummary.newVisitorCount} new)</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {weekSummary.studentCount} students
              </span>
            </div>
          </div>

          {/* Weekly Offering Input Card */}
          <div className="bg-white border border-amber-200/90 p-3.5 sm:p-4 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Weekly offering</span>
              <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">Week {selectedWeek}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-slate-800">{currencySymbol}</span>
              <div className="relative w-full">
                <input
                  id="weekly-offering-amount-input"
                  type="number"
                  min="0"
                  step="100"
                  disabled={isOfferingLocked}
                  value={currentOffering.amount || ''}
                  onChange={(e) => handleOfferingAmountChange(parseFloat(e.target.value))}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className={`w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 px-2.5 text-base font-black text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    isOfferingLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-300 pr-16' : ''
                  }`}
                />
                {isOfferingLocked && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 flex items-center gap-1 text-[10px] font-bold bg-slate-200/90 px-1.5 py-0.5 rounded shadow-2xs">
                    <Lock className="w-3 h-3 text-slate-600" />
                    <span>{currentOffering.remittanceStatus === 'AUDITED' ? 'Audited' : 'Locked'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Remittance Status Indicator & Action */}
            <div className="pt-1 border-t border-slate-100">
              {currentOffering.remittanceStatus === 'AUDITED' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[10px] text-emerald-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Audited Amount: {currencySymbol}{(currentOffering.auditedAmount ?? currentOffering.amount).toLocaleString()}</span>
                    </span>
                    <span className="text-emerald-700 font-semibold truncate max-w-[110px]">
                      {currentOffering.auditedBy ? `By ${currentOffering.auditedBy}` : 'Audited'}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-800 font-medium">
                    This financial record has already been audited and accepted by the Treasurer.
                  </p>
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
      </section>

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

      {/* Roster Table Filter & Reorder Controls */}
      <section aria-labelledby="weekly-roster-heading" className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 id="weekly-roster-heading" className="text-sm sm:text-base font-black text-slate-950">Weekly roster</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              Showing {filteredMembers.length} of {members.length} people · Week {selectedWeek}
            </p>
          </div>
          {lastSavedTimestamp && (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 animate-fade-in" title="Latest grade entry saved to local database">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Saved</span>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              aria-label="Search class members"
              placeholder="Search by name, phone, or occupation"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Compact Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              id="btn-filter-dropdown"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              aria-expanded={isFilterDropdownOpen}
              className="min-h-[42px] px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-slate-600" />
              <span>Filter: {typeFilter === 'ALL' ? 'All' : typeFilter === 'STUDENT' ? 'Students' : 'Visitors'} ▾</span>
            </button>
            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 animate-in fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('ALL');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    typeFilter === 'ALL' ? 'text-blue-900 bg-blue-50' : 'text-slate-700'
                  }`}
                >
                  <span>All ({members.length})</span>
                  {typeFilter === 'ALL' && <Check className="w-3.5 h-3.5 text-blue-900" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('STUDENT');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    typeFilter === 'STUDENT' ? 'text-blue-900 bg-blue-50' : 'text-slate-700'
                  }`}
                >
                  <span>Students ({members.filter(m => m.memberType === 'STUDENT').length})</span>
                  {typeFilter === 'STUDENT' && <Check className="w-3.5 h-3.5 text-blue-900" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('VISITOR');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    typeFilter === 'VISITOR' ? 'text-purple-700 bg-purple-50' : 'text-slate-700'
                  }`}
                >
                  <span>Visitors ({members.filter(m => m.memberType === 'VISITOR').length})</span>
                  {typeFilter === 'VISITOR' && <Check className="w-3.5 h-3.5 text-purple-700" />}
                </button>
              </div>
            )}
          </div>

          {/* REORDER Action Button */}
          {!isReadOnly && !isReorderMode && (
            <button
              type="button"
              id="btn-start-reorder"
              onClick={handleStartReorder}
              className="min-h-[42px] px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition cursor-pointer"
              title="Rearrange members to match the physical handwritten register"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
              <span>REORDER</span>
            </button>
          )}
          </div>
        </div>
      </section>

      {isReorderMode ? (
        <div className="bg-white border-2 border-blue-600 rounded-xl p-4 sm:p-5 shadow-lg space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-900 text-white text-[10px] font-black uppercase">
                  REORDER MODE
                </span>
                <span className="text-xs text-slate-500 font-bold">Physical Register Sync</span>
              </div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base mt-1">
                Rearrange Register to Match Handwritten Book
              </h3>
              <p className="text-xs text-slate-500">
                Use the up/down arrows to position students and visitors in the exact sequence of your paper register. Tap SAVE ORDER when done.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsReorderMode(false)}
                disabled={isSavingOrder}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-save-order"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingOrder ? (
                  <span>Saving Order…</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-amber-300" />
                    <span>SAVE ORDER</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {reorderList.map((member, index) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-xs font-black text-slate-700">
                    {index + 1}
                  </span>
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                      {member.fullName}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      member.memberType === 'VISITOR' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {member.memberType}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveMember(index, 'UP')}
                    disabled={index === 0 || isSavingOrder}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveMember(index, 'DOWN')}
                    disabled={index === reorderList.length - 1 || isSavingOrder}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
      /* 12-Lesson Member Grading Cards List */
      <div className="space-y-3.5">
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
            const isExcludedOrArchived = member.status === 'LEFT_CLASS';
            const isOneTimeVisitor = member.isOneTimeVisitor || member.exclusionType === 'TEMPORARY';

            return (
              <div
                key={member.id}
                id={`grading-card-${member.id}`}
                className={`group bg-white border rounded-2xl p-3.5 sm:p-5 transition-all shadow-sm hover:shadow-md ${
                  isExcludedOrArchived
                    ? 'border-slate-200 border-l-4 border-l-slate-400 bg-slate-50/50 opacity-90'
                    : grade.attendance === 'PRESENT'
                    ? 'border-slate-200 border-l-4 border-l-emerald-600'
                    : grade.attendance === 'ABSENT'
                    ? 'border-slate-200 border-l-4 border-l-[#8b451f]'
                    : 'border-slate-200 border-l-4 border-l-rose-600'
                }`}
              >
                {/* Notification Badge on top for Archived / One-Time Visitors */}
                {isExcludedOrArchived && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-xl mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>{isOneTimeVisitor ? 'One-Time Visitor' : 'Archived Student'}</span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-1.5 py-0.5 rounded">
                        Auto-Exempted from Denominator
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium italic">
                      {member.departureReason || 'Excluded from class'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(250px,1fr)_minmax(310px,auto)_minmax(360px,1.1fr)] xl:items-center gap-4">
                  
                  {/* Member Profile Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0 shadow-sm ${
                      member.memberType === 'VISITOR' ? 'bg-violet-50 border-violet-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                      {member.photoBase64 ? (
                        <img
                          src={member.photoBase64}
                          alt={member.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                          <span className={`text-sm font-black ${member.memberType === 'VISITOR' ? 'text-violet-700' : 'text-blue-800'}`}>
                          {member.fullName.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h4 className="font-black text-slate-950 text-sm sm:text-base leading-tight truncate max-w-full">
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

                  {/* Attendance Selector Buttons */}
                  {/* For Excluded/Archived Students: Automatically on EXEMPT with 1-click Restore */}
                  {/* For Active Students: PRESENT, ABSENT, EXEMPT */}
                  {isExcludedOrArchived ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto bg-slate-100/90 p-1.5 rounded-xl border border-slate-200">
                      <div className="px-3 py-2 rounded-lg text-xs font-black bg-rose-600 text-white flex items-center justify-center gap-1 shadow-xs shrink-0">
                        <Minus className="w-3.5 h-3.5" />
                        <span>EXEMPT</span>
                      </div>
                      <button
                        id={`btn-restore-present-${member.id}`}
                        type="button"
                        onClick={() => handleRestoreAndMarkPresent(member)}
                        disabled={isWeekLocked}
                        className="px-3 py-2 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Attended today: Restore to active roster and mark PRESENT"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Came Today? Restore & Present</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 w-full xl:w-auto bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                      <button
                        id={`att-present-${member.id}`}
                        onClick={() => handleAttendanceChange(member, 'PRESENT')}
                        disabled={isWeekLocked}
                        className={`min-h-[40px] px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 border active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                        className={`min-h-[40px] px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 border active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                        className={`min-h-[40px] px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 border active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                          grade.attendance === 'EXEMPT'
                            ? 'bg-red-600 border-red-600 text-white shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span>EXEMPT</span>
                      </button>
                    </div>
                  )}

                  {/* 4-Tier Grading Inputs (Punctuality 0-15, M Vars 0-15, C Participation 0-20, Total 50) */}
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full xl:w-auto">
                    
                    {/* Punctuality (0-15) */}
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 block mb-1 truncate">Punctuality</span>
                      <div className="flex items-center justify-center gap-1">
                        <ScoreInput
                          id={`score-punctuality-${member.id}`}
                          aria-label={`${member.fullName} - Punctuality score out of 15`}
                          max={15}
                          disabled={grade.attendance !== 'PRESENT' || isWeekLocked}
                          value={grade.attendance === 'PRESENT' ? grade.punctuality : 0}
                          onChange={(val) => handleScoreChange(member.id, 'punctuality', val, 15)}
                          className="w-10 sm:w-12 h-10 bg-white border-2 border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/15</span>
                      </div>
                    </div>

                    {/* M Vars (0-15) */}
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 block mb-1 truncate">Memory</span>
                      <div className="flex items-center justify-center gap-1">
                        <ScoreInput
                          id={`score-memoryverse-${member.id}`}
                          aria-label={`${member.fullName} - Memory Verse score out of 15`}
                          max={15}
                          disabled={grade.attendance !== 'PRESENT' || isWeekLocked}
                          value={grade.attendance === 'PRESENT' ? grade.memoryVerse : 0}
                          onChange={(val) => handleScoreChange(member.id, 'memoryVerse', val, 15)}
                          className="w-10 sm:w-12 h-10 bg-white border-2 border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/15</span>
                      </div>
                    </div>

                    {/* C Participation (0-20) */}
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 block mb-1 truncate">Participation</span>
                      <div className="flex items-center justify-center gap-1">
                        <ScoreInput
                          id={`score-participation-${member.id}`}
                          aria-label={`${member.fullName} - Class Participation score out of 20`}
                          max={20}
                          disabled={grade.attendance !== 'PRESENT' || isWeekLocked}
                          value={grade.attendance === 'PRESENT' ? grade.classParticipation : 0}
                          onChange={(val) => handleScoreChange(member.id, 'classParticipation', val, 20)}
                          className="w-10 sm:w-12 h-10 bg-white border-2 border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/20</span>
                      </div>
                    </div>

                    {/* Auto-Calculated Total (Max 50) */}
                    <div className="bg-blue-950 p-2 rounded-xl border border-blue-900 text-center min-w-0 flex flex-col justify-center">
                      <span className="text-[9px] sm:text-[10px] font-bold text-blue-200 block mb-1 truncate">Total</span>
                      <div className="flex items-baseline justify-center gap-0.5 min-h-[40px]">
                        <span className="text-xl font-black text-white self-center">
                          {grade.attendance === 'PRESENT' ? grade.lessonTotal : 0}
                        </span>
                        <span className="text-[10px] text-blue-300 font-bold self-center">/50</span>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Quick Score Presets & Absent Care Action Bar */}
                {/* 50: Deep Purple | 40: Royal Blue | 30: Sky Blue */}
                <div className="mt-3 p-2.5 sm:p-3 bg-slate-50/90 border border-slate-100 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                  
                  {/* Left: Quick Score Presets with Required Colors */}
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-auto lg:mr-0">Quick score</span>
                    <button
                      id={`btn-score-50-${member.id}`}
                      onClick={() => handleMemberQuickPreset(member.id, 15, 15, 20)}
                      disabled={isWeekLocked || grade.attendance !== 'PRESENT'}
                      className="px-3 py-1.5 min-h-[38px] min-w-[44px] bg-[#3b0764] hover:bg-[#2e0854] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white border border-purple-900 rounded-lg text-xs font-black shadow-xs transition duration-150 flex items-center justify-center cursor-pointer"
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
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
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
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-600">
                        <label className={`min-h-[36px] px-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-1.5 ${isWeekLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-slate-900 hover:border-slate-300'}`}>
                          <input
                            type="checkbox"
                            disabled={isWeekLocked}
                            checked={grade.joinedPrayerMeeting || false}
                            onChange={(e) => handleChecklistChange(member.id, 'joinedPrayerMeeting', e.target.checked)}
                            className="rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-0 w-3.5 h-3.5 disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold text-[11px]">Prayer Mtg</span>
                        </label>

                        <label className={`min-h-[36px] px-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-1.5 ${isWeekLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-slate-900 hover:border-slate-300'}`}>
                          <input
                            type="checkbox"
                            disabled={isWeekLocked}
                            checked={grade.postedStatusInsight || false}
                            onChange={(e) => handleChecklistChange(member.id, 'postedStatusInsight', e.target.checked)}
                            className="rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-0 w-3.5 h-3.5 disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold text-[11px]">WhatsApp Status</span>
                        </label>

                        <label className={`min-h-[36px] px-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-1.5 ${isWeekLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-slate-900 hover:border-slate-300'}`}>
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

      {/* Confirmation Modal to Enter Changes Mode */}
      {isConfirmChangesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-900">
              <Lock className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Enter Changes Mode?
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                This week's remitted record is locked. Entering Changes Mode will allow corrections to be made. Continue?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmChangesModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-enter-changes-mode"
                onClick={() => {
                  setIsConfirmChangesModalOpen(false);
                  setIsChangesModeActive(true);
                }}
                className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
