import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Crown,
  Sparkles,
  TrendingUp,
  DollarSign,
  Users,
  HeartHandshake,
  BookOpen,
  Printer,
  Medal,
  Flame,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  ClassProfile,
  HardWorkStats
} from '../types';
import { calculateMemberStats, generate2DTrendData } from '../utils/calculations';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';

interface Week12AnalyticsViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  classProfile: ClassProfile | null;
  currencySymbol: string;
}

type AwardCategory = 
  | 'OVERALL'
  | 'PUNCTUALITY'
  | 'MEMORY_VERSE'
  | 'PARTICIPATION'
  | 'EVANGELISM';

export const Week12AnalyticsView: React.FC<Week12AnalyticsViewProps> = ({
  members,
  grades,
  offerings,
  classProfile,
  currencySymbol
}) => {
  const [selectedAwardCategory, setSelectedAwardCategory] = useState<AwardCategory>('OVERALL');

  // Trigger celebratory confetti when visiting awards
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    triggerCelebration();
  }, [selectedAwardCategory]);

  // Member statistics calculated using the report-card formula
  const noRecordWeeks = offerings
    .filter(o => o.isNoRecordWeek)
    .map(o => o.weekNumber);

  const memberStatsList: HardWorkStats[] = members.map(m => calculateMemberStats(m, grades, 12, noRecordWeeks));

  // Awards Leaderboard: STRICTLY STUDENTS ONLY (Visitors are excluded from awards)
  const studentStatsList = memberStatsList.filter(s => s.memberType === 'STUDENT');

  // Leaderboard Sorting based on selected category percentage
  const sortedLeaderboard = [...studentStatsList].sort((a, b) => {
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

  // 2D Trend Data (+Y Students, -Y Visitors, X Weeks 1-12)
  const trendData = generate2DTrendData(members, grades, 12);
  const maxAxisVal = Math.max(1, ...trendData.map(d => Math.max(d.students, d.visitors)));

  // Aggregate 12-Week Metrics
  const total12WeekAttendance = trendData.reduce((acc, curr) => acc + curr.total, 0);
  const totalUniqueVisitorsReceived = members.filter(m => m.memberType === 'VISITOR' || m.convertedFromVisitorAtLesson).length;
  const totalConvertedVisitors = members.filter(m => m.convertedFromVisitorAtLesson).length;
  const cumulativeOffering = offerings.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black">
      
      {/* Top Header & Print Action */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:border-none print:shadow-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              WEEK 12 QUARTERLY CLOSEOUT
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1 font-['Cinzel',serif] tracking-wide print:text-black">
            Comprehensive Report & Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 print:text-slate-600">
            2D Roster Shift Trend, 5 Award Leaderboard Champions, and Full Quarter Return Form.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-xs print:hidden"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Print Official Return</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cumulative Attendance</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{total12WeekAttendance}</span>
            <span className="text-xs text-slate-500">marks recorded</span>
          </div>
          <p className="text-[11px] text-blue-700 font-semibold mt-1">12-Lesson Total</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unique Visitors</span>
            <HeartHandshake className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-900">{totalUniqueVisitorsReceived}</span>
            <span className="text-xs text-slate-500">souls welcomed</span>
          </div>
          <p className="text-[11px] text-purple-700 font-semibold mt-1">{totalConvertedVisitors} converted to students</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Visitors Converted</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{totalConvertedVisitors}</span>
            <span className="text-xs text-slate-500">full students</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            {totalUniqueVisitorsReceived > 0 ? Math.round((totalConvertedVisitors / totalUniqueVisitorsReceived) * 100) : 0}% Conversion Rate
          </p>
        </div>

        <div className="bg-white border border-amber-300 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Cumulative Offering</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-amber-700">{currencySymbol}</span>
            <span className="text-2xl font-black text-slate-900">{cumulativeOffering.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">12-Week class collections</p>
        </div>

      </div>

      {/* Visual 2D Trend Chart (+Y Students, -Y Visitors, Weeks 1 to 12) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-700" />
              <h3 className="text-base font-bold text-slate-900">
                2D Roster Shift & Conversion Trend (Weeks 1 to 12)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              +Y Axis: Active Student Attendance • -Y Axis: Active Visitor Attendance • X Axis: Timeline
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-700" />
              <span className="text-slate-700 font-bold">+Y Students</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-600" />
              <span className="text-slate-700 font-bold">-Y Visitors</span>
            </div>
          </div>
        </div>

        {/* Interactive SVG / Bar Chart Representation */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="grid grid-cols-12 gap-1.5 h-64 sm:h-72 items-center">
            {trendData.map((d) => {
              const studentHeightPct = Math.min(100, Math.round((d.students / (maxAxisVal || 1)) * 100));
              const visitorHeightPct = Math.min(100, Math.round((d.visitors / (maxAxisVal || 1)) * 100));

              return (
                <div key={d.week} className="flex flex-col h-full items-center justify-between group relative">
                  
                  {/* Top +Y Bar (Students) */}
                  <div className="flex-1 w-full flex flex-col justify-end items-center pb-1">
                    <span className="text-[10px] font-bold text-blue-900 mb-0.5 opacity-80 group-hover:opacity-100">
                      {d.students > 0 ? d.students : ''}
                    </span>
                    <div
                      style={{ height: `${studentHeightPct}%` }}
                      className="w-full max-w-[28px] bg-blue-700 rounded-t-md transition-all duration-300 group-hover:bg-blue-800 min-h-[4px]"
                      title={`Week ${d.week}: ${d.students} Students`}
                    />
                  </div>

                  {/* Center Timeline Zero Axis */}
                  <div className="w-full border-t-2 border-slate-300 text-center py-1 bg-white border-x border-b rounded z-10 shadow-2xs">
                    <span className="text-[10px] font-black text-slate-800">
                      W{d.week}
                    </span>
                  </div>

                  {/* Bottom -Y Bar (Visitors) */}
                  <div className="flex-1 w-full flex flex-col justify-start items-center pt-1">
                    <div
                      style={{ height: `${visitorHeightPct}%` }}
                      className="w-full max-w-[28px] bg-purple-600 rounded-b-md transition-all duration-300 group-hover:bg-purple-700 min-h-[4px]"
                      title={`Week ${d.week}: ${d.visitors} Visitors`}
                    />
                    <span className="text-[10px] font-bold text-purple-900 mt-0.5 opacity-80 group-hover:opacity-100">
                      {d.visitors > 0 ? d.visitors : ''}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200">
            <span>Quarter Start (Week 1)</span>
            <span className="text-slate-800 font-bold">Center Zero-Axis (Timeline Progression)</span>
            <span>Quarter Closeout (Week 12)</span>
          </div>
        </div>
      </div>

      {/* Award Leaderboard with 5 Filter Views */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif] tracking-wide">
                Quarter 12 Award Leaderboards
              </h3>
              <p className="text-xs text-slate-500">
                Recognizing diligence, verbatim scripture memorization, punctuality, and evangelism fruitfulness.
              </p>
            </div>
          </div>

          {/* 5 Award Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedAwardCategory('OVERALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAwardCategory === 'OVERALL'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>1. Overall Winner</span>
            </button>

            <button
              onClick={() => setSelectedAwardCategory('PUNCTUALITY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAwardCategory === 'PUNCTUALITY'
                  ? 'bg-blue-900 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Medal className="w-3.5 h-3.5" />
              <span>2. Punctuality Champion</span>
            </button>

            <button
              onClick={() => setSelectedAwardCategory('MEMORY_VERSE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAwardCategory === 'MEMORY_VERSE'
                  ? 'bg-amber-600 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>3. Memory Verse Master</span>
            </button>

            <button
              onClick={() => setSelectedAwardCategory('PARTICIPATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAwardCategory === 'PARTICIPATION'
                  ? 'bg-indigo-700 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>4. Participation Leader</span>
            </button>

            <button
              onClick={() => setSelectedAwardCategory('EVANGELISM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAwardCategory === 'EVANGELISM'
                  ? 'bg-emerald-700 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>5. Evangelistic Champion</span>
            </button>
          </div>
        </div>

        {/* Podium Champions Display (Top 3) */}
        {sortedLeaderboard.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
            
            {/* Rank 2 (Silver) */}
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

            {/* Rank 1 (Gold / Champion) */}
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

            {/* Rank 3 (Bronze) */}
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

        {/* Full Leaderboard Table */}
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

    </div>
  );
};
