import React, { useState } from 'react';
import {
  Briefcase,
  BookOpen,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  BookCheck,
  Check,
  Building
} from 'lucide-react';
import { AdminProfile, ClassProfile, SundaySchoolYear } from '../../types';

interface WorkersViewProps {
  currentAdmin: AdminProfile;
  allClasses: ClassProfile[];
  sundaySchoolYear: SundaySchoolYear;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  currentAdmin,
  allClasses,
  sundaySchoolYear
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selfAttendance, setSelfAttendance] = useState<Record<number, 'PRESENT' | 'ABSENT' | 'EXCUSED'>>({
    1: 'PRESENT',
    2: 'PRESENT',
    3: 'PRESENT',
    4: 'PRESENT',
    5: 'PRESENT',
    6: 'PRESENT'
  });
  const [prepAttended, setPrepAttended] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true
  });

  const activeQuarter = sundaySchoolYear.quarters.find(q => q.quarterNumber === sundaySchoolYear.activeQuarterNumber) || sundaySchoolYear.quarters[0];
  const totalWeeks = activeQuarter.totalLessonWeeks;
  const currentLesson = activeQuarter.lessons?.find(l => l.weekNumber === selectedWeek);

  const assignedClass = allClasses[0] || {
    className: 'Grace & Truth Adult Bible Class',
    department: 'Adult'
  };

  const handleMarkSelfAttendance = (status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    setSelfAttendance(prev => ({ ...prev, [selectedWeek]: status }));
  };

  const handleTogglePrep = () => {
    setPrepAttended(prev => ({ ...prev, [selectedWeek]: !prev[selectedWeek] }));
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/40 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Sunday School Worker Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Worker Self-Attendance & Lesson Preparation
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed">
              Teacher/Worker: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Assigned to <strong>{assignedClass.className}</strong>. Mark your personal weekly attendance and review preparatory lesson outlines.
            </p>
          </div>

          {/* Assigned Class Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-xs space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-300 block">Assigned Teaching Post:</span>
            <div className="text-[11px] font-bold text-slate-200">
              {assignedClass.className}
            </div>
            <span className="text-[10px] text-slate-300 bg-amber-900/50 px-2 py-0.5 rounded inline-block">
              {assignedClass.department} Department
            </span>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-900" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            Select Study & Attendance Week (Quarter {sundaySchoolYear.activeQuarterNumber}):
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
            const isSelected = selectedWeek === w;
            const isPresent = selfAttendance[w] === 'PRESENT';
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? 'bg-amber-900 text-white font-black shadow-xs ring-2 ring-amber-900/30'
                    : isPresent
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Week {w}</span>
                {isPresent && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Self-Attendance Marking Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Self-Marking Attendance for Week {selectedWeek}
            </h3>
            <p className="text-xs text-slate-500">
              Record your preparatory class attendance and Sunday School teaching presence.
            </p>
          </div>

          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900">
            Current Status: {selfAttendance[selectedWeek] || 'PENDING'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Sunday Teaching Duty */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-black text-slate-800 uppercase block">
              1. Sunday Morning Teaching Duty:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkSelfAttendance('PRESENT')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  selfAttendance[selectedWeek] === 'PRESENT'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                ✓ Present on Duty
              </button>
              <button
                onClick={() => handleMarkSelfAttendance('EXCUSED')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selfAttendance[selectedWeek] === 'EXCUSED'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Excused
              </button>
              <button
                onClick={() => handleMarkSelfAttendance('ABSENT')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selfAttendance[selectedWeek] === 'ABSENT'
                    ? 'bg-rose-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Absent
              </button>
            </div>
          </div>

          {/* Saturday Preparatory Class */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-black text-slate-800 uppercase block">
              2. Saturday Teachers Preparatory Class:
            </span>
            <button
              onClick={handleTogglePrep}
              className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                prepAttended[selectedWeek]
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {prepAttended[selectedWeek] ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Preparatory Class Attended & Certified</span>
                </>
              ) : (
                <span>Mark Saturday Preparatory Class Attended</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lesson Curriculum Study Guide */}
      {currentLesson && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                Lesson Study Outline • Week {selectedWeek}
              </span>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                {currentLesson.topic}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              Quarter {sundaySchoolYear.activeQuarterNumber}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-2">
              <span className="font-bold text-amber-950 uppercase block">Scripture Reading:</span>
              <p className="text-slate-800 font-medium">{currentLesson.scriptureReading}</p>
            </div>

            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/70 space-y-2">
              <span className="font-bold text-blue-950 uppercase block">Memory Verse:</span>
              <p className="text-slate-800 italic font-serif">"{currentLesson.memoryVerse}"</p>
              <p className="text-blue-900 font-black">— {currentLesson.memoryVerseRef}</p>
            </div>

            {currentLesson.aim && (
              <div className="col-span-1 md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 uppercase block">Lesson Spiritual Aim:</span>
                <p className="text-slate-700">{currentLesson.aim}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
