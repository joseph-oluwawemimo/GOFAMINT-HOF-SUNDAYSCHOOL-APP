import React, { useState, useMemo, useEffect } from 'react';
import {
  HeartHandshake,
  LayoutDashboard,
  Home,
  FileText,
  Building2,
  Lightbulb,
  ArrowLeft,
  Calendar,
  Filter,
  Shield,
  Users,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  VisitationAssignmentRecord,
  ClassFollowUpReportRecord
} from '../../types';
import { ApplicationProfile } from '../../services/profileService';
import {
  VISITATION_TARGET_PER_CLASS_PER_WEEK,
  VISITATION_MAX_PER_CLASS_PER_WEEK,
  VISITATION_COOLDOWN_WEEKS,
  getClassWeeklyVisitationCandidates,
  computeClassFollowUpSummary,
  computeFollowUpIntelligence
} from '../../utils/visitationEngine';
import { GofamintLogo } from '../GofamintLogo';
import {
  getAllClassesDirectory,
  getAllMembers,
  getAllGrades,
  getAllAbsenceLogs
} from '../../db/indexedDB';

export type FollowUpPortalTab =
  | 'DASHBOARD'
  | 'VISITATION'
  | 'REPORTS'
  | 'CLASS_FOLLOW_UP'
  | 'INTELLIGENCE';

interface FollowUpPortalRootProps {
  authProfile: ApplicationProfile | null;
  classes?: ClassProfile[];
  allMembers?: Member[];
  allGrades?: WeeklyGradeRecord[];
  allAbsenceLogs?: AbsenceLogRecord[];
  quarterNumber: number;
  currentWeek: number;
  onBackToPortalSelect: () => void;
  onSaveAbsenceLog?: (log: AbsenceLogRecord) => Promise<void>;
  onUpdateClassProfile?: (updated: ClassProfile) => Promise<void>;
}

