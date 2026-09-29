import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Award,
  Crown,
  Sparkles,
  TrendingUp,
  Coins,
  Users,
  HeartHandshake,
  BookOpen,
  Printer,
  Medal,
  Flame,
  CheckCircle2,
  Calendar,
  Check,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { getCurrentCalendarWeek } from '../utils/quarterScheduleUtils';
import confetti from 'canvas-confetti';
import {
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  ClassProfile,
  HardWorkStats,
  AbsenceLogRecord,
  QuarterData
} from '../types';
import { calculateMemberStats, generate2DTrendData } from '../utils/calculations';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import {
  computeClassFairnessRankings,
  formatRate,
  MemberFairnessMetrics,
  FAIRNESS_RELIABILITY_K
} from '../utils/fairnessScoring';

interface QuarterAnalysisViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  absenceLogs?: AbsenceLogRecord[];
  classProfile: ClassProfile | null;
  quarterData?: QuarterData | null;
  quarterNumber?: number;
  totalWeeksInQuarter?: number;
  currencySymbol?: string;
  onUpgradeVisitor?: (memberId: string) => void;
  onExemptMember?: (memberId: string, reason?: string) => void;
  onExitMember?: (memberId: string, reason?: string) => void;
  onOpenQuarterTransition?: () => void;
}

type AwardCategory = 
  | 'OVERALL'
  | 'PUNCTUALITY'
  | 'MEMORY_VERSE'
  | 'PARTICIPATION'
  | 'EVANGELISM';

