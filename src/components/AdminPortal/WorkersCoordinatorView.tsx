import React, { useState } from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  BookOpen,
  Sparkles,
  Download,
  Search,
  Filter,
  Award,
  BookCheck,
  Building,
  Clock,
  Briefcase
} from 'lucide-react';
import { AdminProfile, ClassProfile, SundaySchoolYear } from '../../types';

interface WorkersCoordinatorViewProps {
  currentAdmin: AdminProfile;
  allClasses: ClassProfile[];
  sundaySchoolYear: SundaySchoolYear;
}

interface WorkerAttendanceRow {
  teacherId: string;
  teacherName: string;
  phone: string;
  assignedClass: string;
  department: string;
  isHeadTeacher: boolean;
  attendance: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE';
  prepClassAttended: boolean;
  studyNoteSubmitted: boolean;
}

export const WorkersCoordinatorView: React.FC<WorkersCoordinatorViewProps> = ({
  currentAdmin,
  allClasses,
  sundaySchoolYear
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'PREP_ATTENDANCE' | 'WORKERS_ROSTER' | 'SYLLABUS_GUIDE'>('PREP_ATTENDANCE');
  const [searchQuery, setSearchQuery] = useState('');

  const activeQuarter = sundaySchoolYear.quarters.find(q => q.quarterNumber === sundaySchoolYear.activeQuarterNumber) || sundaySchoolYear.quarters[0];
  const currentLesson = activeQuarter.lessons?.find(l => l.weekNumber === selectedWeek);

  // Extract all teachers across all classes
  const initialRoster: WorkerAttendanceRow[] = [];
  allClasses.forEach(cls => {
    cls.teachers.forEach(t => {
      initialRoster.push({
        teacherId: `${cls.id}_${t.id}`,
        teacherName: t.name,
        phone: t.phone || '+234 800 000 0000',
        assignedClass: cls.className,
        department: cls.department,
        isHeadTeacher: !!t.isHeadTeacher,
        attendance: 'PRESENT',
        prepClassAttended: true,
        studyNoteSubmitted: true
      });
    });
  });

  const [rosterState, setRosterState] = useState<Record<number, WorkerAttendanceRow[]>>({
    1: initialRoster,
    2: initialRoster
  });

  const currentWeekRoster = rosterState[selectedWeek] || initialRoster;

  const handleToggleAttendance = (teacherId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE') => {
    const updated = currentWeekRoster.map(r => r.teacherId === teacherId ? { ...r, attendance: status } : r);
    setRosterState(prev => ({ ...prev, [selectedWeek]: updated }));
  };

  const handleTogglePrep = (teacherId: string) => {
    const updated = currentWeekRoster.map(r => r.teacherId === teacherId ? { ...r, prepClassAttended: !r.prepClassAttended } : r);
    setRosterState(prev => ({ ...prev, [selectedWeek]: updated }));
  };

  const filteredRoster = currentWeekRoster.filter(r => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (r.teacherName || '').toLowerCase().includes(q) ||
      (r.assignedClass || '').toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q)
    );
  });

  const totalWorkers = currentWeekRoster.length;
  const presentCount = currentWeekRoster.filter(r => r.attendance === 'PRESENT').length;
  const prepAttendedCount = currentWeekRoster.filter(r => r.prepClassAttended).length;

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-yellow-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/40 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>Workers Coordinator Directorate</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Workers' Roster & Preparatory Class Oversight
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed">
              Coordinator: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Managing Sunday School teachers, workers' weekly attendance, and preparatory class rehearsals across all departments.
            </p>
          </div>

          {/* Access Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-xs space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-300 block">Workers Administration:</span>
            <div className="text-[11px] font-bold text-slate-200">
              {totalWorkers} Certified Sunday School Workers
            </div>
            <p className="text-[10px] text-slate-300">
              Preparatory Class: Every Saturday 5:00 PM
            </p>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Active Workers</span>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{totalWorkers} Workers</h3>
          <p className="text-xs text-slate-500 mt-1">Across {allClasses.length} approved classes</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Week {selectedWeek} Present</span>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{presentCount} / {totalWorkers}</h3>
          <p className="text-xs text-emerald-600 font-bold mt-1">
            {totalWorkers > 0 ? Math.round((presentCount / totalWorkers) * 100) : 0}% attendance
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Prep Class Attended</span>
          <h3 className="text-2xl font-black text-blue-900 mt-1">{prepAttendedCount} Workers</h3>
          <p className="text-xs text-slate-500 mt-1">Lesson rehearsal verified</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Quarter Cycle</span>
          <h3 className="text-2xl font-black text-amber-800 mt-1">Quarter {sundaySchoolYear.activeQuarterNumber}</h3>
          <p className="text-xs text-slate-500 mt-1">{sundaySchoolYear.yearName}</p>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-900" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            Select Workers' Attendance Week:
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {Array.from({ length: activeQuarter.totalLessonWeeks }, (_, i) => i + 1).map((w) => {
            const isSelected = selectedWeek === w;
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? 'bg-amber-900 text-white font-black shadow-xs ring-2 ring-amber-900/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Week {w}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Lesson Preview */}
      {currentLesson && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-black text-amber-950 uppercase tracking-wide">
              Week {selectedWeek} Preparatory Lesson:
            </span>
            <span className="text-slate-600 font-bold">Scripture: {currentLesson.scriptureReading}</span>
          </div>
          <p className="text-slate-900 font-bold text-sm">{currentLesson.topic}</p>
          <p className="text-slate-600 italic">Aim: {currentLesson.aim}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('PREP_ATTENDANCE')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            activeTab === 'PREP_ATTENDANCE'
              ? 'bg-amber-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BookCheck className="w-3.5 h-3.5" />
          <span>Week {selectedWeek} Preparatory Class Register</span>
        </button>

        <button
          onClick={() => setActiveTab('WORKERS_ROSTER')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
            activeTab === 'WORKERS_ROSTER'
              ? 'bg-amber-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>General Workers Roster ({totalWorkers})</span>
        </button>
      </div>

      {/* Tab 1: Preparatory Class Attendance */}
      {activeTab === 'PREP_ATTENDANCE' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Preparatory Class & Teachers Attendance (Week {selectedWeek})
              </h3>
              <p className="text-xs text-slate-500">
                Marking preparatory class attendance, syllabus preparedness, and Sunday teaching duty.
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search worker name or class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Worker / Teacher Name</th>
                  <th className="px-3 py-3">Assigned Class & Dept</th>
                  <th className="px-3 py-3 text-center">Prep Class Rehearsal</th>
                  <th className="px-3 py-3 text-center">Sunday Teaching Attendance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.map((worker) => (
                  <tr key={worker.teacherId} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{worker.teacherName}</span>
                        {worker.isHeadTeacher && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            Head Teacher
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">{worker.phone}</div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-800">{worker.assignedClass}</div>
                      <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
                        {worker.department}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleTogglePrep(worker.teacherId)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 ${
                          worker.prepClassAttended
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {worker.prepClassAttended ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Attended Prep</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Missed Prep</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        {(['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleToggleAttendance(worker.teacherId, st)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                              worker.attendance === st
                                ? st === 'PRESENT'
                                  ? 'bg-emerald-800 text-white'
                                  : st === 'ABSENT'
                                  ? 'bg-rose-800 text-white'
                                  : 'bg-amber-700 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        Active Teacher
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Roster */}
      {activeTab === 'WORKERS_ROSTER' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
            Sunday School Teachers Roster by Class
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allClasses.map((cls) => (
              <div key={cls.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                    {cls.department}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {cls.teachers.length} Teacher(s)
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900">{cls.className}</h4>
                <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
                  {cls.teachers.map((t, idx) => (
                    <p key={idx} className="text-slate-700 font-medium">
                      • <strong>{t.name}</strong> {t.phone && `(${t.phone})`} {t.isHeadTeacher && <span className="text-amber-800 font-bold text-[10px]">[Head]</span>}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
