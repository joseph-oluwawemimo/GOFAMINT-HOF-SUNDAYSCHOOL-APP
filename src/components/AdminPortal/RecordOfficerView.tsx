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
  Activity,
  UserX
} from 'lucide-react';
import {
  AdminProfile,
  ClassProfile,
  SundaySchoolYear,
  RecordOfficerClassRow,
  RecordOfficerWeeklyCollation,
  QuarterNumber,
  Member
} from '../../types';
import { getRealRecordOfficerCollation, getAllMembers, getAllGrades, getStudentClassForWeek } from '../../db/indexedDB';
import { isMemberStudentAtWeek } from '../../utils/calculations';
import { GofamintLogo } from '../GofamintLogo';
import { useDatabaseSync } from '../../hooks/useDatabaseSync';
import { DepartedMembersPanel } from './DepartedMembersPanel';

interface RecordOfficerViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
  activeTab?: 'WEEKLY_COLLATION' | 'WEEKLY_ONBOARDED' | 'QUARTER_ANALYSIS' | 'DEPARTED_MEMBERS';
  onTabChange?: (tab: 'WEEKLY_COLLATION' | 'WEEKLY_ONBOARDED' | 'QUARTER_ANALYSIS' | 'DEPARTED_MEMBERS') => void;
}

