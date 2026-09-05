import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRight,
  Sparkles,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  HelpCircle,
  Clock,
  Layers,
  GraduationCap,
  HeartHandshake,
  Search,
  Check,
  ChevronRight,
  Award,
  Calendar,
  Phone,
  FileText,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Member,
  QuarterNumber,
  MemberType,
  MemberStatus,
  ClassProfile,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  SundaySchoolYear
} from '../types';
import {
  getMembersByClass,
  getGradesByClassAndQuarter,
  getOfferingsByClassAndQuarter,
  getAbsenceLogsByClassAndQuarter,
  forwardMembersToQuarter
} from '../db/indexedDB';
import { calculateMemberStats, getConsecutiveAbsences, getConsecutiveVisits } from '../utils/calculations';

export interface QuarterTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  classProfile: ClassProfile | null;
  fromQuarter: QuarterNumber;
  toQuarter: QuarterNumber;
  sourceMembers?: Member[];
  onTransitionComplete: (enrolledMembers: Member[]) => void;
  sundaySchoolYear?: SundaySchoolYear | null;
}

export type ForwardingDecision =
  | 'FORWARD_STUDENT'
  | 'FORWARD_VISITOR'
  | 'UPGRADE_STUDENT'
  | 'DO_NOT_FORWARD'
  | 'UNDER_REVIEW';

export interface MemberAnalysisItem {
  memberId: string;
  fullName: string;
  phone: string;
  sourceType: MemberType;
  sourceStatus: MemberStatus;
  firstLessonWeek: number;
  // Performance & Attendance in previous quarter
  attendedWeeks: number;
  eligibleLessonsCount: number;
  attendanceRate: number;
  consistency: 'High' | 'Moderate' | 'Low';
  consecutiveAbsencesAtEnd: number;
  consecutiveVisitsAtEnd: number;
  totalVisitsCount: number;
  isVisitorUpgradeEligible: boolean;
  isProlongedAbsence: boolean; // 6+ consecutive weeks absent
  isUnderReview: boolean; // 3-5 consecutive absences or < 40% attendance
  isAlreadyExited: boolean; // status === 'LEFT_CLASS'
  diligenceRate: number;
  punctualityAvg: number;
  memoryVerseAvg: number;
  participationAvg: number;
  latestWelfareNote?: string;
  category: 'STUDENT' | 'VISITOR' | 'PROLONGED_ABSENCE' | 'UNDER_REVIEW' | 'ALREADY_EXITED';
  recommendation: {
    type: 'FORWARD_AS_STUDENT' | 'FORWARD_AS_VISITOR' | 'ELIGIBLE_FOR_UPGRADE' | 'EXEMPTION_REVIEW' | 'UNDER_REVIEW' | 'EXEMPT_EXITED';
    label: string;
    description: string;
  };
  // Decision made by user
  decision: ForwardingDecision;
  targetType: MemberType;
  targetStatus: MemberStatus;
  note: string;
}

