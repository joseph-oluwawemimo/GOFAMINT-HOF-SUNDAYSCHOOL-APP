import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Church,
  RefreshCw,
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Sparkles,
  ArrowLeft,
  Share2,
  BookOpen,
  User,
  ShieldCheck,
  Check
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import {
  Member,
  WeeklyGradeRecord,
  ClassProfile,
  LessonInfo
} from '../types';
import {
  calculateMemberStats,
  checkVisitorQualification
} from '../utils/calculations';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import {
  MemberFairnessMetrics,
  WeekClusterPoint,
  computeClassFairnessRankings,
  generateMemberClusterWeeks,
  formatRate
} from '../utils/fairnessScoring';
import { StudentClassPerformanceGraph } from './StudentClassPerformanceGraph';

interface VisitorReportCardViewProps {
  memberId: string;
  members: Member[];
  grades: WeeklyGradeRecord[];
  classProfile: ClassProfile | null;
  lessons?: LessonInfo[];
  fairnessMetrics?: MemberFairnessMetrics | null;
  clusterWeeks?: WeekClusterPoint[];
  classSummary?: {
    rankings?: {
      overall: number;
      memoryVerse: number;
      punctuality: number;
      participation: number;
      totalInClass: number;
      totalEligibleInClass?: number;
    };
    classAverages?: {
      overallRaw: number;
      memoryRaw: number;
      punctualityRaw: number;
      participationRaw: number;
    };
  } | null;
  onBack?: () => void;
  onRefresh?: () => void;
}

