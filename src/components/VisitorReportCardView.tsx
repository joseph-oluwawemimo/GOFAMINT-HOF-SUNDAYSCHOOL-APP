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

interface VisitorReportCardViewProps {
  memberId: string;
  members: Member[];
  grades: WeeklyGradeRecord[];
  classProfile: ClassProfile | null;
  lessons?: LessonInfo[];
  onBack?: () => void;
  onRefresh?: () => void;
}

export const VisitorReportCardView: React.FC<VisitorReportCardViewProps> = ({
  memberId,
  members,
  grades,
  classProfile,
  lessons = GOFAMINT_HOF_12_LESSONS,
  onBack,
  onRefresh
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const member = members.find(m => m.id === memberId);
  const stats = member ? calculateMemberStats(member, grades, 12) : null;
  const qualification = member ? checkVisitorQualification(member, grades, 12) : null;

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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-3 sm:p-6 lg:p-8 font-sans animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-5">
        
        {/* Top Floating Control Bar */}
        <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Register</span>
            </button>
          ) : (
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Official Sunday School Report Card
            </div>
          )}

          {/* Primary & Only Action Button for Visitors: REFRESH */}
          <button
            id="btn-refresh-report-card"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition active:scale-95 ml-auto"
          >
            <RefreshCw className={`w-4 h-4 text-amber-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{refreshSuccess ? 'Refreshed!' : isRefreshing ? 'Refreshing...' : 'Refresh Report Card'}</span>
          </button>
        </div>

        {/* Official Header Card */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
            
            {/* Member Photo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 border-2 border-blue-900 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-[10px] font-black uppercase text-amber-900">
                <GofamintLogo className="w-4 h-4" />
                <span>The Gospel Faith Mission International (House of Favour)</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif]">
                {member.fullName}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${
                  member.memberType === 'STUDENT'
                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                    : 'bg-purple-100 text-purple-900 border border-purple-300'
                }`}>
                  {member.memberType}
                </span>

                <span className="text-xs text-slate-600 font-semibold">
                  Class: <strong className="text-slate-900">{classProfile?.className || 'Sunday School Class'}</strong>
                </span>

                <span className="text-xs text-slate-600">
                  • Dept: <strong className="text-blue-900">{classProfile?.department || 'General'}</strong>
                </span>
              </div>

              <div className="text-xs text-slate-500 pt-1">
                Secretary: {classProfile?.secretaryName || 'Sunday School Secretary'} | First Joined: Week {member.firstLessonWeek || 1}
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

          {/* Qualification Banner for Visitors */}
          {member.memberType === 'VISITOR' && qualification && (
            <div className={`mt-5 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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

        {/* Summary Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Attendance
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {stats.attendedWeeks}
            </span>
            <span className="text-xs text-slate-500 font-bold block mt-0.5">/ 12 Weeks</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Total Points
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-900">
              {stats.totalPointsEarned}
            </span>
            <span className="text-xs text-slate-500 font-bold block mt-0.5">/ {stats.totalPossiblePointsSinceFirst}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Hard Work Rate
            </span>
            <span className="text-xl sm:text-2xl font-black text-purple-900">
              {stats.hardWorkRate}%
            </span>
            <span className="text-xs text-slate-500 font-bold block mt-0.5">Performance</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Memory Verse Recitation
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-700">
              {stats.memoryVersePercentage}%
            </span>
            <span className="text-xs text-slate-500 font-bold block mt-0.5">
              {stats.memoryVerseScoreObtained} / {stats.memoryVerseMaxObtainable} marks
            </span>
          </div>
        </div>

        {/* 12-Week Scorecard Breakdown Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
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
              const isPresent = grade?.attendance === 'PRESENT';
              const isAbsent = grade?.attendance === 'ABSENT';
              const isExempt = !grade || grade.attendance === 'EXEMPT' || weekNum < (member.firstLessonWeek || 1);

              return (
                <div key={weekNum} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                  
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
                  <div className="flex items-center gap-4 pl-8 sm:pl-0">
                    
                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </span>
                      ) : isAbsent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#5c2c16] text-white rounded-lg text-xs font-bold shadow-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold border border-slate-200">
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Exempt</span>
                        </span>
                      )}
                    </div>

                    {/* Breakdown Scores */}
                    {isPresent && grade ? (
                      <div className="flex items-center gap-2 sm:gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block font-semibold">Punct.</span>
                          <span className="font-bold text-slate-800">{grade.punctuality}/15</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block font-semibold">M Vars</span>
                          <span className="font-bold text-slate-800">{grade.memoryVerse}/15</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block font-semibold">C Part.</span>
                          <span className="font-bold text-slate-800">{grade.classParticipation}/20</span>
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="text-center font-black text-blue-900">
                          <span className="text-[9px] text-blue-600 block">Total</span>
                          <span>{grade.lessonTotal}/50</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        {isAbsent ? '0 / 50 pts' : 'Exempt from scoring'}
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
