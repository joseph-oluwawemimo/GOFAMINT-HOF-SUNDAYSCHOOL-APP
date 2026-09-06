import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Calendar,
  Users,
  CheckCircle2,
  BookOpen,
  Coins,
  Printer,
  Download,
  Search,
  Filter,
  Check,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Building,
  UserCheck,
  Sparkles,
  UserPlus,
  ArrowUpRight,
  Eye,
  X,
  Layers,
  Award,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import {
  AdminProfile,
  ClassProfile,
  SundaySchoolYear,
  RecordOfficerClassRow,
  RecordOfficerWeeklyCollation,
  QuarterNumber
} from '../../types';
import { getRealRecordOfficerCollation, getAllMembers, getAllGrades } from '../../db/indexedDB';
import { GofamintLogo } from '../GofamintLogo';

interface RecordOfficerViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
}

export const RecordOfficerView: React.FC<RecordOfficerViewProps> = ({
  currentAdmin,
  allClasses = [],
  sundaySchoolYear
}) => {
  const safeYear = sundaySchoolYear || {
    id: 'DEFAULT',
    yearName: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
    activeQuarterNumber: 1,
    quarters: [1, 2, 3, 4].map(q => ({
      id: `Q${q}`,
      quarterNumber: q as any,
      totalLessonWeeks: 12,
      lessons: []
    }))
  };
  const [selectedQuarter, setSelectedQuarter] = useState<number>(safeYear.activeQuarterNumber || 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'WEEKLY_COLLATION' | 'QUARTER_ANALYSIS'>('WEEKLY_COLLATION');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [collationData, setCollationData] = useState<RecordOfficerWeeklyCollation | null>(null);
  const [allQuarterCollations, setAllQuarterCollations] = useState<RecordOfficerWeeklyCollation[]>([]);
  const [allMembersList, setAllMembersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Class Register Inspection Modal State
  const [inspectedClassRow, setInspectedClassRow] = useState<RecordOfficerClassRow | null>(null);
  const [inspectedClassMembers, setInspectedClassMembers] = useState<any[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);

  const activeQuarterObj = (safeYear.quarters || []).find(q => q.quarterNumber === selectedQuarter) || safeYear.quarters?.[0] || { totalLessonWeeks: 12, lessons: [] };
  const totalWeeks = activeQuarterObj?.totalLessonWeeks || 12;
  const currentLesson = activeQuarterObj?.lessons?.find(l => l.weekNumber === selectedWeek);

  // Load real weekly collation data directly from Class Register records across current quarter
  const loadCollationData = async () => {
    setIsLoading(true);
    try {
      // Load current week & all members concurrently
      const [currentWeekData, allMembersResult] = await Promise.all([
        getRealRecordOfficerCollation(selectedQuarter, selectedWeek),
        getAllMembers()
      ]);
      setCollationData(currentWeekData);
      setAllMembersList(allMembersResult);

      // Load all weeks of the selected quarter in parallel for Quarter Analysis
      const weekPromises: Promise<RecordOfficerWeeklyCollation>[] = [];
      for (let w = 1; w <= totalWeeks; w++) {
        weekPromises.push(getRealRecordOfficerCollation(selectedQuarter, w));
      }
      const allWeeks = await Promise.all(weekPromises);
      setAllQuarterCollations(allWeeks);
    } catch (err) {
      console.error('Failed to load Record Officer collation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollationData();
  }, [selectedQuarter, selectedWeek]);

  // Handle Class Register Inspection
  const handleInspectClass = async (row: RecordOfficerClassRow) => {
    setIsInspecting(true);
    setInspectedClassRow(row);
    try {
      const allMems = await getAllMembers();
      const allGrades = await getAllGrades();
      const classMems = allMems.filter(m => m.classId === row.classId);

      const enriched = classMems.map(mem => {
        const qEnr = mem.quarterEnrollments?.[selectedQuarter as QuarterNumber];
        const firstWeek = qEnr?.firstLessonWeek || mem.firstLessonWeek || 1;
        const convertedWeek = mem.convertedFromVisitorAtLesson;

        const isExempt = selectedWeek < firstWeek;
        const grade = allGrades.find(
          g => g.classId === row.classId && g.quarterNumber === selectedQuarter && g.memberId === mem.id && g.weekNumber === selectedWeek
        );

        let memberType = qEnr?.memberType || mem.memberType;
        if (convertedWeek && convertedWeek > selectedWeek) {
          memberType = 'VISITOR';
        }

        const isNewVisitor = !isExempt && memberType === 'VISITOR' && firstWeek === selectedWeek;
        const gradeAttendance = isExempt
          ? 'EXEMPT'
          : (grade ? grade.attendance : 'UNRECORDED');

        return {
          ...mem,
          memberType,
          firstWeek,
          isExempt,
          isNewVisitor,
          gradeAttendance,
          lessonTotal: isExempt ? 0 : (grade ? grade.lessonTotal : 0)
        };
      });

      setInspectedClassMembers(enriched);
    } catch (err) {
      console.error('Failed to inspect class register:', err);
    } finally {
      setIsInspecting(false);
    }
  };

  const rows = collationData?.rows || [];

  // Filtered rows by department and search
  const filteredRows = rows.filter(r => {
    const q = (searchQuery || '').toLowerCase();
    const matchesDept = selectedDepartment === 'ALL' || r.department === selectedDepartment;
    const matchesSearch = (r.className || '').toLowerCase().includes(q) ||
                          (r.teachersInCharge || '').toLowerCase().includes(q) ||
                          (r.department || '').toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  // Calculate filtered totals
  const filteredStudentPresent = filteredRows.reduce((s, r) => s + r.studentPresent, 0);
  const filteredCurrentVisitorPresent = filteredRows.reduce((s, r) => s + r.currentVisitorPresent, 0);
  const filteredNewVisitors = filteredRows.reduce((s, r) => s + r.newVisitors, 0);
  const filteredClassMembersAbsent = filteredRows.reduce((s, r) => s + r.classMembersAbsent, 0);
  const filteredTotalPresent = filteredRows.reduce((s, r) => s + r.totalPresent, 0);
  const filteredRegisteredClassMembers = filteredRows.reduce((s, r) => s + r.registeredClassMembers, 0);
  const filteredOnboarded = filteredRows.reduce((s, r) => s + r.onboarded, 0);
  const filteredEndingActive = filteredRows.reduce((s, r) => s + r.endingActiveClassMembers, 0);
  const filteredOffering = filteredRows.reduce((s, r) => s + r.offering, 0);

  interface DepartmentSummary {
    department: string;
    classCount: number;
    studentPresent: number;
    currentVisitorPresent: number;
    newVisitors: number;
    classMembersAbsent: number;
    totalPresent: number;
    registeredClassMembers: number;
    onboarded: number;
    endingActiveClassMembers: number;
    offering: number;
  }

  // Department Summaries
  const departmentBreakdowns: DepartmentSummary[] = Object.values(
    rows.reduce((acc, r) => {
      if (!acc[r.department]) {
        acc[r.department] = {
          department: r.department,
          classCount: 0,
          studentPresent: 0,
          currentVisitorPresent: 0,
          newVisitors: 0,
          classMembersAbsent: 0,
          totalPresent: 0,
          registeredClassMembers: 0,
          onboarded: 0,
          endingActiveClassMembers: 0,
          offering: 0
        };
      }
      acc[r.department].classCount++;
      acc[r.department].studentPresent += r.studentPresent;
      acc[r.department].currentVisitorPresent += r.currentVisitorPresent;
      acc[r.department].newVisitors += r.newVisitors;
      acc[r.department].classMembersAbsent += r.classMembersAbsent;
      acc[r.department].totalPresent += r.totalPresent;
      acc[r.department].registeredClassMembers += r.registeredClassMembers;
      acc[r.department].onboarded += r.onboarded;
      acc[r.department].endingActiveClassMembers += r.endingActiveClassMembers;
      acc[r.department].offering += r.offering;
      return acc;
    }, {} as Record<string, DepartmentSummary>)
  );

  // Compute Quarter Analysis for the Selected Quarter (No Cross-Quarter Cumulative!)
  const quarterAnalysis = useMemo(() => {
    if (!allQuarterCollations || allQuarterCollations.length === 0) {
      return {
        totalStudentAttendance: 0,
        totalVisitorAttendance: 0,
        totalNewVisitors: 0,
        totalClassMembersAbsent: 0,
        totalAttendance: 0,
        avgWeeklyAttendance: 0,
        highestWeek: { weekNumber: 1, totalPresent: 0 },
        lowestWeek: { weekNumber: 1, totalPresent: 0 },
        totalOfferingRecorded: 0,
        weeklyTrends: [] as {
          weekNumber: number;
          studentPresent: number;
          visitorPresent: number;
          newVisitors: number;
          absent: number;
          totalPresent: number;
          offering: number;
          onboarded: number;
        }[],
        bestClass: null as any,
        lowestClass: null as any,
        mostImprovedClass: null as any,
        decliningClasses: [] as any[],
        incompleteRecordClasses: [] as any[],
        currentStudentPop: 0,
        currentVisitorPop: 0,
        totalOnboarded: 0
      };
    }

    let totalStudentAttendance = 0;
    let totalVisitorAttendance = 0;
    let totalNewVisitors = 0;
    let totalClassMembersAbsent = 0;
    let totalAttendance = 0;
    let totalOfferingRecorded = 0;
    let totalOnboarded = 0;

    const weeklyTrends = allQuarterCollations.map(wCol => {
      const wStd = wCol.totalStudentPresent;
      const wVis = wCol.totalCurrentVisitorPresent + wCol.totalNewVisitors;
      const wNewVis = wCol.totalNewVisitors;
      const wAbs = wCol.totalClassMembersAbsent;
      const wTot = wCol.grandTotalPresent;
      const wOff = wCol.totalOffering;
      const wOnb = wCol.totalOnboarded;

      totalStudentAttendance += wStd;
      totalVisitorAttendance += wVis;
      totalNewVisitors += wNewVis;
      totalClassMembersAbsent += wAbs;
      totalAttendance += wTot;
      totalOfferingRecorded += wOff;
      totalOnboarded += wOnb;

      return {
        weekNumber: wCol.weekNumber,
        studentPresent: wStd,
        visitorPresent: wVis,
        newVisitors: wNewVis,
        absent: wAbs,
        totalPresent: wTot,
        offering: wOff,
        onboarded: wOnb
      };
    });

    const nonZeroWeeks = weeklyTrends.filter(w => w.totalPresent > 0);
    const avgWeeklyAttendance = nonZeroWeeks.length > 0 ? Math.round(totalAttendance / nonZeroWeeks.length) : 0;
    const avgWeeklyStudents = nonZeroWeeks.length > 0 ? Math.round(totalStudentAttendance / nonZeroWeeks.length) : 0;
    const avgWeeklyVisitors = nonZeroWeeks.length > 0 ? Math.round(totalVisitorAttendance / nonZeroWeeks.length) : 0;

    const registeredStudentPopulation = allMembersList.filter(
      m => m.memberType === 'STUDENT' && m.status === 'ACTIVE'
    ).length;
    const activeVisitorPopulation = allMembersList.filter(
      m => m.memberType === 'VISITOR' && m.status === 'ACTIVE'
    ).length;

    let highestWeek = weeklyTrends[0] || { weekNumber: 1, totalPresent: 0 };
    let lowestWeek = nonZeroWeeks[0] || weeklyTrends[0] || { weekNumber: 1, totalPresent: 0 };

    for (const wt of weeklyTrends) {
      if (wt.totalPresent > highestWeek.totalPresent) highestWeek = wt;
      if (wt.totalPresent > 0 && wt.totalPresent < lowestWeek.totalPresent) lowestWeek = wt;
    }

    // Class performance collation across all quarter weeks
    const classAggregates: Record<string, {
      classId: string;
      className: string;
      department: string;
      totalPresent: number;
      studentPresent: number;
      visitorPresent: number;
      offering: number;
      week1Present: number;
      latestPresent: number;
      missingWeeksCount: number;
    }> = {};

    allQuarterCollations.forEach(wCol => {
      wCol.rows.forEach(r => {
        if (!classAggregates[r.classId]) {
          classAggregates[r.classId] = {
            classId: r.classId,
            className: r.className,
            department: r.department,
            totalPresent: 0,
            studentPresent: 0,
            visitorPresent: 0,
            offering: 0,
            week1Present: 0,
            latestPresent: 0,
            missingWeeksCount: 0
          };
        }
        classAggregates[r.classId].totalPresent += r.totalPresent;
        classAggregates[r.classId].studentPresent += r.studentPresent;
        classAggregates[r.classId].visitorPresent += (r.currentVisitorPresent + r.newVisitors);
        classAggregates[r.classId].offering += r.offering;
        if (wCol.weekNumber === 1) {
          classAggregates[r.classId].week1Present = r.totalPresent;
        }
        if (wCol.weekNumber === selectedWeek) {
          classAggregates[r.classId].latestPresent = r.totalPresent;
        }
        if (r.totalPresent === 0 && r.offering === 0) {
          classAggregates[r.classId].missingWeeksCount++;
        }
      });
    });

    const classList = Object.values(classAggregates);
    const sortedByAttendance = [...classList].sort((a, b) => b.totalPresent - a.totalPresent);
    const bestClass = sortedByAttendance[0] || null;
    const lowestClass = sortedByAttendance.filter(c => c.totalPresent > 0)[sortedByAttendance.filter(c => c.totalPresent > 0).length - 1] || sortedByAttendance[sortedByAttendance.length - 1] || null;

    const mostImprovedClass = [...classList]
      .filter(c => c.week1Present > 0 && c.latestPresent > c.week1Present)
      .sort((a, b) => (b.latestPresent - b.week1Present) - (a.latestPresent - a.week1Present))[0] || null;

    const decliningClasses = classList
      .filter(c => c.week1Present > 0 && c.latestPresent < c.week1Present)
      .sort((a, b) => (a.latestPresent - a.week1Present) - (b.latestPresent - b.week1Present));

    const incompleteRecordClasses = classList.filter(c => c.missingWeeksCount > 0);

    return {
      totalStudentAttendance,
      totalVisitorAttendance,
      totalNewVisitors,
      totalClassMembersAbsent,
      totalAttendance,
      avgWeeklyAttendance,
      avgWeeklyStudents,
      avgWeeklyVisitors,
      registeredStudentPopulation,
      activeVisitorPopulation,
      highestWeek,
      lowestWeek,
      totalOfferingRecorded,
      weeklyTrends,
      bestClass,
      lowestClass,
      mostImprovedClass,
      decliningClasses,
      incompleteRecordClasses,
      currentStudentPop: registeredStudentPopulation,
      currentVisitorPop: activeVisitorPopulation,
      totalOnboarded
    };
  }, [allQuarterCollations, selectedWeek, collationData, allMembersList]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Class Name',
      'Department',
      'Teachers in Charge',
      'Student Present',
      'Current Visitor Present',
      'New Visitors',
      'Class Members Absent',
      'Total Present',
      'Registered Class Members',
      'Onboarded',
      'Ending Active Members',
      'Offering (NGN)'
    ];

    const dataRows = filteredRows.map(r => [
      `"${r.className}"`,
      `"${r.department}"`,
      `"${r.teachersInCharge}"`,
      r.studentPresent,
      r.currentVisitorPresent,
      r.newVisitors,
      r.classMembersAbsent,
      r.totalPresent,
      r.registeredClassMembers,
      r.onboarded,
      r.endingActiveClassMembers,
      r.offering
    ]);

    // Grand Totals Row
    const totalsRow = [
      '"GRAND TOTAL (ALL CLASSES)"',
      '""',
      '""',
      filteredStudentPresent,
      filteredCurrentVisitorPresent,
      filteredNewVisitors,
      filteredClassMembersAbsent,
      filteredTotalPresent,
      filteredRegisteredClassMembers,
      filteredOnboarded,
      filteredEndingActive,
      filteredOffering
    ];

    const csvContent = [headers.join(','), ...dataRows.map(row => row.join(',')), totalsRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GOFAMINT_HOF_Record_Officer_Week_${selectedWeek}_Q${selectedQuarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const departmentsList = ['ALL', ...Array.from(new Set(allClasses.map(c => c.department).filter(Boolean)))];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-indigo-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-400/20 border border-indigo-400/50 rounded-full text-xs font-black text-indigo-300 uppercase tracking-wider">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Record Officer Directorate • Real Class Register Collation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Weekly Sunday Bible School Record & Collation
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Officer in Charge: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Collecting weekly returns live from every Class Register, ensuring unified mathematical consistency and accurate attendance collation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-amber-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Collation Sheet</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-blue-700 hover:bg-blue-600 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl w-fit border border-slate-300 shadow-inner">
        <button
          onClick={() => setActiveTab('WEEKLY_COLLATION')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'WEEKLY_COLLATION'
              ? 'bg-indigo-950 text-amber-300 shadow-md ring-1 ring-indigo-800'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Weekly Class Collation</span>
        </button>

        <button
          onClick={() => setActiveTab('QUARTER_ANALYSIS')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'QUARTER_ANALYSIS'
              ? 'bg-indigo-950 text-amber-300 shadow-md ring-1 ring-indigo-800'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Quarter Analysis (Q{selectedQuarter})</span>
        </button>
      </div>

      {activeTab === 'WEEKLY_COLLATION' ? (
        <>
          {/* Control Bar: Quarter, Week, Department, and Search Selectors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        
        {/* Quarter & Lesson Details Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          
          {/* Quarter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quarter:</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map(qNum => (
                <button
                  key={qNum}
                  onClick={() => setSelectedQuarter(qNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    selectedQuarter === qNum
                      ? 'bg-indigo-900 text-amber-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Quarter {qNum} {sundaySchoolYear.activeQuarterNumber === qNum && '★'}
                </button>
              ))}
            </div>
          </div>

          {/* Current Lesson Summary */}
          {currentLesson && (
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-indigo-700 block">
                Week {selectedWeek} Lesson Theme:
              </span>
              <span className="text-xs font-bold text-slate-800">
                {currentLesson.topic} ({currentLesson.date})
              </span>
            </div>
          )}
        </div>

        {/* Week Selector Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Select Week ({totalWeeks} Weeks in Quarter {selectedQuarter}):</span>
            </span>
            <span className="text-xs font-black text-indigo-950">Active Week: Week {selectedWeek}</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition shrink-0 cursor-pointer ${
                  selectedWeek === w
                    ? 'bg-blue-900 text-white shadow-md ring-2 ring-blue-900/30'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>

        {/* Department Filter & Search Input */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          <div className="sm:col-span-5 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer"
            >
              {departmentsList.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'ALL' ? 'All Departments' : `Department: ${dept}`}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by class name, teacher, or department..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Highlights Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Present</span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{filteredStudentPresent}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Enrolled Learners</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Visitor Present</span>
          <h3 className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">{filteredCurrentVisitorPresent}</h3>
          <p className="text-[11px] text-indigo-500 mt-0.5">Existing Visitors</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Visitors</span>
          <h3 className="text-xl sm:text-2xl font-black text-purple-700 mt-1">{filteredNewVisitors}</h3>
          <p className="text-[11px] text-purple-500 mt-0.5">First-Time Visitors</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Members Absent</span>
          <h3 className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{filteredClassMembersAbsent}</h3>
          <p className="text-[11px] text-rose-500 mt-0.5">Existing Absentees</p>
        </div>

        <div className="bg-indigo-900 text-white p-4 rounded-2xl border border-indigo-800 shadow-xs">
          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">Total Present</span>
          <h3 className="text-xl sm:text-2xl font-black text-amber-300 mt-1">{filteredTotalPresent}</h3>
          <p className="text-[11px] text-indigo-200 mt-0.5">Formula: Std + Vis + New</p>
        </div>

        <div className="bg-emerald-900 text-white p-4 rounded-2xl border border-emerald-800 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Total Offering</span>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-200 mt-1">₦{filteredOffering.toLocaleString()}</h3>
          <p className="text-[11px] text-emerald-300 mt-0.5">Week {selectedWeek} Offering</p>
        </div>
      </div>

      {/* Main Weekly Collation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Weekly Class Collation Table (Week {selectedWeek}, Q{selectedQuarter})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Direct live collation from individual Class Registers. Total Present = Student Present + Current Visitor Present + New Visitors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
              Reporting Classes: <strong>{filteredRows.length}</strong>
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p>Collating live Class Register returns...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="font-bold text-slate-700">No class records found for Week {selectedWeek}, Quarter {selectedQuarter}.</p>
            <p className="text-slate-400">Class secretaries submit their attendance and offering directly through their Class Registers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="p-3.5 pl-4 border-b border-slate-800">Class & Department</th>
                  <th className="p-3.5 text-center border-b border-slate-800 bg-slate-800/80">Student Present</th>
                  <th className="p-3.5 text-center border-b border-slate-800">Current Visitor Present</th>
                  <th className="p-3.5 text-center border-b border-slate-800">New Visitors</th>
                  <th className="p-3.5 text-center border-b border-slate-800">Class Members Absent</th>
                  <th className="p-3.5 text-center border-b border-slate-800 bg-indigo-900/90 text-amber-300">Total Present</th>
                  <th className="p-3.5 text-center border-b border-slate-800">Registered Class Members</th>
                  <th className="p-3.5 text-center border-b border-slate-800">Onboarded</th>
                  <th className="p-3.5 text-right border-b border-slate-800">Offering</th>
                  <th className="p-3.5 pr-4 text-center border-b border-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRows.map((row, idx) => (
                  <tr key={row.classId || idx} className="hover:bg-indigo-50/40 transition">
                    <td className="p-3.5 pl-4">
                      <div className="font-black text-slate-900 text-xs">{row.className}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{row.department} • {row.teachersInCharge}</div>
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-800 bg-slate-50/50">
                      {row.studentPresent}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-indigo-700">
                      {row.currentVisitorPresent}
                    </td>
                    <td className="p-3.5 text-center font-bold text-purple-700">
                      {row.newVisitors > 0 ? (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-black">
                          +{row.newVisitors}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-rose-700">
                      {row.classMembersAbsent}
                    </td>
                    <td className="p-3.5 text-center font-black text-indigo-950 bg-indigo-50/80 text-sm">
                      {row.totalPresent}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-800">
                      {row.registeredClassMembers}
                    </td>
                    <td className="p-3.5 text-center font-bold text-teal-700">
                      {row.onboarded > 0 ? (
                        <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-black">
                          {row.onboarded}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-700">
                      ₦{row.offering.toLocaleString()}
                    </td>
                    <td className="p-3.5 pr-4 text-center">
                      <button
                        onClick={() => handleInspectClass(row)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 text-indigo-900 rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                        title="View Class Register Roster"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Grand Totals Footer */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                  <td className="p-4 pl-4 uppercase tracking-wider text-amber-300">
                    Grand Totals ({filteredRows.length} Classes)
                  </td>
                  <td className="p-4 text-center bg-slate-800 text-white">
                    {filteredStudentPresent}
                  </td>
                  <td className="p-4 text-center text-indigo-300">
                    {filteredCurrentVisitorPresent}
                  </td>
                  <td className="p-4 text-center text-purple-300">
                    {filteredNewVisitors}
                  </td>
                  <td className="p-4 text-center text-rose-300">
                    {filteredClassMembersAbsent}
                  </td>
                  <td className="p-4 text-center bg-indigo-950 text-amber-300 text-sm font-black">
                    {filteredTotalPresent}
                  </td>
                  <td className="p-4 text-center text-slate-200">
                    {filteredRegisteredClassMembers}
                  </td>
                  <td className="p-4 text-center text-teal-300">
                    {filteredOnboarded}
                  </td>
                  <td className="p-4 text-right text-emerald-300 text-sm">
                    ₦{filteredOffering.toLocaleString()}
                  </td>
                  <td className="p-4 pr-4 text-center text-slate-400 text-[10px]">
                    Unified Record
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Growth & Membership Movement Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Overall Sunday Bible School Movement Card */}
        <div className="lg:col-span-1 bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
              Directorate Growth Matrix
            </span>
            <h3 className="text-lg font-black text-white font-['Cinzel',serif]">
              Membership Movement Summary
            </h3>
            <p className="text-xs text-slate-400">
              Calculated across all Sunday Bible School classes for Week {selectedWeek}.
            </p>
          </div>

          <div className="space-y-3 divide-y divide-slate-800 text-xs">
            <div className="flex items-center justify-between pt-2">
              <span className="text-slate-400">Beginning Class Members:</span>
              <span className="font-black text-white">{filteredRegisteredClassMembers}</span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <span className="text-slate-400">New Visitors Arrived:</span>
              <span className="font-black text-purple-400">+{filteredNewVisitors}</span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <span className="text-slate-400">New Visitors Onboarded:</span>
              <span className="font-black text-teal-400">+{filteredOnboarded}</span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <span className="text-slate-400">Class Absentees:</span>
              <span className="font-black text-rose-400">{filteredClassMembersAbsent}</span>
            </div>

            <div className="flex items-center justify-between pt-3 text-sm font-black bg-indigo-950/60 p-3 rounded-xl border border-indigo-800/50">
              <span className="text-indigo-200">Ending Active Class Members:</span>
              <span className="text-amber-300">{filteredEndingActive}</span>
            </div>
          </div>
        </div>

        {/* Departmental Collation Summaries */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Departmental Collation Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500">
                Collation subtotals for each active department in Sunday Bible School.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {departmentBreakdowns.length} Departments
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-black text-[11px] uppercase">
                  <th className="p-2.5 pl-3 rounded-l-lg">Department</th>
                  <th className="p-2.5 text-center">Classes</th>
                  <th className="p-2.5 text-center">Std Present</th>
                  <th className="p-2.5 text-center">Vis Present</th>
                  <th className="p-2.5 text-center">New Vis</th>
                  <th className="p-2.5 text-center">Total Present</th>
                  <th className="p-2.5 text-right pr-3 rounded-r-lg">Offering</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {departmentBreakdowns.map((dept, i) => (
                  <tr key={dept.department || i} className="hover:bg-slate-50">
                    <td className="p-2.5 pl-3 font-black text-slate-900">{dept.department}</td>
                    <td className="p-2.5 text-center font-bold text-slate-600">{dept.classCount}</td>
                    <td className="p-2.5 text-center font-semibold">{dept.studentPresent}</td>
                    <td className="p-2.5 text-center text-indigo-700 font-semibold">{dept.currentVisitorPresent}</td>
                    <td className="p-2.5 text-center text-purple-700 font-bold">{dept.newVisitors}</td>
                    <td className="p-2.5 text-center font-black text-indigo-950 bg-indigo-50/60">{dept.totalPresent}</td>
                    <td className="p-2.5 text-right pr-3 font-black text-emerald-700">₦{dept.offering.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        </>
      ) : (
        /* QUARTER ANALYSIS TAB */
        <div className="space-y-6">
          
          {/* Quarter Switcher Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">
                Directorate Executive Audit
              </span>
              <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                Quarter {selectedQuarter} Comprehensive Attendance & Performance Analysis
              </h2>
              <p className="text-xs text-slate-500">
                12-week comprehensive collation isolated strictly to Quarter {selectedQuarter} (no cross-quarter data bleed).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Select Quarter:</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map(qNum => (
                  <button
                    key={qNum}
                    onClick={() => setSelectedQuarter(qNum)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      selectedQuarter === qNum
                        ? 'bg-indigo-900 text-amber-300 shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Quarter {qNum}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 1. Quarter Attendance Analysis KPI Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>1. Quarter {selectedQuarter} Attendance Totals & Averages</span>
              </h3>
              <span className="text-xs text-indigo-900 bg-indigo-50 font-bold px-2.5 py-1 rounded-lg">
                12-Week Horizon
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white p-4 rounded-2xl border-2 border-blue-200 shadow-xs">
                <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">Registered Students</span>
                <h4 className="text-xl font-black text-blue-950 mt-1">{quarterAnalysis.registeredStudentPopulation}</h4>
                <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Active Roster Census</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border-2 border-purple-200 shadow-xs">
                <span className="text-[10px] font-black text-purple-900 uppercase tracking-wider block">Active Visitors</span>
                <h4 className="text-xl font-black text-purple-950 mt-1">{quarterAnalysis.activeVisitorPopulation}</h4>
                <p className="text-[10px] text-purple-600 font-semibold mt-0.5">Visitor Pipeline</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Avg. Weekly Students</span>
                <h4 className="text-xl font-black text-slate-900 mt-1">{quarterAnalysis.avgWeeklyStudents}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Weekly student mean</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Avg. Weekly Visitors</span>
                <h4 className="text-xl font-black text-indigo-700 mt-1">{quarterAnalysis.avgWeeklyVisitors}</h4>
                <p className="text-[10px] text-indigo-500 mt-0.5">Weekly visitor mean</p>
              </div>

              <div className="bg-blue-900 text-white p-4 rounded-2xl border border-blue-800 shadow-xs">
                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">Avg. Total Weekly</span>
                <h4 className="text-xl font-black text-white mt-1">{quarterAnalysis.avgWeeklyAttendance}</h4>
                <p className="text-[10px] text-blue-200 mt-0.5">Per lesson average</p>
              </div>

              <div className="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-900 shadow-xs">
                <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">Grand Total Att.</span>
                <h4 className="text-xl font-black text-amber-300 mt-1">{quarterAnalysis.totalAttendance}</h4>
                <p className="text-[10px] text-indigo-200 mt-0.5">12-Week aggregate</p>
              </div>

              <div className="bg-emerald-900 text-white p-4 rounded-2xl border border-emerald-800 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Total Offering</span>
                <h4 className="text-xl font-black text-white mt-1">₦{quarterAnalysis.totalOfferingRecorded.toLocaleString()}</h4>
                <p className="text-[10px] text-emerald-200 mt-0.5">Class registers collated</p>
              </div>
            </div>
          </div>

          {/* Highest & Lowest Attendance Weeks Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Peak Attendance Week (Quarter {selectedQuarter})</span>
                </span>
                <div className="text-lg font-black text-emerald-950">
                  Week {quarterAnalysis.highestWeek.weekNumber}
                </div>
                <div className="text-xs text-emerald-800 font-semibold">
                  {quarterAnalysis.highestWeek.totalPresent} Attendees ({quarterAnalysis.highestWeek.studentPresent} Students + {quarterAnalysis.highestWeek.visitorPresent} Visitors)
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700 bg-emerald-100 px-3.5 py-2 rounded-xl">
                ★ Week {quarterAnalysis.highestWeek.weekNumber}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Lowest Attendance Week (Quarter {selectedQuarter})</span>
                </span>
                <div className="text-lg font-black text-amber-950">
                  Week {quarterAnalysis.lowestWeek.weekNumber}
                </div>
                <div className="text-xs text-amber-800 font-semibold">
                  {quarterAnalysis.lowestWeek.totalPresent} Attendees ({quarterAnalysis.lowestWeek.studentPresent} Students + {quarterAnalysis.lowestWeek.visitorPresent} Visitors)
                </div>
              </div>
              <div className="text-2xl font-black text-amber-700 bg-amber-100 px-3.5 py-2 rounded-xl">
                Week {quarterAnalysis.lowestWeek.weekNumber}
              </div>
            </div>
          </div>

          {/* 12-Week Attendance Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>12-Week Weekly Attendance & Offering Progression</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Breakdown per week across all classes in Quarter {selectedQuarter}.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider">
                    <th className="p-3 pl-4">Week</th>
                    <th className="p-3 text-center">Student Present</th>
                    <th className="p-3 text-center text-indigo-200">Visitors</th>
                    <th className="p-3 text-center text-purple-200">New Visitors</th>
                    <th className="p-3 text-center text-rose-200">Absent</th>
                    <th className="p-3 text-center bg-indigo-900 text-amber-300">Total Present</th>
                    <th className="p-3 text-right text-emerald-300">Offering (₦)</th>
                    <th className="p-3 pr-4 text-left w-44">Attendance Gauge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {quarterAnalysis.weeklyTrends.map((wt) => {
                    const maxTot = quarterAnalysis.highestWeek.totalPresent || 1;
                    const pct = Math.min(100, Math.round((wt.totalPresent / maxTot) * 100));
                    return (
                      <tr key={wt.weekNumber} className={`hover:bg-slate-50 ${wt.weekNumber === selectedWeek ? 'bg-indigo-50/40 font-semibold' : ''}`}>
                        <td className="p-3 pl-4 font-black text-slate-900">
                          Week {wt.weekNumber} {wt.weekNumber === selectedWeek && <span className="text-[10px] text-indigo-700 font-bold ml-1">(Active)</span>}
                        </td>
                        <td className="p-3 text-center">{wt.studentPresent}</td>
                        <td className="p-3 text-center text-indigo-700 font-semibold">{wt.visitorPresent}</td>
                        <td className="p-3 text-center text-purple-700 font-bold">
                          {wt.newVisitors > 0 ? `+${wt.newVisitors}` : '0'}
                        </td>
                        <td className="p-3 text-center text-rose-600">{wt.absent}</td>
                        <td className="p-3 text-center font-black text-indigo-950 bg-indigo-50/60 text-sm">
                          {wt.totalPresent}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          ₦{wt.offering.toLocaleString()}
                        </td>
                        <td className="p-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-2 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 shrink-0">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                    <td className="p-3.5 pl-4 uppercase tracking-wider text-amber-300">
                      Quarter {selectedQuarter} Totals
                    </td>
                    <td className="p-3.5 text-center">{quarterAnalysis.totalStudentAttendance}</td>
                    <td className="p-3.5 text-center text-indigo-300">{quarterAnalysis.totalVisitorAttendance}</td>
                    <td className="p-3.5 text-center text-purple-300">{quarterAnalysis.totalNewVisitors}</td>
                    <td className="p-3.5 text-center text-rose-300">{quarterAnalysis.totalClassMembersAbsent}</td>
                    <td className="p-3.5 text-center bg-indigo-950 text-amber-300 text-sm">
                      {quarterAnalysis.totalAttendance}
                    </td>
                    <td className="p-3.5 text-right text-emerald-300">
                      ₦{quarterAnalysis.totalOfferingRecorded.toLocaleString()}
                    </td>
                    <td className="p-3.5 pr-4 text-[10px] text-slate-400">
                      Avg: {quarterAnalysis.avgWeeklyAttendance}/wk
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 2. Class Performance Directorate Highlights */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>2. Class Performance Directorate (Quarter {selectedQuarter})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Best Attendance Class */}
              <div className="bg-white rounded-2xl border-2 border-amber-400 p-5 shadow-xs space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-amber-600">
                  <span className="text-[10px] font-black uppercase tracking-wider">Top Class • Best Attendance</span>
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                {quarterAnalysis.bestClass ? (
                  <>
                    <h4 className="text-lg font-black text-slate-900">{quarterAnalysis.bestClass.className}</h4>
                    <p className="text-xs text-slate-500 font-semibold">{quarterAnalysis.bestClass.department}</p>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                      <span className="text-slate-500">Cumulative Attendance:</span>
                      <span className="font-black text-indigo-950 text-sm">{quarterAnalysis.bestClass.totalPresent} Attendees</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Offering:</span>
                      <span className="font-black text-emerald-700">₦{quarterAnalysis.bestClass.offering.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">No class records available.</p>
                )}
              </div>

              {/* Most Improved Class */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-[10px] font-black uppercase tracking-wider">Most Improved Class</span>
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                {quarterAnalysis.mostImprovedClass ? (
                  <>
                    <h4 className="text-lg font-black text-slate-900">{quarterAnalysis.mostImprovedClass.className}</h4>
                    <p className="text-xs text-slate-500 font-semibold">{quarterAnalysis.mostImprovedClass.department}</p>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                      <span className="text-slate-500">Week 1 vs Current:</span>
                      <span className="font-black text-emerald-700">
                        {quarterAnalysis.mostImprovedClass.week1Present} → {quarterAnalysis.mostImprovedClass.latestPresent} (+{quarterAnalysis.mostImprovedClass.latestPresent - quarterAnalysis.mostImprovedClass.week1Present})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Cumulative Attendance:</span>
                      <span className="font-black text-indigo-950">{quarterAnalysis.mostImprovedClass.totalPresent} Attendees</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 pt-2">
                    Steady attendance across all active classes.
                  </div>
                )}
              </div>

              {/* Submission Integrity & Missing Records */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="text-[10px] font-black uppercase tracking-wider">Submission Integrity</span>
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                </div>
                <h4 className="text-base font-black text-slate-900">
                  {quarterAnalysis.incompleteRecordClasses.length === 0
                    ? '100% Submission Integrity'
                    : `${quarterAnalysis.incompleteRecordClasses.length} Incomplete Classes`}
                </h4>
                <p className="text-xs text-slate-500">
                  {quarterAnalysis.incompleteRecordClasses.length === 0
                    ? 'Every Sunday Bible School class has submitted active returns.'
                    : 'Classes with one or more weeks missing register collation.'}
                </p>
                {quarterAnalysis.incompleteRecordClasses.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1">
                    {quarterAnalysis.incompleteRecordClasses.slice(0, 3).map((c: any) => (
                      <span key={c.classId} className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold rounded-md">
                        {c.className}
                      </span>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* 3. Membership Movement & Growth Summary */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                Directorate Growth Analytics
              </span>
              <h3 className="text-lg font-black text-white font-['Cinzel',serif]">
                Quarter {selectedQuarter} Membership Pipeline & Retention Overview
              </h3>
              <p className="text-xs text-slate-400">
                Summary of soul intake, visitor progression, and active learners in Sunday Bible School.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                <span className="text-xs text-purple-300 font-bold block">Total New Visitors Welcomed</span>
                <span className="text-2xl font-black text-purple-400 mt-1 block">+{quarterAnalysis.totalNewVisitors} Souls</span>
                <p className="text-[11px] text-slate-400 mt-1">Arrived during Quarter {selectedQuarter}</p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                <span className="text-xs text-teal-300 font-bold block">Visitors Onboarded to Students</span>
                <span className="text-2xl font-black text-teal-400 mt-1 block">+{quarterAnalysis.totalOnboarded} Members</span>
                <p className="text-[11px] text-slate-400 mt-1">Completed progression criteria</p>
              </div>

              <div className="bg-indigo-950 p-4 rounded-xl border border-indigo-800">
                <span className="text-xs text-amber-300 font-bold block">Total Class Offerings Collation</span>
                <span className="text-2xl font-black text-white mt-1 block">₦{quarterAnalysis.totalOfferingRecorded.toLocaleString()}</span>
                <p className="text-[11px] text-indigo-200 mt-1">Unified Quarter {selectedQuarter} Financial Record</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Class Register Inspection Modal */}
      {inspectedClassRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md text-[10px] font-black uppercase">
                  <span>Class Register Audit</span>
                </div>
                <h3 className="text-lg font-black text-white">{inspectedClassRow.className}</h3>
                <p className="text-xs text-slate-400">
                  {inspectedClassRow.department} • Teachers: {inspectedClassRow.teachersInCharge} • Week {selectedWeek}, Quarter {selectedQuarter}
                </p>
              </div>

              <button
                onClick={() => setInspectedClassRow(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Quick KPI stats for this class */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Student Present</span>
                  <span className="text-base font-black text-slate-900">{inspectedClassRow.studentPresent}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Visitor Present</span>
                  <span className="text-base font-black text-indigo-700">{inspectedClassRow.currentVisitorPresent + inspectedClassRow.newVisitors}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Absent</span>
                  <span className="text-base font-black text-rose-700">{inspectedClassRow.classMembersAbsent}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Offering</span>
                  <span className="text-base font-black text-emerald-700">₦{inspectedClassRow.offering.toLocaleString()}</span>
                </div>
              </div>

              {/* Members Roster */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                  Individual Member Attendance ({inspectedClassMembers.length} Members in Register)
                </h4>

                {inspectedClassMembers.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No member records recorded in this class.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase">
                          <th className="p-2.5 pl-3">Member Name</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-center">First Week</th>
                          <th className="p-2.5 text-center">Week {selectedWeek} Attendance</th>
                          <th className="p-2.5 text-right pr-3">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectedClassMembers.map((m, idx) => (
                          <tr key={m.id || idx} className="hover:bg-slate-50">
                            <td className="p-2.5 pl-3 font-bold text-slate-900">
                              {m.fullName}
                              {m.isNewVisitor && (
                                <span className="ml-2 text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full font-black uppercase">
                                  New Visitor
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                m.memberType === 'STUDENT'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {m.memberType}
                              </span>
                            </td>
                            <td className="p-2.5 text-center text-slate-500 font-semibold">
                              Week {m.firstWeek || 1}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                m.gradeAttendance === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : m.gradeAttendance === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800'
                                  : m.gradeAttendance === 'EXEMPT'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {m.gradeAttendance}
                              </span>
                            </td>
                            <td className="p-2.5 text-right pr-3 font-black text-slate-700">
                              {m.gradeAttendance === 'EXEMPT' ? '—' : `${m.lessonTotal || 0}/50`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectedClassRow(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print View Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Top Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-amber-300">Sunday School Collation Print Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Content */}
            <div className="p-8 overflow-y-auto space-y-6 text-slate-900 text-xs">
              
              {/* Official Header */}
              <div className="text-center space-y-2 border-b-2 border-slate-900 pb-5">
                <div className="inline-block">
                  <GofamintLogo size={50} />
                </div>
                <h1 className="text-xl font-black font-['Cinzel',serif] tracking-wider uppercase">
                  The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF)
                </h1>
                <h2 className="text-sm font-black tracking-widest text-indigo-900 uppercase">
                  Sunday Bible School Directorate • General Record & Collation
                </h2>
                <div className="flex justify-center gap-6 text-xs font-bold text-slate-600 pt-1">
                  <span>Year: {sundaySchoolYear.yearName}</span>
                  <span>•</span>
                  <span>Quarter: {selectedQuarter}</span>
                  <span>•</span>
                  <span>Week: {selectedWeek}</span>
                  <span>•</span>
                  <span>Date: {currentLesson?.date || new Date().toLocaleDateString()}</span>
                </div>
                {currentLesson && (
                  <p className="text-xs font-bold text-slate-800 bg-slate-100 py-1 px-3 rounded-md inline-block">
                    Lesson {selectedWeek}: {currentLesson.topic} ({currentLesson.scriptureReading})
                  </p>
                )}
              </div>

              {/* Collation Table */}
              <div className="space-y-2">
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-black text-[10px] uppercase border-b border-slate-400">
                      <th className="p-2 border-r border-slate-400">Class Name</th>
                      <th className="p-2 border-r border-slate-400 text-center">Std Present</th>
                      <th className="p-2 border-r border-slate-400 text-center">Vis Present</th>
                      <th className="p-2 border-r border-slate-400 text-center">New Vis</th>
                      <th className="p-2 border-r border-slate-400 text-center">Absent</th>
                      <th className="p-2 border-r border-slate-400 text-center bg-slate-300 font-black">Total Present</th>
                      <th className="p-2 border-r border-slate-400 text-center">Reg Members</th>
                      <th className="p-2 border-r border-slate-400 text-center">Onboarded</th>
                      <th className="p-2 text-right">Offering (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredRows.map((r, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r border-slate-300 font-bold">{r.className} ({r.department})</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.studentPresent}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.currentVisitorPresent}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.newVisitors}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.classMembersAbsent}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-black bg-slate-100">{r.totalPresent}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.registeredClassMembers}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.onboarded}</td>
                        <td className="p-2 text-right font-bold">₦{r.offering.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-black text-xs border-t-2 border-slate-900">
                      <td className="p-2.5 border-r border-slate-400 uppercase">Grand Totals</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredStudentPresent}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredCurrentVisitorPresent}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredNewVisitors}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredClassMembersAbsent}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center bg-slate-300 text-sm">{filteredTotalPresent}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredRegisteredClassMembers}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredOnboarded}</td>
                      <td className="p-2.5 text-right text-sm">₦{filteredOffering.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures & Certification Footer */}
              <div className="pt-10 grid grid-cols-2 gap-12 text-xs border-t border-slate-300">
                <div className="space-y-8">
                  <p className="font-bold">Compiled by (Record Officer):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">{currentAdmin.profileName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>

                <div className="space-y-8">
                  <p className="font-bold">Ratified by (General Superintendent):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">Pastor (Dr.) E.O. Abina</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
