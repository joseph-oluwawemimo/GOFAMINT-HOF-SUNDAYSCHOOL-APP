import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  MessageCircle, 
  RotateCw, 
  Filter, 
  Phone, 
  Calendar,
  Sparkles,
  Award
} from 'lucide-react';
import { Member, ClassProfile, LessonInfo, AbsenceLogRecord, FollowUpAssignmentRecord } from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import { buildWhatsAppDirectLink } from '../utils/phoneUtils';
import { generateStaffAssignedFollowUpMessage } from '../utils/whatsappMessages';

export type { FollowUpAssignmentRecord };

interface FollowUpAssignmentsViewProps {
  members: Member[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  activeLessons?: LessonInfo[];
  selectedQuarterNumber?: number;
  absenceLogs?: AbsenceLogRecord[];
  onSaveAbsenceLog?: (log: AbsenceLogRecord) => Promise<void>;
  onDeleteAbsenceLog?: (logId: string) => Promise<void>;
  onUpdateClassProfile?: (updated: ClassProfile) => Promise<void>;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'Secretary' | 'Head Teacher' | 'Teacher';
  phone?: string;
}

export const FollowUpAssignmentsView: React.FC<FollowUpAssignmentsViewProps> = ({
  members,
  currentWeek,
  classProfile,
  activeLessons = GOFAMINT_HOF_12_LESSONS,
  selectedQuarterNumber = 1,
  absenceLogs = [],
  onSaveAbsenceLog,
  onDeleteAbsenceLog,
  onUpdateClassProfile,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek || 1);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'REACHED_OUT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Storage key for assignments
  const storageKey = useMemo(() => {
    const cid = classProfile?.id || 'default_class';
    return `gofamint_assignments_${cid}_q${selectedQuarterNumber}`;
  }, [classProfile?.id, selectedQuarterNumber]);

  // Load persistent assignment completion records (merging classProfile cloud records & local device storage)
  const cloudRecords = useMemo(() => classProfile?.followUpAssignments || {}, [classProfile?.followUpAssignments]);

  const [savedRecords, setSavedRecords] = useState<Record<string, FollowUpAssignmentRecord>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const local = raw ? JSON.parse(raw) : {};
      return { ...cloudRecords, ...local };
    } catch {
      return { ...cloudRecords };
    }
  });

  // Re-read and merge when quarter, classProfile, or storageKey changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const local = raw ? JSON.parse(raw) : {};
      const merged = { ...local, ...(classProfile?.followUpAssignments || {}) };
      setSavedRecords(merged);
    } catch {
      setSavedRecords(classProfile?.followUpAssignments || {});
    }
  }, [storageKey, classProfile?.followUpAssignments]);

  // AUTOMATIC CROSS-DEVICE RECONCILIATION & CLOUD UPLOAD:
  // If local device localStorage contains records marked REACHED_OUT that aren't yet in classProfile,
  // push them to the central cloud database so all other devices instantly receive them!
  useEffect(() => {
    if (!classProfile || !onUpdateClassProfile) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const local: Record<string, FollowUpAssignmentRecord> = JSON.parse(raw);
      const currentCloud = classProfile.followUpAssignments || {};
      let hasNewCloudData = false;
      const mergedCloud = { ...currentCloud };

      for (const [recId, rec] of Object.entries(local)) {
        if (rec.status === 'REACHED_OUT' && (!currentCloud[recId] || currentCloud[recId].status !== 'REACHED_OUT')) {
          mergedCloud[recId] = rec;
          hasNewCloudData = true;

          // Also guarantee absenceLog exists so Welfare view reflects outreach
          if (onSaveAbsenceLog && rec.memberId && rec.weekNumber) {
            const absenceLogId = `${rec.classId}_q${rec.quarterNumber}_${rec.memberId}_w${rec.weekNumber}`;
            const existingLog = absenceLogs.find(l => l.id === absenceLogId);
            if (!existingLog) {
              const logRecord: AbsenceLogRecord = {
                id: absenceLogId,
                classId: rec.classId,
                quarterNumber: rec.quarterNumber,
                memberId: rec.memberId,
                weekNumber: rec.weekNumber,
                consecutiveWeeksAbsent: 0,
                urgencyLevel: 'YELLOW',
                contactMethod: 'WHATSAPP',
                decisionMade: true,
                decisionDate: rec.reachedOutAt || new Date().toISOString(),
                notes: `Weekly pastoral care assignment completed by ${rec.assignedStaffName} (${rec.assignedStaffRole})`,
                loggedAt: rec.reachedOutAt || new Date().toISOString()
              };
              void onSaveAbsenceLog(logRecord);
            }
          }
        }
      }

      if (hasNewCloudData) {
        const updatedProfile: ClassProfile = {
          ...classProfile,
          followUpAssignments: mergedCloud,
          updatedAt: new Date().toISOString()
        };
        void onUpdateClassProfile(updatedProfile);
      }
    } catch (e) {
      console.warn('Reconciliation error in FollowUpAssignmentsView:', e);
    }
  }, [storageKey, classProfile?.id]);

  const saveRecord = (record: FollowUpAssignmentRecord) => {
    setSavedRecords(prev => {
      const next = { ...prev, [record.id]: record };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save assignment record locally:', err);
      }
      return next;
    });
  };

  // Compile active staff members (Secretary + Teachers)
  const staffList = useMemo<StaffMember[]>(() => {
    const list: StaffMember[] = [];
    if (classProfile?.secretaryName && classProfile.secretaryName.trim()) {
      list.push({
        id: 'sec_1',
        name: classProfile.secretaryName.trim(),
        role: 'Secretary',
        phone: classProfile.secretaryPhone
      });
    }

    if (classProfile?.teachers && classProfile.teachers.length > 0) {
      classProfile.teachers.forEach((t, idx) => {
        if (t.name && t.name.trim()) {
          list.push({
            id: t.id || `teacher_${idx + 1}`,
            name: t.name.trim(),
            role: t.isHeadTeacher ? 'Head Teacher' : 'Teacher',
            phone: t.phone
          });
        }
      });
    }

    // Fallback if class profile has no staff listed
    if (list.length === 0) {
      list.push({
        id: 'staff_default',
        name: classProfile?.className ? `${classProfile.className} Teacher` : 'Class Teacher',
        role: 'Teacher'
      });
    }

    return list;
  }, [classProfile]);

  // Only active members (excluding archived/left)
  const activeMembers = useMemo(() => {
    return members
      .filter(m => m.status === 'ACTIVE' && !m.isOneTimeVisitor)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members]);

  // Current lesson for the selected week
  const currentLesson = useMemo(() => {
    return activeLessons.find(l => l.weekNumber === selectedWeek) || activeLessons[0] || GOFAMINT_HOF_12_LESSONS[0];
  }, [activeLessons, selectedWeek]);

  // Compute balanced distribution with weekly rotation
  // Formula: (memberIndex + weekNumber - 1) % staffList.length
  const weeklyAssignments = useMemo(() => {
    const classId = classProfile?.id || 'default_class';
    const numStaff = staffList.length;

    return activeMembers.map((member, index) => {
      const staffIndex = (index + (selectedWeek - 1)) % numStaff;
      const assignedStaff = staffList[staffIndex];
      const recordId = `${classId}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
      const saved = savedRecords[recordId] || classProfile?.followUpAssignments?.[recordId];

      // Check if an absence/welfare outreach log was recorded for this member in this week
      const matchingAbsenceLog = absenceLogs.find(
        l => l.memberId === member.id &&
             Number(l.weekNumber) === Number(selectedWeek) &&
             (l.quarterNumber === undefined || Number(l.quarterNumber) === Number(selectedQuarterNumber))
      );

      // Status resolution:
      // 1. Explicit assignment record takes first priority (respects explicit staff toggle)
      // 2. If no explicit assignment record exists, an absence/outreach log for that week counts as REACHED_OUT!
      let isReachedOut = false;
      let reachedOutAt = saved?.reachedOutAt;

      if (saved?.status === 'REACHED_OUT') {
        isReachedOut = true;
      } else if (saved?.status === 'PENDING') {
        isReachedOut = false;
      } else if (matchingAbsenceLog) {
        isReachedOut = true;
        reachedOutAt = matchingAbsenceLog.loggedAt;
      }

      return {
        recordId,
        member,
        assignedStaff,
        status: (isReachedOut ? 'REACHED_OUT' : 'PENDING') as 'PENDING' | 'REACHED_OUT',
        reachedOutAt
      };
    });
  }, [activeMembers, staffList, selectedWeek, selectedQuarterNumber, classProfile?.id, classProfile?.followUpAssignments, savedRecords, absenceLogs]);

  // Handle Mark as Done / Reached Out toggle (with real-time cloud sync & cross-view coherence)
  const handleToggleReachedOut = async (item: typeof weeklyAssignments[0]) => {
    const classId = classProfile?.id || 'default_class';
    const isCurrentlyDone = item.status === 'REACHED_OUT';
    const newStatus = isCurrentlyDone ? 'PENDING' : 'REACHED_OUT';
    const nowIso = new Date().toISOString();
    const updated: FollowUpAssignmentRecord = {
      id: item.recordId,
      classId,
      quarterNumber: selectedQuarterNumber,
      weekNumber: selectedWeek,
      memberId: item.member.id,
      assignedStaffId: item.assignedStaff.id,
      assignedStaffName: item.assignedStaff.name,
      assignedStaffRole: item.assignedStaff.role,
      status: newStatus,
      reachedOutAt: newStatus === 'REACHED_OUT' ? (item.reachedOutAt || nowIso) : undefined,
      updatedAt: nowIso
    };

    // 1. Save to local storage and component state immediately
    saveRecord(updated);

    // 2. Persist to classProfile.followUpAssignments and push to central Supabase cloud
    if (classProfile && onUpdateClassProfile) {
      const nextMap = {
        ...(classProfile.followUpAssignments || {}),
        [updated.id]: updated
      };
      const updatedProfile: ClassProfile = {
        ...classProfile,
        followUpAssignments: nextMap,
        updatedAt: nowIso
      };
      void onUpdateClassProfile(updatedProfile);
    }

    // 3. Keep absenceLogs in sync so Welfare view also reflects outreach across all devices
    const canonicalLogId = `${classId}_q${selectedQuarterNumber}_${item.member.id}_w${selectedWeek}`;
    if (newStatus === 'REACHED_OUT' && onSaveAbsenceLog) {
      const logRecord: AbsenceLogRecord = {
        id: canonicalLogId,
        classId,
        quarterNumber: selectedQuarterNumber,
        memberId: item.member.id,
        weekNumber: selectedWeek,
        consecutiveWeeksAbsent: 0,
        urgencyLevel: 'YELLOW',
        contactMethod: 'WHATSAPP',
        decisionMade: true,
        decisionDate: nowIso,
        notes: `Weekly pastoral care assignment completed by ${item.assignedStaff.name} (${item.assignedStaff.role})`,
        loggedAt: nowIso
      };
      void onSaveAbsenceLog(logRecord);
    } else if (newStatus === 'PENDING' && onDeleteAbsenceLog) {
      void onDeleteAbsenceLog(canonicalLogId);
    }
  };

  // Filtered assignments based on UI controls
  const filteredAssignments = useMemo(() => {
    return weeklyAssignments.filter(item => {
      // Staff filter
      if (selectedStaffId !== 'ALL' && item.assignedStaff.id !== selectedStaffId) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.member.fullName.toLowerCase().includes(query);
        const matchesPhone = item.member.phone?.includes(query);
        const matchesStaff = item.assignedStaff.name.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesStaff) return false;
      }
      return true;
    });
  }, [weeklyAssignments, selectedStaffId, statusFilter, searchTerm]);

  // Overall Statistics
  const totalAssigned = weeklyAssignments.length;
  const totalReachedOut = weeklyAssignments.filter(a => a.status === 'REACHED_OUT').length;
  const totalPending = totalAssigned - totalReachedOut;
  const completionPercentage = totalAssigned > 0 ? Math.round((totalReachedOut / totalAssigned) * 100) : 0;

  // Selected Staff specific stats
  const staffScopedStats = useMemo(() => {
    if (selectedStaffId === 'ALL') return null;
    const staffItems = weeklyAssignments.filter(a => a.assignedStaff.id === selectedStaffId);
    const completed = staffItems.filter(a => a.status === 'REACHED_OUT').length;
    return {
      total: staffItems.length,
      completed,
      pending: staffItems.length - completed,
      percentage: staffItems.length > 0 ? Math.round((completed / staffItems.length) * 100) : 0
    };
  }, [weeklyAssignments, selectedStaffId]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      
      {/* Top Hero Banner */}
      <section 
        aria-labelledby="assignments-heading" 
        className="bg-gradient-to-br from-[#1d0e3a] via-[#320b86] to-[#12082b] border border-purple-500/30 rounded-3xl p-5 sm:p-7 shadow-xl shadow-purple-950/20 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-950 bg-amber-400 px-2.5 py-1 rounded-lg">
              Staff Assignments
            </span>
            <span className="text-[10px] font-black text-purple-100 bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg">
              Quarter {selectedQuarterNumber}
            </span>
            <span className="text-[10px] font-black text-purple-100 bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg">
              Week {selectedWeek} of 12
            </span>
          </div>
          <h2 id="assignments-heading" className="text-xl sm:text-3xl font-black text-white mt-2.5 tracking-tight font-['Cinzel',serif]">
            Follow-Up Assignments Console
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/80 mt-1 max-w-2xl">
            Balanced weekly care distribution across class teachers and secretary. Assignments reshuffle automatically each week to provide comprehensive pastoral care.
          </p>
        </div>

        {/* Top Summary Progress Card */}
        <div className="bg-white/10 border border-white/15 p-4 rounded-2xl flex flex-col gap-2 min-w-[260px]">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-purple-200">Weekly Care Progress</span>
            <span className="text-amber-400 font-mono text-sm">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-purple-200/90 pt-1">
            <span><strong>{totalReachedOut}</strong> Reached Out</span>
            <span><strong>{totalPending}</strong> Pending</span>
            <span><strong>{staffList.length}</strong> Staff</span>
          </div>
        </div>
      </section>

      {/* Week Selector Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <span className="text-xs font-black text-slate-500 shrink-0 uppercase tracking-wider flex items-center gap-1.5 mr-1">
          <Calendar className="w-3.5 h-3.5 text-purple-600" />
          <span>Week:</span>
        </span>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(w => {
          const isSelected = selectedWeek === w;
          const isCurrent = currentWeek === w;
          return (
            <button
              key={w}
              type="button"
              id={`btn-assignment-week-${w}`}
              onClick={() => setSelectedWeek(w)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#320b86] text-white shadow-md shadow-purple-900/20 scale-105'
                  : 'bg-white hover:bg-purple-50 text-slate-700 border border-slate-200'
              }`}
            >
              Week {w} {isCurrent && <span className="ml-1 text-[10px] text-amber-300">●</span>}
            </button>
          );
        })}
      </div>

      {/* Staff View Tabs & Filter Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Staff Switcher: "All Staff" vs Individual Teachers */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Select Staff Console View</span>
            </span>
            {staffScopedStats && (
              <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                My Follow-Up: <strong>{staffScopedStats.completed}</strong> of <strong>{staffScopedStats.total}</strong> Done ({staffScopedStats.percentage}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              id="btn-staff-filter-all"
              onClick={() => setSelectedStaffId('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-2 ${
                selectedStaffId === 'ALL'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Leadership Overview (All Staff)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">{totalAssigned}</span>
            </button>

            {staffList.map(staff => {
              const isSelected = selectedStaffId === staff.id;
              const count = weeklyAssignments.filter(a => a.assignedStaff.id === staff.id).length;
              const doneCount = weeklyAssignments.filter(a => a.assignedStaff.id === staff.id && a.status === 'REACHED_OUT').length;
              return (
                <button
                  key={staff.id}
                  type="button"
                  id={`btn-staff-filter-${staff.id}`}
                  onClick={() => setSelectedStaffId(staff.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#320b86] text-white shadow-xs'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
                  }`}
                >
                  <span>{staff.name}</span>
                  <span className="text-[10px] opacity-75 font-normal">({staff.role})</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-900'
                  }`}>
                    {doneCount}/{count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filters: Status & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Status:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({filteredAssignments.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'PENDING' ? 'bg-amber-100 text-amber-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Pending</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('REACHED_OUT')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'REACHED_OUT' ? 'bg-emerald-100 text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>Reached Out</span>
              </button>
            </div>
          </div>

          <div className="relative max-w-xs w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search member or staff..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            />
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Current Week Lesson Context Card */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
        <div>
          <span className="font-black uppercase tracking-wider text-[10px] text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded mr-2">
            Week {selectedWeek} Lesson
          </span>
          <strong className="text-amber-950 font-bold">{currentLesson.topic}</strong>
          <span className="text-amber-800 block sm:inline sm:ml-2">
            Memory Verse: "{currentLesson.memoryVerse}" ({currentLesson.memoryVerseRef})
          </span>
        </div>
        <div className="text-[11px] font-bold text-amber-900 bg-white/80 border border-amber-200 px-2.5 py-1 rounded-xl self-start sm:self-center shrink-0">
          Sunday School: 8:00 a.m.
        </div>
      </div>

      {/* Assignments List / Grid */}
      {filteredAssignments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-800">No assigned members match your selection</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing filters or selecting another staff member.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((item) => {
            const { member, assignedStaff, status, recordId, reachedOutAt } = item;
            const isDone = status === 'REACHED_OUT';

            // Generate WhatsApp message with teacher name + lesson details
            const message = generateStaffAssignedFollowUpMessage({
              memberName: member.fullName,
              staffName: assignedStaff.name,
              className: classProfile?.className,
              isVisitor: member.memberType === 'VISITOR',
              lesson: currentLesson,
              weekNumber: selectedWeek
            });

            const waLink = buildWhatsAppDirectLink(member.phone, message);

            return (
              <div
                key={recordId}
                id={`card-assignment-${member.id}`}
                className={`bg-white border rounded-3xl p-5 shadow-xs transition-all flex flex-col justify-between gap-4 ${
                  isDone 
                    ? 'border-emerald-200 bg-emerald-50/20' 
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div>
                  {/* Card Header: Member Info & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          member.memberType === 'STUDENT' ? 'bg-blue-500' : 'bg-purple-500'
                        }`} />
                        <h4 className="text-sm font-black text-slate-900 truncate">
                          {member.fullName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold">{member.memberType === 'STUDENT' ? 'Student' : 'Visitor'}</span>
                        {member.phone && (
                          <span className="font-mono flex items-center gap-1 text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {member.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                      isDone 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {isDone ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Reached Out</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Pending</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Responsible Staff Badge */}
                  <div className="mt-3.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Responsible Staff</span>
                      <strong className="text-slate-800 font-bold">{assignedStaff.name}</strong>
                    </div>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                      {assignedStaff.role}
                    </span>
                  </div>

                  {/* Prayer Requests / Notes snippet if any */}
                  {member.prayerRequests && (
                    <p className="text-[11px] text-slate-600 italic bg-amber-50/50 border border-amber-100 p-2 rounded-xl mt-2 line-clamp-2">
                      "{member.prayerRequests}"
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {/* WhatsApp Follow-Up Button */}
                  {member.phone ? (
                    <a
                      id={`btn-assignment-wa-${member.id}`}
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[38px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                      title="Open WhatsApp with personalized conversational follow-up message"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Follow Up</span>
                    </a>
                  ) : (
                    <span className="flex-1 min-h-[38px] px-3 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center cursor-not-allowed">
                      No Phone Logged
                    </span>
                  )}

                  {/* Mark as Done / Reached Out Toggle */}
                  <button
                    type="button"
                    id={`btn-assignment-toggle-${member.id}`}
                    onClick={() => handleToggleReachedOut(item)}
                    className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 ${
                      isDone
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300'
                    }`}
                    title={isDone ? 'Mark as Pending' : 'Mark as Reached Out'}
                  >
                    <CheckCircle className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-600' : 'text-purple-600'}`} />
                    <span>{isDone ? 'Done ✓' : 'Mark as Done'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
