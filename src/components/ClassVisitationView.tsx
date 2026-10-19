import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Home,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCw,
  Send,
  UserCheck,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Phone,
  MapPin,
  ClipboardList,
  Lock
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  ClassProfile,
  VisitationAssignmentRecord,
  VisitationCandidate,
  ClassFollowUpReportRecord,
  QuarterData
} from '../types';
import {
  VISITATION_TARGET_PER_CLASS_PER_WEEK,
  VISITATION_MAX_PER_CLASS_PER_WEEK,
  VISITATION_COOLDOWN_WEEKS,
  getClassWeeklyVisitationCandidates,
  computeClassFollowUpSummary,
  mergeVisitationAssignments,
  freezeWeeklyVisitationSlate,
  getWeeklyVisitationAssignments
} from '../utils/visitationEngine';
import { FollowUpWeekSyncBar } from './FollowUpPortal/FollowUpWeekSyncBar';
import { getFollowUpWindowForWeek } from '../utils/quarterScheduleUtils';
import { ApplicationProfile } from '../services/profileService';

interface ClassVisitationViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  currentWeek: number;
  quarterNumber: number;
  classProfile: ClassProfile | null;
  absenceLogs?: AbsenceLogRecord[];
  quarterData?: QuarterData | null;
  onSelectWeek?: (week: number) => void;
  onSaveAbsenceLog?: (log: AbsenceLogRecord) => Promise<void>;
  onUpdateClassProfile?: (updated: ClassProfile) => Promise<void>;
  authProfile?: ApplicationProfile | null;
}