export const QuarterAnalysisView: React.FC<QuarterAnalysisViewProps> = ({
  members,
  grades,
  offerings,
  absenceLogs = [],
  classProfile,
  quarterData,
  quarterNumber = 1,
  totalWeeksInQuarter = 12,
  currencySymbol = '₦',
  onUpgradeVisitor,
  onExemptMember,
  onExitMember,
  onOpenQuarterTransition
}) => {
  const [selectedAwardCategory, setSelectedAwardCategory] = useState<AwardCategory>('OVERALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'STUDENT' | 'VISITOR'>('ALL');
  const [awardEligibilityFilter, setAwardEligibilityFilter] = useState<'ALL' | 'ELIGIBLE' | 'NOT_ELIGIBLE'>('ALL');
  const [sortBy, setSortBy] = useState<'ADJUSTED_RATE' | 'RAW_RATE' | 'ATTENDANCE_RATE' | 'TOTAL_POINTS' | 'NAME'>('ADJUSTED_RATE');
  const [showQuarterReviewModal, setShowQuarterReviewModal] = useState(false);
  const [reviewSuccessFeedback, setReviewSuccessFeedback] = useState<string | null>(null);

  // Lesson 12 completion guard (Phase 21)
  const currentCalendarWeek = useMemo(() => {
    return getCurrentCalendarWeek(quarterData, new Date());
  }, [quarterData]);

  const hasWeek12CompletedRecords = useMemo(() => {
    const hasOffering = offerings.some(o => o.weekNumber === 12 && (o.amount > 0 || o.remittanceStatus === 'REMITTED' || o.remittanceStatus === 'AUDITED'));
    const hasGrades = grades.some(g => g.weekNumber === 12 && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT' || g.lessonTotal > 0));
    return hasOffering || hasGrades;
  }, [offerings, grades]);

  const isLesson12Completed = (currentCalendarWeek > 12) || (currentCalendarWeek >= 12 && hasWeek12CompletedRecords);

  const handleQuarterTransitionClick = () => {
    if (!isLesson12Completed) {
      alert("Quarter transition and quarter-end student review become available after Lesson 12.");
      return;
    }
    if (onOpenQuarterTransition) onOpenQuarterTransition();
  };

  const handleQuarterReviewClick = () => {
    if (!isLesson12Completed) {
      alert("Quarter transition and quarter-end student review become available after Lesson 12.");
      return;
    }
    setShowQuarterReviewModal(true);
  };

  // Trigger celebratory confetti when visiting awards
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.debug('Quarter awards celebration effect was unavailable:', error);
    }
  };

  useEffect(() => {
    triggerCelebration();
  }, [selectedAwardCategory]);

  // Identify no-record weeks for accurate calculation
  const noRecordWeeks = offerings
    .filter(o => o.isNoRecordWeek)
    .map(o => o.weekNumber);

  // Determine current evaluated week to avoid penalizing future lessons in an ongoing quarter
  const currentEvaluatedWeek = useMemo(() => {
    const recordedWeeks = grades
      .filter(g => g.weekNumber && (g.attendance === 'PRESENT' || g.attendance === 'ABSENT' || Number(g.lessonTotal) > 0))
      .map(g => g.weekNumber);
    const maxGradeWeek = recordedWeeks.length > 0 ? Math.max(...recordedWeeks) : 1;
    const maxCalWeek = currentCalendarWeek || 1;
    return Math.max(1, Math.min(totalWeeksInQuarter, Math.max(maxGradeWeek, maxCalWeek)));
  }, [grades, currentCalendarWeek, totalWeeksInQuarter]);

  // Compute fair-play scores and reliability shrinkage using fairnessScoring engine
  const classFairness = useMemo(() => {
    return computeClassFairnessRankings(
      members,
      grades,
      currentEvaluatedWeek,
      noRecordWeeks,
      FAIRNESS_RELIABILITY_K
    );
  }, [members, grades, currentEvaluatedWeek, noRecordWeeks]);

  // Award Contenders for Podium: strictly Award-Eligible members (students) with eligible lessons
  const eligibleContenders = useMemo(() => {
    return classFairness.memberMetrics.filter(m => m.isAwardEligible && m.eligibleLessons > 0);
  }, [classFairness]);

  const sortedPodium = useMemo(() => {
    const list = [...eligibleContenders];
    list.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;
      let aRaw = 0;
      let bRaw = 0;

      switch (selectedAwardCategory) {
        case 'OVERALL':
          aVal = a.overall.adjustedRate;
          bVal = b.overall.adjustedRate;
          aRaw = a.overall.rawRate;
          bRaw = b.overall.rawRate;
          break;
        case 'PUNCTUALITY':
          aVal = a.punctuality.adjustedRate;
          bVal = b.punctuality.adjustedRate;
          aRaw = a.punctuality.rawRate;
          bRaw = b.punctuality.rawRate;
          break;
        case 'MEMORY_VERSE':
          aVal = a.memoryVerse.adjustedRate;
          bVal = b.memoryVerse.adjustedRate;
          aRaw = a.memoryVerse.rawRate;
          bRaw = b.memoryVerse.rawRate;
          break;
        case 'PARTICIPATION':
          aVal = a.participation.adjustedRate;
          bVal = b.participation.adjustedRate;
          aRaw = a.participation.rawRate;
          bRaw = b.participation.rawRate;
          break;
        case 'EVANGELISM': {
          const aMem = members.find(m => m.id === a.memberId);
          const bMem = members.find(m => m.id === b.memberId);
          return (bMem?.evangelismReferralCount || 0) - (aMem?.evangelismReferralCount || 0);
        }
      }

      if (Math.abs(bVal - aVal) > 0.0001) return bVal - aVal;
      if (Math.abs(bRaw - aRaw) > 0.0001) return bRaw - aRaw;
      return b.eligibleLessons - a.eligibleLessons;
    });
    return list;
  }, [eligibleContenders, selectedAwardCategory, members]);

  // Filtered and sorted members for the full Leaderboard table (Students & Visitors)
  const filteredAndSortedMembers = useMemo(() => {
    let list = [...classFairness.memberMetrics];

    // Status filter
    if (statusFilter === 'STUDENT') {
      list = list.filter(m => m.memberType === 'STUDENT');
    } else if (statusFilter === 'VISITOR') {
      list = list.filter(m => m.memberType === 'VISITOR');
    }

    // Award eligibility filter
    if (awardEligibilityFilter === 'ELIGIBLE') {
      list = list.filter(m => m.isAwardEligible);
    } else if (awardEligibilityFilter === 'NOT_ELIGIBLE') {
      list = list.filter(m => !m.isAwardEligible);
    }

    // Sort order
    list.sort((a, b) => {
      if (sortBy === 'NAME') {
        return a.fullName.localeCompare(b.fullName);
      }
      if (sortBy === 'ATTENDANCE_RATE') {
        return b.attendanceRate - a.attendanceRate;
      }
      if (sortBy === 'TOTAL_POINTS') {
        return b.totalPointsEarned - a.totalPointsEarned;
      }
      if (sortBy === 'RAW_RATE') {
        let aRaw = a.overall.rawRate;
        let bRaw = b.overall.rawRate;
        if (selectedAwardCategory === 'PUNCTUALITY') { aRaw = a.punctuality.rawRate; bRaw = b.punctuality.rawRate; }
        else if (selectedAwardCategory === 'MEMORY_VERSE') { aRaw = a.memoryVerse.rawRate; bRaw = b.memoryVerse.rawRate; }
        else if (selectedAwardCategory === 'PARTICIPATION') { aRaw = a.participation.rawRate; bRaw = b.participation.rawRate; }
        else if (selectedAwardCategory === 'EVANGELISM') {
          const aMem = members.find(m => m.id === a.memberId);
          const bMem = members.find(m => m.id === b.memberId);
          return (bMem?.evangelismReferralCount || 0) - (aMem?.evangelismReferralCount || 0);
        }
        return bRaw - aRaw;
      }

      // Default: ADJUSTED_RATE
      let aAdj = a.overall.adjustedRate;
      let bAdj = b.overall.adjustedRate;
      let aRaw = a.overall.rawRate;
      let bRaw = b.overall.rawRate;
      if (selectedAwardCategory === 'PUNCTUALITY') {
        aAdj = a.punctuality.adjustedRate; bAdj = b.punctuality.adjustedRate;
        aRaw = a.punctuality.rawRate; bRaw = b.punctuality.rawRate;
      } else if (selectedAwardCategory === 'MEMORY_VERSE') {
        aAdj = a.memoryVerse.adjustedRate; bAdj = b.memoryVerse.adjustedRate;
        aRaw = a.memoryVerse.rawRate; bRaw = b.memoryVerse.rawRate;
      } else if (selectedAwardCategory === 'PARTICIPATION') {
        aAdj = a.participation.adjustedRate; bAdj = b.participation.adjustedRate;
        aRaw = a.participation.rawRate; bRaw = b.participation.rawRate;
      } else if (selectedAwardCategory === 'EVANGELISM') {
        const aMem = members.find(m => m.id === a.memberId);
        const bMem = members.find(m => m.id === b.memberId);
        return (bMem?.evangelismReferralCount || 0) - (aMem?.evangelismReferralCount || 0);
      }

      if (Math.abs(bAdj - aAdj) > 0.0001) return bAdj - aAdj;
      if (Math.abs(bRaw - aRaw) > 0.0001) return bRaw - aRaw;
      return b.eligibleLessons - a.eligibleLessons;
    });

    return list;
  }, [classFairness.memberMetrics, statusFilter, awardEligibilityFilter, sortBy, selectedAwardCategory, members]);

  // Member statistics calculated for the legacy report card / printable form
  const allMemberStatsList: HardWorkStats[] = members.map(m =>
    calculateMemberStats(m, grades, currentEvaluatedWeek, noRecordWeeks)
  );

  // 2D Trend Data (+Y Students, -Y Visitors, X Weeks 1 to totalWeeksInQuarter)
  const trendData = generate2DTrendData(members, grades, totalWeeksInQuarter);
  const maxAxisVal = Math.max(1, ...trendData.map(d => Math.max(d.students, d.visitors)));

  // Aggregate Metrics
  const totalQuarterAttendance = trendData.reduce((acc, curr) => acc + curr.total, 0);
  const totalStudentsCount = members.filter(m => m.memberType === 'STUDENT').length;
  const totalVisitorsCount = members.filter(m => m.memberType === 'VISITOR').length;
  const totalConvertedVisitors = members.filter(m => m.convertedFromVisitorAtLesson).length;
  const cumulativeOffering = offerings
    .filter(o => !o.isNoRecordWeek)
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Visitors who qualify for upgrade (attended 3 consecutive or 50%+)
  const qualifyingVisitors = members.filter(m => {
    if (m.memberType !== 'VISITOR' || m.status !== 'ACTIVE') return false;
    const presentGrades = grades.filter(g => g.memberId === m.id && g.attendance === 'PRESENT' && !g.isNoRecordWeek);
    const validWeeksCount = Math.max(1, totalWeeksInQuarter - noRecordWeeks.length);
    const attendancePct = (presentGrades.length / validWeeksCount) * 100;
    return presentGrades.length >= 3 && attendancePct >= 50;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in print:bg-white print:text-black">
      
      {/* Top Header & Actions */}
      <section aria-labelledby="quarter-analysis-heading" className="bg-gradient-to-br from-[#071b3d] via-[#18366f] to-[#3a1d58] border border-blue-700/50 rounded-2xl p-4 sm:p-6 shadow-xl shadow-blue-950/10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-950 bg-amber-400 px-2.5 py-1 rounded-lg">
              Quarter {quarterNumber}
            </span>
            {quarterData?.quarterTheme && (
              <span className="text-[10px] font-bold text-blue-100/80 bg-white/10 border border-white/15 px-2 py-1 rounded-lg truncate max-w-[220px]">
                {quarterData.quarterTheme}
              </span>
            )}
          </div>
          <h2 id="quarter-analysis-heading" className="text-xl sm:text-3xl font-black text-white mt-2 tracking-tight">
            Quarter analysis
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/80 mt-1 max-w-2xl">
            Attendance, offering, class growth and student recognition in one view.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          {onOpenQuarterTransition && (
            <button
              id="btn-quarter-transition-in-analysis"
              onClick={handleQuarterTransitionClick}
              disabled={!isLesson12Completed}
              className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${
                isLesson12Completed
                  ? 'bg-teal-700 hover:bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed border border-slate-300'
              }`}
              title={isLesson12Completed ? "Forward active students and eligible visitors to the next Quarter" : "Quarter transition and quarter-end student review become available after Lesson 12."}
            >
              {!isLesson12Completed ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span>Next quarter</span>
            </button>
          )}

          <button
            id="btn-quarter-review"
            onClick={handleQuarterReviewClick}
            disabled={!isLesson12Completed}
            className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs ${
              isLesson12Completed
                ? 'bg-amber-500 hover:bg-amber-400 text-blue-950 cursor-pointer'
                : 'bg-white/10 text-blue-200/50 opacity-60 cursor-not-allowed border border-white/15'
            }`}
            title={isLesson12Completed ? "Review qualifying visitors" : "Quarter transition and quarter-end student review become available after Lesson 12."}
          >
            {!isLesson12Completed ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Sparkles className="w-4 h-4 text-blue-950" />}
            <span>Review ({qualifyingVisitors.length})</span>
          </button>

          <button
            id="btn-print-official-return"
            onClick={handlePrint}
            className="col-span-2 sm:col-span-1 min-h-[44px] px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Print return</span>
          </button>
        </div>
      </section>

      {!isLesson12Completed && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-2 print:hidden">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Quarter transition and quarter-end student review become available after Lesson 12.</span>
        </div>
      )}

      {reviewSuccessFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{reviewSuccessFeedback}</span>
        </div>
      )}

      {/* Aggregate Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 print:hidden">
        
        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quarter Attendance</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{totalQuarterAttendance}</span>
            <span className="text-xs text-slate-500">marks</span>
          </div>
          <p className="text-[11px] text-blue-700 font-semibold mt-1">
            {totalWeeksInQuarter} Lessons Total
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cumulative Offering</span>
            <span className="text-emerald-700 font-black text-base">{currencySymbol}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">
              {currencySymbol}{cumulativeOffering.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">
            From {offerings.filter(o => !o.isNoRecordWeek).length} recorded weeks
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Enrollment</span>
            <HeartHandshake className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{totalStudentsCount}</span>
            <span className="text-xs text-slate-500">Students / {totalVisitorsCount} Visitors</span>
          </div>
          <p className="text-[11px] text-purple-700 font-semibold mt-1">
            {totalConvertedVisitors} converted this year
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quarter Diligence</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-800">
              {sortedPodium[0] ? `${sortedPodium[0].overall.adjustedRate}%` : '0%'}
            </span>
            <span className="text-xs text-slate-500">Fair Rate</span>
          </div>
          <p className="text-[11px] text-amber-900 font-semibold mt-1 truncate">
            Leader: {sortedPodium[0]?.fullName || 'None'}
            {sortedPodium[0] && (
              <span className="text-slate-500 font-normal ml-1">
                ({sortedPodium[0].overall.rawRate}% raw)
              </span>
            )}
          </p>
        </div>

      </div>

      {/* 2D Trend Visualization (+Y Students, -Y Visitors, X Weeks 1 to totalWeeks) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm print:hidden overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                2D Dynamic Roster Shift Trend (Weeks 1 to {totalWeeksInQuarter})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Top bars (+Y) represent verified registered Students. Bottom bars (-Y) represent guest Visitors.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-blue-900 rounded-xs"></span>
              <span className="text-slate-700">Students (+Y)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-purple-500 rounded-xs"></span>
              <span className="text-slate-700">Visitors (-Y)</span>
            </div>
          </div>
        </div>

        {/* 2D Bar Chart Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-13 gap-1 pt-4 pb-2 border-b border-t border-slate-200 min-w-0">
          {trendData.map((d) => {
            const studentHeightPct = Math.round((d.students / maxAxisVal) * 100);
            const visitorHeightPct = Math.round((d.visitors / maxAxisVal) * 100);
            const isNoRecord = noRecordWeeks.includes(d.week);

            return (
              <div key={d.week} className="flex flex-col items-center justify-center gap-1 group relative">
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none z-20 whitespace-nowrap shadow-lg">
                  Wk {d.week}: {isNoRecord ? 'NO RECORD' : `${d.students} Students, ${d.visitors} Visitors`}
                </div>

                {/* +Y Bar: Students */}
                <div className="w-full h-24 flex items-end justify-center bg-slate-50 rounded-t-xs p-0.5">
                  {isNoRecord ? (
                    <span className="text-[9px] font-bold text-slate-400 rotate-90 mb-4">NO REC</span>
                  ) : (
                    <div
                      style={{ height: `${Math.max(4, studentHeightPct)}%` }}
                      className="w-full bg-blue-900 hover:bg-blue-800 rounded-t-xs transition-all duration-300 flex items-center justify-center"
                    >
                      {d.students > 0 && (
                        <span className="text-[9px] font-bold text-white hidden group-hover:inline">
                          {d.students}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Zero Axis Separator */}
                <div className="w-full border-t-2 border-slate-400 text-center py-0.5">
                  <span className="text-[10px] font-black text-slate-700">W{d.week}</span>
                </div>

                {/* -Y Bar: Visitors */}
                <div className="w-full h-16 flex items-start justify-center bg-slate-50 rounded-b-xs p-0.5">
                  {!isNoRecord && (
                    <div
                      style={{ height: `${Math.max(4, visitorHeightPct)}%` }}
                      className="w-full bg-purple-500 hover:bg-purple-600 rounded-b-xs transition-all duration-300 flex items-center justify-center"
                    >
                      {d.visitors > 0 && (
                        <span className="text-[9px] font-bold text-white hidden group-hover:inline">
                          {d.visitors}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Award Leaderboards Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                Quarter {quarterNumber} Awards & Recognition Champions
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fair Play empirical Bayes rankings across active lessons (Weeks 1 to {currentEvaluatedWeek}). Excludes unrecorded weeks.
            </p>
          </div>

          {/* Award Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setSelectedAwardCategory('OVERALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'OVERALL' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              👑 Diligence (Overall)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('PUNCTUALITY')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'PUNCTUALITY' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              ⏰ Punctuality (15)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('MEMORY_VERSE')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'MEMORY_VERSE' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              📖 Verse Recitation (15)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('PARTICIPATION')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'PARTICIPATION' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              💡 Participation (20)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('EVANGELISM')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'EVANGELISM' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              🤝 Soul Winning
            </button>
          </div>
        </div>

        {/* Fair Play Scoring Explanation Banner */}
        <div className="mb-5 p-3 sm:p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <span className="font-bold">Fair Play Scoring Active (Empirical Bayes Shrinkage, k=6): </span>
            Evaluated on completed lessons ({currentEvaluatedWeek} of {totalWeeksInQuarter}) so students are not penalized for future dates.
            Podium champions are exclusively award-eligible registered students with at least 1 evaluated lesson. Visitors receive honest ratings and can be reviewed without zeroing out their scores.
          </div>
        </div>

        {/* Filter & Sort Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          {/* Member Status Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Roster:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All ({classFairness.memberMetrics.length})
            </button>
            <button
              onClick={() => setStatusFilter('STUDENT')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                statusFilter === 'STUDENT' ? 'bg-blue-700 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Students ({classFairness.memberMetrics.filter(m => m.memberType === 'STUDENT').length})
            </button>
            <button
              onClick={() => setStatusFilter('VISITOR')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                statusFilter === 'VISITOR' ? 'bg-purple-700 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Visitors ({classFairness.memberMetrics.filter(m => m.memberType === 'VISITOR').length})
            </button>
          </div>

          {/* Award Eligibility Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Awards:</span>
            <button
              onClick={() => setAwardEligibilityFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                awardEligibilityFilter === 'ALL' ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAwardEligibilityFilter('ELIGIBLE')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                awardEligibilityFilter === 'ELIGIBLE' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Eligible ({classFairness.memberMetrics.filter(m => m.isAwardEligible).length})
            </button>
            <button
              onClick={() => setAwardEligibilityFilter('NOT_ELIGIBLE')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                awardEligibilityFilter === 'NOT_ELIGIBLE' ? 'bg-slate-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Visitors & Ineligible ({classFairness.memberMetrics.filter(m => !m.isAwardEligible).length})
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs focus:ring-1 focus:ring-blue-500"
            >
              <option value="ADJUSTED_RATE">Fair / Adjusted Rate</option>
              <option value="RAW_RATE">Raw Rate</option>
              <option value="ATTENDANCE_RATE">Attendance Rate</option>
              <option value="TOTAL_POINTS">Total Points</option>
              <option value="NAME">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Podium Champions Display (Top 3 Award-Eligible Students) */}
        {sortedPodium.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
            {/* 2nd Silver */}
            {sortedPodium.length >= 2 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center relative order-2 md:order-1 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center mx-auto mb-2">
                  2nd
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{sortedPodium[1].fullName}</h4>
                <div className="mt-1.5">
                  {selectedAwardCategory === 'OVERALL' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[1].overall.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[1].overall.rawRate}% Raw ({sortedPodium[1].totalPointsEarned}/{sortedPodium[1].maxAvailablePoints} pts)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'PUNCTUALITY' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[1].punctuality.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[1].punctuality.rawRate}% Raw ({sortedPodium[1].punctuality.scoreObtained}/{sortedPodium[1].punctuality.maxObtainable} marks)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'MEMORY_VERSE' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[1].memoryVerse.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[1].memoryVerse.rawRate}% Raw ({sortedPodium[1].memoryVerse.scoreObtained}/{sortedPodium[1].memoryVerse.maxObtainable} marks)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'PARTICIPATION' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[1].participation.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[1].participation.rawRate}% Raw ({sortedPodium[1].participation.scoreObtained}/{sortedPodium[1].participation.maxObtainable} marks)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'EVANGELISM' && (
                    <div className="text-base font-black text-purple-700">
                      {members.find(m => m.id === sortedPodium[1].memberId)?.evangelismReferralCount || 0} souls invited
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {sortedPodium[1].attendedWeeks}/{sortedPodium[1].eligibleLessons} attended • {sortedPodium[1].eligibleLessons} eligible (joined W{sortedPodium[1].joinLesson})
                </p>
              </div>
            )}

            {/* 1st Gold Champion */}
            <div className="bg-amber-50/80 p-5 rounded-xl border-2 border-amber-400 shadow-md text-center relative order-1 md:order-2 transform md:scale-105">
              <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center mx-auto mb-2 shadow-xs">
                👑
              </div>
              <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                1st Place Champion
              </span>
              <h4 className="font-black text-slate-950 text-base mt-0.5">{sortedPodium[0].fullName}</h4>
              <div className="mt-1.5">
                {selectedAwardCategory === 'OVERALL' && (
                  <>
                    <div className="text-lg font-black text-amber-950">
                      {sortedPodium[0].overall.adjustedRate}% <span className="text-xs font-bold text-amber-700">Fair Rate</span>
                    </div>
                    <div className="text-xs text-amber-900/80 font-semibold">
                      {sortedPodium[0].overall.rawRate}% Raw ({sortedPodium[0].totalPointsEarned}/{sortedPodium[0].maxAvailablePoints} pts)
                    </div>
                  </>
                )}
                {selectedAwardCategory === 'PUNCTUALITY' && (
                  <>
                    <div className="text-lg font-black text-amber-950">
                      {sortedPodium[0].punctuality.adjustedRate}% <span className="text-xs font-bold text-amber-700">Fair Rate</span>
                    </div>
                    <div className="text-xs text-amber-900/80 font-semibold">
                      {sortedPodium[0].punctuality.rawRate}% Raw ({sortedPodium[0].punctuality.scoreObtained}/{sortedPodium[0].punctuality.maxObtainable} marks)
                    </div>
                  </>
                )}
                {selectedAwardCategory === 'MEMORY_VERSE' && (
                  <>
                    <div className="text-lg font-black text-amber-950">
                      {sortedPodium[0].memoryVerse.adjustedRate}% <span className="text-xs font-bold text-amber-700">Fair Rate</span>
                    </div>
                    <div className="text-xs text-amber-900/80 font-semibold">
                      {sortedPodium[0].memoryVerse.rawRate}% Raw ({sortedPodium[0].memoryVerse.scoreObtained}/{sortedPodium[0].memoryVerse.maxObtainable} marks)
                    </div>
                  </>
                )}
                {selectedAwardCategory === 'PARTICIPATION' && (
                  <>
                    <div className="text-lg font-black text-amber-950">
                      {sortedPodium[0].participation.adjustedRate}% <span className="text-xs font-bold text-amber-700">Fair Rate</span>
                    </div>
                    <div className="text-xs text-amber-900/80 font-semibold">
                      {sortedPodium[0].participation.rawRate}% Raw ({sortedPodium[0].participation.scoreObtained}/{sortedPodium[0].participation.maxObtainable} marks)
                    </div>
                  </>
                )}
                {selectedAwardCategory === 'EVANGELISM' && (
                  <div className="text-lg font-black text-purple-800">
                    {members.find(m => m.id === sortedPodium[0].memberId)?.evangelismReferralCount || 0} souls invited
                  </div>
                )}
              </div>
              <p className="text-[11px] text-amber-900/80 font-semibold mt-1">
                {sortedPodium[0].attendedWeeks}/{sortedPodium[0].eligibleLessons} attended • {sortedPodium[0].eligibleLessons} eligible (joined W{sortedPodium[0].joinLesson})
              </p>
            </div>

            {/* 3rd Bronze */}
            {sortedPodium.length >= 3 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center relative order-3 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center mx-auto mb-2">
                  3rd
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{sortedPodium[2].fullName}</h4>
                <div className="mt-1.5">
                  {selectedAwardCategory === 'OVERALL' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[2].overall.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[2].overall.rawRate}% Raw ({sortedPodium[2].totalPointsEarned}/{sortedPodium[2].maxAvailablePoints} pts)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'PUNCTUALITY' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[2].punctuality.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[2].punctuality.rawRate}% Raw ({sortedPodium[2].punctuality.scoreObtained}/{sortedPodium[2].punctuality.maxObtainable} marks)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'MEMORY_VERSE' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[2].memoryVerse.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[2].memoryVerse.rawRate}% Raw ({sortedPodium[2].memoryVerse.scoreObtained}/{sortedPodium[2].memoryVerse.maxObtainable} marks)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'PARTICIPATION' && (
                    <>
                      <div className="text-base font-black text-slate-900">
                        {sortedPodium[2].participation.adjustedRate}% <span className="text-[11px] font-semibold text-slate-500">Fair</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {sortedPodium[2].participation.rawRate}% Raw ({sortedPodium[2].participation.scoreObtained}/{sortedPodium[2].participation.maxObtainable} marks)
                      </div>
                    </>
                  )}
                  {selectedAwardCategory === 'EVANGELISM' && (
                    <div className="text-base font-black text-purple-700">
                      {members.find(m => m.id === sortedPodium[2].memberId)?.evangelismReferralCount || 0} souls invited
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {sortedPodium[2].attendedWeeks}/{sortedPodium[2].eligibleLessons} attended • {sortedPodium[2].eligibleLessons} eligible (joined W{sortedPodium[2].joinLesson})
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 mb-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            No award-eligible students found for the current evaluation criteria.
          </div>
        )}

        {/* Leaderboard Table (Fair Play Breakdown) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Rank</th>
                <th className="py-3 px-3">Student / Visitor</th>
                <th className="py-3 px-3">Award Status</th>
                <th className="py-3 px-3">Attended</th>
                <th className="py-3 px-3">Punctuality (15/ea)</th>
                <th className="py-3 px-3">Verse (15/ea)</th>
                <th className="py-3 px-3">Participation (20/ea)</th>
                <th className="py-3 px-3 text-amber-900 font-black">Diligence Rate</th>
                <th className="py-3 px-3">Soul Winning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSortedMembers.map((item, idx) => {
                const podiumRank = sortedPodium.findIndex(p => p.memberId === item.memberId);
                const rankDisplay = podiumRank === 0 ? '🥇 1' : podiumRank === 1 ? '🥈 2' : podiumRank === 2 ? '🥉 3' : `${idx + 1}`;

                return (
                  <tr key={item.memberId} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-700">
                      {rankDisplay}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{item.fullName}</span>
                        {item.memberType === 'VISITOR' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700">
                            VISITOR
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-700">
                            STUDENT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-normal text-slate-400">
                        Joined Week {item.joinLesson}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {item.isAwardEligible ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200" title="Visitors & members with < 1 lesson are not eligible for podium championship awards.">
                          Ineligible ({item.memberType === 'VISITOR' ? 'Visitor' : 'Low Att.'})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-700 font-bold">{item.attendedWeeks}</span> / {item.eligibleLessons}
                      <div className="text-[10px] text-slate-500">{item.attendanceRate}%</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">
                        {item.punctuality.adjustedRate}% <span className="text-[9px] font-semibold text-slate-500">fair</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.punctuality.scoreObtained} / {item.punctuality.maxObtainable} ({item.punctuality.rawRate}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-amber-800">
                        {item.memoryVerse.adjustedRate}% <span className="text-[9px] font-semibold text-slate-500">fair</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.memoryVerse.scoreObtained} / {item.memoryVerse.maxObtainable} ({item.memoryVerse.rawRate}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-indigo-800">
                        {item.participation.adjustedRate}% <span className="text-[9px] font-semibold text-slate-500">fair</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.participation.scoreObtained} / {item.participation.maxObtainable} ({item.participation.rawRate}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-extrabold text-amber-950 text-sm">
                        {item.overall.adjustedRate}% <span className="text-[10px] font-bold text-amber-700">Fair</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {item.totalPointsEarned} / {item.maxAvailablePoints} pts ({item.overall.rawRate}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-purple-700">
                      {members.find(m => m.id === item.memberId)?.evangelismReferralCount || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Official Printable Quarter Return Form */}
      <div className="bg-white border border-slate-300 rounded-lg p-8 shadow-xs print:p-0 print:border-none print:shadow-none">
        <div className="text-center pb-6 border-b-2 border-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600 font-['Cinzel',serif]">
            THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR) (GOFAMINT_HOF)
          </p>
          <h2 className="text-xl sm:text-2xl font-black uppercase text-slate-900 mt-1 font-['Cinzel',serif]">
            OFFICIAL SUNDAY SCHOOL QUARTER RETURN FORM
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-700 mt-2">
            <span>Quarter: <strong>Q{quarterNumber}</strong></span>
            <span>•</span>
            <span>Department: <strong>{classProfile?.department || 'General'}</strong></span>
            <span>•</span>
            <span>Class: <strong>{classProfile?.className || 'Main Register'}</strong></span>
            <span>•</span>
            <span>Teacher: <strong>{classProfile?.teacherName || 'Assigned Teacher'}</strong></span>
            <span>•</span>
            <span>Secretary: <strong>{classProfile?.secretaryName || 'Class Secretary'}</strong></span>
          </div>
        </div>

        {/* Statistical Table Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-slate-300 text-center">
          <div className="border border-slate-200 p-3 rounded bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Registered Students</span>
            <span className="text-lg font-black text-slate-900">{totalStudentsCount}</span>
          </div>
          <div className="border border-slate-200 p-3 rounded bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Quarter Marks</span>
            <span className="text-lg font-black text-slate-900">{totalQuarterAttendance}</span>
          </div>
          <div className="border border-slate-200 p-3 rounded bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Average Attendance</span>
            <span className="text-lg font-black text-slate-900">
              {Math.round(totalQuarterAttendance / Math.max(1, totalWeeksInQuarter))} / wk
            </span>
          </div>
          <div className="border border-slate-200 p-3 rounded bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Cumulative Offering</span>
            <span className="text-lg font-black text-emerald-800">
              {currencySymbol}{cumulativeOffering.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Weekly Breakdown Summary Table */}
        <div className="py-6 border-b border-slate-300">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3">
            Weekly Return Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold text-slate-700 text-[10px] uppercase">
                <tr>
                  <th className="p-2 border">Wk</th>
                  <th className="p-2 border">Students</th>
                  <th className="p-2 border">Visitors</th>
                  <th className="p-2 border">Total Present</th>
                  <th className="p-2 border">Absent</th>
                  <th className="p-2 border">Offering Amount</th>
                  <th className="p-2 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map(d => {
                  const off = offerings.find(o => o.weekNumber === d.week);
                  const isNoRec = noRecordWeeks.includes(d.week);
                  const absent = grades.filter(g => g.weekNumber === d.week && !g.isNoRecordWeek && g.attendance === 'ABSENT').length;
                  return (
                    <tr key={d.week} className="border-b">
                      <td className="p-2 border font-bold">Week {d.week}</td>
                      <td className="p-2 border">{isNoRec ? '-' : d.students}</td>
                      <td className="p-2 border">{isNoRec ? '-' : d.visitors}</td>
                      <td className="p-2 border font-bold">{isNoRec ? '-' : d.total}</td>
                      <td className="p-2 border font-bold text-red-700">{isNoRec ? '-' : absent}</td>
                      <td className="p-2 border font-mono">
                        {isNoRec ? '-' : `${currencySymbol}${(off?.amount || 0).toLocaleString()}`}
                      </td>
                      <td className="p-2 border text-[10px] font-bold">
                        {isNoRec ? (
                          <span className="text-amber-700">NO RECORD</span>
                        ) : (
                          <span className="text-emerald-700">RECORDED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures & Certification */}
        <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs">
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-800">Sunday School Teacher</p>
            <p className="text-[10px] text-slate-500 uppercase">Sunday School Teacher</p>
          </div>
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-800">Class Secretary</p>
            <p className="text-[10px] text-slate-500 uppercase">Class Secretary</p>
          </div>
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-800">Directorate Officer</p>
            <p className="text-[10px] text-slate-500 uppercase">General Superintendent / Secretary</p>
          </div>
        </div>

      </div>

      {/* Quarter-End Progression / Student Review Modal */}
      {showQuarterReviewModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Quarter {quarterNumber} End Student Review & Progression
                </h3>
                <p className="text-xs text-slate-500">
                  Audit and promote qualifying visitors, confirm active students, and review member movements.
                </p>
              </div>
              <button
                onClick={() => setShowQuarterReviewModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-4 flex-1">
              
              {/* Qualifying Visitors for Promotion */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Visitors Qualifying for Upgrade ({qualifyingVisitors.length})
                  </h4>
                </div>

                {qualifyingVisitors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded">
                    No visitors meet the 50%+ attendance or 3-consecutive visits upgrade criteria in Quarter {quarterNumber}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {qualifyingVisitors.map(v => (
                      <div key={v.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs text-slate-900">{v.fullName}</p>
                          <p className="text-[11px] text-purple-700">
                            Attended {grades.filter(g => g.memberId === v.id && g.attendance === 'PRESENT' && !g.isNoRecordWeek).length} weeks (50%+ Quarter Attendance Achieved)
                          </p>
                        </div>
                        {onUpgradeVisitor && (
                          <button
                            onClick={() => {
                              onUpgradeVisitor(v.id);
                              setReviewSuccessFeedback(`Promoted ${v.fullName} to Student.`);
                              setTimeout(() => setReviewSuccessFeedback(null), 3000);
                            }}
                            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs transition"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>Promote to Student</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Roster Retention Summary */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">
                  Roster Continuation into Next Quarter
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All active students and visitors will seamlessly continue into the next Quarter while preserving historical attendance, awards, and follow-up records. Identity is preserved permanently without creating duplicate entries.
                </p>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowQuarterReviewModal(false)}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold"
              >
                Close Review
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