export const QuarterTransitionModal: React.FC<QuarterTransitionModalProps> = ({
  isOpen,
  onClose,
  classProfile,
  fromQuarter,
  toQuarter,
  sourceMembers: initialSourceMembers,
  onTransitionComplete,
  sundaySchoolYear
}) => {
  if (!isOpen) return null;

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [analyzedMembers, setAnalyzedMembers] = useState<MemberAnalysisItem[]>([]);
  const [activeStep, setActiveStep] = useState<'REPORT' | 'SUMMARY'>('REPORT');
  const [filterSection, setFilterSection] = useState<'ALL' | 'STUDENTS' | 'VISITORS' | 'PROLONGED_ABSENCE' | 'UNDER_REVIEW' | 'ALREADY_EXITED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine total lessons in source quarter
  const totalLessonsInSourceQuarter = useMemo(() => {
    const qData = sundaySchoolYear?.quarters.find(q => q.quarterNumber === fromQuarter);
    return qData?.lessons?.length || 12;
  }, [sundaySchoolYear, fromQuarter]);

  // Load and analyze previous quarter data
  useEffect(() => {
    let isMounted = true;

    async function loadAndAnalyzeQuarterData() {
      if (!classProfile?.id) return;
      setIsLoadingData(true);

      try {
        const [sourceMems, sourceGrades, sourceOfferings, sourceLogs] = await Promise.all([
          getMembersByClass(classProfile.id, fromQuarter),
          getGradesByClassAndQuarter(classProfile.id, fromQuarter),
          getOfferingsByClassAndQuarter(classProfile.id, fromQuarter),
          getAbsenceLogsByClassAndQuarter(classProfile.id, fromQuarter)
        ]);

        if (!isMounted) return;

        const membersToAnalyze = (sourceMems && sourceMems.length > 0)
          ? sourceMems
          : (initialSourceMembers || []);

        const noRecordWeeks = sourceOfferings
          .filter(o => o.isNoRecordWeek)
          .map(o => o.weekNumber);

        // Perform intelligent analysis for each person in source quarter
        const analysis: MemberAnalysisItem[] = membersToAnalyze.map(member => {
          const stats = calculateMemberStats(member, sourceGrades, totalLessonsInSourceQuarter, noRecordWeeks);

          // Calculate consecutive absences at the end of the quarter
          const consecAbsences = getConsecutiveAbsences(
            member.id,
            totalLessonsInSourceQuarter,
            sourceGrades,
            member.firstLessonWeek || 1,
            noRecordWeeks
          );

          // Calculate consecutive visits for visitors
          const consecVisits = member.memberType === 'VISITOR'
            ? getConsecutiveVisits(member.id, totalLessonsInSourceQuarter, sourceGrades, noRecordWeeks)
            : 0;

          const attendanceRate = stats.eligibleLessonsCount > 0
            ? Math.round((stats.attendedWeeks / stats.eligibleLessonsCount) * 100)
            : 0;

          const consistency: 'High' | 'Moderate' | 'Low' =
            attendanceRate >= 75 ? 'High' : attendanceRate >= 50 ? 'Moderate' : 'Low';

          // Classification flags
          const isAlreadyExited = member.status === 'LEFT_CLASS';
          const isProlongedAbsence = !isAlreadyExited && consecAbsences >= 6;
          const isUnderReview = !isAlreadyExited && !isProlongedAbsence && (
            (consecAbsences >= 3 && consecAbsences < 6) ||
            (member.memberType === 'STUDENT' && attendanceRate < 45)
          );

          const isVisitorUpgradeEligible = member.memberType === 'VISITOR' && !isAlreadyExited && (
            consecVisits >= 3 || (attendanceRate >= 50 && stats.attendedWeeks >= 3)
          );

          // Categorization
          let category: MemberAnalysisItem['category'] = 'STUDENT';
          if (isAlreadyExited) {
            category = 'ALREADY_EXITED';
          } else if (isProlongedAbsence) {
            category = 'PROLONGED_ABSENCE';
          } else if (isUnderReview) {
            category = 'UNDER_REVIEW';
          } else if (member.memberType === 'VISITOR') {
            category = 'VISITOR';
          } else {
            category = 'STUDENT';
          }

          // Recommendation & initial smart default decision
          let recType: MemberAnalysisItem['recommendation']['type'] = 'FORWARD_AS_STUDENT';
          let recLabel = 'Recommended: Forward as Student';
          let recDesc = 'Regular active student in Quarter ' + fromQuarter;
          let initialDecision: ForwardingDecision = 'FORWARD_STUDENT';
          let initialTargetType: MemberType = member.memberType;
          let initialTargetStatus: MemberStatus = 'ACTIVE';

          if (isAlreadyExited) {
            recType = 'EXEMPT_EXITED';
            recLabel = 'Exempted / Left Class in Q' + fromQuarter;
            recDesc = 'Historical record preserved. Do not forward unless student returned.';
            initialDecision = 'DO_NOT_FORWARD';
            initialTargetStatus = 'LEFT_CLASS';
          } else if (isProlongedAbsence) {
            recType = 'EXEMPTION_REVIEW';
            recLabel = `Exemption Review (${consecAbsences} Wks Absent)`;
            recDesc = `Absent for ${consecAbsences} consecutive weeks. Recommend exemption or re-engagement check.`;
            initialDecision = 'DO_NOT_FORWARD';
            initialTargetStatus = 'LEFT_CLASS';
          } else if (isUnderReview) {
            recType = 'UNDER_REVIEW';
            recLabel = 'Under Review — Poor Consistency';
            recDesc = `Missed ${consecAbsences} consecutive lessons (${attendanceRate}% attendance). Review required.`;
            initialDecision = 'UNDER_REVIEW';
            initialTargetStatus = 'ACTIVE';
          } else if (member.memberType === 'VISITOR' && isVisitorUpgradeEligible) {
            recType = 'ELIGIBLE_FOR_UPGRADE';
            recLabel = 'Eligible for Student Upgrade';
            recDesc = `Satisfied criteria: ${consecVisits >= 3 ? `${consecVisits} consecutive visits` : `${attendanceRate}% attendance`}. Promote to regular Student.`;
            initialDecision = 'UPGRADE_STUDENT';
            initialTargetType = 'STUDENT';
            initialTargetStatus = 'ACTIVE';
          } else if (member.memberType === 'VISITOR') {
            recType = 'FORWARD_AS_VISITOR';
            recLabel = 'Recommended: Forward as Visitor';
            recDesc = `Continue as visitor in Quarter ${toQuarter}.`;
            initialDecision = 'FORWARD_VISITOR';
            initialTargetType = 'VISITOR';
            initialTargetStatus = 'ACTIVE';
          } else {
            recType = 'FORWARD_AS_STUDENT';
            recLabel = 'Recommended: Forward as Student';
            recDesc = `Consistent Quarter ${fromQuarter} participation (${attendanceRate}% attendance). Forward as Student.`;
            initialDecision = 'FORWARD_STUDENT';
            initialTargetType = 'STUDENT';
            initialTargetStatus = 'ACTIVE';
          }

          // Check latest welfare log
          const memberLogs = sourceLogs.filter(l => l.memberId === member.id);
          const latestLog = memberLogs.length > 0 ? memberLogs[memberLogs.length - 1] : undefined;

          return {
            memberId: member.id,
            fullName: member.fullName,
            phone: member.phone || '',
            sourceType: member.memberType,
            sourceStatus: member.status,
            firstLessonWeek: member.firstLessonWeek || 1,
            attendedWeeks: stats.attendedWeeks,
            eligibleLessonsCount: stats.eligibleLessonsCount,
            attendanceRate,
            consistency,
            consecutiveAbsencesAtEnd: consecAbsences,
            consecutiveVisitsAtEnd: consecVisits,
            totalVisitsCount: stats.attendedWeeks,
            isVisitorUpgradeEligible,
            isProlongedAbsence,
            isUnderReview,
            isAlreadyExited,
            diligenceRate: stats.hardWorkRate,
            punctualityAvg: stats.avgPunctuality,
            memoryVerseAvg: stats.avgMemoryVerse,
            participationAvg: stats.avgParticipation,
            latestWelfareNote: latestLog ? `${latestLog.reasonCategory || 'Absence'}: ${latestLog.notes || latestLog.exitNote || 'Followed up'}` : undefined,
            category,
            recommendation: {
              type: recType,
              label: recLabel,
              description: recDesc
            },
            decision: initialDecision,
            targetType: initialTargetType,
            targetStatus: initialTargetStatus,
            note: ''
          };
        });

        setAnalyzedMembers(analysis);
      } catch (err) {
        console.error('Error loading previous quarter data for transition report:', err);
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    }

    loadAndAnalyzeQuarterData();

    return () => {
      isMounted = false;
    };
  }, [classProfile?.id, fromQuarter, toQuarter, totalLessonsInSourceQuarter]);

  // Decision change handler per member
  const handleSetDecision = (memberId: string, decision: ForwardingDecision) => {
    setAnalyzedMembers(prev => prev.map(m => {
      if (m.memberId !== memberId) return m;

      let targetType: MemberType = m.sourceType;
      let targetStatus: MemberStatus = 'ACTIVE';

      switch (decision) {
        case 'FORWARD_STUDENT':
          targetType = 'STUDENT';
          targetStatus = 'ACTIVE';
          break;
        case 'FORWARD_VISITOR':
          targetType = 'VISITOR';
          targetStatus = 'ACTIVE';
          break;
        case 'UPGRADE_STUDENT':
          targetType = 'STUDENT';
          targetStatus = 'ACTIVE';
          break;
        case 'DO_NOT_FORWARD':
          targetType = m.sourceType;
          targetStatus = 'LEFT_CLASS';
          break;
        case 'UNDER_REVIEW':
          targetType = m.sourceType;
          targetStatus = 'ACTIVE';
          break;
      }

      return {
        ...m,
        decision,
        targetType,
        targetStatus
      };
    }));
  };

  const handleUpdateNote = (memberId: string, note: string) => {
    setAnalyzedMembers(prev => prev.map(m => m.memberId === memberId ? { ...m, note } : m));
  };

  // Bulk Smart Actions
  const handleApplyAllSmartRecommendations = () => {
    setAnalyzedMembers(prev => prev.map(m => {
      let targetType: MemberType = m.sourceType;
      let targetStatus: MemberStatus = 'ACTIVE';
      let decision: ForwardingDecision = 'FORWARD_STUDENT';

      if (m.isAlreadyExited || m.isProlongedAbsence) {
        decision = 'DO_NOT_FORWARD';
        targetStatus = 'LEFT_CLASS';
      } else if (m.isUnderReview) {
        // If under review, default to forwarding with careful observation
        decision = m.sourceType === 'STUDENT' ? 'FORWARD_STUDENT' : 'FORWARD_VISITOR';
        targetType = m.sourceType;
        targetStatus = 'ACTIVE';
      } else if (m.isVisitorUpgradeEligible) {
        decision = 'UPGRADE_STUDENT';
        targetType = 'STUDENT';
        targetStatus = 'ACTIVE';
      } else if (m.sourceType === 'VISITOR') {
        decision = 'FORWARD_VISITOR';
        targetType = 'VISITOR';
        targetStatus = 'ACTIVE';
      } else {
        decision = 'FORWARD_STUDENT';
        targetType = 'STUDENT';
        targetStatus = 'ACTIVE';
      }

      return {
        ...m,
        decision,
        targetType,
        targetStatus
      };
    }));
  };

  const handleForwardAllActive = () => {
    setAnalyzedMembers(prev => prev.map(m => {
      if (m.isAlreadyExited || m.isProlongedAbsence) return m;
      if (m.sourceType === 'VISITOR') {
        return {
          ...m,
          decision: m.isVisitorUpgradeEligible ? 'UPGRADE_STUDENT' : 'FORWARD_VISITOR',
          targetType: m.isVisitorUpgradeEligible ? 'STUDENT' : 'VISITOR',
          targetStatus: 'ACTIVE'
        };
      }
      return {
        ...m,
        decision: 'FORWARD_STUDENT',
        targetType: 'STUDENT',
        targetStatus: 'ACTIVE'
      };
    }));
  };

  const handleExemptAllProlonged = () => {
    setAnalyzedMembers(prev => prev.map(m => {
      if (m.isProlongedAbsence) {
        return {
          ...m,
          decision: 'DO_NOT_FORWARD',
          targetStatus: 'LEFT_CLASS'
        };
      }
      return m;
    }));
  };

  // Metric summaries
  const totalAnalyzed = analyzedMembers.length;
  const currentStudentsList = analyzedMembers.filter(m => m.category === 'STUDENT');
  const currentVisitorsList = analyzedMembers.filter(m => m.category === 'VISITOR');
  const prolongedAbsenceList = analyzedMembers.filter(m => m.category === 'PROLONGED_ABSENCE');
  const underReviewList = analyzedMembers.filter(m => m.category === 'UNDER_REVIEW');
  const alreadyExitedList = analyzedMembers.filter(m => m.category === 'ALREADY_EXITED');

  const pendingUnderReviewCount = analyzedMembers.filter(m => m.decision === 'UNDER_REVIEW').length;

  // Projected Quarter {toQuarter} outcomes
  const forwardedStudentsCount = analyzedMembers.filter(
    m => m.decision === 'FORWARD_STUDENT' || m.decision === 'UPGRADE_STUDENT'
  ).length;

  const forwardedVisitorsCount = analyzedMembers.filter(
    m => m.decision === 'FORWARD_VISITOR'
  ).length;

  const upgradedToStudentCount = analyzedMembers.filter(
    m => m.decision === 'UPGRADE_STUDENT'
  ).length;

  const notForwardedCount = analyzedMembers.filter(
    m => m.decision === 'DO_NOT_FORWARD'
  ).length;

  const totalEnteringNewQuarter = forwardedStudentsCount + forwardedVisitorsCount;

  // Filtered members for display
  const displayedMembers = useMemo(() => {
    return analyzedMembers.filter(m => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.fullName.toLowerCase().includes(q);
        const matchesPhone = m.phone.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone) return false;
      }

      // Section filter
      if (filterSection === 'STUDENTS') return m.category === 'STUDENT';
      if (filterSection === 'VISITORS') return m.category === 'VISITOR';
      if (filterSection === 'PROLONGED_ABSENCE') return m.category === 'PROLONGED_ABSENCE';
      if (filterSection === 'UNDER_REVIEW') return m.category === 'UNDER_REVIEW';
      if (filterSection === 'ALREADY_EXITED') return m.category === 'ALREADY_EXITED';

      return true;
    });
  }, [analyzedMembers, filterSection, searchQuery]);

  // Execute Final Transition
  const handleConfirmAndInitialize = async () => {
    if (!classProfile?.id) return;

    if (pendingUnderReviewCount > 0) {
      alert(`Please resolve the ${pendingUnderReviewCount} member(s) currently marked 'Under Review' before initializing Quarter ${toQuarter}. You can assign them a forwarding decision or click 'Apply All Smart Recommendations'.`);
      setActiveStep('REPORT');
      setFilterSection('UNDER_REVIEW');
      return;
    }

    if (totalEnteringNewQuarter === 0) {
      alert(`Please select at least one student or visitor to forward into Quarter ${toQuarter}.`);
      return;
    }

    setIsProcessing(true);
    try {
      // Only include members who have a forward/upgrade decision (exclude DO_NOT_FORWARD)
      const toForward = analyzedMembers.filter(m => m.decision !== 'DO_NOT_FORWARD' && m.decision !== 'UNDER_REVIEW');

      const transitions = toForward.map(m => ({
        memberId: m.memberId,
        targetType: m.targetType,
        targetStatus: m.targetStatus,
        firstLessonWeek: 1, // fresh quarter enrollment starts from Lesson 1
        note: m.note || (m.decision === 'UPGRADE_STUDENT' ? `Promoted from Visitor after Q${fromQuarter}` : undefined)
      }));

      const updatedMembers = await forwardMembersToQuarter(
        classProfile.id,
        fromQuarter,
        toQuarter,
        transitions
      );

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      onTransitionComplete(updatedMembers);
      onClose();
    } catch (err) {
      console.error('Failed to execute quarter transition:', err);
      alert('An error occurred while transitioning members to the new quarter.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-emerald-700/90 text-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  Intelligent Transition Engine
                </span>
                <span className="text-xs text-emerald-200 hidden sm:inline">
                  {classProfile?.className} • {classProfile?.department}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                <span>Quarter {fromQuarter} Intelligence Report</span>
                <ArrowRight className="w-4 h-4 text-emerald-400 inline" />
                <span className="text-amber-300">Quarter {toQuarter} Initialization</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator & Non-Destructive Data Guarantee Banner */}
        <div className="bg-emerald-50 border-b border-emerald-100 p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>
              <strong className="font-bold text-emerald-950">Data Safety Guarantee:</strong> Quarter {fromQuarter} records remain permanently preserved and read-only. Quarter {toQuarter} starts with fresh 0-mark grading matrices.
            </span>
          </div>

          {/* Stepper Navigation */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 font-bold">
            <button
              onClick={() => setActiveStep('REPORT')}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                activeStep === 'REPORT'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-emerald-100'
              }`}
            >
              1. Intelligence & Review
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setActiveStep('SUMMARY')}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                activeStep === 'SUMMARY'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-emerald-100'
              }`}
            >
              2. Summary & Confirm
            </button>
          </div>
        </div>

        {isLoadingData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin" />
            <p className="text-sm font-bold text-slate-700">Analyzing Quarter {fromQuarter} Records & Consistency Metrics...</p>
            <p className="text-xs text-slate-500">Evaluating student attendance, visitor conversion qualifications, and 6-week absence trends.</p>
          </div>
        ) : totalAnalyzed === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-400 opacity-60" />
            <h3 className="text-base font-bold text-slate-800">No Members Found in Quarter {fromQuarter}</h3>
            <p className="text-xs text-slate-500 max-w-md">
              There were no registered students or visitors found in Quarter {fromQuarter}. You can close this modal and add members directly to the Quarter {toQuarter} roster.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
            >
              Close
            </button>
          </div>
        ) : activeStep === 'REPORT' ? (
          <>
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Q{fromQuarter} Members</span>
                <span className="text-lg font-black text-slate-900">{totalAnalyzed}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Active Students</span>
                <span className="text-lg font-black text-blue-900">{currentStudentsList.length}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-purple-700 block">Active Visitors</span>
                <span className="text-lg font-black text-purple-900">{currentVisitorsList.length}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Under Review</span>
                <span className="text-lg font-black text-amber-900">{underReviewList.length}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">6+ Wk Absences / Exits</span>
                <span className="text-lg font-black text-rose-900">{prolongedAbsenceList.length + alreadyExitedList.length}</span>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterSection('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterSection === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All Records ({analyzedMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('STUDENTS')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterSection === 'STUDENTS'
                      ? 'bg-blue-800 text-white shadow-xs'
                      : 'bg-white text-blue-800 hover:bg-blue-50 border border-blue-200'
                  }`}
                >
                  Students ({currentStudentsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('VISITORS')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterSection === 'VISITORS'
                      ? 'bg-purple-800 text-white shadow-xs'
                      : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-200'
                  }`}
                >
                  Visitors ({currentVisitorsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('PROLONGED_ABSENCE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterSection === 'PROLONGED_ABSENCE'
                      ? 'bg-rose-800 text-white shadow-xs'
                      : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  6+ Wk Absence Review ({prolongedAbsenceList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('UNDER_REVIEW')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterSection === 'UNDER_REVIEW'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                  }`}
                >
                  Under Review ({underReviewList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('ALREADY_EXITED')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterSection === 'ALREADY_EXITED'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Exempted / Left ({alreadyExitedList.length})
                </button>
              </div>

              {/* Search input & bulk tools */}
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApplyAllSmartRecommendations}
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0"
                  title="Automatically apply the intelligent recommendation for each member"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Apply Smart Recommendations</span>
                  <span className="sm:hidden">Smart Apply</span>
                </button>
              </div>
            </div>

            {/* Main Interactive Intelligence Report Table / Cards */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 max-h-[50vh] bg-slate-50/50">
              {displayedMembers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No member records match the selected filter or search.</p>
                </div>
              ) : (
                displayedMembers.map((item, idx) => {
                  const isExempt = item.decision === 'DO_NOT_FORWARD';
                  const isUpgraded = item.decision === 'UPGRADE_STUDENT';
                  const isStudentForward = item.decision === 'FORWARD_STUDENT';
                  const isVisitorForward = item.decision === 'FORWARD_VISITOR';
                  const isPending = item.decision === 'UNDER_REVIEW';

                  return (
                    <div
                      key={item.memberId}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isExempt
                          ? 'bg-slate-50/80 border-slate-200 opacity-75'
                          : isUpgraded
                          ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                          : isPending
                          ? 'bg-amber-50/80 border-amber-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        
                        {/* Left column: Member Profile & Q1 Intelligence */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{item.fullName}</span>
                            
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              item.sourceType === 'STUDENT'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-purple-100 text-purple-900 border border-purple-200'
                            }`}>
                              Q{fromQuarter} {item.sourceType}
                            </span>

                            {item.isAlreadyExited && (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                                Left Class in Q{fromQuarter}
                              </span>
                            )}

                            {item.isProlongedAbsence && (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300">
                                ⚠️ {item.consecutiveAbsencesAtEnd} Wks Absent
                              </span>
                            )}

                            {item.isUnderReview && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                                Under Review
                              </span>
                            )}

                            {item.isVisitorUpgradeEligible && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-extrabold border border-emerald-300 flex items-center gap-1">
                                <Award className="w-3 h-3 text-emerald-700" />
                                <span>Eligible for Student Upgrade</span>
                              </span>
                            )}
                          </div>

                          {/* Detailed Stats Row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Attendance:</span>
                              <strong className="font-bold text-slate-900">
                                {item.attendedWeeks} / {item.eligibleLessonsCount} lessons ({item.attendanceRate}%)
                              </strong>
                            </div>

                            <div>
                              <span>Consistency:</span>{' '}
                              <span className={`font-bold ${
                                item.consistency === 'High'
                                  ? 'text-emerald-700'
                                  : item.consistency === 'Moderate'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}>
                                {item.consistency}
                              </span>
                            </div>

                            {item.sourceType === 'STUDENT' && (
                              <div>
                                <span>Diligence Rate:</span>{' '}
                                <strong className="font-bold text-amber-900">{item.diligenceRate}%</strong>
                              </div>
                            )}

                            {item.sourceType === 'VISITOR' && (
                              <div>
                                <span>Visits:</span>{' '}
                                <strong className="font-bold text-purple-900">{item.totalVisitsCount} times ({item.consecutiveVisitsAtEnd} consecutive)</strong>
                              </div>
                            )}

                            {item.phone && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <Phone className="w-3 h-3" />
                                <span>{item.phone}</span>
                              </div>
                            )}
                          </div>

                          {/* Recommendation & Welfare Callout */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{item.recommendation.label}</span>
                            </div>

                            {item.latestWelfareNote && (
                              <span className="text-[11px] text-slate-500 italic">
                                Welfare note: "{item.latestWelfareNote}"
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right column: Decision Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-200">
                          
                          {/* Forward as Student Button */}
                          <button
                            type="button"
                            onClick={() => handleSetDecision(item.memberId, 'FORWARD_STUDENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                              isStudentForward
                                ? 'bg-blue-800 text-white shadow-xs ring-2 ring-blue-500/50'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:text-blue-800'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Forward as Student</span>
                          </button>

                          {/* Upgrade to Student (For Visitors) or Forward as Visitor */}
                          {item.sourceType === 'VISITOR' ? (
                            <button
                              type="button"
                              onClick={() => handleSetDecision(item.memberId, 'UPGRADE_STUDENT')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                isUpgraded
                                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/50'
                                  : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-50'
                              }`}
                              title={item.isVisitorUpgradeEligible ? 'Qualified for Student Status!' : 'Upgrade visitor to Student'}
                            >
                              <GraduationCap className="w-3.5 h-3.5" />
                              <span>Upgrade to Student</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetDecision(item.memberId, 'FORWARD_VISITOR')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                isVisitorForward
                                  ? 'bg-purple-800 text-white shadow-xs ring-2 ring-purple-500/50'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-purple-50 hover:text-purple-800'
                              }`}
                              title="Relegate student to Visitor status for Quarter 2"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Forward as Visitor</span>
                            </button>
                          )}

                          {item.sourceType === 'VISITOR' && (
                            <button
                              type="button"
                              onClick={() => handleSetDecision(item.memberId, 'FORWARD_VISITOR')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                isVisitorForward
                                  ? 'bg-purple-800 text-white shadow-xs ring-2 ring-purple-500/50'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-purple-50 hover:text-purple-800'
                              }`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Forward as Visitor</span>
                            </button>
                          )}

                          {/* Exempt / Do Not Forward Button */}
                          <button
                            type="button"
                            onClick={() => handleSetDecision(item.memberId, 'DO_NOT_FORWARD')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                              isExempt
                                ? 'bg-slate-700 text-white shadow-xs ring-2 ring-slate-500/50'
                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300'
                            }`}
                            title="Do not forward into Quarter 2 (Historical records preserved in Quarter 1)"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Exempt / Do Not Forward</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Review Progress & Next Step Toolbar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="space-y-1 text-slate-700 text-center sm:text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">Projected Quarter {toQuarter} Roster:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold">
                    {forwardedStudentsCount} Students
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold">
                    {forwardedVisitorsCount} Visitors
                  </span>
                  {upgradedToStudentCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                      ({upgradedToStudentCount} Upgraded)
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                    {notForwardedCount} Exempted
                  </span>
                </div>

                {pendingUnderReviewCount > 0 && (
                  <p className="text-amber-800 font-bold flex items-center gap-1 justify-center sm:justify-start">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{pendingUnderReviewCount} member(s) marked Under Review — please assign decision before initializing.</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (pendingUnderReviewCount > 0) {
                      handleApplyAllSmartRecommendations();
                    }
                    setActiveStep('SUMMARY');
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>Next — Review Summary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* STEP 2: SUMMARY & CONFIRMATION VIEW */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-h-[70vh] bg-slate-50/40">
            {/* Transition Audit Header Card */}
            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-5 rounded-2xl shadow-lg border border-emerald-800">
              <div className="flex items-center gap-2.5 text-emerald-300 text-xs font-extrabold uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Quarter {fromQuarter} → Quarter {toQuarter} Transition Summary</span>
              </div>
              <h3 className="text-xl font-black text-white">Ready to Initialize Quarter {toQuarter} Class Register</h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-2xl leading-relaxed">
                Review the audited forwarding roster below. Once initialized, the selected members will be enrolled in Quarter {toQuarter} with fresh grading matrices. All Quarter {fromQuarter} attendance and grade logs remain permanently preserved.
              </p>

              {/* Statistics Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-emerald-800/80 text-center">
                <div className="bg-emerald-800/50 p-2.5 rounded-xl border border-emerald-700/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Q{toQuarter} Roster</span>
                  <span className="text-xl font-black text-amber-300">{totalEnteringNewQuarter}</span>
                </div>
                <div className="bg-emerald-800/50 p-2.5 rounded-xl border border-emerald-700/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Students Forwarded</span>
                  <span className="text-xl font-black text-white">{forwardedStudentsCount}</span>
                </div>
                <div className="bg-emerald-800/50 p-2.5 rounded-xl border border-emerald-700/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Visitors Forwarded</span>
                  <span className="text-xl font-black text-white">{forwardedVisitorsCount}</span>
                </div>
                <div className="bg-emerald-800/50 p-2.5 rounded-xl border border-emerald-700/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Upgraded to Student</span>
                  <span className="text-xl font-black text-amber-300">{upgradedToStudentCount}</span>
                </div>
                <div className="bg-emerald-800/50 p-2.5 rounded-xl border border-emerald-700/50 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Exempted / Left</span>
                  <span className="text-xl font-black text-slate-300">{notForwardedCount}</span>
                </div>
              </div>
            </div>

            {/* Checklist of Safety Standards */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs text-slate-700">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-tight text-[11px]">System Verification Checklist:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-start gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span><strong>Zero Historical Overwrites:</strong> Q{fromQuarter} records remain completely archived and read-only.</span>
                </div>
                <div className="flex items-start gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span><strong>Fresh 12-Lesson Matrix:</strong> Q{toQuarter} begins with 0 marks and fresh attendance columns.</span>
                </div>
                <div className="flex items-start gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span><strong>Continuous Person Identity:</strong> Member profiles and phone numbers are preserved without duplicate records.</span>
                </div>
              </div>
            </div>

            {/* Forwarded Members Roster List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs uppercase">
                  Quarter {toQuarter} Enrollment Manifest ({totalEnteringNewQuarter} Forwarded Members)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {notForwardedCount} members excluded / preserved in Q{fromQuarter}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                {analyzedMembers
                  .filter(m => m.decision !== 'DO_NOT_FORWARD')
                  .map((item, idx) => (
                    <div key={item.memberId} className="p-2.5 px-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-slate-400 w-5">{idx + 1}.</span>
                        <div>
                          <span className="font-bold text-slate-900">{item.fullName}</span>
                          <span className="text-slate-500 text-[11px] ml-2">
                            {item.phone || 'No phone'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.decision === 'UPGRADE_STUDENT' && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold text-[10px] border border-amber-300">
                            Upgraded from Visitor
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.targetType === 'STUDENT'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-purple-100 text-purple-900 border border-purple-200'
                        }`}>
                          Q{toQuarter} {item.targetType}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep('REPORT')}
                className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Back to Edit Decisions
              </button>

              <button
                type="button"
                id="btn-confirm-and-initialize-quarter"
                disabled={isProcessing || totalEnteringNewQuarter === 0}
                onClick={handleConfirmAndInitialize}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Initializing Quarter {toQuarter} Register...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>CONFIRM & INITIALIZE QUARTER {toQuarter}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
