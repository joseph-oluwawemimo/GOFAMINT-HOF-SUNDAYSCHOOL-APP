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
  Calendar,
  ClipboardList,
  FileCheck,
  Award,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Printer,
  Download,
  Info
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
import {
  isMemberStudentAtWeek,
  getEffectiveStudentActivationWeek,
  normalizeDepartmentName
} from '../../utils/calculations';
import { DEFAULT_DEPARTMENTS } from '../../data/mockQuarterLessons';
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

export type DepartmentSuperintendentTab =
  | 'OVERSIGHT'
  | 'RECORD_OFFICER_LENS'
  | 'ENROLLMENT_OFFICER_LENS';

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

  // Active Supervisory Perspective Tab
  const [activeTab, setActiveTab] = useState<DepartmentSuperintendentTab>('OVERSIGHT');

  // Quarter & Week selection
  const activeQuarterNumber = sundaySchoolYear?.activeQuarterNumber || 1;
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(activeQuarterNumber);
  const activeQuarterData = (sundaySchoolYear?.quarters || []).find(q => q.quarterNumber === selectedQuarter) || {
    totalLessonWeeks: 12,
    lessons: []
  };

  const latestCompletedSunday = getLatestCompletedSundayWeek(activeQuarterData);
  const [selectedWeek, setSelectedWeek] = useState<number>(latestCompletedSunday || 1);

  // Inspection mode state for deep-dive read-only view
  const [inspectedClass, setInspectedClass] = useState<ClassProfile | null>(null);

  // Synchronized Approved Departments list
  const approvedDepartments = useMemo(() => {
    const list = Array.isArray(sundaySchoolYear?.departments) && sundaySchoolYear.departments.length > 0
      ? sundaySchoolYear.departments
      : DEFAULT_DEPARTMENTS;
    const normalized = list.map(d => normalizeDepartmentName(d, list));
    return Array.from(new Set(normalized)).sort();
  }, [sundaySchoolYear?.departments]);

  // Initial department assignment resolution
  const assignedDept = currentAdmin.departmentId
    ? normalizeDepartmentName(currentAdmin.departmentId, approvedDepartments)
    : (approvedDepartments[0] || 'Adult');

  const [selectedDepartment, setSelectedDepartment] = useState<string>(assignedDept);

  // Sync selectedDepartment when currentAdmin profile changes
  useEffect(() => {
    if (currentAdmin.departmentId) {
      const normalized = normalizeDepartmentName(currentAdmin.departmentId, approvedDepartments);
      setSelectedDepartment(normalized);
    }
  }, [currentAdmin.departmentId, approvedDepartments]);

  // Supervised classes strictly under selectedDepartment
  const departmentClasses = useMemo(() => {
    const selLower = selectedDepartment.toLowerCase();
    return allClasses.filter(c => {
      // 1. Direct department check
      const normalizedClassDept = normalizeDepartmentName(c.department, approvedDepartments);
      if (normalizedClassDept.toLowerCase() === selLower) return true;

      // 2. Class name heuristic check (e.g. "Youth A", "Youth B", "Youth C")
      const fromClassName = normalizeDepartmentName(c.className, approvedDepartments);
      if (fromClassName.toLowerCase() === selLower) return true;

      // 3. Substring check if department is in class name (e.g. c.className includes 'youth')
      const nameLower = (c.className || '').toLowerCase();
      if (selLower === 'youth' && (nameLower.includes('youth') || nameLower.includes('teen') || nameLower.includes('young adult'))) {
        return true;
      }
      if (selLower === 'children' && (nameLower.includes('child') || nameLower.includes('junior') || nameLower.includes('primary') || nameLower.includes('cradle'))) {
        return true;
      }
      if (selLower === 'adult' && (nameLower.includes('adult') || nameLower.includes('elder') || nameLower.includes('senior'))) {
        return true;
      }

      return false;
    });
  }, [allClasses, selectedDepartment, approvedDepartments]);

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

  // Resolve members historically belonging to this department in selectedWeek
  const deptMembersInWeek = useMemo(() => {
    return members.filter(m => {
      const hist = getStudentClassForWeek(m, selectedWeek);
      const effectiveClassId = hist.classId || m.classId;
      if (!effectiveClassId) return false;
      const targetClass = allClasses.find(c => c.id === effectiveClassId);
      if (!targetClass) return false;
      const normDept = normalizeDepartmentName(targetClass.department, approvedDepartments);
      return normDept.toLowerCase() === selectedDepartment.toLowerCase();
    });
  }, [members, selectedWeek, selectedDepartment, allClasses, approvedDepartments]);

  const activeDeptMembers = useMemo(() => {
    return deptMembersInWeek.filter(
      m => !['LEFT_CLASS', 'DEPARTED', 'ARCHIVED'].includes(String(m.status || '').toUpperCase())
    );
  }, [deptMembersInWeek]);

  // STRICT HISTORICAL INDEPENDENCE:
  // Under no circumstance is any converted visitor a student in Weeks 1, 2, or 3.
  const students = useMemo(
    () => activeDeptMembers.filter(m => isMemberStudentAtWeek(m, selectedWeek)),
    [activeDeptMembers, selectedWeek]
  );
  const visitors = useMemo(
    () => activeDeptMembers.filter(m => !isMemberStudentAtWeek(m, selectedWeek)),
    [activeDeptMembers, selectedWeek]
  );
  const newVisitors = useMemo(
    () => visitors.filter(m => (m.firstLessonWeek || 1) === selectedWeek),
    [visitors, selectedWeek]
  );
  const newlyEnrolled = useMemo(
    () => students.filter(m => getEffectiveStudentActivationWeek(m) === selectedWeek),
    [students, selectedWeek]
  );

  // Department Attendance for selected week
  const deptGradesInWeek = useMemo(() => {
    return grades.filter(
      g => (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
           g.weekNumber === selectedWeek &&
           departmentClassIds.has(g.classId) &&
           !g.isNoRecordWeek
    );
  }, [grades, selectedQuarter, selectedWeek, departmentClassIds]);

  const studentPresent = students.filter(m => {
    const g = deptGradesInWeek.find(grd => grd.memberId === m.id);
    return g && g.attendance === 'PRESENT';
  }).length;
  const studentAbsent = Math.max(0, students.length - studentPresent);

  const visitorPresent = visitors.filter(m => {
    const g = deptGradesInWeek.find(grd => grd.memberId === m.id);
    return g && g.attendance === 'PRESENT';
  }).length;
  const visitorAbsent = Math.max(0, visitors.length - visitorPresent);

  const presentCount = studentPresent + visitorPresent;
  const absentCount = studentAbsent + visitorAbsent;
  const totalCount = students.length + visitors.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Department Welfare & Follow-Up Oversight
  const deptAbsenceLogs = useMemo(() => {
    return absenceLogs.filter(
      l => (l.quarterNumber === undefined || l.quarterNumber === selectedQuarter) &&
           l.weekNumber === selectedWeek &&
           l.classId && departmentClassIds.has(l.classId)
    );
  }, [absenceLogs, selectedQuarter, selectedWeek, departmentClassIds]);

  const pendingFollowUpCount = Math.max(0, absentCount - deptAbsenceLogs.length);
  const followUpFidelity = absentCount > 0 ? Math.round((deptAbsenceLogs.length / absentCount) * 100) : 100;

  // Department Offering for selected week
  const deptOfferingsInWeek = useMemo(() => {
    return offerings.filter(
      o => (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter) &&
           o.weekNumber === selectedWeek &&
           departmentClassIds.has(o.classId) &&
           !o.isNoRecordWeek
    );
  }, [offerings, selectedQuarter, selectedWeek, departmentClassIds]);

  const totalOffering = deptOfferingsInWeek.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  // Transfers involving this department
  const deptTransfers = useMemo(() => {
    return transfers.filter(
      t => (t.destinationDepartment?.toLowerCase() === selectedDepartment.toLowerCase() ||
            t.previousDepartment?.toLowerCase() === selectedDepartment.toLowerCase())
    );
  }, [transfers, selectedDepartment]);

  // Multi-Class Trajectory Calculation across 12 Weeks (for comparative chart)
  const multiClass12WeekTrajectory = useMemo(() => {
    const totalWeeks = activeQuarterData.totalLessonWeeks || 12;
    return Array.from({ length: totalWeeks }, (_, i) => {
      const wk = i + 1;
      const classBreakdown: Record<string, { present: number; rate: number; total: number }> = {};
      let totalDeptPresent = 0;
      let totalDeptMembers = 0;

      departmentClasses.forEach(cls => {
        // Members historically in this class at week wk
        const clsMems = members.filter(m => {
          const hist = getStudentClassForWeek(m, wk);
          return (hist.classId === cls.id || (!hist.classId && m.classId === cls.id)) &&
                 !['LEFT_CLASS', 'DEPARTED', 'ARCHIVED'].includes(String(m.status || '').toUpperCase());
        });
        const clsGrades = grades.filter(
          g => (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
               g.weekNumber === wk &&
               g.classId === cls.id &&
               !g.isNoRecordWeek
        );
        const present = clsGrades.filter(g => g.attendance === 'PRESENT').length;
        const total = clsMems.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        classBreakdown[cls.id] = { present, rate, total };

        totalDeptPresent += present;
        totalDeptMembers += total;
      });

      return {
        week: wk,
        totalDeptPresent,
        totalDeptMembers,
        deptRate: totalDeptMembers > 0 ? Math.round((totalDeptPresent / totalDeptMembers) * 100) : 0,
        classBreakdown
      };
    });
  }, [activeQuarterData, departmentClasses, members, grades, selectedQuarter]);

  // Class Color Palette for multi-class comparison chart
  const classColors = [
    { stroke: '#4318ff', fill: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50 border-indigo-200' },
    { stroke: '#059669', fill: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50 border-emerald-200' },
    { stroke: '#d97706', fill: 'bg-amber-600', text: 'text-amber-600', light: 'bg-amber-50 border-amber-200' },
    { stroke: '#dc2626', fill: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50 border-rose-200' },
    { stroke: '#7c3aed', fill: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50 border-purple-200' },
    { stroke: '#0891b2', fill: 'bg-cyan-600', text: 'text-cyan-600', light: 'bg-cyan-50 border-cyan-200' },
  ];

  // Automated Data Interpretation & Strategic Insights
  const automatedInsights = useMemo(() => {
    // 1. Identify Top Performing Class
    let topClass: { cls: ClassProfile; rate: number; present: number; total: number } | null = null;
    let volatileClass: { cls: ClassProfile; rate: number; drop: number } | null = null;

    departmentClasses.forEach(cls => {
      const clsMems = activeDeptMembers.filter(m => m.classId === cls.id);
      const clsGrades = deptGradesInWeek.filter(g => g.classId === cls.id);
      const present = clsGrades.filter(g => g.attendance === 'PRESENT').length;
      const rate = clsMems.length > 0 ? Math.round((present / clsMems.length) * 100) : 0;

      if (!topClass || rate > topClass.rate) {
        topClass = { cls, rate, present, total: clsMems.length };
      }

      // Check drop from previous week
      if (selectedWeek > 1) {
        const prevWk = multiClass12WeekTrajectory[selectedWeek - 2]?.classBreakdown[cls.id];
        if (prevWk && prevWk.rate > rate) {
          const drop = prevWk.rate - rate;
          if (!volatileClass || drop > volatileClass.drop) {
            volatileClass = { cls, rate, drop };
          }
        }
      }
    });

    // 2. Visitor Consistency Pipeline Status
    const consistentVisitors = visitors.filter(v => {
      const vGrades = grades.filter(
        g => g.memberId === v.id &&
             (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
             g.weekNumber <= selectedWeek &&
             g.attendance === 'PRESENT' &&
             !g.isNoRecordWeek
      );
      return vGrades.length >= 2;
    });

    const readyForConversion = visitors.filter(v => {
      const vGrades = grades.filter(
        g => g.memberId === v.id &&
             (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
             g.weekNumber <= selectedWeek &&
             g.attendance === 'PRESENT' &&
             !g.isNoRecordWeek
      );
      return vGrades.length >= 3;
    });

    // 3. Strategic Directives for Department Superintendent
    const strategicDirectives: { title: string; desc: string; priority: 'HIGH' | 'MEDIUM' | 'OPPORTUNITY' }[] = [];

    if (pendingFollowUpCount > 0) {
      strategicDirectives.push({
        title: 'Mobilize Pastoral Follow-Up',
        desc: `${pendingFollowUpCount} absent learner(s) in Week ${selectedWeek} have not yet received logged welfare contact. Dispatch phone check-in assignments to teachers.`,
        priority: 'HIGH'
      });
    }

    if (readyForConversion.length > 0) {
      strategicDirectives.push({
        title: 'Promote Consistent Visitors to Studentship',
        desc: `${readyForConversion.length} visitor(s) in this department have completed the 3-week consistency quota and are ready for official Enrollment Officer certification (studentship activates next week).`,
        priority: 'OPPORTUNITY'
      });
    }

    if (volatileClass && volatileClass.drop >= 15) {
      strategicDirectives.push({
        title: `Intervene in ${volatileClass.cls.className}`,
        desc: `Attendance in this class fell by ${volatileClass.drop}% compared to last week. Schedule a briefing with the teacher-in-charge to understand underlying causes.`,
        priority: 'HIGH'
      });
    }

    if (newVisitors.length > 0) {
      strategicDirectives.push({
        title: 'New Visitor Assimilation Protocol',
        desc: `+${newVisitors.length} new visitor(s) joined this week. Pair them with church members and teachers to sustain their 3-week streak toward studentship.`,
        priority: 'MEDIUM'
      });
    }

    return {
      topClass,
      volatileClass,
      consistentVisitors,
      readyForConversion,
      strategicDirectives
    };
  }, [departmentClasses, activeDeptMembers, deptGradesInWeek, selectedWeek, multiClass12WeekTrajectory, visitors, grades, selectedQuarter, pendingFollowUpCount, newVisitors]);

  // Visitor consistency streak details for Enrollment Officer Lens
  const visitorStreakDetails = useMemo(() => {
    return visitors.map(v => {
      const vGrades = grades.filter(
        g => g.memberId === v.id &&
             (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
             g.weekNumber <= selectedWeek &&
             g.attendance === 'PRESENT' &&
             !g.isNoRecordWeek
      );
      const totalVisits = vGrades.length;
      const targetClass = departmentClasses.find(c => c.id === v.classId);
      const isReady = totalVisits >= 3;
      return {
        member: v,
        className: targetClass?.name || targetClass?.className || 'Class',
        totalVisits,
        isReady,
        streakLabel: isReady ? '3 of 3 (Ready for Studentship)' : `${totalVisits} of 3 visits`,
        status: v.conversionStatus || (isReady ? 'QUALIFIED' : 'IN_PROGRESS')
      };
    });
  }, [visitors, grades, selectedQuarter, selectedWeek, departmentClasses]);

  return (
    <div className="space-y-6 text-slate-900 pb-16">
      
      {/* 1. Header Banner - Departmental Superintendent Branding */}
      <section className="rounded-3xl border-2 border-indigo-400/40 bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-400/20 border border-indigo-400/40 rounded-full text-xs font-black text-indigo-300 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Departmental Superintendent Directorate • Oversight Authority</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              {selectedDepartment} Departmental Superintendent
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Superintendent: <strong>{currentAdmin.profileName}</strong> • Direct oversight across all {departmentClasses.length} class(es), multi-class comparative analytics, attendance integrity, and member progression in the {selectedDepartment} Department.
            </p>
          </div>

          {/* Department Selector (Synchronized with 3 approved departments) */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 space-y-1.5 shrink-0">
            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Department in View:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-indigo-900 text-white font-bold text-xs px-3 py-2 rounded-xl border border-indigo-400/50 focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {approvedDepartments.map(dept => (
                <option key={dept} value={dept} className="bg-slate-900 text-white">
                  {dept} Department
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Read-Only Inspection Mode Notice */}
        <div className="mt-4 pt-4 border-t border-indigo-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-300">INSPECTION & OVERSIGHT ACTIVE</span>
            <span>— Segregated to {selectedDepartment} Department ({departmentClasses.length} Classes).</span>
          </div>
          <span className="font-mono text-[11px] text-amber-300">Evaluation: Week {selectedWeek} (Completed: Wk {latestCompletedSunday || 1})</span>
        </div>
      </section>

      {/* 2. Supervisory Perspectives (3 Specialized Lenses) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab('OVERSIGHT')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'OVERSIGHT'
              ? 'bg-[#320b86] text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Superintendent Oversight & Multi-Class Comparison</span>
        </button>

        <button
          onClick={() => setActiveTab('RECORD_OFFICER_LENS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'RECORD_OFFICER_LENS'
              ? 'bg-[#320b86] text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Record Officer Collation Lens</span>
        </button>

        <button
          onClick={() => setActiveTab('ENROLLMENT_OFFICER_LENS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'ENROLLMENT_OFFICER_LENS'
              ? 'bg-[#320b86] text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Enrollment Officer Visitor Pipeline Lens</span>
          {automatedInsights.readyForConversion.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
              {automatedInsights.readyForConversion.length} Qualified
            </span>
          )}
        </button>
      </div>

      {/* 3. Evaluation Week Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#320b86]" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            Selected Evaluation Week:
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#320b86] text-white font-black shadow-xs ring-2 ring-[#320b86]/30'
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

      {/* ========================================================================= */}
      {/* PERSPECTIVE 1: SUPERINTENDENT OVERSIGHT & MULTI-CLASS COMPARISON          */}
      {/* ========================================================================= */}
      {activeTab === 'OVERSIGHT' && (
        <div className="space-y-6">

          {/* Department KPI Metric Cards */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Supervised Classes</span>
                <Building2 className="w-4 h-4 text-[#320b86]" />
              </div>
              <div className="text-2xl font-black text-slate-900">{departmentClasses.length} Units</div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">
                {departmentClasses.map(c => c.name || c.className).join(', ') || 'No classes'}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-xs">
              <div className="flex items-center justify-between text-blue-900 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Members (Wk {selectedWeek})</span>
                <Users className="w-4 h-4 text-blue-700" />
              </div>
              <div className="text-2xl font-black text-blue-950">{activeDeptMembers.length}</div>
              <p className="text-[10px] text-blue-800 mt-1 font-bold">
                {students.length} Students • {visitors.length} Visitors
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs">
              <div className="flex items-center justify-between text-emerald-900 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Attendance Rate (Wk {selectedWeek})</span>
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-black text-emerald-950">{attendanceRate}%</div>
              <p className="text-[10px] text-emerald-800 mt-1 font-bold">
                {presentCount} Present • {absentCount} Absent
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
              <div className="flex items-center justify-between text-amber-900 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Follow-Up Fidelity</span>
                <PhoneCall className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-2xl font-black text-amber-950">{followUpFidelity}%</div>
              <p className="text-[10px] text-amber-800 mt-1 font-bold">
                {deptAbsenceLogs.length} Contacted • {pendingFollowUpCount} Pending
              </p>
            </div>
          </div>

          {/* MULTI-CLASS COMPARATIVE 12-WEEK TRAJECTORY GRAPH */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#320b86]" />
                  <span>Multi-Class Comparative 12-Week Trajectory Graph</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct pattern comparison: see how Class A compares with Class B across all 12 weeks of Quarter {selectedQuarter}.
                </p>
              </div>

              {/* Class Legend */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {departmentClasses.map((cls, idx) => {
                  const color = classColors[idx % classColors.length];
                  return (
                    <span key={cls.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 font-bold text-slate-800 text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                      <span>{cls.name || cls.className}</span>
                    </span>
                  );
                })}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 font-black text-[#320b86] text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#320b86]" />
                  <span>Dept Total</span>
                </span>
              </div>
            </div>

            {/* Visual SVG Multi-Line & Bar Chart */}
            <div className="pt-2">
              <div className="grid grid-cols-12 gap-1.5 sm:gap-2 h-56 items-end border-b border-slate-200 pb-2">
                {multiClass12WeekTrajectory.map((point) => {
                  const isCur = point.week === selectedWeek;
                  const maxPossiblePresent = Math.max(1, Math.max(...multiClass12WeekTrajectory.map(p => p.totalDeptPresent)));
                  const deptHeightPercent = Math.min(100, Math.round((point.totalDeptPresent / maxPossiblePresent) * 100));

                  return (
                    <div
                      key={point.week}
                      onClick={() => setSelectedWeek(point.week)}
                      className={`h-full flex flex-col justify-end items-center group cursor-pointer relative p-1 rounded-xl transition ${
                        isCur ? 'bg-purple-50 ring-2 ring-[#320b86]/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 bg-slate-900 text-white text-[10px] p-2.5 rounded-xl shadow-xl min-w-[150px] pointer-events-none">
                        <strong className="block text-amber-300 border-b border-slate-700 pb-1 mb-1">
                          Week {point.week} Breakdown
                        </strong>
                        <div className="space-y-0.5">
                          <div className="flex justify-between">
                            <span>Dept Total:</span>
                            <span className="font-bold text-emerald-400">{point.totalDeptPresent} Present ({point.deptRate}%)</span>
                          </div>
                          {departmentClasses.map((cls, idx) => {
                            const b = point.classBreakdown[cls.id];
                            return (
                              <div key={cls.id} className="flex justify-between text-slate-300">
                                <span className="truncate max-w-[90px]">{cls.name || cls.className}:</span>
                                <span className="font-bold">{b?.present || 0} ({b?.rate || 0}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Multi-Bar Columns for each class */}
                      <div className="w-full flex items-end justify-center gap-1 h-44">
                        {departmentClasses.map((cls, idx) => {
                          const b = point.classBreakdown[cls.id];
                          const maxClassPres = Math.max(1, Math.max(...multiClass12WeekTrajectory.map(p => p.classBreakdown[cls.id]?.present || 0)));
                          const barHeight = Math.max(6, Math.min(100, Math.round(((b?.present || 0) / maxClassPres) * 100)));
                          const color = classColors[idx % classColors.length];

                          return (
                            <div
                              key={cls.id}
                              style={{ height: `${barHeight}%`, backgroundColor: color.stroke }}
                              className="w-2 sm:w-2.5 rounded-t-sm transition-all group-hover:brightness-110"
                              title={`${cls.name || cls.className}: ${b?.present || 0} Present`}
                            />
                          );
                        })}
                      </div>

                      {/* Week Label */}
                      <span className={`text-[10px] mt-1 font-bold ${isCur ? 'text-[#320b86] font-black' : 'text-slate-500'}`}>
                        W{point.week}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CLASS-BY-CLASS COMPARATIVE BREAKDOWN CARDS */}
          <div className="space-y-3">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#320b86]" />
              <span>Comparative Performance of Classes under {selectedDepartment} Department (Week {selectedWeek})</span>
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departmentClasses.map((cls, idx) => {
                const clsMembers = activeDeptMembers.filter(m => m.classId === cls.id);
                const clsStudents = clsMembers.filter(m => isMemberStudentAtWeek(m, selectedWeek));
                const clsVisitors = clsMembers.filter(m => !isMemberStudentAtWeek(m, selectedWeek));

                const clsGrades = deptGradesInWeek.filter(g => g.classId === cls.id);
                const clsPresent = clsGrades.filter(g => g.attendance === 'PRESENT').length;
                const clsAbsent = clsGrades.filter(g => g.attendance === 'ABSENT').length;
                const rate = clsMembers.length > 0 ? Math.round((clsPresent / clsMembers.length) * 100) : 0;

                const clsLogs = deptAbsenceLogs.filter(l => l.classId === cls.id);
                const clsPendingFollowUps = Math.max(0, clsAbsent - clsLogs.length);

                const clsOffering = offerings.find(
                  o => o.classId === cls.id && o.weekNumber === selectedWeek &&
                       (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                );

                const color = classColors[idx % classColors.length];

                return (
                  <div key={cls.id} className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-[#320b86] transition">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.stroke }} />
                          <h4 className="font-black text-base text-slate-900">{cls.name || cls.className}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Teacher: <strong>{cls.teachers?.[0]?.name || 'Teacher Assigned'}</strong>
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        rate >= 80 ? 'bg-emerald-100 text-emerald-800' : rate >= 50 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rate}% Att.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Active Learners</span>
                        <strong className="text-slate-900 text-sm">{clsMembers.length} Members</strong>
                        <span className="text-[10px] text-slate-500 block">{clsStudents.length} Students • {clsVisitors.length} Visitors</span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Attendance Status</span>
                        <strong className="text-emerald-700 text-sm">{clsPresent} Present</strong>
                        <span className="text-[10px] text-slate-500 block">{clsAbsent} Absent</span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Follow-Up Gap</span>
                        <strong className={clsPendingFollowUps > 0 ? 'text-amber-800 text-sm' : 'text-emerald-700 text-sm'}>
                          {clsPendingFollowUps > 0 ? `${clsPendingFollowUps} Uncontacted` : 'All Reached'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">{clsLogs.length} logs completed</span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Offering Remitted</span>
                        <strong className="text-slate-900 text-sm">
                          ₦{clsOffering ? Number(clsOffering.amount).toLocaleString() : '0'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">{clsOffering?.remittanceStatus || 'Unrecorded'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectedClass(cls)}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-indigo-700" />
                      <span>Inspect {cls.name || cls.className} Register</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AUTOMATED DATA INTERPRETATION & STRATEGIC INSIGHTS ("WHAT THIS DEPARTMENT NEEDS NEXT") */}
          <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/60 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-[#320b86] text-[10px] font-black uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#320b86]" />
                  <span>Superintendent Cognitive Intelligence Engine</span>
                </div>
                <h3 className="font-black text-base text-slate-900">
                  Data Interpretation & Action Directives: What this Department Needs Next
                </h3>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Card 1: Top Performing Class */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span className="font-black text-xs uppercase tracking-wider">Top Performing Class</span>
                </div>
                {automatedInsights.topClass ? (
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      {automatedInsights.topClass.cls.name || automatedInsights.topClass.cls.className}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Highest attendance consistency this week at <strong>{automatedInsights.topClass.rate}%</strong> ({automatedInsights.topClass.present} of {automatedInsights.topClass.total} present).
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No attendance data yet.</p>
                )}
              </div>

              {/* Card 2: Volatility / At-Risk Warning */}
              <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-rose-800">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span className="font-black text-xs uppercase tracking-wider">Class Volatility Alert</span>
                </div>
                {automatedInsights.volatileClass ? (
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      {automatedInsights.volatileClass.cls.name || automatedInsights.volatileClass.cls.className}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Attendance dropped by <strong>{automatedInsights.volatileClass.drop}%</strong> compared to last week. Needs immediate teacher debrief.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 font-bold">Stable attendance trajectory across all department classes.</p>
                )}
              </div>

              {/* Card 3: Visitor Consistency & Conversion Milestone */}
              <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <UserCheck className="w-5 h-5 text-amber-600" />
                  <span className="font-black text-xs uppercase tracking-wider">Visitor Progression</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {automatedInsights.readyForConversion.length} Qualified for Studentship
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {automatedInsights.consistentVisitors.length} visitor(s) are on an active 2+ streak. {automatedInsights.readyForConversion.length} have completed the 3-week quota.
                  </p>
                </div>
              </div>
            </div>

            {/* Strategic Action Directives */}
            <div className="pt-2 border-t border-indigo-100 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Recommended Superintendent Action Points for Upcoming Sunday:
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {automatedInsights.strategicDirectives.map((dir, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5 text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                      dir.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : dir.priority === 'OPPORTUNITY' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {dir.priority}
                    </span>
                    <div>
                      <strong className="text-slate-900 block">{dir.title}</strong>
                      <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">{dir.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSPECTIVE 2: RECORD OFFICER COLLATION LENS                              */}
      {/* ========================================================================= */}
      {activeTab === 'RECORD_OFFICER_LENS' && (
        <div className="space-y-6">

          {/* Mathematical Balance Banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="text-emerald-950 font-black block">
                  Department Mathematical Balancing Verified (Week {selectedWeek}, Quarter {selectedQuarter})
                </strong>
                <span className="text-emerald-800">
                  Total Members ({totalCount}) = Students ({students.length}) + Visitors ({visitors.length}) | Present ({presentCount}) + Absent ({absentCount}) = Total ({totalCount})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Record</span>
              </button>
            </div>
          </div>

          {/* Department Weekly Collation Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#320b86]" />
                  <span>{selectedDepartment} Department Weekly Class Register Collation (Week {selectedWeek})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standard Record Officer collation grid for all classes in this department. Converted visitors remain 100% visitors in Weeks 1–3.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#320b86] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Class Name</th>
                    <th className="p-3">Teacher in Charge</th>
                    <th className="p-3 text-center bg-blue-900/60">Total Students</th>
                    <th className="p-3 text-center bg-blue-900/60">Student Present</th>
                    <th className="p-3 text-center bg-blue-900/60">Student Absent</th>
                    <th className="p-3 text-center bg-purple-900/60">Total Visitors</th>
                    <th className="p-3 text-center bg-purple-900/60">Visitor Present</th>
                    <th className="p-3 text-center bg-purple-900/60">Visitor Absent</th>
                    <th className="p-3 text-center bg-emerald-900/60">Total Present</th>
                    <th className="p-3 text-center bg-rose-900/60">Total Absent</th>
                    <th className="p-3 text-center bg-slate-800">Total Members</th>
                    <th className="p-3 text-right">Offering</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentClasses.map((cls) => {
                    const clsMems = activeDeptMembers.filter(m => m.classId === cls.id);
                    const clsStudents = clsMems.filter(m => isMemberStudentAtWeek(m, selectedWeek));
                    const clsVisitors = clsMems.filter(m => !isMemberStudentAtWeek(m, selectedWeek));

                    const clsGrades = deptGradesInWeek.filter(g => g.classId === cls.id);
                    const sp = clsStudents.filter(m => clsGrades.some(g => g.memberId === m.id && g.attendance === 'PRESENT')).length;
                    const sa = Math.max(0, clsStudents.length - sp);

                    const vp = clsVisitors.filter(m => clsGrades.some(g => g.memberId === m.id && g.attendance === 'PRESENT')).length;
                    const va = Math.max(0, clsVisitors.length - vp);

                    const tp = sp + vp;
                    const ta = sa + va;
                    const tm = clsMems.length;

                    const clsOff = offerings.find(
                      o => o.classId === cls.id && o.weekNumber === selectedWeek &&
                           (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                    );

                    return (
                      <tr key={cls.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-900">{cls.name || cls.className}</td>
                        <td className="p-3 text-slate-600">{cls.teachers?.[0]?.name || 'Teacher'}</td>
                        <td className="p-3 text-center font-bold text-blue-950 bg-blue-50/40">{clsStudents.length}</td>
                        <td className="p-3 text-center text-emerald-700 font-bold bg-blue-50/40">{sp}</td>
                        <td className="p-3 text-center text-slate-500 bg-blue-50/40">{sa}</td>
                        <td className="p-3 text-center font-bold text-purple-950 bg-purple-50/40">{clsVisitors.length}</td>
                        <td className="p-3 text-center text-purple-800 font-bold bg-purple-50/40">{vp}</td>
                        <td className="p-3 text-center text-slate-500 bg-purple-50/40">{va}</td>
                        <td className="p-3 text-center font-black text-emerald-800 bg-emerald-50/40">{tp}</td>
                        <td className="p-3 text-center text-rose-700 bg-rose-50/40">{ta}</td>
                        <td className="p-3 text-center font-black text-slate-950 bg-slate-50">{tm}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ₦{clsOff ? Number(clsOff.amount).toLocaleString() : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                  <tr>
                    <td className="p-3" colSpan={2}>Department Grand Totals ({departmentClasses.length} Classes)</td>
                    <td className="p-3 text-center text-amber-300">{students.length}</td>
                    <td className="p-3 text-center text-emerald-400">{studentPresent}</td>
                    <td className="p-3 text-center text-slate-300">{studentAbsent}</td>
                    <td className="p-3 text-center text-amber-300">{visitors.length}</td>
                    <td className="p-3 text-center text-emerald-400">{visitorPresent}</td>
                    <td className="p-3 text-center text-slate-300">{visitorAbsent}</td>
                    <td className="p-3 text-center text-emerald-400">{presentCount}</td>
                    <td className="p-3 text-center text-rose-400">{absentCount}</td>
                    <td className="p-3 text-center text-amber-300">{totalCount}</td>
                    <td className="p-3 text-right text-amber-300">₦{totalOffering.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSPECTIVE 3: ENROLLMENT OFFICER VISITOR PIPELINE LENS                   */}
      {/* ========================================================================= */}
      {activeTab === 'ENROLLMENT_OFFICER_LENS' && (
        <div className="space-y-6">

          {/* Department Intake Pipeline Cards */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Active Visitors</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{visitors.length}</div>
              <p className="text-[10px] text-slate-500 mt-0.5">Currently progressing in {selectedDepartment}</p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-xs">
              <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">First-Time Visitors (Wk {selectedWeek})</span>
              <div className="text-2xl font-black text-purple-950 mt-1">+{newVisitors.length}</div>
              <p className="text-[10px] text-purple-700 mt-0.5">New intake starting Lesson {selectedWeek}</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">Newly Enrolled Students (Wk {selectedWeek})</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">+{newlyEnrolled.length}</div>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                {selectedWeek <= 3 ? '0 enrolled (starts Week 4+)' : 'Officially activated as students'}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Ready for Conversion</span>
              <div className="text-2xl font-black text-amber-950 mt-1">{automatedInsights.readyForConversion.length}</div>
              <p className="text-[10px] text-amber-800 mt-0.5">Achieved 3-week consistency quota</p>
            </div>
          </div>

          {/* Visitor Consistency & Consecutive Visit Tracker Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#320b86]" />
                  <span>Visitor Consistency Streak Tracker ({visitorStreakDetails.length} Active Visitors)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track visitor progress toward the 3-week consistency milestone for official studentship.
                </p>
              </div>
            </div>

            {visitorStreakDetails.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic">
                No visitors currently registered in {selectedDepartment} Department.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Visitor Name</th>
                      <th className="p-3">Assigned Class</th>
                      <th className="p-3 text-center">First Joined</th>
                      <th className="p-3 text-center">Attendance Streak</th>
                      <th className="p-3 text-center">Consistency Status</th>
                      <th className="p-3 text-center">Next Step</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visitorStreakDetails.map((item) => (
                      <tr key={item.member.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <strong className="text-slate-900 block">{item.member.fullName}</strong>
                          <span className="text-[10px] text-slate-500">{item.member.phone || 'No phone'}</span>
                        </td>
                        <td className="p-3 text-slate-700 font-semibold">{item.className}</td>
                        <td className="p-3 text-center text-slate-500">Week {item.member.firstLessonWeek || 1}</td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {[1, 2, 3].map((st) => (
                              <span
                                key={st}
                                className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-black ${
                                  item.totalVisits >= st
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {item.totalVisits >= st ? '✓' : st}
                              </span>
                            ))}
                            <span className="ml-1 text-[11px] font-bold text-slate-700">{item.streakLabel}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {item.isReady ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                              Consistency Completed
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              {3 - item.totalVisits} visit(s) needed
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.isReady ? (
                            <span className="text-emerald-700 font-bold text-[11px]">
                              Awaiting Enrollment Officer review for Week {Math.max(4, selectedWeek + 1)} activation
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              Maintain Sunday attendance
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Department Transfers Log */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>Department Student Transfers ({deptTransfers.length} Total Records)</span>
            </h3>

            {deptTransfers.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No transfers recorded for this department.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
                {deptTransfers.map(t => (
                  <div key={t.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <strong className="text-slate-900">{t.memberName || t.studentName}</strong>
                      <div className="text-[10px] text-slate-500">
                        {t.previousClassName || t.fromClassName} → {t.destinationClassName || t.toClassName} (Effective Week {t.effectiveWeekNumber || t.effectiveWeek || 1})
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
      )}

      {/* ========================================================================= */}
      {/* 4. CLASS READ-ONLY INSPECTION MODAL                                       */}
      {/* ========================================================================= */}
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
              {/* Modal Header */}
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
                          <th className="p-2.5">Type (Wk {selectedWeek})</th>
                          <th className="p-2.5 text-center">Attendance</th>
                          <th className="p-2.5 text-right">Lesson Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clsMembers.map((m) => {
                          const g = clsGrades.find(grd => grd.memberId === m.id);
                          const isStudent = isMemberStudentAtWeek(m, selectedWeek);
                          return (
                            <tr key={m.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900">{m.fullName}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  isStudent ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'
                                }`}>
                                  {isStudent ? 'STUDENT' : 'VISITOR'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  g?.attendance === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {g?.attendance || 'ABSENT'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-900">
                                {g?.lessonTotal ?? 0} pts
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setInspectedClass(null)}
                    className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Close Inspection
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
