import React, { useState, useMemo, useEffect } from 'react';
import {
  HeartHandshake,
  LayoutDashboard,
  Home,
  FileText,
  BarChart3,
  ArrowLeft,
  Calendar,
  Filter,
  Shield,
  Users,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
  UserCheck,
  UserX,
  MessageCircle,
  CheckCircle2,
  Check,
  X,
  ChevronRight,
  TrendingUp,
  Building,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  VisitationAssignmentRecord,
  ClassFollowUpReportRecord,
  QuarterData
} from '../../types';
import { ApplicationProfile } from '../../services/profileService';
import {
  VISITATION_TARGET_PER_CLASS_PER_WEEK,
  VISITATION_MAX_PER_CLASS_PER_WEEK,
  VISITATION_COOLDOWN_WEEKS,
  getClassWeeklyVisitationCandidates,
  getWeeklyVisitationAssignments,
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
import { FollowUpReportView } from '../FollowUpReportView';
import { FollowUpWeekSyncBar } from './FollowUpWeekSyncBar';
import { FollowUpChartsView } from './FollowUpChartsView';

export type FollowUpPortalTab =
  | 'DASHBOARD'
  | 'VISITATION'
  | 'WELFARE'
  | 'CONSOLIDATED_REPORT'
  | 'ANALYTICS';

interface FollowUpPortalRootProps {
  authProfile: ApplicationProfile | null;
  classes?: ClassProfile[];
  allMembers?: Member[];
  allGrades?: WeeklyGradeRecord[];
  allAbsenceLogs?: AbsenceLogRecord[];
  quarterNumber: number;
  currentWeek: number;
  quarterData?: QuarterData | null;
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
  quarterData,
  onBackToPortalSelect,
  onSaveAbsenceLog,
  onUpdateClassProfile
}) => {
  const [activeTab, setActiveTab] = useState<FollowUpPortalTab>('DASHBOARD');
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek || 1);

  useEffect(() => {
    setSelectedWeek(currentWeek || 1);
  }, [currentWeek]);

  const [selectedClassIdFilter, setSelectedClassIdFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visitationPriorityFilter, setVisitationPriorityFilter] = useState<string>('ALL');
  const [visitationMode, setVisitationMode] = useState<'CROSS_CLASS_QUEUE' | 'CLASS_SLOTS'>('CROSS_CLASS_QUEUE');
  const [consolidatedMode, setConsolidatedMode] = useState<'ALL_CLASSES_OVERVIEW' | 'CLASS_MATRIX'>('ALL_CLASSES_OVERVIEW');
  const [inspectClassId, setInspectClassId] = useState<string | null>(null);

  // Officer / Admin Direct Outreach Modal State for 4-5+ Weeks Absentees
  const [officerModalMember, setOfficerModalMember] = useState<{
    member: Member;
    consecutiveWeeks: number;
    classProfile?: ClassProfile;
  } | null>(null);
  const [officerContactMethod, setOfficerContactMethod] = useState<'PHONE_CALL' | 'PHYSICAL_VISIT' | 'PASTORAL_LETTER'>('PHONE_CALL');
  const [officerNotes, setOfficerNotes] = useState('');
  const [officerDecision, setOfficerDecision] = useState<string>('CONTINUE_OUTREACH');
  const [isSavingOfficerLog, setIsSavingOfficerLog] = useState(false);

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

  // Scope: Global Follow-Up Officer vs Class Secretary/Teacher
  const userRole = authProfile?.role || '';
  const isGlobalFollowUpOfficer = [
    'EVANGELISM_AND_FOLLOW_UP_PERSONNEL',
    'GENERAL_SUPERINTENDENT',
    'GENERAL_SECRETARY',
    'ASST_GENERAL_SECRETARY',
    'ASSISTANT_GENERAL_SECRETARY',
    'SUPER_ADMIN',
    'DEPARTMENT_SUPERINTENDENT'
  ].includes(userRole);

  const assignedClassId = authProfile?.classId;

  const scopedClasses = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedClasses;
    }
    return loadedClasses.filter(c => c.id === assignedClassId);
  }, [isGlobalFollowUpOfficer, assignedClassId, loadedClasses]);

  const scopedMembers = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedMembers;
    }
    return loadedMembers.filter(m => m.classId === assignedClassId);
  }, [isGlobalFollowUpOfficer, assignedClassId, loadedMembers]);

  const scopedGrades = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedGrades;
    }
    return loadedGrades.filter(g => g.classId === assignedClassId);
  }, [isGlobalFollowUpOfficer, assignedClassId, loadedGrades]);

  const scopedAbsenceLogs = useMemo(() => {
    if (isGlobalFollowUpOfficer || !assignedClassId) {
      return loadedAbsenceLogs;
    }
    return loadedAbsenceLogs.filter(l => l.classId === assignedClassId);
  }, [isGlobalFollowUpOfficer, assignedClassId, loadedAbsenceLogs]);

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (assignedClassId && !isGlobalFollowUpOfficer) return assignedClassId;
    return scopedClasses[0]?.id || '';
  });

  useEffect(() => {
    if (scopedClasses.length > 0) {
      if (!selectedClassId || !scopedClasses.some(c => c.id === selectedClassId)) {
        setSelectedClassId(scopedClasses[0].id);
      }
    }
  }, [scopedClasses, selectedClassId]);

  const activeClassProfile = useMemo(() => {
    return scopedClasses.find(c => c.id === selectedClassId) || scopedClasses[0] || null;
  }, [scopedClasses, selectedClassId]);

  const activeClassMembers = useMemo(() => {
    if (!activeClassProfile) return [];
    return scopedMembers.filter(m => m.classId === activeClassProfile.id);
  }, [scopedMembers, activeClassProfile]);

  const activeClassGrades = useMemo(() => {
    if (!activeClassProfile) return [];
    return scopedGrades.filter(g => g.classId === activeClassProfile.id);
  }, [scopedGrades, activeClassProfile]);

  const activeClassAbsenceLogs = useMemo(() => {
    if (!activeClassProfile) return [];
    return scopedAbsenceLogs.filter(l => l.classId === activeClassProfile.id);
  }, [scopedAbsenceLogs, activeClassProfile]);

  const handleUpdateClassProfile = async (updated: ClassProfile) => {
    setLoadedClasses(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (onUpdateClassProfile) {
      await onUpdateClassProfile(updated);
    }
  };

  const handleSaveAbsenceLog = async (log: AbsenceLogRecord) => {
    setLoadedAbsenceLogs(prev => {
      const idx = prev.findIndex(l => l.id === log.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = log;
        return copy;
      }
      return [log, ...prev];
    });
    if (onSaveAbsenceLog) {
      await onSaveAbsenceLog(log);
    }
  };

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

  // High-Level Indicators for Dashboard
  const dashboardKpis = useMemo(() => {
    const totalMembersNeedingFollowUp = intelligence.totalMembersNeedingFollowUp;
    const totalMembersNeedingVisitation = intelligence.totalMembersNeedingVisitation;

    let absent1Week = 0;
    let absent2Weeks = 0;
    let absent3Weeks = 0;
    let absent4to5Weeks = 0;
    let absent6PlusWeeks = 0;

    for (const m of scopedMembers) {
      const cls = scopedClasses.find(c => c.id === m.classId);
      const cand = getClassWeeklyVisitationCandidates(
        [m],
        selectedWeek,
        scopedGrades,
        scopedAbsenceLogs,
        cls?.visitationAssignments || {},
        { includeCooldown: true, maxCap: 1, quarterNumber }
      ).candidates[0];

      if (cand && cand.consecutiveWeeksAbsent > 0) {
        const weeks = cand.consecutiveWeeksAbsent;
        if (weeks === 1) absent1Week++;
        else if (weeks === 2) absent2Weeks++;
        else if (weeks === 3) absent3Weeks++;
        else if (weeks >= 4 && weeks <= 5) absent4to5Weeks++;
        else if (weeks >= 6) absent6PlusWeeks++;
      }
    }

    const recentFollowUpLogs = scopedAbsenceLogs
      .filter(l => l.weekNumber === selectedWeek || !l.weekNumber)
      .slice(0, 10);

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
      absent3Weeks,
      absent4to5Weeks,
      absent6PlusWeeks,
      recentFollowUpLogs,
      completedVisits,
      pendingVisitations,
      classesWithOutstanding,
      completionRate: intelligence.overallFollowUpCompletionRate
    };
  }, [scopedMembers, scopedClasses, selectedWeek, scopedGrades, scopedAbsenceLogs, allVisitationAssignments, classSummaries, intelligence]);

  // All visitation candidates for the Visitation Tab
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
        { includeCooldown: false, maxCap: VISITATION_MAX_PER_CLASS_PER_WEEK, quarterNumber }
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

  // Members grouped by Absence Stages for Welfare Reach View
  const stagedWelfareMembers = useMemo(() => {
    const targetClasses =
      selectedClassIdFilter === 'ALL'
        ? scopedClasses
        : scopedClasses.filter(c => c.id === selectedClassIdFilter);

    const stages: {
      week1: Array<{ member: Member; classProfile: ClassProfile; weeks: number }>;
      week2: Array<{ member: Member; classProfile: ClassProfile; weeks: number }>;
      week3: Array<{ member: Member; classProfile: ClassProfile; weeks: number }>;
      week4to5: Array<{ member: Member; classProfile: ClassProfile; weeks: number }>;
      week6Plus: Array<{ member: Member; classProfile: ClassProfile; weeks: number }>;
    } = {
      week1: [],
      week2: [],
      week3: [],
      week4to5: [],
      week6Plus: []
    };

    for (const cls of targetClasses) {
      const membersInClass = scopedMembers.filter(m => m.classId === cls.id);
      for (const m of membersInClass) {
        const cand = getClassWeeklyVisitationCandidates(
          [m],
          selectedWeek,
          scopedGrades,
          scopedAbsenceLogs,
          cls.visitationAssignments || {},
          { includeCooldown: true, maxCap: 1, quarterNumber }
        ).candidates[0];

        if (cand && cand.consecutiveWeeksAbsent > 0) {
          const w = cand.consecutiveWeeksAbsent;
          if (w === 1) stages.week1.push({ member: m, classProfile: cls, weeks: 1 });
          else if (w === 2) stages.week2.push({ member: m, classProfile: cls, weeks: 2 });
          else if (w === 3) stages.week3.push({ member: m, classProfile: cls, weeks: 3 });
          else if (w >= 4 && w <= 5) stages.week4to5.push({ member: m, classProfile: cls, weeks: w });
          else if (w >= 6) stages.week6Plus.push({ member: m, classProfile: cls, weeks: w });
        }
      }
    }

    return stages;
  }, [scopedClasses, selectedClassIdFilter, scopedMembers, selectedWeek, scopedGrades, scopedAbsenceLogs]);

  // Submit Officer Direct Outreach for 4-5+ Weeks Absentees
  const handleSaveOfficerOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerModalMember) return;
    setIsSavingOfficerLog(true);
    try {
      const logRecord: AbsenceLogRecord = {
        id: `officer_log_${Date.now()}_${officerModalMember.member.id}`,
        classId: officerModalMember.member.classId,
        memberId: officerModalMember.member.id,
        contactMethod: officerContactMethod,
        callerStaffId: authProfile?.id || 'officer_admin',
        callerStaffName: authProfile?.displayName || 'Evangelism & Follow-Up Officer',
        notes: `[Follow-Up Directorate Direct Outreach] ${officerNotes.trim()}`,
        date: new Date().toISOString().split('T')[0],
        weekNumber: selectedWeek,
        consecutiveWeeksAbsent: officerModalMember.weeks || 4,
        urgencyLevel: (officerModalMember.weeks >= 6 ? 'CRITICAL' : 'RED') as any,
        resolved: officerDecision === 'RETURNING_THIS_SUNDAY',
        escalatedToAdmin: true,
        escalationDecision: officerDecision as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await handleSaveAbsenceLog(logRecord);
      setOfficerModalMember(null);
      setOfficerNotes('');
    } catch (err) {
      console.error('Failed to save officer outreach:', err);
      alert('Could not record outreach log.');
    } finally {
      setIsSavingOfficerLog(false);
    }
  };

  // Nav Items for trademark sidebar
  const navItems = [
    {
      id: 'DASHBOARD' as const,
      label: 'Executive Radar',
      shortLabel: 'Radar',
      icon: LayoutDashboard,
      badge: dashboardKpis.totalMembersNeedingFollowUp > 0 ? dashboardKpis.totalMembersNeedingFollowUp : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'VISITATION' as const,
      label: 'Visitation Queue',
      shortLabel: 'Visitation',
      icon: Home,
      badge: dashboardKpis.pendingVisitations.length > 0 ? dashboardKpis.pendingVisitations.length : undefined,
      badgeColor: 'bg-amber-400 text-slate-900'
    },
    {
      id: 'WELFARE' as const,
      label: 'Welfare Reach',
      shortLabel: 'Welfare',
      icon: HeartHandshake,
      badge: dashboardKpis.absent4to5Weeks + dashboardKpis.absent6PlusWeeks > 0 ? dashboardKpis.absent4to5Weeks + dashboardKpis.absent6PlusWeeks : undefined,
      badgeColor: 'bg-red-600 text-white font-black'
    },
    {
      id: 'CONSOLIDATED_REPORT' as const,
      label: 'All Classes Performance',
      shortLabel: 'Performance',
      icon: FileText
    },
    {
      id: 'ANALYTICS' as const,
      label: 'Growth & Intelligence',
      shortLabel: 'Analytics',
      icon: BarChart3
    }
  ];

  return (
    <div className="jobie-admin-canvas flex min-h-screen font-sans selection:bg-[#320b86] selection:text-white relative bg-[#f4f7fe] text-slate-800">
      
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (TRADEMARK JOBIE DESIGN WITH CARVED-OUT ACTIVE NOTCH) */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 jobie-sidebar shrink-0 sticky top-0 h-screen z-30 shadow-2xl overflow-hidden">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-white/10 shrink-0">
          <GofamintLogo size={42} />
          <div className="min-w-0">
            <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase font-['Cinzel',serif] block truncate">
              GOFAMINT HOF
            </span>
            <h2 className="text-sm font-black text-white font-['Cinzel',serif] tracking-wide truncate">
              Follow-Up Portal
            </h2>
            <span className="inline-block text-[9px] font-bold text-purple-200 bg-white/15 px-2 py-0.5 rounded-full mt-1 truncate max-w-full">
              Evangelism & Visitation
            </span>
          </div>
        </div>

        {/* Officer Profile Info Chip */}
        <div className="px-5 py-3.5 bg-white/5 border-b border-white/10 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-xs">
            <HeartHandshake className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-black tracking-wider text-purple-300/80 block">
              Follow-Up Officer
            </span>
            <p className="text-xs font-black text-white truncate">
              {authProfile?.displayName || 'Evangelist F.O. Samuel'}
            </p>
          </div>
        </div>

        {/* Navigation Section with Trademark Carved Notch */}
        <div className="flex-1 py-5 space-y-1 overflow-y-auto no-scrollbar">
          <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
            Directorate Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                id={`sidebar-followup-${item.id.toLowerCase()}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'CONSOLIDATED_REPORT') {
                    setConsolidatedMode('ALL_CLASSES_OVERVIEW');
                    setInspectClassId(null);
                  }
                }}
                className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                  isActive
                    ? 'jobie-notch-item active'
                    : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                <span className="truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className={`ml-auto px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                    isActive ? 'bg-[#320b86] text-white' : item.badgeColor || 'bg-amber-400 text-slate-900'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Actions: Exit / Back to Portals */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onBackToPortalSelect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Portals</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE BOTTOM NAVIGATION (PRESERVED FOR PHONES & TOUCH SCREENS)         */}
      {/* ========================================================================= */}
      <nav aria-label="Follow-Up portal sections" className="fixed inset-x-0 bottom-0 z-50 lg:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-7xl mx-auto grid grid-cols-5 items-stretch gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                id={`mobile-followup-${item.id.toLowerCase()}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'CONSOLIDATED_REPORT') {
                    setConsolidatedMode('ALL_CLASSES_OVERVIEW');
                    setInspectClassId(null);
                  }
                }}
                className={`min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-1.5 min-h-[50px] rounded-xl text-[9px] font-bold transition-all relative cursor-pointer ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.shortLabel}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className={`absolute top-1 right-1 px-1.5 py-0.2 text-[8px] font-black rounded-full ${
                    item.badgeColor || 'bg-amber-400 text-slate-900'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* MAIN CONTENT WORKSPACE                                                    */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        
        {/* TOP BAR: OFFICER IDENTITY & SUNDAY SCHOOL YEAR */}
        <header className="bg-white border-b border-slate-200/90 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBackToPortalSelect}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Back to Portals"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-['Cinzel',serif]">
                    Evangelism & Follow-Up Directorate
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-[#320b86] border border-purple-200">
                    Oversight Portal
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="font-bold text-slate-700">{authProfile?.displayName || 'Evangelist F.O. Samuel'}</span>
                  <span>•</span>
                  <span>Evangelism & Follow-Up Officer</span>
                  <span>•</span>
                  <span className="font-semibold text-rose-700">Sunday School Year 2026 • Quarter {quarterNumber}</span>
                </div>
              </div>
            </div>

            {/* Quick Filter Pill */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter:</span>
              <select
                value={selectedClassIdFilter}
                onChange={e => setSelectedClassIdFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-black rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-xs"
              >
                <option value="ALL">All Classes (Cumulative)</option>
                {scopedClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.className} ({c.department})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* NEATLY PLACED SYNCHRONIZED WEEK BAR */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 w-full">
          <FollowUpWeekSyncBar
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
            totalWeeks={12}
            quarter={quarterData}
            quarterNumber={quarterNumber}
            label="Follow-up week"
          />
        </div>

        {/* WORKSPACE VIEW ROUTER */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
          
          {/* ========================================================================= */}
          {/* TAB 1: EXECUTIVE RADAR & DASHBOARD                                        */}
          {/* ========================================================================= */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* "Who Needs Attention" Hero Banner */}
              <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-[#1e0a45] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-rose-900/40 relative overflow-hidden">
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30 inline-block">
                      Central Follow-Up Radar · Week {selectedWeek}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/30 inline-block">
                      Officer: {authProfile?.displayName || 'Evangelist F.O. Samuel'}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Who needs attention?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-3xl font-medium leading-relaxed">
                    Centrally compiled from class register rolls. Identifies members requiring phone check-ins, home visits, or direct Directorate intervention to preserve attendance and care for souls.
                  </p>
                </div>
              </div>

              {/* 5 Interactive Visualizations & Histogram Section */}
              <FollowUpChartsView
                classes={scopedClasses}
                members={scopedMembers}
                grades={scopedGrades}
                absenceLogs={scopedAbsenceLogs}
                selectedWeek={selectedWeek}
                quarterNumber={quarterNumber}
                selectedClassIdFilter={selectedClassIdFilter}
                onSelectClassFilter={setSelectedClassIdFilter}
                isFullAnalyticsMode={false}
              />

              {/* KPI Summary Strip */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 pl-1 block">
                  Authoritative Operational Summary Strip (Week {selectedWeek})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                      Require Follow-Up
                    </span>
                    <span className="text-2xl font-black text-slate-900 mt-1">
                      {dashboardKpis.totalMembersNeedingFollowUp}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">1+ wks absent</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider">
                      Require Visitation
                    </span>
                    <span className="text-2xl font-black text-rose-700 mt-1">
                      {dashboardKpis.totalMembersNeedingVisitation}
                    </span>
                    <span className="text-[10px] text-rose-600 font-semibold">Active queue</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">
                      Absent 1 Wk
                    </span>
                    <span className="text-2xl font-black text-blue-700 mt-1">
                      {dashboardKpis.absent1Week}
                    </span>
                    <span className="text-[10px] text-blue-500 font-semibold">Message & call</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-orange-700 uppercase tracking-wider">
                      Absent 2 Wks
                    </span>
                    <span className="text-2xl font-black text-orange-700 mt-1">
                      {dashboardKpis.absent2Weeks}
                    </span>
                    <span className="text-[10px] text-orange-600 font-semibold">Phone call</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider">
                      Absent 3 Wks
                    </span>
                    <span className="text-2xl font-black text-rose-800 mt-1">
                      {dashboardKpis.absent3Weeks}
                    </span>
                    <span className="text-[10px] text-rose-700 font-semibold">Home visit</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-red-200 shadow-xs flex flex-col justify-between bg-red-50/40">
                    <span className="text-[10px] font-black text-red-800 uppercase tracking-wider">
                      4–5 Wks Admin Care
                    </span>
                    <span className="text-2xl font-black text-red-900 mt-1">
                      {dashboardKpis.absent4to5Weeks}
                    </span>
                    <span className="text-[10px] text-red-700 font-black">Officer action</span>
                  </div>
                </div>

                {/* Second KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white rounded-2xl p-4 border border-purple-200 bg-purple-50/30 flex flex-col justify-between shadow-xs">
                    <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider">
                      6+ Weeks Urgent Review
                    </span>
                    <span className="text-2xl font-black text-purple-900 mt-1">
                      {dashboardKpis.absent6PlusWeeks}
                    </span>
                    <span className="text-[10px] text-purple-600 font-semibold">Permanent review</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Pending Visitations
                    </span>
                    <span className="text-2xl font-black text-amber-600 mt-1">
                      {dashboardKpis.pendingVisitations.length}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">Allocated this week</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Completed Visits
                    </span>
                    <span className="text-2xl font-black text-emerald-600 mt-1">
                      {dashboardKpis.completedVisits.length}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Recorded this week</span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Follow-Up Completion
                    </span>
                    <span className="text-2xl font-black text-teal-600 mt-1">
                      {dashboardKpis.completionRate}%
                    </span>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className="bg-teal-500 h-1.5 rounded-full"
                        style={{ width: `${dashboardKpis.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Feeds */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <HeartHandshake className="w-4 h-4 text-rose-500" />
                      Recent Follow-Up Outreach Logs
                    </h3>
                    <span className="text-xs text-slate-400 font-bold">Week {selectedWeek}</span>
                  </div>

                  {dashboardKpis.recentFollowUpLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                      No follow-up activity logged yet for Week {selectedWeek}
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
                                {cls?.className || 'Class'} · {log.contactMethod}
                              </span>
                              {log.notes && (
                                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 italic">
                                  "{log.notes}"
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                              {log.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <Home className="w-4 h-4 text-emerald-500" />
                      Completed Visitations This Week
                    </h3>
                    <span className="text-xs text-slate-400 font-bold">Week {selectedWeek}</span>
                  </div>

                  {dashboardKpis.completedVisits.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                      No visitations completed yet for Week {selectedWeek}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {dashboardKpis.completedVisits.map(visit => {
                        const member = scopedMembers.find(m => m.id === visit.memberId);
                        const cls = scopedClasses.find(c => c.id === visit.classId);

                        return (
                          <div key={visit.id} className="py-2.5 flex items-start justify-between gap-3">
                            <div>
                              <span className="font-black text-slate-900 block">
                                {member?.fullName || 'Member Visited'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {cls?.className || 'Class'} · Visitor: {visit.assignedStaffName || 'Assigned Staff'}
                              </span>
                              {visit.feedbackNotes && (
                                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 italic">
                                  "{visit.feedbackNotes}"
                                </p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-full uppercase">
                              Done
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

          {/* ========================================================================= */}
          {/* TAB 2: VISITATION QUEUE WORKSPACE (READ-ONLY/STATUS FOCUS)                */}
          {/* ========================================================================= */}
          {activeTab === 'VISITATION' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Home className="w-5 h-5 text-indigo-600" />
                    Weekly Visitation Queue & Candidate Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Central oversight of 4-slot prioritized visits per class (Max: {VISITATION_MAX_PER_CLASS_PER_WEEK}). Cooldown protects visited members for 4 weeks. Individual visit recording actions remain in Class Registers.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
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

              {allVisitationCandidates.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-black text-slate-900">No Visitation Candidates Pending</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    All candidates for this filter have either completed their visit, are in active 4-week cooldown, or are present in class.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Priority Tier</th>
                          <th className="py-3 px-4">Member Name</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4 text-center">Absence</th>
                          <th className="py-3 px-4">Last Visit</th>
                          <th className="py-3 px-4">Assigned Visitor</th>
                          <th className="py-3 px-4 text-center">Visit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allVisitationCandidates.map(({ candidate, classProfile: cls }) => {
                          const assignment = getWeeklyVisitationAssignments(cls.visitationAssignments || {}, selectedWeek, quarterNumber)
                            .find(record => record.memberId === candidate.memberId);

                          return (
                            <tr key={`${cls.id}_${candidate.memberId}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    candidate.priority === 'HIGH'
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : candidate.priority === 'MEDIUM'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                                  }`}
                                >
                                  {candidate.priority === 'HIGH'
                                    ? 'Priority 1 (3+ wks)'
                                    : candidate.priority === 'MEDIUM'
                                    ? 'Priority 2 (2 wks)'
                                    : 'Priority 3 (1 wk)'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-black text-slate-900">
                                <div>{candidate.fullName}</div>
                                {candidate.phone && (
                                  <span className="text-[10px] text-slate-400 font-medium">{candidate.phone}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-700">
                                <div>{cls.className}</div>
                                <span className="text-[10px] text-slate-400">{cls.department}</span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-black text-xs">
                                  {candidate.consecutiveWeeksAbsent} {candidate.consecutiveWeeksAbsent === 1 ? 'wk' : 'wks'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 font-medium">
                                {candidate.lastVisitedDate || <span className="text-slate-400 italic">Never</span>}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-800">
                                {assignment?.assignedStaffName || <span className="text-slate-400 italic">Unassigned</span>}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    assignment?.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : assignment?.status === 'ASSIGNED'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
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

          {/* ========================================================================= */}
          {/* TAB 3: WELFARE REACH (STAGED MONITORING & 4-5+ WEEKS ADMIN OUTREACH)        */}
          {/* ========================================================================= */}
          {activeTab === 'WELFARE' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-rose-600" />
                    Welfare Reach & Staged Absentee Monitoring
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1-3 weeks are managed directly by class teachers and secretaries. 4-5+ weeks are escalated for Direct Follow-Up Officer & Admin Outreach.
                  </p>
                </div>
              </div>

              {/* ESCALATED ADMIN ATTENTION SECTION (4-5+ WEEKS) */}
              <div className="bg-red-50/60 rounded-3xl p-6 border-2 border-red-200 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-800 bg-red-100 px-3 py-1 rounded-full border border-red-300 inline-block">
                      Action Required · Follow-Up Officer & Admin Care
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-red-950 mt-1">
                      Escalated Absentees: 4 to 5+ Weeks Absent ({stagedWelfareMembers.week4to5.length + stagedWelfareMembers.week6Plus.length})
                    </h3>
                    <p className="text-xs text-red-800/80 mt-0.5">
                      Class staff have completed initial check-ins and visitation. The Directorate directly takes up these cases for pastoral recovery.
                    </p>
                  </div>
                </div>

                {stagedWelfareMembers.week4to5.length + stagedWelfareMembers.week6Plus.length === 0 ? (
                  <div className="bg-white/80 rounded-2xl p-6 text-center text-xs font-bold text-slate-600">
                    No members currently in the 4-5+ weeks escalation tier.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...stagedWelfareMembers.week4to5, ...stagedWelfareMembers.week6Plus].map(({ member, classProfile: cls, weeks }) => (
                      <div
                        key={member.id}
                        className="bg-white rounded-2xl p-4 border border-red-200 shadow-xs flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                              Absent {weeks} Weeks {weeks >= 6 ? '• Critical Review' : '• Officer Outreach'}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 mt-1.5">{member.fullName}</h4>
                            <span className="text-[11px] text-slate-500 font-semibold block">
                              {cls.className} ({cls.department})
                            </span>
                            {member.phone && (
                              <span className="text-xs text-slate-700 font-mono font-bold mt-0.5 block">
                                📞 {member.phone}
                              </span>
                            )}
                          </div>

                          {/* ACTION BUTTON SPECIFICALLY FOR FOLLOW-UP OFFICER & ADMIN */}
                          <button
                            type="button"
                            onClick={() => setOfficerModalMember({ member, consecutiveWeeks: weeks, classProfile: cls })}
                            className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer shrink-0"
                          >
                            Take Up Case
                          </button>
                        </div>

                        {member.prayerRequests && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl italic">
                            Prayer: "{member.prayerRequests}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* READ-ONLY STATUS MONITORING FOR WEEKS 1 TO 3 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1 Week Stage */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-amber-700 uppercase tracking-wider">
                      1 Week Absent ({stagedWelfareMembers.week1.length})
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Class Task: Call/WhatsApp</span>
                  </div>
                  {stagedWelfareMembers.week1.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">No members in this stage</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                      {stagedWelfareMembers.week1.map(({ member, classProfile: cls }) => (
                        <div key={member.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <span className="font-black text-slate-900 block">{member.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{cls.className} · Status: In Class Care</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2 Weeks Stage */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-orange-700 uppercase tracking-wider">
                      2 Weeks Absent ({stagedWelfareMembers.week2.length})
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Class Task: Phone Outreach</span>
                  </div>
                  {stagedWelfareMembers.week2.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">No members in this stage</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                      {stagedWelfareMembers.week2.map(({ member, classProfile: cls }) => (
                        <div key={member.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <span className="font-black text-slate-900 block">{member.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{cls.className} · Status: In Class Care</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3 Weeks Stage */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-rose-700 uppercase tracking-wider">
                      3 Weeks Absent ({stagedWelfareMembers.week3.length})
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Class Task: Visitation</span>
                  </div>
                  {stagedWelfareMembers.week3.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">No members in this stage</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                      {stagedWelfareMembers.week3.map(({ member, classProfile: cls }) => (
                        <div key={member.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <span className="font-black text-slate-900 block">{member.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{cls.className} · Status: Home Visit Candidate</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: CONSOLIDATED REPORT (ALL CLASSES PERFORMANCE TABLE)                */}
          {/* ========================================================================= */}
          {activeTab === 'CONSOLIDATED_REPORT' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Header with Switcher between All Classes Table vs Class Matrix */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <FileText className="w-5 h-5 text-rose-600" />
                    All Classes Performance Table (Week {selectedWeek})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidated 4-activity performance across Sunday School: SSS Report, Assignment, Visitation, and Welfare Reach.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setConsolidatedMode('ALL_CLASSES_OVERVIEW');
                      setInspectClassId(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                      consolidatedMode === 'ALL_CLASSES_OVERVIEW'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Classes Performance Table
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsolidatedMode('CLASS_MATRIX');
                      if (!inspectClassId) setInspectClassId(scopedClasses[0]?.id || '');
                    }}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                      consolidatedMode === 'CLASS_MATRIX'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Selected Class Detailed Matrix
                  </button>
                </div>
              </div>

              {consolidatedMode === 'ALL_CLASSES_OVERVIEW' ? (
                /* USER-SPECIFIED ALL CLASSES PERFORMANCE TABLE */
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-center">Total Members</th>
                          <th className="py-3 px-4 text-center text-emerald-700">Present</th>
                          <th className="py-3 px-4 text-center text-rose-700">Absent</th>
                          <th className="py-3 px-4 text-center">SSS Report</th>
                          <th className="py-3 px-4 text-center">Assignment</th>
                          <th className="py-3 px-4 text-center">Visitation</th>
                          <th className="py-3 px-4 text-center">Welfare Reach</th>
                          <th className="py-3 px-4 text-center">Total Follow-Up %</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classSummaries.map(report => {
                          const clsMembers = scopedMembers.filter(m => m.classId === report.classId);
                          const totalMembersCount = clsMembers.length;

                          // SSS Report done / eligible
                          let sssrDone = 0;
                          try {
                            const raw = localStorage.getItem('gofamint_sssr_deliveries') || '{}';
                            const parsed = JSON.parse(raw);
                            sssrDone = Object.keys(parsed).filter(k => k.startsWith(`${report.classId}_w${selectedWeek}_`)).length;
                          } catch { sssrDone = 0; }
                          const sssrEligible = report.present;

                          // Assignment done / eligible
                          let assignDone = 0;
                          try {
                            const raw = localStorage.getItem('gofamint_assignments') || '{}';
                            const parsed = JSON.parse(raw);
                            assignDone = Object.keys(parsed).filter(k => k.startsWith(`${report.classId}_w${selectedWeek}_`)).length;
                          } catch { assignDone = 0; }
                          const assignEligible = totalMembersCount;

                          // Visitation done / target (target: 3)
                          const clsAssignments = (scopedClasses.find(c => c.id === report.classId)?.visitationAssignments) || {};
                          const visitationDone = Object.values(clsAssignments).filter(
                            (a: any) => a.status === 'COMPLETED' && (a.weekNumber === selectedWeek || !a.weekNumber)
                          ).length;
                          const visitationTarget = VISITATION_TARGET_PER_CLASS_PER_WEEK;

                          // Welfare reach done / absent
                          const welfareDone = scopedAbsenceLogs.filter(
                            l => l.classId === report.classId && (l.weekNumber === selectedWeek || !l.weekNumber)
                          ).length;
                          const welfareTarget = report.absent;

                          // Total follow up %
                          const sssrRate = sssrEligible > 0 ? (sssrDone / sssrEligible) : 1;
                          const assignRate = assignEligible > 0 ? (assignDone / assignEligible) : 1;
                          const visitRate = visitationTarget > 0 ? Math.min(1, visitationDone / visitationTarget) : 1;
                          const welfareRate = welfareTarget > 0 ? Math.min(1, welfareDone / welfareTarget) : 1;
                          const totalPercentage = Math.round(((sssrRate + assignRate + visitRate + welfareRate) / 4) * 100);

                          const isFullyDone = totalPercentage >= 100;

                          return (
                            <tr key={report.classId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 font-black text-slate-900">{report.className}</td>
                              <td className="py-3.5 px-4 text-slate-600 font-semibold">{report.department}</td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isFullyDone
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}
                                >
                                  {isFullyDone ? 'Completed' : 'Not Completed'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-slate-800">{totalMembersCount}</td>
                              <td className="py-3.5 px-4 text-center font-bold text-emerald-700">{report.present}</td>
                              <td className="py-3.5 px-4 text-center font-bold text-rose-700">{report.absent}</td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                                {sssrDone} / {sssrEligible}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                                {assignDone} / {assignEligible}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                                {visitationDone} / {visitationTarget}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                                {welfareDone} / {welfareTarget}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-mono font-black text-xs ${
                                  totalPercentage >= 80 ? 'bg-emerald-100 text-emerald-800' : totalPercentage >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {totalPercentage}%
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectClassId(report.classId);
                                    setSelectedClassId(report.classId);
                                    setConsolidatedMode('CLASS_MATRIX');
                                  }}
                                  className="px-3 py-1 bg-[#320b86] hover:bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Detailed Class Matrix Inspection View */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setConsolidatedMode('ALL_CLASSES_OVERVIEW')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to All Classes Performance Table</span>
                    </button>
                    <span className="text-xs font-bold text-purple-900">
                      Inspecting: <strong>{scopedClasses.find(c => c.id === (inspectClassId || selectedClassId))?.className}</strong>
                    </span>
                  </div>

                  <FollowUpReportView
                    classProfile={scopedClasses.find(c => c.id === (inspectClassId || selectedClassId)) || activeClassProfile}
                    members={scopedMembers.filter(m => m.classId === (inspectClassId || selectedClassId))}
                    grades={scopedGrades.filter(g => g.classId === (inspectClassId || selectedClassId))}
                    absenceLogs={scopedAbsenceLogs.filter(l => l.classId === (inspectClassId || selectedClassId))}
                    currentWeek={selectedWeek}
                    selectedQuarterNumber={quarterNumber}
                    quarterData={quarterData}
                    onSelectWeek={setSelectedWeek}
                  />
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: GROWTH & INTELLIGENCE ANALYTICS                                    */}
          {/* ========================================================================= */}
          {activeTab === 'ANALYTICS' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Growth, Retention & Follow-Up Analytics (Week {selectedWeek})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Strategic intelligence revealing class follow-up workloads, persistent absenteeism hotspots, and discipleship intake.
                  </p>
                </div>
              </div>

              {/* Intelligence Ranking Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                    Highest Follow-Up Need
                  </span>
                  <h4 className="text-base font-black text-slate-900">
                    {intelligence.highestNeedClass?.className || 'None'}
                  </h4>
                  <span className="text-xs text-slate-500 block font-semibold">
                    {intelligence.highestNeedClass?.count || 0} members needing follow-up
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">
                    Persistent Absentees Hotspot
                  </span>
                  <h4 className="text-base font-black text-slate-900">
                    {intelligence.persistentAbsenteeClass?.className || 'None'}
                  </h4>
                  <span className="text-xs text-slate-500 block font-semibold">
                    {intelligence.persistentAbsenteeClass?.count || 0} members absent 3+ weeks
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    Highest Follow-Up Performance
                  </span>
                  <h4 className="text-base font-black text-slate-900">
                    {intelligence.mostActiveFollowUpClass?.className || 'None'}
                  </h4>
                  <span className="text-xs text-slate-500 block font-semibold">
                    {intelligence.mostActiveFollowUpClass?.count || 0} follow-up logs recorded
                  </span>
                </div>
              </div>

              {/* All 5 Deep-Dive Graphs */}
              <FollowUpChartsView
                classes={scopedClasses}
                members={scopedMembers}
                grades={scopedGrades}
                absenceLogs={scopedAbsenceLogs}
                selectedWeek={selectedWeek}
                quarterNumber={quarterNumber}
                selectedClassIdFilter={selectedClassIdFilter}
                onSelectClassFilter={setSelectedClassIdFilter}
                isFullAnalyticsMode={true}
              />
            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* OFFICER / ADMIN DIRECT OUTREACH MODAL (4-5+ WEEKS ESCALATED ABSENTEES)     */}
      {/* ========================================================================= */}
      {officerModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-red-200 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-200">
                  Directorate Direct Outreach
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Log Officer Intervention
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct contact for <strong>{officerModalMember.member.fullName}</strong> ({officerModalMember.consecutiveWeeks} consecutive weeks absent).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOfficerModalMember(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficerOutreach} className="space-y-4 text-xs">
              <div>
                <label className="font-black text-slate-700 block mb-1">
                  Outreach Channel:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'PHONE_CALL', label: 'Phone Call', icon: PhoneCall },
                    { id: 'PHYSICAL_VISIT', label: 'Physical Visit', icon: Home },
                    { id: 'PASTORAL_LETTER', label: 'WhatsApp / Msg', icon: MessageCircle }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOfficerContactMethod(item.id as any)}
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 cursor-pointer transition ${
                        officerContactMethod === item.id
                          ? 'border-red-600 bg-red-50 text-red-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <item.icon className="w-4 h-4 text-red-600" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-black text-slate-700 block mb-1">
                  Officer Pastoral Notes & Findings:
                </label>
                <textarea
                  required
                  rows={3}
                  value={officerNotes}
                  onChange={e => setOfficerNotes(e.target.value)}
                  placeholder="Record conversation details, reasons for extended absence, and spiritual state..."
                  className="w-full p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>

              <div>
                <label className="font-black text-slate-700 block mb-1">
                  Directorate Assessment Decision:
                </label>
                <select
                  value={officerDecision}
                  onChange={e => setOfficerDecision(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value="RETURNING_THIS_SUNDAY">Contacted & Confirmed Returning This Sunday</option>
                  <option value="CONTINUE_OUTREACH">Under Sustained Prayer & Outreach</option>
                  <option value="ESCALATE_TO_PASTORATE">Escalate to Church Pastorate for Home Intervention</option>
                  <option value="RELOCATED">Confirmed Relocated / Moved Away</option>
                  <option value="ONE_TIME_VISITOR_RECLASSIFY">Recommend Roster Status Adjustment</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOfficerModalMember(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOfficerLog}
                  className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingOfficerLog ? 'Saving...' : 'Record Officer Outreach'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