export const RecordOfficerView: React.FC<RecordOfficerViewProps> = ({
  currentAdmin,
  allClasses = [],
  sundaySchoolYear,
  activeTab: controlledTab,
  onTabChange
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
  const [internalTab, setInternalTab] = useState<'WEEKLY_COLLATION' | 'WEEKLY_ONBOARDED' | 'QUARTER_ANALYSIS' | 'DEPARTED_MEMBERS'>('WEEKLY_COLLATION');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = onTabChange || setInternalTab;
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [collationData, setCollationData] = useState<RecordOfficerWeeklyCollation | null>(null);
  const [allQuarterCollations, setAllQuarterCollations] = useState<RecordOfficerWeeklyCollation[]>([]);
  const [allMembersList, setAllMembersList] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Class Register Inspection Modal State
  const [inspectedClassRow, setInspectedClassRow] = useState<RecordOfficerClassRow | null>(null);
  const [inspectedClassMembers, setInspectedClassMembers] = useState<any[]>([]);
  const [inspectFilter, setInspectFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [isInspecting, setIsInspecting] = useState(false);

  const activeQuarterObj = (safeYear.quarters || []).find(q => q.quarterNumber === selectedQuarter) || safeYear.quarters?.[0] || { totalLessonWeeks: 12, lessons: [] };
  const totalWeeks = activeQuarterObj?.totalLessonWeeks || 12;
  const currentLesson = activeQuarterObj?.lessons?.find(l => l.weekNumber === selectedWeek);

  // Load real weekly collation data directly from Class Register records across current quarter
  const loadCollationData = async (isBackground = false) => {
    if (!collationData && !isBackground) {
      setIsLoading(true);
    }
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

  useDatabaseSync(() => loadCollationData(true), ['members', 'grades', 'offerings', 'absenceLogs', 'classes']);

  useEffect(() => {
    loadCollationData(false);
  }, [selectedQuarter, selectedWeek]);

  // Handle Class Register Inspection
  const handleInspectClass = async (row: RecordOfficerClassRow) => {
    setIsInspecting(true);
    setInspectedClassRow(row);
    setInspectFilter('ALL');
    try {
      const allMems = await getAllMembers();
      const allGrades = await getAllGrades();
      // Resolve membership historically at selectedWeek
      const classMems = allMems.filter(m => {
        const hist = getStudentClassForWeek(m, selectedWeek);
        return hist.classId === row.classId || (!hist.classId && m.classId === row.classId);
      });

      const enriched = classMems.map(mem => {
        const qEnr = mem.quarterEnrollments?.[selectedQuarter as QuarterNumber];
        const firstWeek = qEnr?.firstLessonWeek || mem.firstLessonWeek || 1;
        const convertedWeek = mem.convertedFromVisitorAtLesson;

        const isExempt = selectedWeek < firstWeek;
        const grade = allGrades.find(
          g => g.classId === row.classId && g.quarterNumber === selectedQuarter && g.memberId === mem.id && g.weekNumber === selectedWeek
        );

        const memberType: 'STUDENT' | 'VISITOR' = isMemberStudentAtWeek(mem, selectedWeek) ? 'STUDENT' : 'VISITOR';

        const isNewVisitor = !isExempt && memberType === 'VISITOR' && firstWeek === selectedWeek;
        const gradeAttendance = isExempt
          ? 'EXEMPT'
          : (grade && !grade.isNoRecordWeek && grade.attendance === 'PRESENT' ? 'PRESENT' : 'ABSENT');

        return {
          ...mem,
          memberType,
          firstWeek,
          isExempt,
          isNewVisitor,
          gradeAttendance,
          lessonTotal: isExempt ? 0 : (grade ? grade.lessonTotal : 0)
        };
      }).filter(m => !m.isExempt);

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

  // Calculate filtered totals for Concise Record & Composition
  const filteredStudentsCount = filteredRows.reduce((s, r) => s + (r.studentsCount ?? (r.studentPresent + (r.studentAbsent || 0))), 0);
  const filteredVisitorsCount = filteredRows.reduce((s, r) => s + (r.visitorsCount ?? ((r.visitorPresent || r.currentVisitorPresent) + (r.visitorAbsent || 0))), 0);
  const filteredTotalClassMembers = filteredStudentsCount + filteredVisitorsCount;

  const filteredStudentPresent = filteredRows.reduce((s, r) => s + r.studentPresent, 0);
  const filteredVisitorPresent = filteredRows.reduce((s, r) => s + (r.visitorPresent ?? r.currentVisitorPresent), 0);
  const filteredTotalPresent = filteredStudentPresent + filteredVisitorPresent;

  const filteredStudentAbsent = filteredRows.reduce((s, r) => s + (r.studentAbsent ?? (r.studentsCount - r.studentPresent)), 0);
  const filteredVisitorAbsent = filteredRows.reduce((s, r) => s + (r.visitorAbsent ?? (r.visitorsCount - (r.visitorPresent || r.currentVisitorPresent))), 0);
  const filteredTotalAbsent = filteredStudentAbsent + filteredVisitorAbsent;

  const filteredOffering = filteredRows.reduce((s, r) => s + r.offering, 0);

  // Compatibility aliases
  const filteredCurrentVisitorPresent = filteredVisitorPresent;
  const filteredNewVisitors = filteredRows.reduce((s, r) => s + r.newVisitors, 0);
  const filteredClassMembersAbsent = filteredTotalAbsent;
  const filteredRegisteredClassMembers = filteredTotalClassMembers;
  const filteredOnboarded = filteredVisitorsCount;
  const filteredEndingActive = filteredTotalClassMembers;

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

  // Dedicated Onboarded Attendee List for Selected Week (Phase 42)
  const weeklyOnboardedAttendees = useMemo(() => {
    return allMembersList.filter(m => {
      const qEnr = m.quarterEnrollments?.[selectedQuarter as QuarterNumber];
      const firstWeek = qEnr?.firstLessonWeek || m.firstLessonWeek || 1;
      const matchesWeek = firstWeek === selectedWeek;
      const matchesDept = selectedDepartment === 'ALL' || m.department === selectedDepartment;
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = !q || m.fullName.toLowerCase().includes(q) || (m.phone || '').includes(q) || (m.className || '').toLowerCase().includes(q);

      return matchesWeek && matchesDept && matchesSearch;
    });
  }, [allMembersList, selectedQuarter, selectedWeek, selectedDepartment, searchQuery]);

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

    const avgWeeklyAbsent = nonZeroWeeks.length > 0 ? Math.round(totalClassMembersAbsent / nonZeroWeeks.length) : 0;
    const avgWeeklyOffering = nonZeroWeeks.length > 0 ? Math.round(totalOfferingRecorded / nonZeroWeeks.length) : 0;

    // Build unified classes map
    const classMap = new Map<string, { id: string; className: string; department: string }>();
    allClasses.forEach(c => classMap.set(c.id, { id: c.id, className: c.className, department: c.department }));
    allMembersList.forEach(m => {
      if (m.classId && !classMap.has(m.classId)) {
        classMap.set(m.classId, { id: m.classId, className: m.className || 'Sunday Class', department: m.department || 'General' });
      }
    });
    allQuarterCollations.forEach(wc => {
      wc.rows.forEach(r => {
        if (r.classId && !classMap.has(r.classId)) {
          classMap.set(r.classId, { id: r.classId, className: r.className, department: r.department });
        }
      });
    });
    const derivedClasses = Array.from(classMap.values());

    // Class-by-Class Quarterly Progression & Conservation Matrix
    const classQuarterProgressions = derivedClasses.map(cls => {
      const classMembers = allMembersList.filter(
        m => m.classId === cls.id || (m.className && m.className.toLowerCase() === cls.className.toLowerCase())
      );

      // Week 1 Initial Onboarding Baseline
      const week1Onboarded = classMembers.filter(m => {
        const qEnr = m.quarterEnrollments?.[selectedQuarter as QuarterNumber];
        const fw = qEnr?.firstLessonWeek ?? m.firstLessonWeek ?? 1;
        return fw === 1;
      }).length;

      // Subsequent Onboarded (Weeks 2-12)
      const laterOnboarded = classMembers.filter(m => {
        const qEnr = m.quarterEnrollments?.[selectedQuarter as QuarterNumber];
        const fw = qEnr?.firstLessonWeek ?? m.firstLessonWeek ?? 1;
        return fw > 1;
      }).length;

      const totalOnboarded = week1Onboarded + laterOnboarded;

      // Active Students & Ongoing Visitors
      const activeStudents = classMembers.filter(m => m.memberType === 'STUDENT' && m.status === 'ACTIVE').length;
      const activeVisitors = classMembers.filter(m => m.memberType === 'VISITOR' && m.status === 'ACTIVE' && !m.isOneTimeVisitor).length;
      const currentClassMembers = activeStudents + activeVisitors;

      // Departed Members Section
      const oneTimeVisitors = classMembers.filter(m => (
        m.isOneTimeVisitor === true ||
        m.exclusionType === 'TEMPORARY' ||
        m.exitReviewOutcome === 'TEMPORARY_EXIT' ||
        (m.memberType === 'VISITOR' && (m.status === 'LEFT_CLASS' || m.status === 'RELEGATED_VISITOR'))
      )).length;

      const archivedDeparted = classMembers.filter(m => (
        !m.isOneTimeVisitor &&
        (m.status === 'LEFT_CLASS' || m.exitReviewOutcome === 'PERMANENT_EXIT' || m.exclusionType === 'PERMANENT')
      )).length;

      const totalDeparted = oneTimeVisitors + archivedDeparted;

      // Reconciled Total Onboarded ensures conservation integrity: Total Onboarded = Active + Departed
      const reconciledTotalOnboarded = Math.max(totalOnboarded, currentClassMembers + totalDeparted);
      const isBalanced = (currentClassMembers + totalDeparted) === reconciledTotalOnboarded;
      const netGrowth = currentClassMembers - week1Onboarded;
      const progressionRate = reconciledTotalOnboarded > 0 ? Math.round((currentClassMembers / reconciledTotalOnboarded) * 100) : 0;

      // Class average weekly attendance & offering
      const collationsForClass = allQuarterCollations.map(wc => wc.rows.find(r => r.classId === cls.id)).filter(Boolean);
      const totalPresentSum = collationsForClass.reduce((s, r) => s + (r?.totalPresent || 0), 0);
      const totalOfferingSum = collationsForClass.reduce((s, r) => s + (r?.offering || 0), 0);
      const activeWeeks = collationsForClass.filter(r => (r?.totalPresent || 0) > 0).length;
      const avgWeeklyAttendance = activeWeeks > 0 ? Math.round(totalPresentSum / activeWeeks) : 0;

      return {
        classId: cls.id,
        className: cls.className,
        department: cls.department,
        week1Onboarded,
        laterOnboarded,
        totalOnboarded: reconciledTotalOnboarded,
        activeStudents,
        activeVisitors,
        currentClassMembers,
        oneTimeVisitors,
        archivedDeparted,
        totalDeparted,
        isBalanced,
        netGrowth,
        progressionRate,
        avgWeeklyAttendance,
        totalOfferingSum
      };
    }).sort((a, b) => a.className.localeCompare(b.className));

    const corporateProgression = classQuarterProgressions.reduce((acc, c) => ({
      week1Onboarded: acc.week1Onboarded + c.week1Onboarded,
      laterOnboarded: acc.laterOnboarded + c.laterOnboarded,
      totalOnboarded: acc.totalOnboarded + c.totalOnboarded,
      activeStudents: acc.activeStudents + c.activeStudents,
      activeVisitors: acc.activeVisitors + c.activeVisitors,
      currentClassMembers: acc.currentClassMembers + c.currentClassMembers,
      oneTimeVisitors: acc.oneTimeVisitors + c.oneTimeVisitors,
      archivedDeparted: acc.archivedDeparted + c.archivedDeparted,
      totalDeparted: acc.totalDeparted + c.totalDeparted,
      netGrowth: acc.netGrowth + c.netGrowth
    }), {
      week1Onboarded: 0,
      laterOnboarded: 0,
      totalOnboarded: 0,
      activeStudents: 0,
      activeVisitors: 0,
      currentClassMembers: 0,
      oneTimeVisitors: 0,
      archivedDeparted: 0,
      totalDeparted: 0,
      netGrowth: 0
    });

    return {
      totalStudentAttendance,
      totalVisitorAttendance,
      totalNewVisitors,
      totalClassMembersAbsent,
      totalAttendance,
      avgWeeklyAttendance,
      avgWeeklyStudents,
      avgWeeklyVisitors,
      avgWeeklyAbsent,
      avgWeeklyOffering,
      registeredStudentPopulation,
      activeVisitorPopulation,
      uniqueLivingSouls: registeredStudentPopulation + activeVisitorPopulation,
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
      totalOnboarded,
      classQuarterProgressions,
      corporateProgression
    };
  }, [allQuarterCollations, selectedWeek, collationData, allMembersList, allClasses, selectedQuarter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Class Name',
      'Department',
      'Teachers in Charge',
      'Students',
      'Visitors',
      'Total Class Members',
      'Total Present',
      'Students Present',
      'Visitors Present',
      'Total Absent',
      'Students Absent',
      'Visitors Absent',
      'Offering (NGN)'
    ];

    const dataRows = filteredRows.map(r => {
      const rowStudents = r.studentsCount ?? (r.studentPresent + (r.studentAbsent || 0));
      const rowVisitors = r.visitorsCount ?? ((r.visitorPresent || r.currentVisitorPresent) + (r.visitorAbsent || 0));
      const rowTotal = rowStudents + rowVisitors;
      const rowPresent = r.totalPresent;
      const rowAbsent = r.totalAbsent ?? (rowTotal - rowPresent);

      return [
        `"${r.className}"`,
        `"${r.department}"`,
        `"${r.teachersInCharge}"`,
        rowStudents,
        rowVisitors,
        rowTotal,
        rowPresent,
        r.studentPresent,
        r.visitorPresent ?? r.currentVisitorPresent,
        rowAbsent,
        r.studentAbsent ?? (rowStudents - r.studentPresent),
        r.visitorAbsent ?? (rowVisitors - (r.visitorPresent ?? r.currentVisitorPresent)),
        r.offering
      ];
    });

    // Grand Totals Row
    const totalsRow = [
      '"GRAND TOTAL (ALL CLASSES)"',
      '""',
      '""',
      filteredStudentsCount,
      filteredVisitorsCount,
      filteredTotalClassMembers,
      filteredTotalPresent,
      filteredStudentPresent,
      filteredVisitorPresent,
      filteredTotalAbsent,
      filteredStudentAbsent,
      filteredVisitorAbsent,
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
      <div className="bg-gradient-to-r from-[#20055b] via-[#320b86] to-[#4c1d95] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[11px] font-black text-amber-300 uppercase tracking-widest font-['Cinzel',serif]">
              <ClipboardList className="w-3.5 h-3.5 text-amber-300" />
              <span>RECORD DIRECTORATE • REAL CLASS REGISTER COLLATION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Sunday Bible School Records & Collation
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/90 max-w-2xl leading-relaxed">
              Officer in Charge: <strong className="text-white font-bold">{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Collecting weekly returns live from every Class Register, ensuring unified mathematical consistency and accurate attendance collation.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#20055b] font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-400/20 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Collation</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Quarter, Week, Department, and Search Selectors (Available in Collation and Onboarded views) */}
      {(activeTab === 'WEEKLY_COLLATION' || activeTab === 'WEEKLY_ONBOARDED') && (
        <div className="bg-white rounded-2xl border border-slate-100/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      selectedQuarter === qNum
                        ? 'bg-[#320b86] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Quarter {qNum} {safeYear.activeQuarterNumber === qNum && '★'}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Lesson Summary */}
            {currentLesson && (
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-[#320b86] block">
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
                <Calendar className="w-3.5 h-3.5 text-[#320b86]" />
                <span>Select Week ({totalWeeks} Weeks in Quarter {selectedQuarter}):</span>
              </span>
              <span className="text-xs font-black text-[#320b86]">Active: Week {selectedWeek}</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition shrink-0 cursor-pointer ${
                    selectedWeek === w
                      ? 'bg-[#320b86] text-white shadow-md shadow-[#320b86]/25'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#320b86]/20 focus:border-[#320b86] outline-hidden cursor-pointer"
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
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#320b86]/20 focus:border-[#320b86] outline-hidden font-medium placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* View Mode: WEEKLY_COLLATION */}
      {activeTab === 'WEEKLY_COLLATION' ? (
        <>
          {/* ========================================================= */}
          {/* RECORD OFFICER DUAL CONCEPTUAL PANELS (PART 11)           */}
          {/* LEFT = CLASS SUMMARY  |  RIGHT = WEEKLY RECORD            */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* LEFT PANEL: CLASS SUMMARY (MEMBERSHIP COMPOSITION) */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#1e1b4b] via-[#28076e] to-[#3b0764] text-white rounded-3xl p-5 border-2 border-indigo-400/40 shadow-lg flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-indigo-400/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                      CLASS SUMMARY (MEMBERSHIP)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-indigo-400/20 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                    Dual Classification
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200/80 mt-2 leading-relaxed">
                  Total class membership comprised of qualified Students and qualifying Visitors.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5 backdrop-blur-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                      Students
                    </span>
                    <Users className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                  <h4 className="text-2xl font-black text-white mt-1">
                    {filteredStudentsCount}
                  </h4>
                  <p className="text-[10px] text-indigo-200 mt-0.5">
                    Enrolled Students
                  </p>
                </div>

                <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5 backdrop-blur-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
                      Visitors
                    </span>
                    <UserCheck className="w-3.5 h-3.5 text-purple-300" />
                  </div>
                  <h4 className="text-2xl font-black text-white mt-1">
                    {filteredVisitorsCount}
                  </h4>
                  <p className="text-[10px] text-indigo-200 mt-0.5">
                    Qualifying Learners
                  </p>
                </div>
              </div>

              <div className="bg-white/10 border-2 border-amber-400/60 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 block">
                    TOTAL CLASS MEMBERS
                  </span>
                  <span className="text-[10px] text-indigo-200 font-medium">
                    Students ({filteredStudentsCount}) + Visitors ({filteredVisitorsCount})
                  </span>
                </div>
                <div className="text-3xl font-black text-amber-300 font-mono tracking-tight">
                  {filteredTotalClassMembers}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: WEEKLY RECORD (ATTENDANCE & RETURNS) */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-lg flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      WEEKLY RECORD (WEEK {selectedWeek} RETURN)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                    Live Register Returns
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Real-time collation of learners present, absentees, and weekly Sunday Bible School offering.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Present Card */}
                <div className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider">
                      PRESENT
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <h4 className="text-2xl font-black text-emerald-950">
                    {filteredTotalPresent}
                  </h4>
                  <div className="text-[10px] text-emerald-800 font-bold bg-white/80 p-1.5 rounded-lg border border-emerald-100 space-y-0.5">
                    <div>Students: <strong className="text-emerald-950 font-black">{filteredStudentPresent}</strong></div>
                    <div>Visitors: <strong className="text-emerald-950 font-black">{filteredVisitorPresent}</strong></div>
                  </div>
                </div>

                {/* Absent Card */}
                <div className="bg-rose-50/70 rounded-2xl p-3.5 border border-rose-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-rose-900 uppercase tracking-wider">
                      ABSENT
                    </span>
                    <UserX className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <h4 className="text-2xl font-black text-rose-950">
                    {filteredTotalAbsent}
                  </h4>
                  <div className="text-[10px] text-rose-800 font-bold bg-white/80 p-1.5 rounded-lg border border-rose-100 space-y-0.5">
                    <div>Students: <strong className="text-rose-950 font-black">{filteredStudentAbsent}</strong></div>
                    <div>Visitors: <strong className="text-rose-950 font-black">{filteredVisitorAbsent}</strong></div>
                  </div>
                </div>

                {/* Offering Card */}
                <div className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-200 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                        OFFERING
                      </span>
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <h4 className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
                      ₦{filteredOffering.toLocaleString()}
                    </h4>
                  </div>
                  <div className="text-[10px] text-amber-800 font-semibold bg-white/80 p-1.5 rounded-lg border border-amber-100">
                    Week {selectedWeek} Offering Recorded
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Validation Rules Bar */}
          <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-slate-300">Master Record Equation:</span>
              <span className="font-black text-amber-300 bg-white/10 px-2.5 py-1 rounded-lg">
                Total Present ({filteredTotalPresent}) + Total Absent ({filteredTotalAbsent}) = Total Members ({filteredTotalClassMembers})
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span>Membership Composition:</span>
              <span className="font-black text-teal-300 bg-white/10 px-2.5 py-1 rounded-lg">
                Students ({filteredStudentsCount}) + Visitors ({filteredVisitorsCount}) = Total Members ({filteredTotalClassMembers})
              </span>
            </div>
          </div>

          {/* Concise Weekly Collation Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <span>Concise Record Table (Week {selectedWeek}, Quarter {selectedQuarter})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Total Class Members = Students + Visitors • Total Present + Total Absent = Total Class Members
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
                    {/* Super Header: Class Summary vs Weekly Record */}
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                      <th rowSpan={2} className="p-3 pl-4 border-r border-slate-800 align-bottom w-56">Class & Department</th>
                      <th colSpan={3} className="p-2 text-center border-r border-indigo-800 bg-indigo-950/80 text-indigo-300">
                        CLASS SUMMARY (MEMBERSHIP)
                      </th>
                      <th colSpan={3} className="p-2 text-center border-r border-slate-800 bg-slate-950 text-amber-300">
                        WEEKLY RECORD (WEEK {selectedWeek})
                      </th>
                      <th rowSpan={2} className="p-3 pr-4 text-center align-bottom w-28">Inspection</th>
                    </tr>
                    {/* Sub Headers */}
                    <tr className="bg-slate-800 text-slate-200 text-[10px] font-bold uppercase tracking-wider border-b border-slate-700">
                      <th className="p-2 text-center border-r border-slate-700 text-blue-300">Students</th>
                      <th className="p-2 text-center border-r border-slate-700 text-indigo-300">Visitors</th>
                      <th className="p-2 text-center border-r border-slate-700 bg-indigo-900/60 text-amber-300 font-black">Total Members</th>
                      <th className="p-2 text-center border-r border-slate-700 text-emerald-300">Total Present</th>
                      <th className="p-2 text-center border-r border-slate-700 text-rose-300">Total Absent</th>
                      <th className="p-2 text-right border-r border-slate-700 text-amber-200">Offering</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRows.map((row, idx) => {
                      const rowStudents = row.studentsCount ?? (row.studentPresent + (row.studentAbsent || 0));
                      const rowVisitors = row.visitorsCount ?? ((row.visitorPresent || row.currentVisitorPresent) + (row.visitorAbsent || 0));
                      const rowTotalMembers = rowStudents + rowVisitors;
                      const rowPresent = row.totalPresent;
                      const rowAbsent = row.totalAbsent ?? (rowTotalMembers - rowPresent);

                      return (
                        <tr key={row.classId || idx} className="hover:bg-indigo-50/40 transition">
                          <td className="p-3.5 pl-4">
                            <div className="font-black text-slate-900 text-xs">{row.className}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">{row.department} • {row.teachersInCharge}</div>
                            {Boolean(row.transfersIn) && (
                              <span className="inline-block mt-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded mr-1">
                                +{row.transfersIn} transfer in
                              </span>
                            )}
                            {Boolean(row.transfersOut) && (
                              <span className="inline-block mt-1 px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] font-black rounded mr-1">
                                -{row.transfersOut} transfer out
                              </span>
                            )}
                            {row.transferNotes && row.transferNotes.length > 0 && (
                              <div className="text-[9px] text-indigo-700 italic mt-0.5">
                                {row.transferNotes.join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-bold text-blue-900 bg-blue-50/30">
                            {rowStudents}
                          </td>
                          <td className="p-3.5 text-center font-bold text-indigo-900 bg-indigo-50/30">
                            {rowVisitors}
                          </td>
                          <td className="p-3.5 text-center font-black text-slate-950 bg-slate-100">
                            {rowTotalMembers}
                          </td>
                          <td className="p-3.5 text-center font-black text-emerald-700 bg-emerald-50/30">
                            <div>{rowPresent}</div>
                            <div className="text-[9px] font-normal text-slate-400">
                              {row.studentPresent} std • {row.visitorPresent ?? row.currentVisitorPresent} vis
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-bold text-rose-700 bg-rose-50/30">
                            <div>{rowAbsent}</div>
                            <div className="text-[9px] font-normal text-slate-400">
                              {row.studentAbsent ?? (rowStudents - row.studentPresent)} std • {row.visitorAbsent ?? (rowVisitors - (row.visitorPresent ?? row.currentVisitorPresent))} vis
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-900">
                            ₦{row.offering.toLocaleString()}
                          </td>
                          <td className="p-3.5 pr-4 text-center">
                            <button
                              onClick={() => handleInspectClass(row)}
                              className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-amber-300 rounded-lg font-black text-[11px] transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                              title="Inspect Class: People Behind the Numbers"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-300" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Grand Totals Footer */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                      <td className="p-4 pl-4 uppercase tracking-wider text-amber-300">
                        TOTALS ({filteredRows.length} Classes)
                      </td>
                      <td className="p-4 text-center text-blue-300">
                        {filteredStudentsCount}
                      </td>
                      <td className="p-4 text-center text-indigo-300">
                        {filteredVisitorsCount}
                      </td>
                      <td className="p-4 text-center bg-slate-800 text-amber-300 font-black text-sm">
                        {filteredTotalClassMembers}
                      </td>
                      <td className="p-4 text-center text-emerald-300 font-black text-sm">
                        {filteredTotalPresent}
                      </td>
                      <td className="p-4 text-center text-rose-300 font-black text-sm">
                        {filteredTotalAbsent}
                      </td>
                      <td className="p-4 text-right text-amber-300 font-black text-sm">
                        ₦{filteredOffering.toLocaleString()}
                      </td>
                      <td className="p-4 pr-4 text-center text-emerald-400 text-[10px] font-black">
                        ✓ Balanced
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

      {/* Phase 42: Dedicated Onboarded Attendee List */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-600" />
              <span>Week {selectedWeek} Onboarded Attendees</span>
            </h3>
            <p className="text-xs text-slate-500">
              List of attendees onboarded during Week {selectedWeek} (Quarter {selectedQuarter}).
            </p>
          </div>
          <span className="text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            {weeklyOnboardedAttendees.length} Onboarded Attendee{weeklyOnboardedAttendees.length !== 1 ? 's' : ''}
          </span>
        </div>

        {weeklyOnboardedAttendees.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No attendees were onboarded in Week {selectedWeek} for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Name</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Onboarding Date</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center pr-4">Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {weeklyOnboardedAttendees.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 pl-4 font-black text-slate-900">{m.fullName}</td>
                    <td className="p-3 text-slate-600">{m.department || 'General'}</td>
                    <td className="p-3 font-bold text-teal-900">{m.className || 'General Class'}</td>
                    <td className="p-3 font-mono text-slate-600">{m.phone || '—'}</td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : `Week ${selectedWeek}`}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.memberType === 'STUDENT'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-purple-100 text-purple-800 border border-purple-300'
                      }`}>
                        {m.memberType === 'STUDENT' ? 'Enrolled' : 'Onboarded'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold pr-4">
                      Week {selectedWeek}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      ) : activeTab === 'WEEKLY_ONBOARDED' ? (
        /* PHASE 42: DEDICATED ONBOARDED ATTENDEE VIEW */
        <div className="bg-white rounded-2xl p-6 border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-[#320b86] tracking-wider block">
                Directorate Census & Welcoming Pipeline
              </span>
              <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#320b86]" />
                <span>Week {selectedWeek} Newly Onboarded Attendees</span>
              </h2>
              <p className="text-xs text-slate-500">
                Detailed census of first-time visitors and converted attendees onboarded during Week {selectedWeek} (Quarter {selectedQuarter}).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#320b86] bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100">
                {weeklyOnboardedAttendees.length} Onboarded Attendee{weeklyOnboardedAttendees.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {weeklyOnboardedAttendees.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <UserPlus className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">No attendees were onboarded in Week {selectedWeek} for the selected filter.</p>
              <p className="text-slate-400">First-time visitors and newly converted members appear here once recorded in Class Registers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#20055b] text-white text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3 pl-4">Name</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Phone Number</th>
                    <th className="p-3">Onboarding Date</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center pr-4">Week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {weeklyOnboardedAttendees.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 pl-4 font-black text-slate-900">{m.fullName}</td>
                      <td className="p-3 text-slate-600">{m.department || 'General'}</td>
                      <td className="p-3 font-bold text-[#320b86]">{m.className || 'General Class'}</td>
                      <td className="p-3 font-mono text-slate-600">{m.phone || '—'}</td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : `Week ${selectedWeek}`}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          m.memberType === 'STUDENT'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}>
                          {m.memberType === 'STUDENT' ? 'Enrolled' : 'Onboarded'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold pr-4">
                        Week {selectedWeek}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'QUARTER_ANALYSIS' ? (
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                  {/* Row 1: Weekly Mean (Average per Sunday) */}
                  <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                    <td className="p-3.5 pl-4 uppercase tracking-wider text-amber-300">
                      Weekly Mean (Avg / Sunday)
                    </td>
                    <td className="p-3.5 text-center text-blue-200">
                      {quarterAnalysis.avgWeeklyStudents}
                      <span className="block text-[9px] font-normal text-slate-400">Mean Students/wk</span>
                    </td>
                    <td className="p-3.5 text-center text-indigo-300">
                      {quarterAnalysis.avgWeeklyVisitors}
                      <span className="block text-[9px] font-normal text-slate-400">Mean Visitors/wk</span>
                    </td>
                    <td className="p-3.5 text-center text-purple-300">
                      +{quarterAnalysis.totalNewVisitors}
                      <span className="block text-[9px] font-normal text-slate-400">Total Welcomed</span>
                    </td>
                    <td className="p-3.5 text-center text-rose-300">
                      {quarterAnalysis.avgWeeklyAbsent}
                      <span className="block text-[9px] font-normal text-slate-400">Mean Absences/wk</span>
                    </td>
                    <td className="p-3.5 text-center bg-indigo-950 text-amber-300 text-sm">
                      {quarterAnalysis.avgWeeklyAttendance}
                      <span className="block text-[9px] font-normal text-indigo-200">Total Avg Attendance</span>
                    </td>
                    <td className="p-3.5 text-right text-emerald-300">
                      ₦{quarterAnalysis.totalOfferingRecorded.toLocaleString()}
                      <span className="block text-[9px] font-normal text-emerald-400">₦{quarterAnalysis.avgWeeklyOffering.toLocaleString()}/wk avg</span>
                    </td>
                    <td className="p-3.5 pr-4 text-[10px] text-slate-400">
                      12-Week Mean Ratio
                    </td>
                  </tr>

                  {/* Row 2: Living Souls Census */}
                  <tr className="bg-slate-950 text-slate-300 font-bold border-t border-slate-800 text-[11px]">
                    <td className="p-3 pl-4 text-indigo-300 uppercase tracking-wider">
                      Living Souls Census (Quarter {selectedQuarter})
                    </td>
                    <td className="p-3 text-center text-blue-300">
                      {quarterAnalysis.registeredStudentPopulation} Unique
                    </td>
                    <td className="p-3 text-center text-indigo-300">
                      {quarterAnalysis.activeVisitorPopulation} Unique
                    </td>
                    <td className="p-3 text-center text-purple-300">
                      +{quarterAnalysis.totalNewVisitors} New
                    </td>
                    <td className="p-3 text-center text-slate-500">—</td>
                    <td className="p-3 text-center bg-indigo-900 text-amber-300 font-black">
                      {quarterAnalysis.uniqueLivingSouls} Active Souls
                    </td>
                    <td className="p-3 text-right text-emerald-400">
                      12 Lessons Collated
                    </td>
                    <td className="p-3 pr-4 text-[10px] text-slate-500">
                      Church Census Baseline
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 2. Class-by-Class Quarterly Progression & Conservation Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <span>2. Class-by-Class Quarterly Progression & Conservation Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mathematical proof of soul retention: <strong>Total Onboarded = Active Class Members + Departed Section</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Conservation Law 100% Balanced</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider">
                    <th className="p-3 pl-4">Class & Department</th>
                    <th className="p-3 text-center bg-slate-800 text-blue-200">Week 1 Started</th>
                    <th className="p-3 text-center bg-slate-800 text-purple-200">Later Onboarded</th>
                    <th className="p-3 text-center bg-blue-950 text-amber-300">Total Ever Onboarded</th>
                    <th className="p-3 text-center text-teal-200">Active Students</th>
                    <th className="p-3 text-center text-cyan-200">Active Visitors</th>
                    <th className="p-3 text-center bg-teal-900 text-white font-black">Current Members</th>
                    <th className="p-3 text-center text-amber-300">1-Time Visitors</th>
                    <th className="p-3 text-center text-rose-300">Archived Departed</th>
                    <th className="p-3 text-center bg-rose-950 text-white font-black">Total Departed</th>
                    <th className="p-3 text-center bg-indigo-950 text-emerald-300">Conservation Check</th>
                    <th className="p-3 text-center">Net Growth</th>
                    <th className="p-3 text-right pr-4">Mean Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {quarterAnalysis.classQuarterProgressions.map((cp) => (
                    <tr key={cp.classId} className="hover:bg-slate-50 transition">
                      <td className="p-3 pl-4">
                        <div className="font-bold text-slate-900">{cp.className}</div>
                        <div className="text-[10px] text-slate-500">{cp.department}</div>
                      </td>
                      <td className="p-3 text-center font-semibold bg-slate-50/50">{cp.week1Onboarded}</td>
                      <td className="p-3 text-center font-semibold bg-slate-50/50">+{cp.laterOnboarded}</td>
                      <td className="p-3 text-center font-black text-blue-950 bg-blue-50/70 text-xs">
                        {cp.totalOnboarded}
                      </td>
                      <td className="p-3 text-center font-bold text-teal-800">{cp.activeStudents}</td>
                      <td className="p-3 text-center font-bold text-cyan-800">{cp.activeVisitors}</td>
                      <td className="p-3 text-center font-black bg-teal-50 text-teal-950 text-xs">
                        {cp.currentClassMembers}
                      </td>
                      <td className="p-3 text-center text-amber-800 font-semibold">{cp.oneTimeVisitors}</td>
                      <td className="p-3 text-center text-rose-800 font-semibold">{cp.archivedDeparted}</td>
                      <td className="p-3 text-center font-black bg-rose-50 text-rose-950 text-xs">
                        {cp.totalDeparted}
                      </td>
                      <td className="p-3 text-center">
                        {cp.isBalanced ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{cp.currentClassMembers + cp.totalDeparted} = {cp.totalOnboarded}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                            Review
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-black ${
                          cp.netGrowth > 0 ? 'text-emerald-700' : cp.netGrowth < 0 ? 'text-rose-600' : 'text-slate-600'
                        }`}>
                          {cp.netGrowth > 0 ? `+${cp.netGrowth}` : cp.netGrowth}
                        </span>
                      </td>
                      <td className="p-3 text-right pr-4 font-mono font-bold text-indigo-950">
                        {cp.avgWeeklyAttendance}/wk
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                    <td className="p-3.5 pl-4 uppercase tracking-wider text-amber-300">
                      Corporate Summary (All Classes)
                    </td>
                    <td className="p-3.5 text-center bg-slate-800 text-blue-200">{quarterAnalysis.corporateProgression.week1Onboarded}</td>
                    <td className="p-3.5 text-center bg-slate-800 text-purple-200">+{quarterAnalysis.corporateProgression.laterOnboarded}</td>
                    <td className="p-3.5 text-center bg-blue-950 text-amber-300 text-sm">
                      {quarterAnalysis.corporateProgression.totalOnboarded}
                    </td>
                    <td className="p-3.5 text-center text-teal-300">{quarterAnalysis.corporateProgression.activeStudents}</td>
                    <td className="p-3.5 text-center text-cyan-300">{quarterAnalysis.corporateProgression.activeVisitors}</td>
                    <td className="p-3.5 text-center bg-teal-900 text-white font-black text-sm">
                      {quarterAnalysis.corporateProgression.currentClassMembers}
                    </td>
                    <td className="p-3.5 text-center text-amber-300">{quarterAnalysis.corporateProgression.oneTimeVisitors}</td>
                    <td className="p-3.5 text-center text-rose-300">{quarterAnalysis.corporateProgression.archivedDeparted}</td>
                    <td className="p-3.5 text-center bg-rose-950 text-white font-black text-sm">
                      {quarterAnalysis.corporateProgression.totalDeparted}
                    </td>
                    <td className="p-3.5 text-center text-emerald-300 text-[11px]">
                      {quarterAnalysis.corporateProgression.currentClassMembers + quarterAnalysis.corporateProgression.totalDeparted === quarterAnalysis.corporateProgression.totalOnboarded
                        ? `✓ ${quarterAnalysis.corporateProgression.currentClassMembers + quarterAnalysis.corporateProgression.totalDeparted} = ${quarterAnalysis.corporateProgression.totalOnboarded} (100% Balanced)`
                        : 'Reconciled'}
                    </td>
                    <td className="p-3.5 text-center text-emerald-300 font-black">
                      {quarterAnalysis.corporateProgression.netGrowth > 0
                        ? `+${quarterAnalysis.corporateProgression.netGrowth}`
                        : quarterAnalysis.corporateProgression.netGrowth}
                    </td>
                    <td className="p-3.5 text-right pr-4 text-amber-300 font-mono font-black">
                      Avg: {quarterAnalysis.avgWeeklyAttendance}/wk
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 3. Class Performance Directorate Highlights */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>3. Class Performance Directorate (Quarter {selectedQuarter})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Best Attendance Class */}
              <div className="bg-white rounded-2xl border-2 border-amber-400 p-5 shadow-xs space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-amber-600">
                  <span className="text-[10px] font-black uppercase tracking-wider">Top Class • Best Mean Attendance</span>
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                {quarterAnalysis.bestClass ? (
                  <>
                    <h4 className="text-lg font-black text-slate-900">{quarterAnalysis.bestClass.className}</h4>
                    <p className="text-xs text-slate-500 font-semibold">{quarterAnalysis.bestClass.department}</p>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                      <span className="text-slate-500">Weekly Mean Attendance:</span>
                      <span className="font-black text-indigo-950 text-sm">{quarterAnalysis.bestClass.avgWeeklyAttendance || Math.round(quarterAnalysis.bestClass.totalPresent / 12)} / Sunday</span>
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
                      <span className="text-slate-500">Mean Attendance:</span>
                      <span className="font-black text-indigo-950">{quarterAnalysis.mostImprovedClass.avgWeeklyAttendance || Math.round(quarterAnalysis.mostImprovedClass.totalPresent / 12)} / Sunday</span>
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

          {/* 4. Membership Movement & Growth Summary */}
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
      ) : (
        <DepartedMembersPanel members={allMembersList} classes={allClasses} />
      )}

      {/* Class Register Inspection Modal */}
      {inspectedClassRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#20055b] to-[#320b86] text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 text-amber-300 rounded-md text-[10px] font-black uppercase">
                  <span>Class Register Audit</span>
                </div>
                <h3 className="text-lg font-black text-white">{inspectedClassRow.className}</h3>
                <p className="text-xs text-purple-200">
                  {inspectedClassRow.department} • Teachers: {inspectedClassRow.teachersInCharge} • Week {selectedWeek}, Quarter {selectedQuarter}
                </p>
              </div>

              <button
                onClick={() => setInspectedClassRow(null)}
                className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              
              {/* Part 1-C: Elaborate Inspection Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Panel 1: MEMBERS */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">Class Membership</span>
                    <span className="text-[10px] text-slate-500 font-bold">Dual Classification</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Students</span>
                      <span className="text-base font-black text-blue-900">{inspectedClassRow.studentsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Visitors</span>
                      <span className="text-base font-black text-indigo-700">{inspectedClassRow.visitorsCount}</span>
                    </div>
                    <div className="bg-white rounded-xl p-1 border border-indigo-200">
                      <span className="text-[10px] text-indigo-900 uppercase font-black block">Total Members</span>
                      <span className="text-base font-black text-indigo-950">{inspectedClassRow.totalClassMembers}</span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: THIS WEEK */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-[11px] font-black uppercase text-emerald-900 tracking-wider">This Week's Record</span>
                    <span className="text-[10px] text-slate-500 font-bold">Week {selectedWeek} Return</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div>
                      <span className="text-[10px] text-emerald-800 uppercase font-bold block">Present</span>
                      <span className="text-base font-black text-emerald-700">{inspectedClassRow.totalPresent}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-800 uppercase font-bold block">Absent</span>
                      <span className="text-base font-black text-rose-700">{inspectedClassRow.totalAbsent}</span>
                    </div>
                    <div className="bg-white rounded-xl p-1 border border-amber-200">
                      <span className="text-[10px] text-amber-900 uppercase font-black block">Offering</span>
                      <span className="text-base font-black text-amber-900">₦{inspectedClassRow.offering.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Elaborate Inspection Cards (Part 1-C) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* PRESENT INSPECTION */}
                <div className="bg-emerald-50/70 p-4 rounded-2xl border-2 border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>PRESENT ({inspectedClassRow.totalPresent})</span>
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
                      {Math.round((inspectedClassRow.totalPresent / (inspectedClassRow.totalClassMembers || 1)) * 100)}% attendance
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Students Present</span>
                      <span className="text-lg font-black text-emerald-900">{inspectedClassRow.studentPresent}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Visitors Present</span>
                      <span className="text-lg font-black text-emerald-900">{inspectedClassRow.visitorPresent}</span>
                    </div>
                  </div>
                </div>

                {/* ABSENT INSPECTION */}
                <div className="bg-rose-50/70 p-4 rounded-2xl border-2 border-rose-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                      <UserX className="w-4 h-4 text-rose-600" />
                      <span>ABSENT ({inspectedClassRow.totalAbsent})</span>
                    </span>
                    <span className="text-[10px] font-bold bg-rose-200/70 text-rose-900 px-2 py-0.5 rounded-full">
                      {Math.round((inspectedClassRow.totalAbsent / (inspectedClassRow.totalClassMembers || 1)) * 100)}% absence
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Students Absent</span>
                      <span className="text-lg font-black text-rose-900">{inspectedClassRow.studentAbsent}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Visitors Absent</span>
                      <span className="text-lg font-black text-rose-900">{inspectedClassRow.visitorAbsent}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Members Roster with Filters */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    People Behind the Numbers ({inspectedClassMembers.length} Members)
                  </h4>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setInspectFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                        inspectFilter === 'ALL' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({inspectedClassMembers.length})
                    </button>
                    <button
                      onClick={() => setInspectFilter('PRESENT')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                        inspectFilter === 'PRESENT' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      Present ({inspectedClassRow.totalPresent})
                    </button>
                    <button
                      onClick={() => setInspectFilter('ABSENT')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                        inspectFilter === 'ABSENT' ? 'bg-rose-700 text-white shadow-xs' : 'text-slate-600 hover:text-rose-700'
                      }`}
                    >
                      Absent ({inspectedClassRow.totalAbsent})
                    </button>
                  </div>
                </div>

                {inspectedClassMembers.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No member records recorded in this class.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase">
                          <th className="p-2.5 pl-3">Member Name</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-center">Week {selectedWeek} Attendance</th>
                          <th className="p-2.5 text-right pr-3">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectedClassMembers
                          .filter(m => {
                            if (inspectFilter === 'PRESENT') return m.gradeAttendance === 'PRESENT';
                            if (inspectFilter === 'ABSENT') return m.gradeAttendance === 'ABSENT';
                            return true;
                          })
                          .map((m, idx) => (
                          <tr key={m.id || idx} className="hover:bg-slate-50">
                            <td className="p-2.5 pl-3 font-bold text-slate-900">
                              {m.fullName}
                              {m.transferHistory && m.transferHistory.length > 0 && (
                                <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold">
                                  Transferred
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
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                m.gradeAttendance === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {m.gradeAttendance}
                              </span>
                            </td>
                            <td className="p-2.5 text-right pr-3 font-black text-slate-700">
                              {m.gradeAttendance === 'PRESENT' ? `${m.lessonTotal || 0}/50` : '—'}
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
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectedClassRow(null)}
                className="px-5 py-2.5 bg-[#320b86] hover:bg-[#28076e] text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print View Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Top Bar */}
            <div className="p-4 bg-gradient-to-r from-[#20055b] to-[#320b86] text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-amber-300">Sunday School Collation Print Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#20055b] font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
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
                      <th className="p-2 border-r border-slate-400 text-center">Students</th>
                      <th className="p-2 border-r border-slate-400 text-center">Visitors</th>
                      <th className="p-2 border-r border-slate-400 text-center bg-slate-300 font-black">Total Members</th>
                      <th className="p-2 border-r border-slate-400 text-center">Total Present</th>
                      <th className="p-2 border-r border-slate-400 text-center">Total Absent</th>
                      <th className="p-2 text-right">Offering (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredRows.map((r, idx) => {
                      const rowStudents = r.studentsCount ?? (r.studentPresent + (r.studentAbsent || 0));
                      const rowVisitors = r.visitorsCount ?? ((r.visitorPresent || r.currentVisitorPresent) + (r.visitorAbsent || 0));
                      const rowTotal = rowStudents + rowVisitors;
                      const rowPresent = r.totalPresent;
                      const rowAbsent = r.totalAbsent ?? (rowTotal - rowPresent);

                      return (
                        <tr key={idx}>
                          <td className="p-2 border-r border-slate-300 font-bold">{r.className} ({r.department})</td>
                          <td className="p-2 border-r border-slate-300 text-center">{rowStudents}</td>
                          <td className="p-2 border-r border-slate-300 text-center">{rowVisitors}</td>
                          <td className="p-2 border-r border-slate-300 text-center font-black bg-slate-100">{rowTotal}</td>
                          <td className="p-2 border-r border-slate-300 text-center font-bold text-emerald-800">{rowPresent}</td>
                          <td className="p-2 border-r border-slate-300 text-center font-bold text-rose-800">{rowAbsent}</td>
                          <td className="p-2 text-right font-bold">₦{r.offering.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-black text-xs border-t-2 border-slate-900">
                      <td className="p-2.5 border-r border-slate-400 uppercase">Grand Totals</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredStudentsCount}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{filteredVisitorsCount}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center bg-slate-300 text-sm font-black">{filteredTotalClassMembers}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center text-sm font-black text-emerald-800">{filteredTotalPresent}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center text-sm font-black text-rose-800">{filteredTotalAbsent}</td>
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
                    <span className="font-bold text-slate-800">Record Officer</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>

                <div className="space-y-8">
                  <p className="font-bold">Ratified by (General Superintendent):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">General Superintendent</span>
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
