import React, { useState, useEffect } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
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
  const [showQuarterReviewModal, setShowQuarterReviewModal] = useState(false);
  const [reviewSuccessFeedback, setReviewSuccessFeedback] = useState<string | null>(null);

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

  // Member statistics calculated using the report-card formula
  const allMemberStatsList: HardWorkStats[] = members.map(m =>
    calculateMemberStats(m, grades, totalWeeksInQuarter, noRecordWeeks)
  );

  // Leaderboard for Awards: STRICTLY STUDENTS ONLY (Visitors are excluded from award competitions)
  const studentLeaderboardList = allMemberStatsList.filter(s => s.memberType === 'STUDENT');

  // Leaderboard Sorting based on selected category percentage
  const sortedLeaderboard = [...studentLeaderboardList].sort((a, b) => {
    switch (selectedAwardCategory) {
      case 'OVERALL':
        if (b.hardWorkRate !== a.hardWorkRate) return b.hardWorkRate - a.hardWorkRate;
        return b.totalPointsEarned - a.totalPointsEarned;
      case 'PUNCTUALITY':
        if (b.punctualityPercentage !== a.punctualityPercentage) return b.punctualityPercentage - a.punctualityPercentage;
        return b.punctualityScoreObtained - a.punctualityScoreObtained;
      case 'MEMORY_VERSE':
        if (b.memoryVersePercentage !== a.memoryVersePercentage) return b.memoryVersePercentage - a.memoryVersePercentage;
        return b.memoryVerseScoreObtained - a.memoryVerseScoreObtained;
      case 'PARTICIPATION':
        if (b.participationPercentage !== a.participationPercentage) return b.participationPercentage - a.participationPercentage;
        return b.participationScoreObtained - a.participationScoreObtained;
      case 'EVANGELISM':
        return b.totalReferrals - a.totalReferrals;
      default:
        return b.hardWorkRate - a.hardWorkRate;
    }
  });

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
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black">
      
      {/* Top Header & Actions */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              QUARTER {quarterNumber} COMPREHENSIVE CLOSEOUT
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {quarterData?.quarterTheme || 'GOFAMINT_HOF Directorate Theme'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1 font-['Cinzel',serif] tracking-wide">
            Quarter {quarterNumber} Report & Analytical Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            2D Roster Shift Trend, 5 Award Leaderboard Champions, Financial Return (₦), and Quarter-End Progression.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenQuarterTransition && (
            <button
              id="btn-quarter-transition-in-analysis"
              onClick={onOpenQuarterTransition}
              className="px-3.5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Forward active students and eligible visitors to the next Quarter"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Quarter Transition</span>
            </button>
          )}

          <button
            id="btn-quarter-review"
            onClick={() => setShowQuarterReviewModal(true)}
            className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-blue-950 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-950" />
            <span>Quarter-End Student Review ({qualifyingVisitors.length} Qualify)</span>
          </button>

          <button
            id="btn-print-official-return"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Print Official Return</span>
          </button>
        </div>
      </div>

      {reviewSuccessFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{reviewSuccessFeedback}</span>
        </div>
      )}

      {/* Aggregate Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
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

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
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

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
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

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quarter Diligence</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-800">
              {sortedLeaderboard[0]?.hardWorkRate || 0}%
            </span>
            <span className="text-xs text-slate-500">Top Rate</span>
          </div>
          <p className="text-[11px] text-amber-900 font-semibold mt-1 truncate">
            Leader: {sortedLeaderboard[0]?.fullName || 'None'}
          </p>
        </div>

      </div>

      {/* 2D Trend Visualization (+Y Students, -Y Visitors, X Weeks 1 to totalWeeks) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs print:hidden">
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
        <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-13 gap-1 pt-4 pb-2 border-b border-t border-slate-200">
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
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                Quarter {quarterNumber} Awards & Recognition Champions
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Top performers calculated fairly with non-recorded weeks excluded from denominators.
            </p>
          </div>

          {/* Award Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setSelectedAwardCategory('OVERALL')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'OVERALL' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              👑 Diligence (Overall)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('PUNCTUALITY')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'PUNCTUALITY' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              ⏰ Punctuality (15)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('MEMORY_VERSE')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'MEMORY_VERSE' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              📖 Verse Recitation (15)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('PARTICIPATION')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'PARTICIPATION' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              💡 Participation (20)
            </button>
            <button
              onClick={() => setSelectedAwardCategory('EVANGELISM')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedAwardCategory === 'EVANGELISM' ? 'bg-amber-500 text-blue-950 shadow-xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              🤝 Soul Winning
            </button>
          </div>
        </div>

        {/* Podium Champions Display (Top 3) */}
        {sortedLeaderboard.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
            {/* 2nd Silver */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center relative order-2 md:order-1 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center mx-auto mb-2">
                2nd
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{sortedLeaderboard[1].fullName}</h4>
              <div className="text-xs text-slate-700 mt-1 font-bold">
                {selectedAwardCategory === 'OVERALL' && `${sortedLeaderboard[1].hardWorkRate}% (${sortedLeaderboard[1].totalPointsEarned}/${sortedLeaderboard[1].totalPossiblePointsSinceFirst} pts)`}
                {selectedAwardCategory === 'PUNCTUALITY' && `${sortedLeaderboard[1].punctualityPercentage}% (${sortedLeaderboard[1].punctualityScoreObtained}/${sortedLeaderboard[1].punctualityMaxObtainable} marks)`}
                {selectedAwardCategory === 'MEMORY_VERSE' && `${sortedLeaderboard[1].memoryVersePercentage}% (${sortedLeaderboard[1].memoryVerseScoreObtained}/${sortedLeaderboard[1].memoryVerseMaxObtainable} marks)`}
                {selectedAwardCategory === 'PARTICIPATION' && `${sortedLeaderboard[1].participationPercentage}% (${sortedLeaderboard[1].participationScoreObtained}/${sortedLeaderboard[1].participationMaxObtainable} marks)`}
                {selectedAwardCategory === 'EVANGELISM' && `${sortedLeaderboard[1].totalReferrals} visitors invited`}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {sortedLeaderboard[1].eligibleLessonsCount} eligible lessons (joined W{sortedLeaderboard[1].firstLessonWeek})
              </p>
            </div>

            {/* 1st Gold */}
            <div className="bg-amber-50/70 p-5 rounded-lg border-2 border-amber-400 shadow-sm text-center relative order-1 md:order-2 transform md:scale-105">
              <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center mx-auto mb-2 shadow-xs">
                👑
              </div>
              <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                1st Place Champion
              </span>
              <h4 className="font-black text-slate-950 text-base mt-0.5">{sortedLeaderboard[0].fullName}</h4>
              <div className="text-sm font-extrabold text-amber-950 mt-1">
                {selectedAwardCategory === 'OVERALL' && `${sortedLeaderboard[0].hardWorkRate}% (${sortedLeaderboard[0].totalPointsEarned}/${sortedLeaderboard[0].totalPossiblePointsSinceFirst} pts)`}
                {selectedAwardCategory === 'PUNCTUALITY' && `${sortedLeaderboard[0].punctualityPercentage}% (${sortedLeaderboard[0].punctualityScoreObtained}/${sortedLeaderboard[0].punctualityMaxObtainable} marks)`}
                {selectedAwardCategory === 'MEMORY_VERSE' && `${sortedLeaderboard[0].memoryVersePercentage}% (${sortedLeaderboard[0].memoryVerseScoreObtained}/${sortedLeaderboard[0].memoryVerseMaxObtainable} marks)`}
                {selectedAwardCategory === 'PARTICIPATION' && `${sortedLeaderboard[0].participationPercentage}% (${sortedLeaderboard[0].participationScoreObtained}/${sortedLeaderboard[0].participationMaxObtainable} marks)`}
                {selectedAwardCategory === 'EVANGELISM' && `${sortedLeaderboard[0].totalReferrals} visitors invited`}
              </div>
              <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                {sortedLeaderboard[0].eligibleLessonsCount} eligible lessons (joined W{sortedLeaderboard[0].firstLessonWeek})
              </p>
            </div>

            {/* 3rd Bronze */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center relative order-3 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center mx-auto mb-2">
                3rd
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{sortedLeaderboard[2].fullName}</h4>
              <div className="text-xs text-slate-700 mt-1 font-bold">
                {selectedAwardCategory === 'OVERALL' && `${sortedLeaderboard[2].hardWorkRate}% (${sortedLeaderboard[2].totalPointsEarned}/${sortedLeaderboard[2].totalPossiblePointsSinceFirst} pts)`}
                {selectedAwardCategory === 'PUNCTUALITY' && `${sortedLeaderboard[2].punctualityPercentage}% (${sortedLeaderboard[2].punctualityScoreObtained}/${sortedLeaderboard[2].punctualityMaxObtainable} marks)`}
                {selectedAwardCategory === 'MEMORY_VERSE' && `${sortedLeaderboard[2].memoryVersePercentage}% (${sortedLeaderboard[2].memoryVerseScoreObtained}/${sortedLeaderboard[2].memoryVerseMaxObtainable} marks)`}
                {selectedAwardCategory === 'PARTICIPATION' && `${sortedLeaderboard[2].participationPercentage}% (${sortedLeaderboard[2].participationScoreObtained}/${sortedLeaderboard[2].participationMaxObtainable} marks)`}
                {selectedAwardCategory === 'EVANGELISM' && `${sortedLeaderboard[2].totalReferrals} visitors invited`}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {sortedLeaderboard[2].eligibleLessonsCount} eligible lessons (joined W{sortedLeaderboard[2].firstLessonWeek})
              </p>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Rank</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Eligible Lessons</th>
                <th className="py-3 px-3">Attended</th>
                <th className="py-3 px-3">Punctuality (15/ea)</th>
                <th className="py-3 px-3">Verse (15/ea)</th>
                <th className="py-3 px-3">Participation (20/ea)</th>
                <th className="py-3 px-3 text-amber-800 font-black">Diligence Rate</th>
                <th className="py-3 px-3">Soul Winning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedLeaderboard.map((item, idx) => (
                <tr key={item.memberId} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-bold text-slate-500">
                    {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    <div>{item.fullName}</div>
                    <span className="text-[10px] font-normal text-slate-400">
                      Joined Week {item.firstLessonWeek}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-800">{item.eligibleLessonsCount} lessons</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-700 font-bold">{item.attendedWeeks}</span> / {item.eligibleLessonsCount}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{item.punctualityPercentage}%</div>
                    <div className="text-[10px] text-slate-500">{item.punctualityScoreObtained} / {item.punctualityMaxObtainable}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-amber-800">{item.memoryVersePercentage}%</div>
                    <div className="text-[10px] text-slate-500">{item.memoryVerseScoreObtained} / {item.memoryVerseMaxObtainable}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-indigo-800">{item.participationPercentage}%</div>
                    <div className="text-[10px] text-slate-500">{item.participationScoreObtained} / {item.participationMaxObtainable}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-extrabold text-amber-900 text-sm">{item.hardWorkRate}%</div>
                    <div className="text-[10px] text-slate-500">{item.totalPointsEarned} / {item.totalPossiblePointsSinceFirst} pts</div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-purple-700">
                    {item.totalReferrals}
                  </td>
                </tr>
              ))}
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