export const ClassVisitationView: React.FC<ClassVisitationViewProps> = ({
  members,
  grades,
  currentWeek,
  quarterNumber,
  classProfile,
  absenceLogs = [],
  quarterData,
  onSelectWeek,
  onSaveAbsenceLog,
  onUpdateClassProfile,
  authProfile = null
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

  const windowInfo = useMemo(() => {
    return getFollowUpWindowForWeek(selectedWeek, quarterData, new Date());
  }, [selectedWeek, quarterData]);

  const isCoordinator = useMemo(() => {
    const role = authProfile?.role || '';
    return [
      'EVANGELISM_AND_FOLLOW_UP_PERSONNEL',
      'GENERAL_SUPERINTENDENT',
      'GENERAL_SECRETARY',
      'ASST_GENERAL_SECRETARY',
      'ASSISTANT_GENERAL_SECRETARY',
      'SUPER_ADMIN',
      'DEPARTMENT_SUPERINTENDENT'
    ].includes(role);
  }, [authProfile]);

  const isLockedForClass = windowInfo.status === 'EXPIRED' && !isCoordinator;
  const [showCooldownCandidates, setShowCooldownCandidates] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isRecordVisitModalOpen, setIsRecordVisitModalOpen] = useState<boolean>(false);
  const [selectedCandidate, setSelectedCandidate] = useState<VisitationCandidate | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<VisitationAssignmentRecord | null>(null);

  // Form states for assignment
  const [assignedWorkerName, setAssignedWorkerName] = useState<string>('');
  const [assignedWorkerPhone, setAssignedWorkerPhone] = useState<string>('');

  // Form states for recording completed visit
  const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitOutcome, setVisitOutcome] = useState<string>('');
  const [visitNextAction, setVisitNextAction] = useState<string>('');

  // Class available staff list
  const availableStaff = useMemo(() => {
    const list: Array<{ id: string; name: string; role: string; phone?: string }> = [];
    if (classProfile?.teacherName) {
      list.push({ id: 'teacher', name: classProfile.teacherName, role: 'Teacher', phone: classProfile.teacherPhone });
    }
    if (classProfile?.secretaryName) {
      list.push({ id: 'secretary', name: classProfile.secretaryName, role: 'Secretary', phone: classProfile.secretaryPhone });
    }
    // Add additional class workers from profile if any
    if (classProfile?.assignedWorkers) {
      classProfile.assignedWorkers.forEach(w => {
        if (!list.some(l => l.name.toLowerCase() === w.name.toLowerCase())) {
          list.push({ id: w.id || w.name, name: w.name, role: w.role || 'Worker', phone: w.phone });
        }
      });
    }
    return list;
  }, [classProfile]);

  // Local storage key for fallback persistence
  const storageKey = useMemo(() => {
    const cid = classProfile?.id || 'default_class';
    return `gofamint_visitation_assignments_${cid}_q${quarterNumber}`;
  }, [classProfile?.id, quarterNumber]);

  const [assignments, setAssignments] = useState<Record<string, VisitationAssignmentRecord>>({});
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [failedSlateKey, setFailedSlateKey] = useState<string | null>(null);
  const savingRef = useRef(false);
  const assignmentsRef = useRef(assignments);
  const activeStorageKeyRef = useRef(storageKey);
  assignmentsRef.current = assignments;
  activeStorageKeyRef.current = storageKey;

  useEffect(() => {
    try {
      const cloud = classProfile?.visitationAssignments || {};
      const raw = localStorage.getItem(storageKey);
      const local: Record<string, VisitationAssignmentRecord> = raw ? JSON.parse(raw) : {};
      if (!local || typeof local !== 'object' || Array.isArray(local) || Object.values(local).some(record => !record || typeof record.memberId !== 'string' || typeof record.weekNumber !== 'number')) {
        throw new Error('Stored visitation assignments have an invalid format.');
      }
      setAssignments(previous => mergeVisitationAssignments(local, loadedStorageKey === storageKey ? previous : {}, cloud));
    } catch (error) {
      console.error(`[Visitation] Failed to read candidate cache for ${storageKey}:`, error);
      setPersistenceError('The saved device copy of visitation records could not be read. Showing database records; please contact your administrator if a visit is missing.');
      setAssignments(classProfile?.visitationAssignments || {});
    }
    setLoadedStorageKey(storageKey);
  }, [classProfile?.visitationAssignments, storageKey]);

  // Compute visitation candidates for selected week
  const classMembers = useMemo(() => {
    return members.filter(m => m.classId === classProfile?.id && m.status !== 'LEFT_CLASS');
  }, [members, classProfile?.id]);

  const { candidates, totalEligibleBeforeCap, excludedByCooldownCount } = useMemo(() => {
    return getClassWeeklyVisitationCandidates(
      loadedStorageKey === storageKey ? classMembers : [],
      selectedWeek,
      grades,
      absenceLogs,
      loadedStorageKey === storageKey ? assignments : {},
      {
        includeCooldown: showCooldownCandidates,
        maxCap: VISITATION_MAX_PER_CLASS_PER_WEEK,
        quarterNumber
      }
    );
  }, [classMembers, selectedWeek, grades, absenceLogs, assignments, showCooldownCandidates, quarterNumber, loadedStorageKey, storageKey]);

  const saveAssignmentSnapshot = async (next: Record<string, VisitationAssignmentRecord>) => {
    if (!classProfile || !onUpdateClassProfile) throw new Error('Visitation database saving is unavailable.');
    const previous = assignmentsRef.current;
    assignmentsRef.current = next;
    setAssignments(next);
    try {
      await onUpdateClassProfile({ ...classProfile, visitationAssignments: next });
    } catch (error) {
      if (activeStorageKeyRef.current === storageKey) {
        assignmentsRef.current = previous;
        setAssignments(previous);
      }
      throw error;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (error) {
      console.error(`[Visitation] Database saved but device cache failed for ${storageKey}:`, error);
      setPersistenceError('Your visitation records were saved to the database, but this device could not save an offline copy.');
    }
  };

  // Freeze the first computed 4-slot slate for this week. From this point,
  // completing slot 1 changes the progress to 1/4; it never generates slot 5.
  useEffect(() => {
    const slateKey = `${storageKey}_w${selectedWeek}`;
    if (!classProfile || !onUpdateClassProfile || loadedStorageKey !== storageKey || candidates.length === 0 || isLockedForClass || savingRef.current || failedSlateKey === slateKey) return;
    const nextAssignments = freezeWeeklyVisitationSlate(classProfile.id, quarterNumber, selectedWeek, candidates, assignments);
    if (Object.keys(nextAssignments).every(id => nextAssignments[id] === assignments[id])) return;
    savingRef.current = true;
    setIsSaving(true);
    void saveAssignmentSnapshot(nextAssignments).catch(error => {
      console.error(`[Visitation] Could not save Week ${selectedWeek} candidate slate:`, error);
      setFailedSlateKey(slateKey);
      setPersistenceError(`Week ${selectedWeek} candidates could not be saved. Please retry before recording visits. ${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => {
      savingRef.current = false;
      setIsSaving(false);
    });
  }, [assignments, candidates, classProfile, onUpdateClassProfile, quarterNumber, selectedWeek, storageKey, loadedStorageKey, isLockedForClass, failedSlateKey, isSaving]);

  // Compute follow-up summary for class
  const classSummary = useMemo(() => {
    if (!classProfile) return null;
    return computeClassFollowUpSummary(
      classProfile,
      classMembers,
      selectedWeek,
      quarterNumber,
      grades,
      absenceLogs,
      assignments
    );
  }, [classProfile, classMembers, selectedWeek, quarterNumber, grades, absenceLogs, assignments]);

  // Save assignment handler
  const handleAssignWorker = async () => {
    if (isLockedForClass) {
      alert(`Week ${selectedWeek} follow-up window is closed. Changes cannot be recorded in class register (Read-Only Mode).`);
      return;
    }
    if (!selectedCandidate || !assignedWorkerName.trim() || savingRef.current) return;

    const existing = getWeeklyVisitationAssignments(assignmentsRef.current, selectedWeek, quarterNumber).find(record => record.memberId === selectedCandidate.memberId);
    const assignmentId = existing?.id || `${classProfile?.id || 'cls'}_q${quarterNumber}_w${selectedWeek}_m${selectedCandidate.memberId}`;
    const newRecord: VisitationAssignmentRecord = {
      ...existing,
      id: assignmentId,
      classId: classProfile?.id || '',
      memberId: selectedCandidate.memberId,
      memberName: selectedCandidate.fullName,
      assignedStaffName: assignedWorkerName.trim(),
      assignedStaffPhone: assignedWorkerPhone.trim() || undefined,
      assignedDate: new Date().toISOString().split('T')[0],
      weekNumber: selectedWeek,
      quarterNumber,
      priority: selectedCandidate.priority,
      slotType: selectedCandidate.slotType,
      status: existing?.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedAssignments = {
      ...assignmentsRef.current,
      [assignmentId]: newRecord
    };

    savingRef.current = true;
    setIsSaving(true);
    setPersistenceError('');
    try {
      await saveAssignmentSnapshot(updatedAssignments);
      setIsAssignModalOpen(false);
      setSelectedCandidate(null);
      setAssignedWorkerName('');
      setAssignedWorkerPhone('');
    } catch (error) {
      console.error(`[Visitation] Assignment save failed for ${assignmentId}:`, error);
      setPersistenceError(`The worker assignment was not saved. Please retry. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Record completed visit handler
  const handleRecordCompletedVisit = async () => {
    if (isLockedForClass) {
      alert(`Week ${selectedWeek} follow-up window is closed. Changes cannot be recorded in class register (Read-Only Mode).`);
      return;
    }
    if (!selectedCandidate || !visitorName.trim() || savingRef.current) return;

    const existing = getWeeklyVisitationAssignments(assignmentsRef.current, selectedWeek, quarterNumber).find(record => record.memberId === selectedCandidate.memberId);
    const assignmentId = existing?.id || `${classProfile?.id || 'cls'}_q${quarterNumber}_w${selectedWeek}_m${selectedCandidate.memberId}`;
    const completedRecord: VisitationAssignmentRecord = {
      ...existing,
      id: assignmentId,
      classId: classProfile?.id || '',
      memberId: selectedCandidate.memberId,
      memberName: selectedCandidate.fullName,
      assignedStaffName: visitorName.trim(),
      assignedDate: existing?.assignedDate || new Date().toISOString().split('T')[0],
      weekNumber: selectedWeek,
      quarterNumber,
      priority: selectedCandidate.priority,
      slotType: selectedCandidate.slotType,
      status: 'COMPLETED',
      completedAt: visitDate || new Date().toISOString().split('T')[0],
      outcome: visitOutcome.trim(),
      nextAction: visitNextAction.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    const updatedAssignments = {
      ...assignmentsRef.current,
      [assignmentId]: completedRecord
    };

    savingRef.current = true;
    setIsSaving(true);
    setPersistenceError('');
    let visitSaved = false;
    try {
      await saveAssignmentSnapshot(updatedAssignments);
      visitSaved = true;
      // A stable ID makes retrying a failed log safe and avoids double-counting.
      if (onSaveAbsenceLog) {
      const absenceLog: AbsenceLogRecord = {
        id: `visitation_${classProfile?.id}_q${quarterNumber}_${selectedCandidate.memberId}_w${selectedWeek}`,
        quarterNumber,
        memberId: selectedCandidate.memberId,
        classId: classProfile?.id || '',
        weekNumber: selectedWeek,
        consecutiveWeeksAbsent: selectedCandidate.consecutiveWeeksAbsent,
        urgencyLevel: selectedCandidate.consecutiveWeeksAbsent >= 3 ? 'CRITICAL' : selectedCandidate.consecutiveWeeksAbsent === 2 ? 'RED' : 'ORANGE',
        contactMethod: 'PASTORAL_VISIT',
        decisionDate: visitDate,
        notes: `Pastoral Visit completed by ${visitorName.trim()}.${visitOutcome ? ` Outcome: ${visitOutcome.trim()}` : ''}${visitNextAction ? ` Next action: ${visitNextAction.trim()}` : ''}`,
        loggedAt: new Date().toISOString()
      };
      await onSaveAbsenceLog(absenceLog);
      }
      setIsRecordVisitModalOpen(false);
      setSelectedCandidate(null);
      setVisitorName('');
      setVisitOutcome('');
      setVisitNextAction('');
    } catch (error) {
      console.error(`[Visitation] ${visitSaved ? 'Follow-up log' : 'Completed visit'} save failed for ${assignmentId}:`, error);
      setPersistenceError(`${visitSaved ? 'The visit is saved as completed, but its follow-up log could not be saved.' : 'The completed visit was not saved.'} Please retry. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {persistenceError && (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <p>{persistenceError}</p>
          {failedSlateKey && (
            <button type="button" className="mt-2 rounded-lg bg-rose-800 px-3 py-2 font-bold text-white" onClick={() => { setPersistenceError(''); setFailedSlateKey(null); }}>
              Retry Saving Candidates
            </button>
          )}
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider">
              <Home className="w-3.5 h-3.5" />
              Class Register · Subpage 3
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Weekly Visitation Management
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl font-medium">
              Priority-based weekly visitation queue with 4-week cooldown protection. Default target of 3 visits (max 4) per week to prevent worker burnout.
            </p>
          </div>

          {/* Dynamic Week Indicator Badge */}
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-2 border border-white/20">
              <Calendar className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-black text-amber-300 tracking-wide uppercase">
                Week {selectedWeek} Follow-Up
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized Follow-Up Week Switcher & Live Deadline Timer */}
      <FollowUpWeekSyncBar
        selectedWeek={selectedWeek}
        onSelectWeek={handleSelectWeek}
        totalWeeks={12}
        quarter={quarterData}
        quarterNumber={quarterNumber}
        label="Visitation week"
        isClassPortal={true}
        isCoordinator={isCoordinator}
      />

      {/* Closed / Read-Only Notice when past week window is closed */}
      {isLockedForClass && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 flex items-start gap-3.5 text-amber-950 shadow-sm animate-fade-in">
          <div className="w-10 h-10 rounded-2xl bg-amber-200/80 flex items-center justify-center shrink-0 text-amber-900 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-950 uppercase tracking-tight">
              Week {selectedWeek} Follow-Up Window Is Closed (Read-Only Mode)
            </h3>
            <p className="text-xs text-amber-900/90 mt-1 leading-relaxed font-medium">
              In accordance with Sunday School regulations, class teachers and secretaries cannot alter or record visitations for closed past weeks. Records are displayed in Read-Only mode. Only the Follow-Up Directorate Coordinator can review.
            </p>
          </div>
        </div>
      )}

      {/* Class Follow-Up & Visitation KPI Metrics */}
      {classSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Class Members</span>
            <span className="text-2xl font-black text-slate-900 mt-1">{classSummary.totalClassMembers}</span>
            <span className="text-[10px] text-slate-500 mt-1 font-semibold">{classSummary.className}</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">Present Week {selectedWeek}</span>
            <span className="text-2xl font-black text-emerald-700 mt-1">{classSummary.present}</span>
            <span className="text-[10px] text-emerald-600 mt-1 font-bold">
              {classSummary.totalClassMembers > 0 ? Math.round((classSummary.present / classSummary.totalClassMembers) * 100) : 0}% attendance
            </span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">Absent Week {selectedWeek}</span>
            <span className="text-2xl font-black text-rose-700 mt-1">{classSummary.absent}</span>
            <span className="text-[10px] text-rose-500 mt-1 font-semibold">Immediate attention</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">Follow-Up Need</span>
            <span className="text-2xl font-black text-amber-700 mt-1">{classSummary.membersRequiringFollowUp}</span>
            <span className="text-[10px] text-amber-600 mt-1 font-semibold">1+ weeks absent</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Visitation Need</span>
            <span className="text-2xl font-black text-indigo-700 mt-1">{classSummary.membersRequiringVisitation}</span>
            <span className="text-[10px] text-indigo-500 mt-1 font-semibold">Eligible (not in cooldown)</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-teal-600 uppercase tracking-wider">Completed Visits</span>
            <span className="text-2xl font-black text-teal-700 mt-1">{classSummary.visitationCompleted}</span>
            <span className="text-[10px] text-teal-600 mt-1 font-semibold">Recorded visits</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">Report Status</span>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                classSummary.status === 'SUBMITTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {classSummary.status}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 font-semibold">Week {selectedWeek}</span>
          </div>
        </div>
      )}

      {/* Main Visitation Queue Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header & Controls */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Weekly Visitation Candidates (Target: {VISITATION_TARGET_PER_CLASS_PER_WEEK}, Max: {VISITATION_MAX_PER_CLASS_PER_WEEK})
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                {candidates.length} Selected
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                {candidates.filter(candidate => candidate.visitStatus === 'COMPLETED').length}/{candidates.length} Completed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              4-Slot Operational Rule: 2 Priority Need (Urgent Absentees) · 1 Consistent Student (Encouragement) · 1 Newly Onboarded (Joined Last Week). Excludes 4-week cooldown & one-time visitors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCooldownCandidates(prev => !prev)}
              disabled={isSaving || getWeeklyVisitationAssignments(assignments, selectedWeek, quarterNumber).some(record => record.selectedSlotIndex !== undefined)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                showCooldownCandidates
                  ? 'bg-purple-100 border-purple-300 text-purple-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showCooldownCandidates ? 'Showing Cooldown Members' : `Include Cooldown (${excludedByCooldownCount})`}
            </button>
          </div>
        </div>

        {/* Candidates Table */}
        {candidates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">No Visitation Candidates Required</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              All class members are either actively attending, have already been visited recently (within the 4-week cooldown), or there are no unaddressed absences for Week {selectedWeek}.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="block w-full text-left border-collapse lg:table">
              <thead className="hidden lg:table-header-group">
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Slot & Priority</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4 text-center">Absence</th>
                  <th className="py-3 px-4">Last Visit</th>
                  <th className="py-3 px-4">Cooldown</th>
                  <th className="py-3 px-4">Assigned Worker</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-slate-100 text-xs lg:table-row-group">
                {candidates.map(candidate => {
                  const assignment = getWeeklyVisitationAssignments(assignments, selectedWeek, quarterNumber).find(record => record.memberId === candidate.memberId);
                  const isCompleted = assignment?.status === 'COMPLETED';

                  return (
                    <tr
                      key={candidate.memberId}
                      className={`block py-3 lg:table-row lg:py-0 hover:bg-slate-50/80 transition-colors [&>td]:block [&>td]:py-1.5 lg:[&>td]:table-cell lg:[&>td]:py-3.5 ${
                        candidate.isInCooldown ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Priority & Slot Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              candidate.slotType === 'CONSISTENT_STUDENT'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : candidate.slotType === 'NEWLY_ONBOARDED'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : candidate.priority === 'HIGH'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : candidate.priority === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                candidate.slotType === 'CONSISTENT_STUDENT'
                                  ? 'bg-emerald-600'
                                  : candidate.slotType === 'NEWLY_ONBOARDED'
                                  ? 'bg-purple-600'
                                  : candidate.priority === 'HIGH'
                                  ? 'bg-rose-600'
                                  : candidate.priority === 'MEDIUM'
                                  ? 'bg-amber-600'
                                  : 'bg-blue-600'
                              }`}
                            />
                            {candidate.slotType === 'CONSISTENT_STUDENT'
                              ? 'Consistent Student'
                              : candidate.slotType === 'NEWLY_ONBOARDED'
                              ? 'Newly Onboarded'
                              : candidate.priority === 'HIGH'
                              ? 'Priority 1 (High)'
                              : candidate.priority === 'MEDIUM'
                              ? 'Priority 2 (Med)'
                              : 'Priority 3 (Mon)'}
                          </span>
                          {candidate.slotType && (
                            <span className="text-[9px] text-slate-500 font-semibold">
                              {candidate.slotType === 'PRIORITY_NEED' ? 'Slot 1/2 · Need' : candidate.slotType === 'CONSISTENT_STUDENT' ? 'Slot 3 · Encourage' : 'Slot 4 · New Onboard'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Member Info */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex flex-col">
                          <span>{candidate.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                            <span className="uppercase text-slate-600">{candidate.memberType}</span>
                            {candidate.phone && (
                              <span className="flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {candidate.phone}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Consecutive Absences */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-black text-xs">
                          {candidate.consecutiveWeeksAbsent} {candidate.consecutiveWeeksAbsent === 1 ? 'wk' : 'wks'}
                        </span>
                      </td>

                      {/* Last Visit */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {candidate.lastVisitedDate ? (
                          <div className="flex flex-col">
                            <span>{candidate.lastVisitedDate}</span>
                            {candidate.lastVisitedWeek && (
                              <span className="text-[10px] text-slate-400">Week {candidate.lastVisitedWeek}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Never recorded</span>
                        )}
                      </td>

                      {/* Cooldown Status */}
                      <td className="py-3.5 px-4">
                        {candidate.isInCooldown ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                            <Clock className="w-3 h-3" />
                            In Cooldown ({candidate.cooldownWeeksRemaining}w left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            Eligible
                          </span>
                        )}
                      </td>

                      {/* Assigned Worker */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {assignment?.assignedStaffName ? (
                          <div className="flex flex-col">
                            <span className="text-indigo-900 font-black">{assignment.assignedStaffName}</span>
                            {assignment.assignedDate && (
                              <span className="text-[10px] text-slate-400">Assigned: {assignment.assignedDate}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : assignment?.status === 'ASSIGNED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {assignment?.status || 'PENDING'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isLockedForClass ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">
                            <Lock className="w-3 h-3" />
                            <span>Locked</span>
                          </span>
                        ) : (
                          <div className="inline-flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedCandidate(candidate);
                                setAssignedWorkerName(assignment?.assignedStaffName || '');
                                setAssignedWorkerPhone(assignment?.assignedStaffPhone || '');
                                setIsAssignModalOpen(true);
                              }}
                              disabled={isSaving || assignment?.selectedSlotIndex === undefined || failedSlateKey === `${storageKey}_w${selectedWeek}`}
                              className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                            >
                              {assignment ? 'Reassign' : 'Assign'}
                            </button>

                            <button
                              onClick={() => {
                                setSelectedCandidate(candidate);
                                setSelectedAssignment(assignment || null);
                                setVisitorName(assignment?.assignedStaffName || classProfile?.teacherName || '');
                                setVisitOutcome(assignment?.outcome || '');
                                setVisitNextAction(assignment?.nextAction || '');
                                setIsRecordVisitModalOpen(true);
                              }}
                              disabled={isSaving || assignment?.selectedSlotIndex === undefined || failedSlateKey === `${storageKey}_w${selectedWeek}`}
                              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              {isCompleted ? 'Edit Visit' : 'Complete Visit'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Worker Modal */}
      {isAssignModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Assign visitation worker" className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-scale-in">
            {persistenceError && <p role="alert" className="mb-3 text-sm text-rose-700">{persistenceError}</p>}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">Assign Visitation Worker</h3>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Visiting Member:</span>
                <span className="text-sm font-black text-slate-900">{selectedCandidate.fullName}</span>
                <span className="text-xs text-rose-600 font-bold block mt-0.5">
                  {selectedCandidate.consecutiveWeeksAbsent} consecutive weeks absent ({selectedCandidate.priority} Priority)
                </span>
              </div>

              {/* Quick Select from Class Staff */}
              {availableStaff.length > 0 && (
                <div>
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                    Quick Pick Class Worker
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableStaff.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setAssignedWorkerName(s.name);
                          if (s.phone) setAssignedWorkerPhone(s.phone);
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          assignedWorkerName === s.name
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s.name} ({s.role})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Worker Name *
                </label>
                <input
                  type="text"
                  value={assignedWorkerName}
                  onChange={e => setAssignedWorkerName(e.target.value)}
                  placeholder="Enter worker full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Worker Phone (Optional)
                </label>
                <input
                  type="text"
                  value={assignedWorkerPhone}
                  onChange={e => setAssignedWorkerPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignWorker}
                disabled={isSaving || !assignedWorkerName.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Completed Visit Modal */}
      {isRecordVisitModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Record completed visitation" className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-scale-in">
            {persistenceError && <p role="alert" className="mb-3 text-sm text-rose-700">{persistenceError}</p>}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">Record Completed Visitation</h3>
              </div>
              <button
                onClick={() => setIsRecordVisitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold block">Visited Member:</span>
                <span className="text-sm font-black text-slate-900">{selectedCandidate.fullName}</span>
                <span className="text-xs text-slate-600 block mt-0.5">
                  Consecutive Absences: {selectedCandidate.consecutiveWeeksAbsent} weeks
                </span>
                <span className="text-[11px] text-purple-700 font-bold block mt-1">
                  Notice: Once saved, this member enters the mandatory 4-week visitation cooldown.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Date of Visit *
                  </label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Visitor / Worker Name *
                  </label>
                  <input
                    type="text"
                    value={visitorName}
                    onChange={e => setVisitorName(e.target.value)}
                    placeholder="Worker name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Visit Outcome / Summary Report *
                </label>
                <textarea
                  rows={3}
                  value={visitOutcome}
                  onChange={e => setVisitOutcome(e.target.value)}
                  placeholder="Summary of the visit: How is the member doing? Reason for absence, prayer requests, response to invitation to return..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Next Action (Optional)
                </label>
                <input
                  type="text"
                  value={visitNextAction}
                  onChange={e => setVisitNextAction(e.target.value)}
                  placeholder="e.g. Call before next Sunday, Arrange transport, Pastor to follow up"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsRecordVisitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordCompletedVisit}
                disabled={isSaving || !visitorName.trim() || !visitDate}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Saving…' : 'Confirm & Record Completed Visit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