export const FollowUpPortalRoot: React.FC<FollowUpPortalRootProps> = ({
  authProfile,
  classes = [],
  allMembers = [],
  allGrades = [],
  allAbsenceLogs = [],
  quarterNumber,
  currentWeek,
  onBackToPortalSelect,
  onSaveAbsenceLog,
  onUpdateClassProfile
}) => {
  const [activeTab, setActiveTab] = useState<FollowUpPortalTab>('DASHBOARD');
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek || 1);
  const [selectedClassIdFilter, setSelectedClassIdFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visitationPriorityFilter, setVisitationPriorityFilter] = useState<string>('ALL');

  const [loadedClasses, setLoadedClasses] = useState<ClassProfile[]>(classes);
  const [loadedMembers, setLoadedMembers] = useState<Member[]>(allMembers);
  const [loadedGrades, setLoadedGrades] = useState<WeeklyGradeRecord[]>(allGrades);
  const [loadedAbsenceLogs, setLoadedAbsenceLogs] = useState<AbsenceLogRecord[]>(allAbsenceLogs);

  useEffect(() => {
    let isMounted = true;
    async function loadDataset() {
      try {
        const [cls, mems, grds, logs] = await Promise.all([
          getAllClassesDirectory(),
          getAllMembers(),
          getAllGrades(),
          getAllAbsenceLogs()
        ]);
        if (isMounted) {
          if (cls && cls.length > 0) setLoadedClasses(cls);
          if (mems && mems.length > 0) setLoadedMembers(mems);
          if (grds && grds.length > 0) setLoadedGrades(grds);
          if (logs && logs.length > 0) setLoadedAbsenceLogs(logs);
        }
      } catch (err) {
        console.error('Failed to load dataset in FollowUpPortalRoot:', err);
      }
    }
    loadDataset();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (classes && classes.length > 0) setLoadedClasses(classes);
  }, [classes]);

  useEffect(() => {
    if (allMembers && allMembers.length > 0) setLoadedMembers(allMembers);
  }, [allMembers]);

  useEffect(() => {
    if (allGrades && allGrades.length > 0) setLoadedGrades(allGrades);
  }, [allGrades]);

  useEffect(() => {
    if (allAbsenceLogs && allAbsenceLogs.length > 0) setLoadedAbsenceLogs(allAbsenceLogs);
  }, [allAbsenceLogs]);

  // Check role permissions:
  // EVANGELISM_AND_FOLLOW_UP_PERSONNEL and central executive admin roles see all classes.
  // Class teachers and secretaries only see their assigned class.
  const isGlobalFollowUpOfficer = useMemo(() => {
    const role = authProfile?.role;
    if (!role) return false;
    if (role === 'EVANGELISM_AND_FOLLOW_UP_PERSONNEL') return true;
    if (
      role === 'GENERAL_SUPERINTENDENT' ||
      role === 'GENERAL_SECRETARY' ||
      role === 'ASST_GENERAL_SECRETARY' ||
      role === 'ASSISTANT_GENERAL_SECRETARY' ||
      role === 'SUPER_ADMIN' ||
      role === 'DEPARTMENT_SUPERINTENDENT'
    ) {
      return true;
    }
    return false;
  }, [authProfile?.role]);

  const assignedClassId = authProfile?.classId;

  // Strict Class-Level Privacy Filter:
  // If not global officer and assigned to a class, restrict all data to that class!
  const scopedClasses = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedClasses;
    }
    return loadedClasses.filter(c => c.id === assignedClassId);
  }, [loadedClasses, isGlobalFollowUpOfficer, assignedClassId]);

  const scopedMembers = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedMembers.filter(m => m.status !== 'LEFT_CLASS');
    }
    return loadedMembers.filter(m => m.classId === assignedClassId && m.status !== 'LEFT_CLASS');
  }, [loadedMembers, isGlobalFollowUpOfficer, assignedClassId]);

  const scopedGrades = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedGrades;
    }
    return loadedGrades.filter(g => g.classId === assignedClassId);
  }, [loadedGrades, isGlobalFollowUpOfficer, assignedClassId]);

  const scopedAbsenceLogs = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedAbsenceLogs;
    }
    return loadedAbsenceLogs.filter(l => l.classId === assignedClassId);
  }, [loadedAbsenceLogs, isGlobalFollowUpOfficer, assignedClassId]);

  // Merge all visitation assignments from scoped classes
  const allVisitationAssignments = useMemo(() => {
    const merged: Record<string, VisitationAssignmentRecord> = {};
    for (const cls of scopedClasses) {
      if (cls.visitationAssignments) {
        Object.assign(merged, cls.visitationAssignments);
      }
    }
    return merged;
  }, [scopedClasses]);

  // Compute Class Summaries for the selected week
  const classSummaries = useMemo(() => {
    return scopedClasses.map(cls =>
      computeClassFollowUpSummary(
        cls,
        scopedMembers,
        selectedWeek,
        quarterNumber,
        scopedGrades,
        scopedAbsenceLogs,
        cls.visitationAssignments || {}
      )
    );
  }, [scopedClasses, scopedMembers, selectedWeek, quarterNumber, scopedGrades, scopedAbsenceLogs]);

  // Compute Cross-Class Intelligence derived from real data
  const intelligence = useMemo(() => {
    return computeFollowUpIntelligence(
      scopedClasses,
      scopedMembers,
      selectedWeek,
      quarterNumber,
      scopedGrades,
      scopedAbsenceLogs
    );
  }, [scopedClasses, scopedMembers, selectedWeek, quarterNumber, scopedGrades, scopedAbsenceLogs]);

  // Compute High-Level Indicators for Dashboard
  const dashboardKpis = useMemo(() => {
    const totalMembersNeedingFollowUp = intelligence.totalMembersNeedingFollowUp;
    const totalMembersNeedingVisitation = intelligence.totalMembersNeedingVisitation;

    // Consecutive absences breakdown
    let absent1Week = 0;
    let absent2Weeks = 0;
    let absent3PlusWeeks = 0;

    for (const m of scopedMembers) {
      const cls = scopedClasses.find(c => c.id === m.classId);
      const cand = getClassWeeklyVisitationCandidates(
        [m],
        selectedWeek,
        scopedGrades,
        scopedAbsenceLogs,
        cls?.visitationAssignments || {},
        { includeCooldown: true, maxCap: 1 }
      ).candidates[0];

      if (cand) {
        if (cand.consecutiveWeeksAbsent >= 3) absent3PlusWeeks++;
        else if (cand.consecutiveWeeksAbsent === 2) absent2Weeks++;
        else if (cand.consecutiveWeeksAbsent === 1) absent1Week++;
      }
    }

    // Recent follow up activities (this week's logs)
    const recentFollowUpLogs = scopedAbsenceLogs
      .filter(l => l.weekNumber === selectedWeek || !l.weekNumber)
      .slice(0, 10);

    // Recent visitation activities
    const allAssignmentsList = Object.values(allVisitationAssignments) as VisitationAssignmentRecord[];
    const completedVisits = allAssignmentsList.filter(
      (a: VisitationAssignmentRecord) => a.status === 'COMPLETED' && (a.weekNumber === selectedWeek || !a.weekNumber)
    );

    const pendingVisitations = allAssignmentsList.filter(
      (a: VisitationAssignmentRecord) => a.status !== 'COMPLETED' && a.weekNumber === selectedWeek
    );

    const classesWithOutstanding = classSummaries.filter(s => s.pendingFollowUp > 0);

    return {
      totalMembersNeedingFollowUp,
      totalMembersNeedingVisitation,
      absent1Week,
      absent2Weeks,
      absent3PlusWeeks,
      recentFollowUpLogs,
      completedVisits,
      pendingVisitations,
      classesWithOutstanding,
      completionRate: intelligence.overallFollowUpCompletionRate
    };
  }, [scopedMembers, scopedClasses, selectedWeek, scopedGrades, scopedAbsenceLogs, allVisitationAssignments, classSummaries, intelligence]);

  // All visitation candidates for the Visitation Tab (optionally filtered by class & priority)
  const allVisitationCandidates = useMemo(() => {
    const list: Array<{ candidate: any; classProfile: ClassProfile }> = [];

    const targetClasses =
      selectedClassIdFilter === 'ALL'
        ? scopedClasses
        : scopedClasses.filter(c => c.id === selectedClassIdFilter);

    for (const cls of targetClasses) {
      const membersInClass = scopedMembers.filter(m => m.classId === cls.id);
      const { candidates } = getClassWeeklyVisitationCandidates(
        membersInClass,
        selectedWeek,
        scopedGrades,
        scopedAbsenceLogs,
        cls.visitationAssignments || {},
        { includeCooldown: false, maxCap: VISITATION_MAX_PER_CLASS_PER_WEEK }
      );

      for (const cand of candidates) {
        if (visitationPriorityFilter !== 'ALL' && cand.priority !== visitationPriorityFilter) {
          continue;
        }
        if (
          searchQuery.trim() &&
          !cand.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim())
        ) {
          continue;
        }
        list.push({ candidate: cand, classProfile: cls });
      }
    }

    return list;
  }, [scopedClasses, selectedClassIdFilter, scopedMembers, selectedWeek, scopedGrades, scopedAbsenceLogs, visitationPriorityFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 animate-in fade-in duration-300">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-indigo-900/60 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToPortalSelect}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Return to Portal Destination Selection"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Portals</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-white p-1 border border-amber-400/40 shadow-xs flex items-center justify-center">
              <GofamintLogo className="w-full h-full object-contain" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-rose-400" />
                  Evangelism & Follow-Up Portal
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Portal 5
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                {isGlobalFollowUpOfficer ? 'Cross-Class Follow-Up & Visitation Directorate' : `Class Follow-Up Suite · ${scopedClasses[0]?.className || 'Assigned Class'}`}
              </p>
            </div>
          </div>

          {/* Right Controls: Role Badge & Week Selector */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-right">
              <span className="text-[10px] font-bold text-slate-300 block uppercase tracking-wider">
                Active Account
              </span>
              <span className="text-xs font-black text-amber-300">
                {authProfile?.fullName || 'Follow-Up Officer'}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-amber-400" />
              <label htmlFor="portal-week-select" className="text-xs font-bold text-slate-300">
                Week:
              </label>
              <select
                id="portal-week-select"
                value={selectedWeek}
                onChange={e => setSelectedWeek(Number(e.target.value))}
                className="bg-slate-900 text-white text-xs font-black rounded-lg px-2.5 py-1 border border-slate-600 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {Array.from({ length: 13 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800 flex overflow-x-auto no-scrollbar gap-1 py-1.5">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'DASHBOARD'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            1. Follow-Up Dashboard
          </button>

          <button
            onClick={() => setActiveTab('VISITATION')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'VISITATION'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            2. Visitation Queue
          </button>

          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'REPORTS'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            3. Follow-Up Reports
          </button>

          <button
            onClick={() => setActiveTab('CLASS_FOLLOW_UP')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'CLASS_FOLLOW_UP'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            4. Class Follow-Up
          </button>

          <button
            onClick={() => setActiveTab('INTELLIGENCE')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'INTELLIGENCE'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            5. Follow-Up Intelligence
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* TAB 1: FOLLOW-UP DASHBOARD */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Question */}
            <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-rose-900/40 relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30 inline-block">
                  Central Follow-Up Radar · Week {selectedWeek}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Who needs attention?
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
                  Authoritative indicators calculated directly from real Sunday School registers. Highlights active absentees, visitation eligibility, and weekly progress.
                </p>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">
                  Require Follow-Up
                </span>
                <span className="text-3xl font-black text-slate-900 mt-2">
                  {dashboardKpis.totalMembersNeedingFollowUp}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 font-semibold">1+ weeks absent</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">
                  Require Visitation
                </span>
                <span className="text-3xl font-black text-rose-700 mt-2">
                  {dashboardKpis.totalMembersNeedingVisitation}
                </span>
                <span className="text-[11px] text-rose-500 mt-1 font-semibold">Eligible (not in cooldown)</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider">
                  Absent 1 Week
                </span>
                <span className="text-3xl font-black text-blue-700 mt-2">
                  {dashboardKpis.absent1Week}
                </span>
                <span className="text-[11px] text-blue-500 mt-1 font-semibold">Monitor closely</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">
                  Absent 2 Weeks
                </span>
                <span className="text-3xl font-black text-purple-700 mt-2">
                  {dashboardKpis.absent2Weeks}
                </span>
                <span className="text-[11px] text-purple-500 mt-1 font-semibold">Second Priority Visit</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">
                  Absent 3+ Weeks
                </span>
                <span className="text-3xl font-black text-rose-800 mt-2">
                  {dashboardKpis.absent3PlusWeeks}
                </span>
                <span className="text-[11px] text-rose-600 mt-1 font-black">Highest Priority Visit</span>
              </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Pending Visitation Assignments
                </span>
                <span className="text-2xl font-black text-amber-600 mt-1">
                  {dashboardKpis.pendingVisitations.length}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">Awaiting completion</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Completed Visits
                </span>
                <span className="text-2xl font-black text-emerald-600 mt-1">
                  {dashboardKpis.completedVisits.length}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">Recorded this week</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Classes With Outstanding
                </span>
                <span className="text-2xl font-black text-indigo-600 mt-1">
                  {dashboardKpis.classesWithOutstanding.length}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">Need follow-up push</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Follow-Up Completion Rate
                </span>
                <span className="text-2xl font-black text-teal-600 mt-1">
                  {dashboardKpis.completionRate}%
                </span>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardKpis.completionRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Activities Feeds */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Follow-Up Activities */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-rose-500" />
                    Recent Follow-Up Activities
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">Week {selectedWeek}</span>
                </div>

                {dashboardKpis.recentFollowUpLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                    No data available for Week {selectedWeek}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {dashboardKpis.recentFollowUpLogs.map(log => {
                      const member = scopedMembers.find(m => m.id === log.memberId);
                      const cls = scopedClasses.find(c => c.id === log.classId);

                      return (
                        <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div>
                            <span className="font-black text-slate-900 block">
                              {member?.fullName || 'Class Member'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {cls?.className || 'Class'} · Method: {log.contactMethod}
                            </span>
                            {log.notes && (
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 italic">
                                "{log.notes}"
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">
                            {log.decisionDate || log.loggedAt?.split('T')[0] || 'Logged'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Completed Visitations */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Recent Completed Visitations
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">4-Week Cooldown Active</span>
                </div>

                {dashboardKpis.completedVisits.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                    No data available for Week {selectedWeek}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {dashboardKpis.completedVisits.map(visit => {
                      const cls = scopedClasses.find(c => c.id === visit.classId);

                      return (
                        <div key={visit.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div>
                            <span className="font-black text-slate-900 block">
                              {visit.memberName || 'Member Visited'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {cls?.className || 'Class'} · Visitor: {visit.assignedStaffName}
                            </span>
                            {visit.outcome && (
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 italic">
                                "{visit.outcome}"
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold shrink-0">
                            {visit.completedAt || 'Completed'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VISITATION QUEUE */}
        {activeTab === 'VISITATION' && (
          <div className="space-y-6 animate-fade-in">
            {/* Controls Bar */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Home className="w-5 h-5 text-indigo-600" />
                  Weekly Visitation Candidate Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: {VISITATION_TARGET_PER_CLASS_PER_WEEK} visits/class (Max: {VISITATION_MAX_PER_CLASS_PER_WEEK}). Respects 4-week cooldown protection.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search member..."
                    className="pl-8 pr-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* Class Filter (if global officer) */}
                {isGlobalFollowUpOfficer && (
                  <select
                    value={selectedClassIdFilter}
                    onChange={e => setSelectedClassIdFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="ALL">All Classes ({scopedClasses.length})</option>
                    {scopedClasses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.className} ({c.department})
                      </option>
                    ))}
                  </select>
                )}

                {/* Priority Filter */}
                <select
                  value={visitationPriorityFilter}
                  onChange={e => setVisitationPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HIGH">Priority 1 (High - 3+ wks)</option>
                  <option value="MEDIUM">Priority 2 (Med - 2 wks)</option>
                  <option value="LOW">Priority 3 (Low - 1 wk)</option>
                </select>
              </div>
            </div>

            {/* Candidates List */}
            {allVisitationCandidates.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-black text-slate-900">No Visitation Candidates Pending</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  All eligible members for the selected filter have either been visited within the 4-week cooldown or are currently attending.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4 text-center">Absence</th>
                        <th className="py-3 px-4">Last Visit</th>
                        <th className="py-3 px-4">Assigned Worker</th>
                        <th className="py-3 px-4">Visit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {allVisitationCandidates.map(({ candidate, classProfile: cls }) => {
                        const assignmentKey = `${cls.id}_w${selectedWeek}_m${candidate.memberId}`;
                        const assignment = cls.visitationAssignments?.[assignmentKey];

                        return (
                          <tr key={`${cls.id}_${candidate.memberId}`} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  candidate.priority === 'HIGH'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : candidate.priority === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                                }`}
                              >
                                {candidate.priority === 'HIGH'
                                  ? 'Priority 1'
                                  : candidate.priority === 'MEDIUM'
                                  ? 'Priority 2'
                                  : 'Priority 3'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <div className="flex flex-col">
                                <span>{candidate.fullName}</span>
                                {candidate.phone && (
                                  <span className="text-[10px] text-slate-400 font-medium">{candidate.phone}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-700">
                              <div className="flex flex-col">
                                <span>{cls.className}</span>
                                <span className="text-[10px] text-slate-400">{cls.department}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-black text-xs">
                                {candidate.consecutiveWeeksAbsent} {candidate.consecutiveWeeksAbsent === 1 ? 'wk' : 'wks'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {candidate.lastVisitedDate || <span className="text-slate-400 italic">Never</span>}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">
                              {assignment?.assignedStaffName || <span className="text-slate-400 italic">Unassigned</span>}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  assignment?.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : assignment?.status === 'ASSIGNED'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {assignment?.status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FOLLOW-UP REPORTS */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-rose-600" />
                  Weekly Class Follow-Up Submissions (Week {selectedWeek})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audited reports pushed directly from Class Registers into the Central Follow-Up layer.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-600">
                  {classSummaries.filter(s => s.status === 'SUBMITTED').length} of {classSummaries.length} Classes Submitted
                </span>
              </div>
            </div>

            {/* Reports Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Members</th>
                      <th className="py-3 px-4 text-center">Present</th>
                      <th className="py-3 px-4 text-center">Absent</th>
                      <th className="py-3 px-4 text-center">Follow-Up Need</th>
                      <th className="py-3 px-4 text-center">Visitation Need</th>
                      <th className="py-3 px-4 text-center">Completed Visits</th>
                      <th className="py-3 px-4">Submitted By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {classSummaries.map(report => (
                      <tr key={report.classId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-900">{report.className}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-semibold">{report.department}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              report.status === 'SUBMITTED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {report.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {report.totalClassMembers}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-700">
                          {report.present}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-rose-700">
                          {report.absent}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-amber-700">
                          {report.membersRequiringFollowUp}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-indigo-700">
                          {report.membersRequiringVisitation}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-teal-700">
                          {report.visitationCompleted}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {report.status === 'SUBMITTED' ? report.submittedBy : <span className="italic">Not submitted yet</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLASS FOLLOW-UP MATRIX */}
        {activeTab === 'CLASS_FOLLOW_UP' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Class-by-Class Attendance & Follow-Up Performance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time operational matrix showing present, absent, follow-up need, and completed vs pending visits for Week {selectedWeek}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {classSummaries.map(cls => (
                <div
                  key={cls.classId}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">{cls.className}</h3>
                      <span className="text-[11px] font-bold text-slate-500">{cls.department}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        cls.status === 'SUBMITTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {cls.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                    <div className="p-2 rounded-xl bg-slate-50">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Total</span>
                      <span className="text-base font-black text-slate-900">{cls.totalClassMembers}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50">
                      <span className="text-[10px] text-emerald-600 font-bold block uppercase">Present</span>
                      <span className="text-base font-black text-emerald-700">{cls.present}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50">
                      <span className="text-[10px] text-rose-600 font-bold block uppercase">Absent</span>
                      <span className="text-base font-black text-rose-700">{cls.absent}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs font-semibold">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Members Requiring Follow-Up:</span>
                      <span className="font-black text-amber-700">{cls.membersRequiringFollowUp}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Members Requiring Visitation:</span>
                      <span className="font-black text-indigo-700">{cls.membersRequiringVisitation}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Visitation Completed:</span>
                      <span className="font-black text-teal-700">{cls.visitationCompleted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pending Visitation:</span>
                      <span className="font-black text-rose-700">{cls.pendingVisitation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: FOLLOW-UP INTELLIGENCE */}
        {activeTab === 'INTELLIGENCE' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/40">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30 inline-block mb-2">
                Predictive & Historical Decision Support
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Follow-Up Intelligence & Analytics
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium mt-1">
                Zero fabricated statistics. Answers mission-critical questions directly derived from class records, absence logs, and visitation cooldown data.
              </p>
            </div>

            {/* Questions Answered Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Question 1: Highest Need Class */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
                  1
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  Which class has the highest follow-up need?
                </h3>
                {intelligence.classWithHighestNeed ? (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="text-base font-black text-rose-900 block">
                      {intelligence.classWithHighestNeed.className}
                    </span>
                    <span className="text-xs text-rose-700 font-bold block mt-0.5">
                      {intelligence.classWithHighestNeed.count} members requiring follow-up ({intelligence.classWithHighestNeed.department})
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No data available</p>
                )}
              </div>

              {/* Question 2: Most Persistent Absences */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                  2
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  Which class has the most persistent absences?
                </h3>
                {intelligence.classWithMostPersistentAbsences ? (
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
                    <span className="text-base font-black text-purple-900 block">
                      {intelligence.classWithMostPersistentAbsences.className}
                    </span>
                    <span className="text-xs text-purple-700 font-bold block mt-0.5">
                      {intelligence.classWithMostPersistentAbsences.count} members absent 3+ consecutive weeks
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No persistent absentees recorded</p>
                )}
              </div>

              {/* Question 3: Immediate Visitation Required */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                  3
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  Which members require immediate visitation?
                </h3>
                <span className="text-2xl font-black text-amber-600 block">
                  {intelligence.immediateVisitationRequired.length} Members
                </span>
                <span className="text-xs text-slate-500 font-semibold block">
                  Absent 3+ weeks and not in 4-week cooldown
                </span>
              </div>

              {/* Question 4: Followed Up This Week */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  4
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  How many people were followed up this week?
                </h3>
                <span className="text-2xl font-black text-blue-600 block">
                  {intelligence.peopleFollowedUpThisWeek} People
                </span>
                <span className="text-xs text-slate-500 font-semibold block">
                  Logged in Class Registers for Week {selectedWeek}
                </span>
              </div>

              {/* Question 5: Visitations Completed */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  5
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  How many visitations were completed?
                </h3>
                <span className="text-2xl font-black text-emerald-600 block">
                  {intelligence.visitationsCompletedThisWeek} Visits
                </span>
                <span className="text-xs text-slate-500 font-semibold block">
                  Pastoral visitations logged with outcome reports
                </span>
              </div>

              {/* Question 6: Returned After Follow-Up */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-black">
                  6
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  How many people returned after follow-up?
                </h3>
                <span className="text-2xl font-black text-teal-600 block">
                  {intelligence.returnedAfterFollowUp} Restorations
                </span>
                <span className="text-xs text-slate-500 font-semibold block">
                  Members marked PRESENT following pastoral contact
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
