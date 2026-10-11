import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Minus,
  Users,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Check,
  Phone,
  Home,
  MessageCircle,
  Bell,
  HeartHandshake,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  ClassProfile,
  VisitationAssignmentRecord,
  FollowUpAssignmentRecord,
  SSSRDeliveryRecord,
  WeeklyReminderRecord,
  QuarterData
} from '../types';
import { getClassWeeklyVisitationCandidates, getMemberVisitationCooldown } from '../utils/visitationEngine';
import { getConsecutiveAbsences } from '../utils/calculations';
import { FollowUpWeekSyncBar } from './FollowUpPortal/FollowUpWeekSyncBar';

interface FollowUpReportViewProps {
  classProfile: ClassProfile | null;
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs?: AbsenceLogRecord[];
  currentWeek: number;
  selectedQuarterNumber?: number;
  quarterData?: QuarterData | null;
  onSelectWeek?: (week: number) => void;
}

export type StatusCategory = 'DONE' | 'NOT_DONE' | 'REQUIRED_NOT_DONE' | 'NOT_ELIGIBLE' | 'IN_PROGRESS';

export interface MemberOperationalRow {
  member: Member;
  isPresent: boolean;
  isOneTimeVisitor: boolean;
  consecutiveAbsences: number;
  // Activity 1: SSSR Report
  sssrStatus: StatusCategory;
  sssrDetail: string;
  // Activity 2: Reminder & Staff Assignment
  reminderStatus: StatusCategory;
  reminderDetail: string;
  assignmentStatus: StatusCategory;
  assignmentDetail: string;
  assignedStaffName: string;
  isSecretaryOverride?: boolean;
  // Activity 3: Visitation
  visitationStatus: StatusCategory;
  visitationDetail: string;
  isVisitationCandidate: boolean;
  isInCooldown: boolean;
  // Activity 4: Welfare Reach
  welfareStatus: StatusCategory;
  welfareDetail: string;
  welfareRequiredAction?: string;
  isWelfareEligible: boolean;
}

