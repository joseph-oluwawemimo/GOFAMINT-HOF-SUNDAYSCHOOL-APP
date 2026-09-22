import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  BarChart3,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Eye,
  Search,
  Filter,
  UserCheck,
  PhoneCall,
  Coins,
  TrendingUp,
  X,
  Sparkles,
  Calendar
} from 'lucide-react';
import {
  getAllGrades,
  getAllMembers,
  getAllAbsenceLogs,
  getAllOfferings,
  getAllStudentTransfers,
  getStudentClassForWeek
} from '../../db/indexedDB';
import {
  isSundayRegisterOpenForWeek,
  getLatestCompletedSundayWeek,
  getActiveSundayRegisterWeek
} from '../../utils/quarterScheduleUtils';
import type {
  AdminProfile,
  ClassProfile,
  Member,
  SundaySchoolYear,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  WeeklyOfferingRecord,
  StudentTransferRecord,
  QuarterNumber
} from '../../types';

interface Props {
  currentAdmin: AdminProfile;
  allClasses: ClassProfile[];
  sundaySchoolYear: SundaySchoolYear;
}

export const DepartmentSuperintendentView: React.FC<Props> = ({
  currentAdmin,
  allClasses,
  sundaySchoolYear
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [grades, setGrades] = useState<WeeklyGradeRecord[]>([]);
  const [absenceLogs, setAbsenceLogs] = useState<AbsenceLogRecord[]>([]);
  const [offerings, setOfferings] = useState<WeeklyOfferingRecord[]>([]);
  const [transfers, setTransfers] = useState<StudentTransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Quarter & Week selection
  const activeQuarterNumber = sundaySchoolYear.activeQuarterNumber || 1;
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(activeQuarterNumber);
  const activeQuarterData = (sundaySchoolYear.quarters || []).find(q => q.quarterNumber === selectedQuarter) || {
    totalLessonWeeks: 12,
    lessons: []
  };

  // Follow-up & Active week intelligence (Phase 1 & Phase 14)
  const latestCompletedSunday = getLatestCompletedSundayWeek(activeQuarterData);
  const [selectedWeek, setSelectedWeek] = useState<number>(latestCompletedSunday || 1);

  // Inspection mode state (Phase 14.2 & 14.6)
  const [inspectedClass, setInspectedClass] = useState<ClassProfile | null>(null);

  // Department determination: support staff profile departmentId or fallback to available
  const rawDept = String(currentAdmin.departmentId || '').trim();
  const availableDepts = useMemo(() => {
    const list = Array.from(new Set(allClasses.map(c => String(c.department || '').trim()).filter(Boolean)));
    return list.length > 0 ? list : ['Adult', 'Youth', 'Intermediate', 'Junior', 'Children'];
  }, [allClasses]);

  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    rawDept && availableDepts.includes(rawDept) ? rawDept : (availableDepts[0] || 'Adult')
  );

  const departmentClasses = useMemo(
    () => allClasses.filter(c => String(c.department || '').trim().toLowerCase() === selectedDepartment.toLowerCase()),
    [allClasses, selectedDepartment]
  );

  const departmentClassIds = useMemo(
    () => new Set(departmentClasses.map(c => c.id)),
    [departmentClasses]
  );

  // Load all live database records
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allMems, allGrd, allAbs, allOff, allTrf] = await Promise.all([
        getAllMembers(),
        getAllGrades(),
        getAllAbsenceLogs(),
        getAllOfferings(),
        getAllStudentTransfers()
      ]);
      setMembers(allMems);
      setGrades(allGrd);
      setAbsenceLogs(allAbs);
      setOfferings(allOff);
      setTransfers(allTrf);
      setLoadError(null);
    } catch (err: any) {
      console.error('[Department Superintendent] Failed to load data:', err);
      setLoadError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDepartment, selectedQuarter, selectedWeek]);

  // Phase 10.5 & 10.7: Historically resolve members who belonged to this department in selectedWeek
  const deptMembersInWeek = useMemo(() => {
    return members.filter(m => {
      const hist = getStudentClassForWeek(m, selectedWeek);
      if (hist.department) {
        return hist.department.toLowerCase() === selectedDepartment.toLowerCase();
      }
      return m.classId ? departmentClassIds.has(m.classId) : false;
    });
  }, [members, selectedWeek, selectedDepartment, departmentClassIds]);

  const activeDeptMembers = deptMembersInWeek.filter(
    m => !['LEFT_CLASS', 'DEPARTED', 'ARCHIVED'].includes(String(m.status || '').toUpperCase())
  );
  const students = activeDeptMembers.filter(m => m.memberType === 'STUDENT');
  const visitors = activeDeptMembers.filter(m => m.memberType === 'VISITOR');
  const newVisitors = visitors.filter(m => (m.firstLessonWeek || 1) === selectedWeek);
  const newlyEnrolled = students.filter(m => m.convertedFromVisitorAtLesson === selectedWeek);

  // Department Attendance for selected week
  const deptGradesInWeek = useMemo(() => {
    return grades.filter(
      g => (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
           g.weekNumber === selectedWeek &&
           departmentClassIds.has(g.classId) &&
           !g.isNoRecordWeek
    );
  }, [grades, selectedQuarter, selectedWeek, departmentClassIds]);

  const presentCount = deptGradesInWeek.filter(g => g.attendance === 'PRESENT').length;
  const absentCount = deptGradesInWeek.filter(g => g.attendance === 'ABSENT').length;
  const attendanceRate = deptGradesInWeek.length > 0 ? Math.round((presentCount / deptGradesInWeek.length) * 100) : 0;

  // Department Follow-Up Oversight (Phase 14.4)
  const deptAbsenceLogs = useMemo(() => {
    return absenceLogs.filter(
      l => (l.quarterNumber === undefined || l.quarterNumber === selectedQuarter) &&
           l.weekNumber === selectedWeek &&
           l.classId && departmentClassIds.has(l.classId)
    );
  }, [absenceLogs, selectedQuarter, selectedWeek, departmentClassIds]);

  const pendingFollowUpCount = Math.max(0, absentCount - deptAbsenceLogs.length);

  // Phase 14.8: Transfers involving this department
  const deptTransfers = useMemo(() => {
    return transfers.filter(
      t => (t.destinationDepartment?.toLowerCase() === selectedDepartment.toLowerCase() ||
            t.previousDepartment?.toLowerCase() === selectedDepartment.toLowerCase())
    );
  }, [transfers, selectedDepartment]);

  const transfersIn = deptTransfers.filter(
    t => t.destinationDepartment?.toLowerCase() === selectedDepartment.toLowerCase() && t.status === 'APPROVED'
  );
  const transfersOut = deptTransfers.filter(
    t => t.previousDepartment?.toLowerCase() === selectedDepartment.toLowerCase() && t.status === 'APPROVED'
  );

  // Phase 14.9: Attention Required Exceptions
  const attentionExceptions = useMemo(() => {
    const list: { type: 'REGISTER' | 'FOLLOWUP' | 'SCORES' | 'TRANSFERS'; classId?: string; className: string; message: string; urgency: 'HIGH' | 'MEDIUM' }[] = [];

    departmentClasses.forEach(cls => {
      const clsGrades = deptGradesInWeek.filter(g => g.classId === cls.id);
      const clsPresent = clsGrades.filter(g => g.attendance === 'PRESENT');
      const clsAbsent = clsGrades.filter(g => g.attendance === 'ABSENT');
      const clsAbsLogs = deptAbsenceLogs.filter(l => l.classId === cls.id);

      // Check register completion
      if (clsGrades.length === 0) {
        list.push({
          type: 'REGISTER',
          classId: cls.id,
          className: cls.name || cls.className,
          message: `Register not yet entered for Week ${selectedWeek}.`,
          urgency: 'HIGH'
        });
      }

      // Check missing scores among present students (Phase 5.1 & Phase 14.9)
      const missingScores = clsPresent.filter(g => g.lessonTotal === undefined || g.lessonTotal === null || Number.isNaN(Number(g.lessonTotal)));
      if (missingScores.length > 0) {
        list.push({
          type: 'SCORES',
          classId: cls.id,
          className: cls.name || cls.className,
          message: `${missingScores.length} student(s) marked Present have missing required scores.`,
          urgency: 'HIGH'
        });
      }

      // Check high pending follow-ups
      const unlogged = clsAbsent.length - clsAbsLogs.length;
      if (unlogged > 3) {
        list.push({
          type: 'FOLLOWUP',
          classId: cls.id,
          className: cls.name || cls.className,
          message: `${unlogged} absent members have unlogged follow-up welfare actions.`,
          urgency: 'MEDIUM'
        });
      }
    });

    // Check pending transfers
    const pendingTrfs = deptTransfers.filter(t => t.status === 'PENDING');
    if (pendingTrfs.length > 0) {
      list.push({
        type: 'TRANSFERS',
        className: `${selectedDepartment} Department`,
        message: `${pendingTrfs.length} pending transfer request(s) awaiting Enrollment Officer action.`,
        urgency: 'MEDIUM'
      });
    }

    return list;
  }, [departmentClasses, deptGradesInWeek, deptAbsenceLogs, deptTransfers, selectedWeek, selectedDepartment]);

  return (
    <div className="space-y-6 text-slate-900">
      
      {/* Header Banner - Distinct Role Aesthetics */}
      <section className="rounded-3xl border-2 border-indigo-400/40 bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-400/20 border border-indigo-400/40 rounded-full text-xs font-black text-indigo-300 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Departmental Superintendent Directorate • Oversight Portfolio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              {selectedDepartment} Departmental Superintendent
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Superintendent: <strong>{currentAdmin.profileName}</strong> • Overseeing all classes, attendance records, member progression, and follow-up fidelity across the {selectedDepartment} Department.
            </p>
          </div>

          {/* Department Selector (if multiple available) */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 space-y-1.5 shrink-0">
            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Department in View:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-indigo-900 text-white font-bold text-xs px-3 py-2 rounded-xl border border-indigo-400/50 focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {availableDepts.map(dept => (
                <option key={dept} value={dept} className="bg-slate-900 text-white">
                  {dept} Department
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inspection Mode Indicator Banner (Phase 14.6) */}
        <div className="mt-4 pt-4 border-t border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-300">INSPECTION MODE ACTIVE</span>
            <span>— Read-Only Portfolio (Records outside {selectedDepartment} are segregated; class registers cannot be modified from this view).</span>
          </div>
          <span className="font-mono text-[11px] text-amber-300">Basis: Week {selectedWeek} (Latest Completed: Wk {latestCompletedSunday})</span>
        </div>
      </section>

      {/* Week Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-900" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            Select Evaluation Lesson Week:
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {Array.from({ length: activeQuarterData.totalLessonWeeks || 12 }, (_, i) => i + 1).map((w) => {
            const isSelected = selectedWeek === w;
            const isOpen = isSundayRegisterOpenForWeek(activeQuarterData, w);
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? 'bg-indigo-900 text-white font-black shadow-xs ring-2 ring-indigo-900/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Week {w}</span>
                {w === latestCompletedSunday && (
                  <span className="px-1 py-0.2 bg-amber-300 text-amber-950 rounded text-[9px] font-black">
                    Completed
                  </span>
                )}
                {!isOpen && (
                  <span className="text-[9px] text-slate-400">🔒</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Department analytics failed to load: {loadError}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. HOW ARE MY CLASSES DOING? (PHASE 14.1 MY DEPARTMENT) */}
      {/* ========================================================= */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>1. How Are My Classes Doing? — My Department Overview</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold">{departmentClasses.length} Overseen Classes</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overseen Classes</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{departmentClasses.length}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">{departmentClasses.map(c => c.name || c.className).join(', ') || 'No classes'}</p>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
            <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">Total Members (Week {selectedWeek})</span>
            <div className="text-2xl font-black text-indigo-950 mt-1">{activeDeptMembers.length}</div>
            <p className="text-[10px] text-indigo-700 mt-0.5 font-bold">{students.length} Students • {visitors.length} Visitors</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">Attendance Rate</span>
            <div className="text-2xl font-black text-emerald-950 mt-1">{attendanceRate}%</div>
            <p className="text-[10px] text-emerald-700 mt-0.5 font-bold">{presentCount} Present • {absentCount} Absent</p>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 shadow-xs">
            <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">New Growth (Week {selectedWeek})</span>
            <div className="text-2xl font-black text-purple-950 mt-1">+{newVisitors.length + newlyEnrolled.length}</div>
            <p className="text-[10px] text-purple-700 mt-0.5 font-bold">{newVisitors.length} New Visitors • {newlyEnrolled.length} Converted</p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. WHO NEEDS ATTENTION? (PHASE 14.9 ATTENTION REQUIRED) */}
      {/* ========================================================= */}
      <div className="rounded-3xl border-2 border-amber-300 bg-amber-50/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-black text-sm uppercase tracking-wider text-amber-950">
              2. Who Needs Attention? — Operational Exceptions Panel
            </h3>
          </div>
          <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 font-black rounded-full text-xs">
            {attentionExceptions.length} Issue(s) Detected
          </span>
        </div>

        {attentionExceptions.length === 0 ? (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All classes in {selectedDepartment} Department have completed registers, complete scores, and active follow-up actions for Week {selectedWeek}!</span>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {attentionExceptions.map((exc, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start gap-3 bg-white shadow-2xs ${
                  exc.urgency === 'HIGH' ? 'border-rose-300' : 'border-amber-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${exc.urgency === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-2">
                    <strong className="font-black text-slate-900">{exc.className}</strong>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                      exc.urgency === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {exc.type}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">{exc.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. ARE MY CLASSES FOLLOWING UP? (PHASE 14.4) */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-teal-600" />
              <span>3. Are My Classes Following Up? — Welfare & Absenteeism Fidelity</span>
            </h3>
            <p className="text-xs text-slate-500">
              Evaluating which classes are consistently reaching out to absent learners.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-teal-50 border border-teal-300 text-teal-900 font-bold rounded-xl">
              {deptAbsenceLogs.length} Completed Actions
            </span>
            <span className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-900 font-bold rounded-xl">
              {pendingFollowUpCount} Pending Follow-up
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departmentClasses.map((cls) => {
            const clsAbsents = deptGradesInWeek.filter(g => g.classId === cls.id && g.attendance === 'ABSENT').length;
            const clsLogs = deptAbsenceLogs.filter(l => l.classId === cls.id);
            const isFidelityGood = clsAbsents === 0 || clsLogs.length >= clsAbsents;

            return (
              <div key={cls.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-xs">{cls.name || cls.className}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isFidelityGood ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {isFidelityGood ? 'Fidelity Good' : 'Follow-up Needed'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Absent Learners:</span>
                    <strong className="text-slate-800">{clsAbsents}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Welfare Logged:</span>
                    <strong className="text-teal-700">{clsLogs.length}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. ARE MY CLASSES KEEPING RECORDS? (PHASE 14.5 CLASS RECORD COMPLETION) */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <span>4. Are My Classes Keeping Records Properly? — Class Register Fidelity</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live collation table of class register entries, attendance completion, and learner progression.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Class</th>
                <th className="p-3 text-center">Register Status</th>
                <th className="p-3 text-center">Attendance (Rate)</th>
                <th className="p-3 text-center">Follow-up</th>
                <th className="p-3 text-center">New Intake</th>
                <th className="p-3 text-center">Offering Status</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Inspection Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentClasses.map((cls) => {
                const clsGrades = deptGradesInWeek.filter(g => g.classId === cls.id);
                const clsPresent = clsGrades.filter(g => g.attendance === 'PRESENT').length;
                const clsAbsent = clsGrades.filter(g => g.attendance === 'ABSENT').length;
                const rate = clsGrades.length > 0 ? Math.round((clsPresent / clsGrades.length) * 100) : 0;
                const clsAbsLogs = deptAbsenceLogs.filter(l => l.classId === cls.id).length;
                const pendingFollowUps = Math.max(0, clsAbsent - clsAbsLogs);

                const clsMembers = activeDeptMembers.filter(m => m.classId === cls.id);
                const clsNewIntake = clsMembers.filter(m => (m.firstLessonWeek || 1) === selectedWeek).length;

                const clsOffering = offerings.find(
                  o => o.classId === cls.id && o.weekNumber === selectedWeek &&
                       (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                );

                const isComplete = clsGrades.length > 0;
                const overallStatus = isComplete && pendingFollowUps === 0 ? 'Good' : 'Attention';

                return (
                  <tr key={cls.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{cls.name || cls.className}</div>
                      <div className="text-[10px] text-slate-400">{cls.teachers?.[0]?.name || 'Teacher assigned'}</div>
                    </td>
                    <td className="p-3 text-center">
                      {isComplete ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                          Complete
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {rate}% ({clsPresent}P / {clsAbsent}A)
                    </td>
                    <td className="p-3 text-center">
                      {pendingFollowUps > 0 ? (
                        <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10px]">
                          {pendingFollowUps} pending
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[10px]">All followed up</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {clsNewIntake > 0 ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[10px]">
                          +{clsNewIntake} new
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        clsOffering?.remittanceStatus === 'AUDITED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : clsOffering?.remittanceStatus === 'REMITTED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {clsOffering?.remittanceStatus || 'Unrecorded'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                        overallStatus === 'Good' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {overallStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {/* Phase 14.2 & 14.6: Read-only Inspection */}
                      <button
                        type="button"
                        onClick={() => setInspectedClass(cls)}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. GROWTH & TRANSFERS OVERSIGHT (PHASE 14.7 & 14.8) */}
      {/* ========================================================= */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Growth Panel */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Departmental Growth & Learner Pipeline</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">First-Time Visitors</span>
              <span className="text-xl font-black text-slate-900">{newVisitors.length}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-emerald-900 font-bold uppercase block">Newly Enrolled Students</span>
              <span className="text-xl font-black text-emerald-900">{newlyEnrolled.length}</span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <span className="text-[10px] text-indigo-900 font-bold uppercase block">Transfers In</span>
              <span className="text-xl font-black text-indigo-900">+{transfersIn.length}</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[10px] text-rose-900 font-bold uppercase block">Transfers Out</span>
              <span className="text-xl font-black text-rose-900">-{transfersOut.length}</span>
            </div>
          </div>
        </div>

        {/* Transfer Oversight (Phase 14.8) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            <span>Transfer Oversight ({deptTransfers.length} Records)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Informational record of student movements affecting classes in {selectedDepartment}.
          </p>

          {deptTransfers.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No transfers recorded for this department.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
              {deptTransfers.map(t => (
                <div key={t.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900">{t.memberName || t.studentName}</strong>
                    <div className="text-[10px] text-slate-500">
                      {t.previousClassName || t.fromClassName} → {t.destinationClassName || t.toClassName} (Wk {t.effectiveWeekNumber || t.effectiveWeek || 1})
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CLASS INSPECTION MODAL (PHASE 14.2 & 14.6 INSPECTION MODE) */}
      {/* ========================================================= */}
      {inspectedClass && (() => {
        const clsGrades = deptGradesInWeek.filter(g => g.classId === inspectedClass.id);
        const clsMembers = activeDeptMembers.filter(m => m.classId === inspectedClass.id);
        const clsOffering = offerings.find(
          o => o.classId === inspectedClass.id && o.weekNumber === selectedWeek &&
               (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
            onClick={() => setInspectedClass(null)}
          >
            <div
              className="bg-white border-2 border-indigo-300 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Banner with Explicit Read-Only Notice */}
              <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white p-5 flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
                    <span>READ-ONLY INSPECTION MODE</span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-1">
                    {inspectedClass.name || inspectedClass.className}
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Department: {inspectedClass.department} • Week {selectedWeek}, Quarter {selectedQuarter}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedClass(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Class Summary Metrics */}
              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Class Members</span>
                    <strong className="text-lg font-black text-slate-900">{clsMembers.length}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Present in Wk {selectedWeek}</span>
                    <strong className="text-lg font-black text-emerald-700">
                      {clsGrades.filter(g => g.attendance === 'PRESENT').length}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Offering</span>
                    <strong className="text-lg font-black text-slate-900">
                      ₦{clsOffering ? Number(clsOffering.amount).toLocaleString() : '0'}
                    </strong>
                  </div>
                </div>

                {/* Individual Member Roster in Class (Read-Only) */}
                <div className="space-y-2">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider text-xs">
                    Class Attendance Register Roster ({clsMembers.length} Members)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Learner Name</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5 text-center">Attendance</th>
                          <th className="p-2.5 text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clsMembers.map(mem => {
                          const grade = clsGrades.find(g => g.memberId === mem.id);
                          return (
                            <tr key={mem.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900">{mem.fullName}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  mem.memberType === 'STUDENT' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {mem.memberType}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  grade?.attendance === 'PRESENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : grade?.attendance === 'ABSENT'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {grade?.attendance || 'UNRECORDED'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-black text-slate-800">
                                {grade?.attendance === 'PRESENT' ? `${grade.lessonTotal ?? 0}/50` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 italic">
                  <strong>Notice:</strong> As Departmental Superintendent, you are viewing this class register in read-only Inspection Mode. Teachers and Secretaries maintain entry privileges.
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectedClass(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