export const VisitorReportCardView: React.FC<VisitorReportCardViewProps> = ({
  memberId,
  members,
  grades,
  classProfile,
  lessons = GOFAMINT_HOF_12_LESSONS,
  fairnessMetrics,
  clusterWeeks,
  classSummary,
  onBack,
  onRefresh
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const member = members.find(m => m.id === memberId) || (members.length === 1 ? members[0] : null);
  const stats = member ? calculateMemberStats(member, grades, 12) : null;
  const qualification = member ? checkVisitorQualification(member, grades, 12) : null;

  // Authoritative live fairness metrics & rankings
  const activeMetrics = React.useMemo(() => {
    if (fairnessMetrics) return fairnessMetrics;
    if (!member) return null;
    const allMembersInClass = members.length > 0 ? members : [member];
    const rankingsResult = computeClassFairnessRankings(allMembersInClass, grades, 12);
    return rankingsResult.memberMetrics.find(m => m.memberId === member.id) || null;
  }, [fairnessMetrics, member, members, grades]);

  const activeClusterWeeks = React.useMemo(() => {
    if (clusterWeeks && clusterWeeks.length > 0) return clusterWeeks;
    if (!member) return [];
    return generateMemberClusterWeeks(member, grades, 12);
  }, [clusterWeeks, member, grades]);

  const activeRankings = React.useMemo(() => {
    if (classSummary?.rankings) return classSummary.rankings;
    if (activeMetrics?.rankings) return activeMetrics.rankings;
    return {
      overall: 1,
      memoryVerse: 1,
      punctuality: 1,
      participation: 1,
      totalInClass: Math.max(1, members.length),
      totalEligibleInClass: members.filter(m => m.memberType === 'STUDENT').length || 1
    };
  }, [classSummary?.rankings, activeMetrics?.rankings, members]);

  const currentUrl = window.location.href;

  useEffect(() => {
    if (memberId) {
      QRCode.toDataURL(
        currentUrl,
        {
          width: 200,
          margin: 1,
          color: { dark: '#1e3a8a', light: '#ffffff' }
        },
        (err, url) => {
          if (!err && url) setQrCodeUrl(url);
        }
      );
    }
  }, [memberId, currentUrl]);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2000);
    }, 600);
  };

  if (!member || !stats) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-300 max-w-md shadow-lg space-y-4">
          <GofamintLogo size={48} className="mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Member Record Not Found</h2>
          <p className="text-xs text-slate-600">
            The requested Sunday School report card could not be located on this device.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg text-xs font-bold"
            >
              Back to Register
            </button>
          )}
        </div>
      </div>
    );
  }

  const isStudent = (activeMetrics?.memberType || member.memberType) === 'STUDENT';
  const isAwardEligible = activeMetrics?.isAwardEligible ?? isStudent;
  const joinWeek = activeMetrics?.joinLesson || member.firstLessonWeek || 1;
  const eligibleLessonCount = activeMetrics?.eligibleLessons ?? stats.eligibleLessonsCount;
  const attendanceRateVal = activeMetrics
    ? activeMetrics.attendanceRate
    : stats.eligibleLessonsCount > 0
    ? (stats.attendedWeeks / stats.eligibleLessonsCount) * 100
    : 0;

  return (
    <div className="text-slate-800 font-sans animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
        
        {/* Top Floating Control Bar */}
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Register</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs font-black text-slate-700">
                Official Live Sunday School Profile
              </div>
            </div>
          )}

          {/* Primary & Only Action Button for Visitors/Students: REFRESH */}
          <button
            id="btn-refresh-report-card"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="flex min-h-[42px] items-center gap-2 px-4 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 ml-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{refreshSuccess ? 'Updated' : isRefreshing ? 'Updating...' : 'Refresh Live Data'}</span>
          </button>
        </div>

        {/* Official Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
            
            {/* Member Photo */}
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 border-2 border-blue-900 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
              {member.photoBase64 ? (
                <img
                  src={member.photoBase64}
                  alt={member.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-slate-700">
                  {member.fullName.charAt(0)}
                </span>
              )}
            </div>

            {/* Main Information */}
            <div className="flex-1 space-y-1.5">
              <div className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-[9px] sm:text-[10px] font-black uppercase text-amber-900">
                <GofamintLogo className="w-4 h-4" />
                <span className="truncate">GOFAMINT · House of Favour</span>
              </div>

              <h1 className="text-xl sm:text-3xl font-black text-slate-900">
                {member.fullName}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                {/* Student / Visitor status badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                  isStudent
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isStudent ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                  <span>{isStudent ? 'STUDENT' : 'VISITOR'}</span>
                </span>

                {/* Award Eligibility Badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                  isAwardEligible
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  <Award className="w-3.5 h-3.5" />
                  <span>{isAwardEligible ? 'Eligible for Awards' : 'Not Eligible for Awards'}</span>
                </span>

                <span className="text-xs text-slate-600 font-semibold">
                  Class: <strong className="text-slate-900">{classProfile?.className || member.className || 'Sunday School Class'}</strong>
                </span>

                <span className="text-xs text-slate-600">
                  • Dept: <strong className="text-blue-900">{classProfile?.department || member.department || 'General'}</strong>
                </span>
              </div>

              <div className="text-xs text-slate-500 pt-1">
                Secretary: {classProfile?.secretaryName || 'Sunday School Secretary'} | Joined Quarter: Week {joinWeek} ({eligibleLessonCount} Eligible Lessons)
              </div>
            </div>

            {/* QR Code */}
            {qrCodeUrl && (
              <div className="hidden md:flex flex-col items-center shrink-0 text-center">
                <div className="w-20 h-20 p-1 bg-white border border-slate-300 rounded-xl shadow-xs">
                  <img src={qrCodeUrl} alt="Report Card QR" className="w-full h-full object-contain" />
                </div>
                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Live Portal</span>
              </div>
            )}

          </div>

          {/* Award Eligibility & Visitor Progression Explanation */}
          {!isStudent && (
            <div className="mt-4 p-3.5 rounded-xl border bg-amber-50/70 border-amber-200 text-amber-950 flex items-start gap-3 text-xs leading-relaxed">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Visitor Performance Tracking Active:</strong>
                All your attendance, memory verse scores, and punctuality marks are recorded with 100% precision. Under Sunday School rules, award eligibility activates automatically once you achieve Student status (attend 3 consecutive lessons or 6 lessons in the quarter).
              </div>
            </div>
          )}

          {/* Qualification Banner for Visitors */}
          {member.memberType === 'VISITOR' && qualification && (
            <div className={`mt-3 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              qualification.isQualified
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-purple-50 border-purple-200 text-purple-950'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                  qualification.isQualified ? 'bg-emerald-200 text-emerald-900' : 'bg-purple-200 text-purple-900'
                }`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    {qualification.isQualified ? '🎉 Student Status Qualification Achieved' : 'Student Qualification Progress'}
                  </h4>
                  <p className="text-xs mt-0.5 leading-relaxed">
                    {qualification.description}
                  </p>
                </div>
              </div>

              <div className="text-xs font-black px-3 py-1.5 rounded-lg shrink-0 bg-white/80 border border-slate-200 shadow-xs">
                <span>{stats.attendedWeeks} / 12 Weeks Attended</span>
              </div>
            </div>
          )}

        </div>

        {/* Summary Stats Overview: Accurate Live Scoring & Fairness */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          
          {/* Attendance Stat Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Attendance & Consistency
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {stats.attendedWeeks} <span className="text-xs text-slate-400 font-normal">/ {eligibleLessonCount}</span>
            </span>
            <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
              {formatRate(attendanceRateVal)}% Attended
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {(activeMetrics ? activeMetrics.absentWeeks : stats.absentWeeks)} absent {joinWeek > 1 ? `• Wk 1-${joinWeek - 1} N/A` : ''}
            </span>
          </div>

          {/* Points & Diligence Stat Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Overall Diligence Rate
            </span>
            <span className="text-xl sm:text-2xl font-black text-purple-900">
              {formatRate(activeMetrics?.overall.rawRate ?? stats.hardWorkRate)}%
            </span>
            <div className="text-[11px] font-bold text-indigo-700 mt-0.5">
              Adjusted: {formatRate(activeMetrics?.overall.adjustedRate ?? stats.hardWorkRate)}%
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {activeMetrics ? activeMetrics.totalPointsEarned : stats.totalPointsEarned} / {activeMetrics ? activeMetrics.maxAvailablePoints : stats.totalPossiblePointsSinceFirst} pts
            </span>
          </div>

          {/* Memory Verse Stat Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Memory Verse Recitation
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-700">
              {formatRate(activeMetrics?.memoryVerse.rawRate ?? stats.memoryVersePercentage)}%
            </span>
            <div className="text-[11px] font-bold text-amber-900 mt-0.5">
              Adjusted: {formatRate(activeMetrics?.memoryVerse.adjustedRate ?? stats.memoryVersePercentage)}%
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {activeMetrics ? activeMetrics.memoryVerse.points : stats.memoryVerseScoreObtained} / {activeMetrics ? activeMetrics.memoryVerse.maxPoints : stats.memoryVerseMaxObtainable} marks
            </span>
          </div>

          {/* Punctuality & Participation Stat Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Punctuality & Class Part.
            </span>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">Punct.</span>
                <span className="text-base font-black text-emerald-800">
                  {formatRate(activeMetrics?.punctuality.rawRate ?? 0)}%
                </span>
              </div>
              <span className="text-slate-300">|</span>
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">Part.</span>
                <span className="text-base font-black text-blue-900">
                  {formatRate(activeMetrics?.participation.rawRate ?? 0)}%
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              Combined: {((activeMetrics?.punctuality.points || 0) + (activeMetrics?.participation.points || 0))} pts
            </span>
          </div>

        </div>

        {/* 5 & 6: Student Class Performance / Ranking Graph & 12-Lesson Performance Cluster */}
        <StudentClassPerformanceGraph
          memberName={member.fullName}
          memberType={isStudent ? 'STUDENT' : 'VISITOR'}
          className={classProfile?.className || member.className}
          isAwardEligible={isAwardEligible}
          awardEligibilityLabel={isAwardEligible ? 'Eligible for Awards' : 'Not Eligible for Awards'}
          rankings={{
            overall: activeRankings.overall,
            memoryVerse: activeRankings.memoryVerse,
            punctuality: activeRankings.punctuality,
            participation: activeRankings.participation,
            totalInClass: activeRankings.totalInClass,
            totalEligibleInClass: activeRankings.totalEligibleInClass
          }}
          rates={activeMetrics ? {
            overall: activeMetrics.overall,
            memoryVerse: activeMetrics.memoryVerse,
            punctuality: activeMetrics.punctuality,
            participation: activeMetrics.participation
          } : {
            overall: { rawRate: stats.hardWorkRate, adjustedRate: stats.hardWorkRate, points: stats.totalPointsEarned, maxPoints: stats.totalPossiblePointsSinceFirst, referenceRate: 70 },
            memoryVerse: { rawRate: stats.memoryVersePercentage, adjustedRate: stats.memoryVersePercentage, points: stats.memoryVerseScoreObtained, maxPoints: stats.memoryVerseMaxObtainable, referenceRate: 70 },
            punctuality: { rawRate: 0, adjustedRate: 0, points: 0, maxPoints: eligibleLessonCount * 15, referenceRate: 70 },
            participation: { rawRate: 0, adjustedRate: 0, points: 0, maxPoints: eligibleLessonCount * 20, referenceRate: 70 }
          }}
          clusterWeeks={activeClusterWeeks}
          classAverages={classSummary?.classAverages}
        />

        {/* 12-Week Scorecard Breakdown Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-900" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                12-Week Sunday School Performance Record
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold">Read-Only Live Record</span>
          </div>

          <div className="divide-y divide-slate-200">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((weekNum) => {
              const grade = grades.find(g => g.memberId === member.id && g.weekNumber === weekNum);
              const lesson = lessons.find(l => l.weekNumber === weekNum);
              const isBeforeJoin = weekNum < joinWeek;
              const isPresent = grade?.attendance === 'PRESENT';
              const isAbsent = grade?.attendance === 'ABSENT';
              const isExempt = grade?.attendance === 'EXEMPT';

              return (
                <div key={weekNum} className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                  
                  {/* Week & Topic Details */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-900 font-black text-xs flex items-center justify-center shrink-0 border border-blue-200">
                        {weekNum}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {lesson?.topic || `Week ${weekNum} Lesson`}
                      </h4>
                    </div>

                    {lesson?.memoryVerseRef && (
                      <p className="text-[11px] text-slate-500 pl-8 truncate">
                        M Vars: <span className="font-semibold text-slate-700">{lesson.memoryVerseRef}</span>
                      </p>
                    )}
                  </div>

                  {/* Attendance & Score Display */}
                  <div className="grid grid-cols-1 gap-2 pl-8 sm:flex sm:items-center sm:gap-4 sm:pl-0">
                    
                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isBeforeJoin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold border border-slate-200">
                          <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>N/A (Joined Wk {joinWeek})</span>
                        </span>
                      ) : isPresent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </span>
                      ) : isAbsent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#5c2c16] text-white rounded-lg text-xs font-bold shadow-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </span>
                      ) : isExempt ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200">
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Excused</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs font-semibold border border-slate-200">
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>No Entry</span>
                        </span>
                      )}
                    </div>

                    {/* Breakdown Scores */}
                    {isPresent && grade ? (
                      <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-3 text-xs bg-slate-50 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block font-semibold">Punct.</span>
                          <span className="font-bold text-slate-800">{grade.punctuality}/15</span>
                        </div>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block font-semibold">M Vars</span>
                          <span className="font-bold text-slate-800">{grade.memoryVerse}/15</span>
                        </div>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block font-semibold">C Part.</span>
                          <span className="font-bold text-slate-800">{grade.classParticipation}/20</span>
                        </div>
                        <span className="hidden sm:inline text-slate-300">|</span>
                        <div className="text-center font-black text-blue-900">
                          <span className="text-[9px] text-blue-600 block">Total</span>
                          <span>{grade.lessonTotal}/50</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        {isBeforeJoin
                          ? 'Excluded from denominator'
                          : isAbsent
                          ? '0 / 50 pts (Missed lesson)'
                          : 'No score recorded'}
                      </div>
                    )}

                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-slate-500 py-3 space-y-1">
          <p className="font-semibold">The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF) Sunday School Register</p>
          <p className="text-[11px] text-slate-400">Personal Report Card • Updates in Real Time upon Teacher / Secretary Entry</p>
        </div>

      </div>
    </div>
  );
};