export const FollowUpReportView: React.FC<FollowUpReportViewProps> = ({
  classProfile,
  members,
  grades,
  absenceLogs = [],
  currentWeek,
  selectedQuarterNumber = 1,
  quarterData,
  onSelectWeek
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek || 1);

  useEffect(() => {
    setSelectedWeek(currentWeek || 1);
  }, [currentWeek]);

  const handleSelectWeek = (wk: number) => {
    setSelectedWeek(wk);
    if (onSelectWeek) {
      onSelectWeek(wk);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'OUTSTANDING' | 'COMPLETED'>('ALL');
  const [selectedMemberType, setSelectedMemberType] = useState<'ALL' | 'STUDENT' | 'VISITOR'>('ALL');

  const activeMembers = useMemo(() => {
    return members.filter(m => m.status !== 'LEFT_CLASS');
  }, [members]);

  // Read stored records from profile
  const sssrDeliveries = useMemo(() => classProfile?.sssrDeliveries || {}, [classProfile?.sssrDeliveries]);
  const weeklyReminders = useMemo(() => classProfile?.weeklyReminders || {}, [classProfile?.weeklyReminders]);
  const followUpAssignments = useMemo(() => classProfile?.followUpAssignments || {}, [classProfile?.followUpAssignments]);
  const visitationAssignments = useMemo(() => classProfile?.visitationAssignments || {}, [classProfile?.visitationAssignments]);

  // Compute visitation candidates for selectedWeek
  const { candidates: weeklyVisitationCandidates } = useMemo(() => {
    return getClassWeeklyVisitationCandidates(
      activeMembers,
      selectedWeek,
      grades,
      absenceLogs,
      visitationAssignments,
      { includeCooldown: false }
    );
  }, [activeMembers, selectedWeek, grades, absenceLogs, visitationAssignments]);

  const visitationCandidateMemberIds = useMemo(() => {
    return new Set(weeklyVisitationCandidates.map(c => c.memberId));
  }, [weeklyVisitationCandidates]);

  // Compile member-level rows
  const memberRows = useMemo<MemberOperationalRow[]>(() => {
    const classId = classProfile?.id || 'cls';
    const upcomingWeek = Math.min(13, selectedWeek + 1);

    return activeMembers.map(member => {
      const grade = grades.find(g => g.memberId === member.id && g.weekNumber === selectedWeek);
      const isPresent = grade?.attendance === 'PRESENT';
      const isOneTimeVisitor = Boolean(member.isOneTimeVisitor);
      const consecutiveAbsences = getConsecutiveAbsences(member.id, selectedWeek, grades, member.firstLessonWeek || 1);

      // 1. Activity One: SSSR Report
      // Required for ALL persons on register (students, visitors, one-time visitors, present or absent)
      const sssrId = `${classId}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
      const sssrDelivery = sssrDeliveries[sssrId];
      const sssrIsDone = sssrDelivery?.status === 'DONE';
      const sssrStatus: StatusCategory = sssrIsDone ? 'DONE' : 'NOT_DONE';
      const sssrDetail = sssrIsDone
        ? `Sent on ${sssrDelivery.sentAt ? sssrDelivery.sentAt.split('T')[0] : 'record'}`
        : 'Required — not sent yet';

      // 2. Activity Two: Follow-Up Assignments (Reminders & Staff Assignments)
      // Reminder (for upcoming week)
      const reminderId = `${classId}_q${selectedQuarterNumber}_w${upcomingWeek}_m${member.id}`;
      const reminder = weeklyReminders[reminderId];
      const reminderIsDone = reminder?.status === 'DONE';
      const reminderStatus: StatusCategory = reminderIsDone ? 'DONE' : 'NOT_DONE';
      const reminderDetail = reminderIsDone ? 'Reminder sent' : 'Reminder pending';

      // Staff Assignment
      const assignmentId = `${classId}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
      const assignment = followUpAssignments[assignmentId];
      const matchingAbsenceLog = absenceLogs.find(
        l => l.memberId === member.id && Number(l.weekNumber) === Number(selectedWeek)
      );

      let assignmentIsDone = false;
      let assignedStaffName = assignment?.assignedStaffName || 'Assigned Staff';
      let isSecretaryOverride = Boolean(assignment?.isSecretaryOverride);

      if (assignment?.status === 'REACHED_OUT' || reminderIsDone) {
        assignmentIsDone = true;
      } else if (assignment?.status === 'PENDING' && !reminderIsDone) {
        assignmentIsDone = false;
      } else if (matchingAbsenceLog) {
        assignmentIsDone = true;
      }

      const assignmentStatus: StatusCategory = assignmentIsDone ? 'DONE' : 'NOT_DONE';
      const assignmentDetail = assignmentIsDone
        ? (isSecretaryOverride ? 'Done (Secretary Override)' : `Done (${assignedStaffName})`)
        : `Pending (${assignedStaffName})`;

      // 3. Activity Three: Visitation
      // Excluded: one-time visitors, members in 4-week cooldown, members who do not qualify
      const cooldown = getMemberVisitationCooldown(member.id, selectedWeek, absenceLogs, visitationAssignments);
      const isCandidate = visitationCandidateMemberIds.has(member.id);
      const visitAssignment = (Object.values(visitationAssignments) as VisitationAssignmentRecord[]).find(
        a => a.memberId === member.id && a.weekNumber === selectedWeek
      );
      const visitCompleted = visitAssignment?.status === 'COMPLETED' ||
        absenceLogs.some(l => l.memberId === member.id && l.weekNumber === selectedWeek && (l.contactMethod === 'PASTORAL_VISIT' || (l as any).contactMethod === 'IN_PERSON'));

      let visitationStatus: StatusCategory = 'NOT_ELIGIBLE';
      let visitationDetail = 'Not eligible this week';

      if (isOneTimeVisitor) {
        visitationStatus = 'NOT_ELIGIBLE';
        visitationDetail = 'One-time visitor excluded';
      } else if (cooldown.isInCooldown) {
        visitationStatus = 'NOT_ELIGIBLE';
        visitationDetail = `In 4-week cooldown (${cooldown.cooldownWeeksRemaining} wks remaining)`;
      } else if (isCandidate) {
        if (visitCompleted) {
          visitationStatus = 'DONE';
          visitationDetail = 'Visit Completed';
        } else {
          visitationStatus = 'REQUIRED_NOT_DONE';
          visitationDetail = 'Required — not done';
        }
      } else {
        visitationStatus = 'NOT_ELIGIBLE';
        visitationDetail = 'Not selected this week';
      }

      // 4. Activity Four: Welfare Reach
      // Excluded: Present members, One-time visitors
      // Eligible: Absent members based on consecutive absence
      let welfareStatus: StatusCategory = 'NOT_ELIGIBLE';
      let welfareDetail = 'Not eligible (Present)';
      let welfareRequiredAction: string | undefined = undefined;
      const isWelfareEligible = !isPresent && !isOneTimeVisitor && consecutiveAbsences > 0;

      if (isOneTimeVisitor) {
        welfareStatus = 'NOT_ELIGIBLE';
        welfareDetail = 'One-time visitor excluded';
      } else if (isPresent) {
        welfareStatus = 'NOT_ELIGIBLE';
        welfareDetail = 'Present (No welfare outreach needed)';
      } else {
        // Absent member: determine staged action
        if (consecutiveAbsences === 1) {
          welfareRequiredAction = 'WhatsApp';
        } else if (consecutiveAbsences === 2) {
          welfareRequiredAction = 'Phone Call';
        } else if (consecutiveAbsences === 3) {
          if (cooldown.isInCooldown) {
            welfareRequiredAction = 'Phone Call (In Cooldown)';
          } else {
            welfareRequiredAction = 'Pastoral Visitation';
          }
        } else if (consecutiveAbsences >= 4) {
          welfareRequiredAction = 'Phone Call & WhatsApp';
        }

        const logForWeek = absenceLogs.find(
          l => l.memberId === member.id && (l.weekNumber === selectedWeek || l.consecutiveWeeksAbsent === consecutiveAbsences)
        );

        if (logForWeek || assignmentIsDone) {
          welfareStatus = 'DONE';
          welfareDetail = `Completed (${logForWeek?.contactMethod || 'Contacted'})`;
        } else {
          welfareStatus = 'REQUIRED_NOT_DONE';
          welfareDetail = `Required: ${welfareRequiredAction} — not done`;
        }
      }

      return {
        member,
        isPresent,
        isOneTimeVisitor,
        consecutiveAbsences,
        sssrStatus,
        sssrDetail,
        reminderStatus,
        reminderDetail,
        assignmentStatus,
        assignmentDetail,
        assignedStaffName,
        isSecretaryOverride,
        visitationStatus,
        visitationDetail,
        isVisitationCandidate: isCandidate,
        isInCooldown: cooldown.isInCooldown,
        welfareStatus,
        welfareDetail,
        welfareRequiredAction,
        isWelfareEligible
      };
    });
  }, [activeMembers, selectedWeek, selectedQuarterNumber, grades, absenceLogs, sssrDeliveries, weeklyReminders, followUpAssignments, visitationAssignments, visitationCandidateMemberIds, classProfile?.id]);

  // =========================================================================
  // CLASS-LEVEL COMPLETION CALCULATIONS
  // Formula: Completion % = (Completed eligible activities / Total eligible activities) * 100
  // If zero eligible tasks -> "Not applicable" (never divide by 0 or report misleading 100%)
  // =========================================================================

  // Activity 1: SSSR
  const sssrEligible = memberRows.length; // All registered people
  const sssrCompleted = memberRows.filter(r => r.sssrStatus === 'DONE').length;
  const sssrRate = sssrEligible > 0 ? Math.round((sssrCompleted / sssrEligible) * 100) : null;

  // Activity 2: Reminders & Assignments
  const remindersEligible = memberRows.length;
  const remindersCompleted = memberRows.filter(r => r.reminderStatus === 'DONE').length;
  const remindersRate = remindersEligible > 0 ? Math.round((remindersCompleted / remindersEligible) * 100) : null;

  const assignmentsEligible = memberRows.length;
  const assignmentsCompleted = memberRows.filter(r => r.assignmentStatus === 'DONE').length;
  const assignmentsRate = assignmentsEligible > 0 ? Math.round((assignmentsCompleted / assignmentsEligible) * 100) : null;

  // Activity 3: Visitation (Candidates this week)
  const visitationEligible = memberRows.filter(r => r.isVisitationCandidate).length;
  const visitationCompleted = memberRows.filter(r => r.isVisitationCandidate && r.visitationStatus === 'DONE').length;
  const visitationRate = visitationEligible > 0 ? Math.round((visitationCompleted / visitationEligible) * 100) : null;

  // Activity 4: Welfare Reach (Absent members only, excluding one-time visitors)
  const welfareEligible = memberRows.filter(r => r.isWelfareEligible).length;
  const welfareCompleted = memberRows.filter(r => r.isWelfareEligible && r.welfareStatus === 'DONE').length;
  const welfareRate = welfareEligible > 0 ? Math.round((welfareCompleted / welfareEligible) * 100) : null;

  // OVERALL COMPLETION SCORE
  // Combines eligible tasks across the four activities, counting each required task once.
  // Never counts ineligible persons as outstanding tasks!
  const totalEligibleTasks = sssrEligible + assignmentsEligible + visitationEligible + welfareEligible;
  const totalCompletedTasks = sssrCompleted + assignmentsCompleted + visitationCompleted + welfareCompleted;
  const overallRate = totalEligibleTasks > 0 ? Math.round((totalCompletedTasks / totalEligibleTasks) * 100) : null;

  // Outstanding tasks list
  const outstandingList = useMemo(() => {
    const list: Array<{ memberName: string; activity: string; detail: string; responsible: string }> = [];

    memberRows.forEach(r => {
      if (r.sssrStatus !== 'DONE') {
        list.push({
          memberName: r.member.fullName,
          activity: 'SSSR Report',
          detail: 'Report not generated / sent',
          responsible: classProfile?.secretaryName || 'Class Secretary'
        });
      }
      if (r.assignmentStatus !== 'DONE') {
        list.push({
          memberName: r.member.fullName,
          activity: 'Staff Assignment',
          detail: 'Pastoral follow-up pending',
          responsible: r.assignedStaffName
        });
      }
      if (r.isVisitationCandidate && r.visitationStatus !== 'DONE') {
        list.push({
          memberName: r.member.fullName,
          activity: 'Class Visitation',
          detail: 'Priority weekly visit required',
          responsible: 'Visitation Worker / Secretary'
        });
      }
      if (r.isWelfareEligible && r.welfareStatus !== 'DONE') {
        list.push({
          memberName: r.member.fullName,
          activity: 'Welfare Reach',
          detail: r.welfareRequiredAction ? `Required: ${r.welfareRequiredAction}` : 'Outreach needed',
          responsible: 'Class Teacher / Care Team'
        });
      }
    });

    return list;
  }, [memberRows, classProfile?.secretaryName]);

  // Filtered rows for Member Matrix
  const filteredRows = useMemo(() => {
    return memberRows.filter(r => {
      if (selectedMemberType !== 'ALL' && r.member.memberType !== selectedMemberType) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = r.member.fullName.toLowerCase().includes(query);
        const matchesPhone = r.member.phone?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone) return false;
      }

      if (filterMode === 'OUTSTANDING') {
        const hasOutstanding =
          r.sssrStatus !== 'DONE' ||
          r.assignmentStatus !== 'DONE' ||
          (r.isVisitationCandidate && r.visitationStatus !== 'DONE') ||
          (r.isWelfareEligible && r.welfareStatus !== 'DONE');
        if (!hasOutstanding) return false;
      } else if (filterMode === 'COMPLETED') {
        const isAllDone =
          r.sssrStatus === 'DONE' &&
          r.assignmentStatus === 'DONE' &&
          (!r.isVisitationCandidate || r.visitationStatus === 'DONE') &&
          (!r.isWelfareEligible || r.welfareStatus === 'DONE');
        if (!isAllDone) return false;
      }

      return true;
    });
  }, [memberRows, selectedMemberType, searchTerm, filterMode]);

  // Helper badge for status category
  const renderStatusBadge = (status: StatusCategory, label?: string, subDetail?: string) => {
    switch (status) {
      case 'DONE':
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>{label || 'Done'}</span>
            </span>
            {subDetail && <span className="text-[9px] text-slate-500 mt-0.5 truncate">{subDetail}</span>}
          </div>
        );
      case 'REQUIRED_NOT_DONE':
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 w-fit">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>{label || 'Required — Not Done'}</span>
            </span>
            {subDetail && <span className="text-[9px] text-rose-700 mt-0.5 font-medium truncate">{subDetail}</span>}
          </div>
        );
      case 'NOT_DONE':
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 w-fit">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>{label || 'Not Done'}</span>
            </span>
            {subDetail && <span className="text-[9px] text-slate-500 mt-0.5 truncate">{subDetail}</span>}
          </div>
        );
      case 'NOT_ELIGIBLE':
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 w-fit">
              <Minus className="w-3 h-3 text-slate-400" />
              <span>{label || 'Not Eligible'}</span>
            </span>
            {subDetail && <span className="text-[9px] text-slate-400 mt-0.5 italic truncate">{subDetail}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/30">
                Reporting Layer · Component Five
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-500/30">
                {classProfile?.className || 'Assigned Class'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <FileText className="w-7 h-7 text-amber-400" />
              Follow-Up Report & Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 mt-1 max-w-2xl font-medium">
              Consolidated reporting layer tracking live completion status across all four activities: SSS Report, Reminders/Assignments, Visitation, and Welfare Reach.
            </p>
          </div>
        </div>
      </div>

      {/* Synchronized Follow-Up Week Switcher & Live Deadline Timer */}
      <FollowUpWeekSyncBar
        selectedWeek={selectedWeek}
        onSelectWeek={handleSelectWeek}
        totalWeeks={12}
        quarter={quarterData}
        quarterNumber={selectedQuarterNumber}
        label="Report week"
      />

      {/* ========================================================================= */}
      {/* SECTION B: CLASS-LEVEL DASHBOARD SUMMARY                                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Class Population */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Total Class Register</span>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900">{activeMembers.length}</span>
            <span className="text-xs text-slate-500 block font-medium mt-0.5">Total registered persons</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold">
            <span>Students: {activeMembers.filter(m => m.memberType === 'STUDENT').length}</span>
            <span>Visitors: {activeMembers.filter(m => m.memberType === 'VISITOR').length}</span>
          </div>
        </div>

        {/* 1. SSS Reports */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider">1. SSS Reports</span>
          <div className="mt-2">
            <span className="text-3xl font-black text-blue-900">{sssrCompleted} / {sssrEligible}</span>
            <span className="text-xs text-blue-700 block font-medium mt-0.5">
              {sssrRate !== null ? `${sssrRate}% Completed` : 'Not applicable'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${sssrRate ?? 0}%` }} />
          </div>
        </div>

        {/* 2. Reminders & Assignments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">2. Assignments</span>
          <div className="mt-2">
            <span className="text-3xl font-black text-purple-900">{assignmentsCompleted} / {assignmentsEligible}</span>
            <span className="text-xs text-purple-700 block font-medium mt-0.5">
              {assignmentsRate !== null ? `${assignmentsRate}% Completed` : 'Not applicable'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${assignmentsRate ?? 0}%` }} />
          </div>
        </div>

        {/* 3. Visitation */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">3. Visitation</span>
          <div className="mt-2">
            <span className="text-3xl font-black text-rose-900">
              {visitationEligible > 0 ? `${visitationCompleted} / ${visitationEligible}` : '—'}
            </span>
            <span className="text-xs text-rose-700 block font-medium mt-0.5">
              {visitationRate !== null ? `${visitationRate}% Completed` : 'Not applicable (0 eligible)'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-rose-600 h-full rounded-full transition-all duration-500" style={{ width: `${visitationRate ?? 0}%` }} />
          </div>
        </div>

        {/* 4. Welfare Reach */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-black text-teal-600 uppercase tracking-wider">4. Welfare Reach</span>
          <div className="mt-2">
            <span className="text-3xl font-black text-teal-900">
              {welfareEligible > 0 ? `${welfareCompleted} / ${welfareEligible}` : '—'}
            </span>
            <span className="text-xs text-teal-700 block font-medium mt-0.5">
              {welfareRate !== null ? `${welfareRate}% Completed` : 'Not applicable (0 eligible)'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-teal-600 h-full rounded-full transition-all duration-500" style={{ width: `${welfareRate ?? 0}%` }} />
          </div>
        </div>
      </div>

      {/* Overall Completion Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
            Overall Weekly Completion Rate
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mt-1">
            {overallRate !== null ? `${overallRate}%` : 'Not applicable'}
          </h2>
          <p className="text-xs text-emerald-200 mt-1">
            {totalCompletedTasks} of {totalEligibleTasks} eligible activities completed across all 4 activities for Week {selectedWeek}.
          </p>
        </div>

        {/* Outstanding Activities Count Button */}
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-200 block">Outstanding Work</span>
            <span className="text-2xl font-black text-amber-300">{outstandingList.length} Tasks</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: MEMBER-LEVEL OPERATIONAL REPORT MATRIX                         */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-black text-slate-900">
              Member-Level Follow-Up Matrix ({filteredRows.length} Rows)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Mode */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('OUTSTANDING')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  filterMode === 'OUTSTANDING' ? 'bg-white text-rose-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Needs Action
              </button>
              <button
                onClick={() => setFilterMode('COMPLETED')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  filterMode === 'COMPLETED' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fully Completed
              </button>
            </div>

            {/* Member Type Filter */}
            <select
              value={selectedMemberType}
              onChange={e => setSelectedMemberType(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="STUDENT">Students</option>
              <option value="VISITOR">Visitors</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>

        {/* 4-Activity Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[200px]">Member</th>
                <th className="py-3 px-4 min-w-[150px]">1. SSS Report</th>
                <th className="py-3 px-4 min-w-[180px]">2. Reminder / Assignment</th>
                <th className="py-3 px-4 min-w-[170px]">3. Visitation</th>
                <th className="py-3 px-4 min-w-[170px]">4. Welfare Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => {
                const { member, isPresent, isOneTimeVisitor } = row;

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition">
                    {/* Member Column */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{member.fullName}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                          <span className="uppercase text-slate-600">{member.memberType}</span>
                          {isOneTimeVisitor && (
                            <span className="text-purple-600 font-bold">· One-Time Visitor</span>
                          )}
                          {member.phone && (
                            <span className="font-mono text-slate-400">· {member.phone}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 1: SSSR Report */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(
                        row.sssrStatus,
                        row.sssrStatus === 'DONE' ? 'Done' : 'Not Done',
                        row.sssrDetail
                      )}
                    </td>

                    {/* Column 2: Reminder & Staff Assignment */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {renderStatusBadge(
                          row.assignmentStatus,
                          row.assignmentStatus === 'DONE' ? 'Done' : 'Not Done',
                          row.assignmentDetail
                        )}
                      </div>
                    </td>

                    {/* Column 3: Visitation */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(
                        row.visitationStatus,
                        row.visitationStatus === 'DONE'
                          ? 'Completed'
                          : row.visitationStatus === 'REQUIRED_NOT_DONE'
                          ? 'Required — Not Done'
                          : 'Not Eligible',
                        row.visitationDetail
                      )}
                    </td>

                    {/* Column 4: Welfare Reach */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(
                        row.welfareStatus,
                        row.welfareStatus === 'DONE'
                          ? 'Done'
                          : row.welfareStatus === 'REQUIRED_NOT_DONE'
                          ? 'Required — Not Done'
                          : 'Not Eligible',
                        row.welfareDetail
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outstanding Activities Detail Card */}
      {outstandingList.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Outstanding Work & Responsible Staff ({outstandingList.length} Tasks)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Activities requiring completion for Week {selectedWeek} with assigned accountable personnel.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {outstandingList.slice(0, 12).map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-slate-900 font-black">{item.memberName}</strong>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-800">
                    {item.activity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{item.detail}</p>
                <div className="pt-1 text-[10px] text-slate-400">
                  Responsible: <strong className="text-slate-700">{item.responsible}</strong>
                </div>
              </div>
            ))}
          </div>

          {outstandingList.length > 12 && (
            <p className="text-xs text-center text-slate-400 italic pt-2">
              ...and {outstandingList.length - 12} more outstanding activities in this class.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
