import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  MessageCircle, 
  Filter, 
  Phone, 
  Calendar, 
  ShieldCheck, 
  Send, 
  Copy, 
  Check, 
  UserX,
  Sparkles,
  Lock,
  AlertTriangle,
  HeartHandshake,
  Plane,
  X,
  Edit3
} from 'lucide-react';
import { 
  Member, 
  ClassProfile, 
  LessonInfo, 
  AbsenceLogRecord, 
  FollowUpAssignmentRecord,
  WeeklyReminderRecord,
  StudentReminderResponse,
  QuarterData
} from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import { buildWhatsAppDirectLink, normalizePhoneNumber } from '../utils/phoneUtils';
import { getLessonByWeek } from '../utils/whatsappMessages';
import { FollowUpWeekSyncBar } from './FollowUpPortal/FollowUpWeekSyncBar';
import { getFollowUpWindowForWeek } from '../utils/quarterScheduleUtils';
import { ApplicationProfile } from '../services/profileService';

export type { FollowUpAssignmentRecord, WeeklyReminderRecord, StudentReminderResponse };

interface FollowUpAssignmentsViewProps {
  members: Member[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  activeLessons?: LessonInfo[];
  selectedQuarterNumber?: number;
  quarterData?: QuarterData | null;
  absenceLogs?: AbsenceLogRecord[];
  onSelectWeek?: (week: number) => void;
  onSaveAbsenceLog?: (log: AbsenceLogRecord) => Promise<void>;
  onDeleteAbsenceLog?: (logId: string) => Promise<void>;
  onUpdateClassProfile?: (updated: ClassProfile) => Promise<void>;
  authProfile?: ApplicationProfile | null;
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
  quarterData,
  absenceLogs = [],
  onSelectWeek,
  onSaveAbsenceLog,
  onDeleteAbsenceLog,
  onUpdateClassProfile,
  authProfile = null,
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

  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'REACHED_OUT'>('ALL');
  const [responseFilter, setResponseFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal state for recording student response
  const [recordingResponseItem, setRecordingResponseItem] = useState<{
    recordId: string;
    member: Member;
    currentResponse?: StudentReminderResponse;
    currentNote?: string;
  } | null>(null);
  const [selectedStudentResponse, setSelectedStudentResponse] = useState<StudentReminderResponse>('ATTENDING');
  const [studentResponseNote, setStudentResponseNote] = useState('');

  // Follow-up window lock & role intelligence
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

  // If window is expired and user is not a coordinator, editing is locked (Read-Only)
  const isLockedForClass = windowInfo.status === 'EXPIRED' && !isCoordinator;

  // Storage key for assignments
  const storageKey = useMemo(() => {
    const cid = classProfile?.id || 'default_class';
    return `gofamint_assignments_${cid}_q${selectedQuarterNumber}`;
  }, [classProfile?.id, selectedQuarterNumber]);

  // Load persistent assignment records
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

    if (list.length === 0) {
      list.push({
        id: 'staff_default',
        name: classProfile?.className ? `${classProfile.className} Teacher` : 'Class Teacher',
        role: 'Teacher'
      });
    }

    return list;
  }, [classProfile]);

  // Split into active eligible members vs excluded members
  const { activeEligibleMembers, excludedMembers } = useMemo(() => {
    const excluded: Member[] = [];
    const active: Member[] = [];

    members.forEach(m => {
      const isExcluded = m.status === 'LEFT_CLASS' ||
        m.exclusionType === 'TEMPORARY' ||
        m.exclusionType === 'PERMANENT' ||
        m.exitReviewOutcome === 'PERMANENT_EXIT';

      if (isExcluded) {
        excluded.push(m);
      } else {
        active.push(m);
      }
    });

    active.sort((a, b) => a.fullName.localeCompare(b.fullName));
    excluded.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return { activeEligibleMembers: active, excludedMembers: excluded };
  }, [members]);

  // Upcoming lesson for weekly reminders
  const upcomingWeekNumber = useMemo(() => {
    return Math.min(13, selectedWeek + 1);
  }, [selectedWeek]);

  const upcomingLesson = useMemo(() => {
    return activeLessons.find(l => l.weekNumber === upcomingWeekNumber) || 
      getLessonByWeek(upcomingWeekNumber, activeLessons);
  }, [activeLessons, upcomingWeekNumber]);

  // Unified Weekly Reminder Message
  const getWeeklyReminderText = (member: Member) => {
    const memberName = member.fullName.trim() || 'Beloved';
    const className = classProfile?.className || 'Sunday School';
    const topic = upcomingLesson.topic || 'Upcoming Sunday School Lesson';
    const mv = upcomingLesson.memoryVerse || 'Thy word is a lamp unto my feet, and a light unto my path.';
    const mvRef = upcomingLesson.memoryVerseRef || 'Scripture';

    return `*SUNDAY SCHOOL WEEKLY REMINDER*
*GOFAMINT House of Favour · ${className}*
*Preparing for Week ${upcomingWeekNumber}*

Hello ${memberName}, we hope your week has been blessed!

We are warmly preparing for our upcoming Sunday School lesson:
📌 *Topic:* "${topic}"
💎 *Memory Verse:* "${mv}" (${mvRef})
⏰ *Start Time:* 8:00 a.m. Prompt

Please prepare ahead and arrive early this Sunday at 8:00 a.m. Your presence will be a great blessing to our class!

_With love in Christ,_
*${className} Team · GOFAMINT House of Favour*`;
  };

  // Helper to compute assignment item
  const buildAssignmentItem = (member: Member, index: number, isExcludedGroup = false) => {
    const classId = classProfile?.id || 'default_class';
    const numStaff = staffList.length;
    const staffIndex = (index + (selectedWeek - 1)) % numStaff;
    const assignedStaff = staffList[staffIndex];
    const recordId = `${classId}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
    const saved = savedRecords[recordId] || classProfile?.followUpAssignments?.[recordId];

    const matchingAbsenceLog = absenceLogs.find(
      l => l.memberId === member.id &&
           Number(l.weekNumber) === Number(selectedWeek) &&
           (l.quarterNumber === undefined || Number(l.quarterNumber) === Number(selectedQuarterNumber))
    );

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
      reachedOutAt,
      isSecretaryOverride: Boolean(saved?.isSecretaryOverride),
      completedBy: saved?.completedBy,
      studentResponse: saved?.studentResponse,
      studentResponseNote: saved?.studentResponseNote,
      isExcludedGroup
    };
  };

  // Weekly assignments for active members
  const activeAssignments = useMemo(() => {
    return activeEligibleMembers.map((member, index) => buildAssignmentItem(member, index, false));
  }, [activeEligibleMembers, staffList, selectedWeek, selectedQuarterNumber, classProfile?.id, classProfile?.followUpAssignments, savedRecords, absenceLogs]);

  // Weekly assignments for excluded members
  const excludedAssignments = useMemo(() => {
    return excludedMembers.map((member, index) => buildAssignmentItem(member, index + 100, true));
  }, [excludedMembers, staffList, selectedWeek, selectedQuarterNumber, classProfile?.id, classProfile?.followUpAssignments, savedRecords, absenceLogs]);

  // Save assignment record helper
  const saveAssignmentRecord = async (updated: FollowUpAssignmentRecord) => {
    const nextSaved = { ...savedRecords, [updated.id]: updated };
    setSavedRecords(nextSaved);

    try {
      localStorage.setItem(storageKey, JSON.stringify(nextSaved));
    } catch (err) {
      console.error('Failed to save assignment locally:', err);
    }

    if (classProfile && onUpdateClassProfile) {
      await onUpdateClassProfile({
        ...classProfile,
        followUpAssignments: {
          ...(classProfile.followUpAssignments || {}),
          [updated.id]: updated
        }
      });
    }

    // Reflect in absence logs if reached out
    if (updated.status === 'REACHED_OUT' && onSaveAbsenceLog) {
      const absenceLogId = `${updated.classId}_q${selectedQuarterNumber}_${updated.memberId}_w${selectedWeek}`;
      const logRecord: AbsenceLogRecord = {
        id: absenceLogId,
        classId: updated.classId,
        quarterNumber: selectedQuarterNumber,
        memberId: updated.memberId,
        weekNumber: selectedWeek,
        consecutiveWeeksAbsent: 0,
        urgencyLevel: 'YELLOW',
        contactMethod: 'WHATSAPP',
        decisionMade: true,
        decisionDate: updated.updatedAt,
        notes: updated.isSecretaryOverride
          ? `Weekly reminder completed via Secretary Override for ${updated.assignedStaffName}. Student response: ${updated.studentResponse || 'REACHED_OUT'}. ${updated.studentResponseNote || ''}`
          : `Weekly reminder outreach completed by ${updated.assignedStaffName} (${updated.assignedStaffRole}). Student response: ${updated.studentResponse || 'REACHED_OUT'}. ${updated.studentResponseNote || ''}`,
        loggedAt: updated.updatedAt
      };
      await onSaveAbsenceLog(logRecord);
    }
  };

  // Toggle Reached Out / Done status
  const handleToggleReachedOut = async (item: ReturnType<typeof buildAssignmentItem>, isSecretaryOverride = false) => {
    if (isLockedForClass) {
      alert(`Week ${selectedWeek} follow-up window is closed. Changes cannot be recorded in class register (Read-Only Mode).`);
      return;
    }

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
      reachedOutAt: newStatus === 'REACHED_OUT' ? nowIso : undefined,
      isSecretaryOverride: isSecretaryOverride || (isCurrentlyDone ? false : item.isSecretaryOverride),
      completedBy: isSecretaryOverride
        ? (classProfile?.secretaryName || 'Class Secretary')
        : (newStatus === 'REACHED_OUT' ? item.assignedStaff.name : undefined),
      completedAt: newStatus === 'REACHED_OUT' ? nowIso : undefined,
      studentResponse: newStatus === 'REACHED_OUT' ? (item.studentResponse || 'ATTENDING') : undefined,
      studentResponseNote: item.studentResponseNote,
      updatedAt: nowIso
    };

    await saveAssignmentRecord(updated);
  };

  // Open Record Response Modal
  const handleOpenRecordResponse = (item: ReturnType<typeof buildAssignmentItem>) => {
    if (isLockedForClass) {
      alert(`Week ${selectedWeek} follow-up window is closed. Changes cannot be recorded in class register (Read-Only Mode).`);
      return;
    }
    setRecordingResponseItem({
      recordId: item.recordId,
      member: item.member,
      currentResponse: item.studentResponse,
      currentNote: item.studentResponseNote
    });
    setSelectedStudentResponse(item.studentResponse || 'ATTENDING');
    setStudentResponseNote(item.studentResponseNote || '');
  };

  // Submit Student Response
  const handleSaveStudentResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingResponseItem) return;

    const classId = classProfile?.id || 'default_class';
    const nowIso = new Date().toISOString();
    const existing = savedRecords[recordingResponseItem.recordId];

    const updated: FollowUpAssignmentRecord = {
      id: recordingResponseItem.recordId,
      classId,
      quarterNumber: selectedQuarterNumber,
      weekNumber: selectedWeek,
      memberId: recordingResponseItem.member.id,
      assignedStaffId: existing?.assignedStaffId || 'staff_default',
      assignedStaffName: existing?.assignedStaffName || 'Staff Member',
      assignedStaffRole: existing?.assignedStaffRole || 'Teacher',
      status: 'REACHED_OUT',
      reachedOutAt: nowIso,
      completedBy: classProfile?.secretaryName || existing?.assignedStaffName || 'Staff Member',
      completedAt: nowIso,
      studentResponse: selectedStudentResponse,
      studentResponseNote: studentResponseNote.trim() || undefined,
      updatedAt: nowIso
    };

    await saveAssignmentRecord(updated);
    setRecordingResponseItem(null);
  };

  // Copy Reminder Message
  const handleCopyReminder = (member: Member) => {
    const text = getWeeklyReminderText(member);
    navigator.clipboard.writeText(text);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter filterable list
  const filterList = (list: typeof activeAssignments) => {
    return list.filter(item => {
      if (selectedStaffId !== 'ALL' && item.assignedStaff.id !== selectedStaffId) {
        return false;
      }
      if (statusFilter === 'PENDING' && item.status !== 'PENDING') {
        return false;
      }
      if (statusFilter === 'REACHED_OUT' && item.status !== 'REACHED_OUT') {
        return false;
      }
      if (responseFilter !== 'ALL') {
        if (responseFilter === 'UNRECORDED' && item.studentResponse) return false;
        if (responseFilter !== 'UNRECORDED' && item.studentResponse !== responseFilter) return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = item.member.fullName.toLowerCase().includes(query);
        const matchesPhone = item.member.phone?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone) return false;
      }
      return true;
    });
  };

  const filteredActiveAssignments = useMemo(() => filterList(activeAssignments), [activeAssignments, selectedStaffId, statusFilter, responseFilter, searchTerm]);
  const filteredExcludedAssignments = useMemo(() => filterList(excludedAssignments), [excludedAssignments, selectedStaffId, statusFilter, responseFilter, searchTerm]);

  // Statistics across active members
  const totalAssignments = activeAssignments.length;
  const completedAssignments = activeAssignments.filter(a => a.status === 'REACHED_OUT').length;
  const assignmentRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  // Response breakdown counters
  const responseCounters = useMemo(() => {
    let early = 0;
    let attending = 0;
    let cannotAttend = 0;
    let traveled = 0;
    let sickPrayer = 0;
    let noResponse = 0;

    for (const a of activeAssignments) {
      if (a.studentResponse === 'ATTENDING_EARLY') early++;
      else if (a.studentResponse === 'ATTENDING') attending++;
      else if (a.studentResponse === 'CANNOT_ATTEND') cannotAttend++;
      else if (a.studentResponse === 'TRAVELED') traveled++;
      else if (a.studentResponse === 'SICK_NEED_PRAYER') sickPrayer++;
      else if (a.studentResponse === 'NO_RESPONSE') noResponse++;
    }

    return { early, attending, cannotAttend, traveled, sickPrayer, noResponse };
  }, [activeAssignments]);

  // Response config helper
  const getResponseBadge = (response?: StudentReminderResponse) => {
    switch (response) {
      case 'ATTENDING_EARLY':
        return {
          label: 'Attending Early (8am)',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dotColor: 'bg-emerald-600'
        };
      case 'ATTENDING':
        return {
          label: 'Will Attend',
          color: 'bg-teal-100 text-teal-800 border-teal-300',
          dotColor: 'bg-teal-600'
        };
      case 'CANNOT_ATTEND':
        return {
          label: 'Cannot Make It',
          color: 'bg-rose-100 text-rose-800 border-rose-300',
          dotColor: 'bg-rose-600'
        };
      case 'TRAVELED':
        return {
          label: 'Traveled / Away',
          color: 'bg-amber-100 text-amber-800 border-amber-300',
          dotColor: 'bg-amber-600'
        };
      case 'SICK_NEED_PRAYER':
        return {
          label: 'Needs Prayer / Sick',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          dotColor: 'bg-purple-600'
        };
      case 'NO_RESPONSE':
        return {
          label: 'No Response Yet',
          color: 'bg-slate-100 text-slate-700 border-slate-300',
          dotColor: 'bg-slate-500'
        };
      default:
        return null;
    }
  };

  // Render a member assignment card
  const renderCard = (item: typeof activeAssignments[0]) => {
    const { member, assignedStaff, status, isSecretaryOverride, completedBy, studentResponse, studentResponseNote } = item;
    const isDone = status === 'REACHED_OUT';
    const msgText = getWeeklyReminderText(member);
    const phoneDigits = normalizePhoneNumber(member.phone || '');
    const waLink = buildWhatsAppDirectLink(phoneDigits, msgText);
    const badgeInfo = getResponseBadge(studentResponse);

    return (
      <div
        key={item.recordId}
        className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
          isDone
            ? 'bg-emerald-50/25 border-emerald-300 shadow-xs'
            : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
        }`}
      >
        <div>
          {/* Header: Member Info & Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 text-sm truncate">{member.fullName}</h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {member.memberType}
                </span>
                {member.isOneTimeVisitor && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                    OTV
                  </span>
                )}
                {member.exclusionType === 'TEMPORARY' && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                    Temp. Excluded
                  </span>
                )}
                {member.exclusionType === 'PERMANENT' && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                    Archived
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3 text-slate-400" />
                {member.phone || 'No phone'}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isDone ? 'Done ✓' : 'Pending'}
              </span>

              {/* Student Response Badge */}
              {badgeInfo && (
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${badgeInfo.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dotColor}`} />
                  {badgeInfo.label}
                </span>
              )}
            </div>
          </div>

          {/* Assigned Staff Attribution */}
          <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Staff:</span>
              <span className="font-bold text-slate-800 truncate">{assignedStaff.name} ({assignedStaff.role})</span>
            </div>
            {isDone && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Completed by:</span>
                <strong className={isSecretaryOverride ? 'text-amber-800 font-bold' : 'text-emerald-700'}>
                  {completedBy || assignedStaff.name} {isSecretaryOverride ? '(Secretary Override)' : ''}
                </strong>
              </div>
            )}

            {/* Note on Student Response */}
            {studentResponseNote && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-600 italic">
                💬 "{studentResponseNote}"
              </div>
            )}
          </div>
        </div>

        {/* Actions: Follow Up (WhatsApp Upcoming Lesson Reminder), Record Response, Mark Done */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {member.phone ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[36px] py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              title="Open WhatsApp with upcoming lesson reminder message"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Follow Up</span>
            </a>
          ) : (
            <div className="text-[11px] text-slate-400 italic py-1">No phone</div>
          )}

          <button
            type="button"
            onClick={() => handleCopyReminder(member)}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title="Copy Reminder Text"
          >
            {copiedId === member.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Record Student Response Button */}
          {!isLockedForClass && (
            <button
              type="button"
              onClick={() => handleOpenRecordResponse(item)}
              className="py-1.5 px-2.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition cursor-pointer flex items-center gap-1"
              title="Record the student's reply (Attending, cannot make it, etc.)"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Response</span>
            </button>
          )}

          {/* Staff Mark Done / Reopen Toggle */}
          {!isLockedForClass ? (
            <button
              type="button"
              onClick={() => handleToggleReachedOut(item, false)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isDone
                  ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
              }`}
            >
              {isDone ? 'Reopen' : 'Mark Done'}
            </button>
          ) : (
            <span className="py-1.5 px-2 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Locked</span>
            </span>
          )}

          {/* Secretary Override Button */}
          {!isDone && !isLockedForClass && (
            <button
              type="button"
              onClick={() => handleToggleReachedOut(item, true)}
              className="py-1.5 px-3 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-950 transition cursor-pointer shadow-xs"
              title="Secretary override: complete this reminder for assigned staff"
            >
              Secretary Override
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-purple-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/30">
                Pillar Four · Reminder Assignment Pillar
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                Targeting Upcoming Week {upcomingWeekNumber}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Users className="w-7 h-7 text-purple-400" />
              Follow-Up Assignments & Reminders
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/80 mt-1 max-w-2xl font-medium">
              Weekly reminder is distributed across staff to reach all class members before Sunday. Staff logs whether the student confirmed early arrival, will attend, or cannot make it.
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
        label="Assignments & reminders week"
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
              In accordance with Sunday School regulations, class teachers and secretaries cannot alter or record follow-up ratings for closed past weeks. All responses and completion statuses are displayed in Read-Only mode. Only the Follow-Up Directorate Coordinator can review.
            </p>
          </div>
        </div>
      )}

      {/* Upcoming Lesson Target Banner */}
      <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm bg-gradient-to-r from-amber-50/70 to-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full">
                Target: Upcoming Sunday Lesson (Week {upcomingWeekNumber})
              </span>
              <span className="text-xs font-bold text-slate-500">Service: 8:00 a.m. Prompt</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              📌 Topic: "{upcomingLesson.topic}"
            </h3>
            <p className="text-xs text-slate-700 font-medium">
              💎 <strong>Memory Verse:</strong> "{upcomingLesson.memoryVerse}" ({upcomingLesson.memoryVerseRef || 'Scripture'})
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between shrink-0 min-w-[240px]">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Active Member Completion
            </span>
            <div className="text-xl font-black text-slate-900">
              {completedAssignments} of {totalAssignments} ({assignmentRate}%)
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${assignmentRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Student Response Summary Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Student Feedback & Response Breakdown (Week {upcomingWeekNumber} Prep):
          </span>
          <span className="text-[11px] font-bold text-slate-400">
            {completedAssignments} Responses Logged
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 text-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Early (8am)</span>
            <span className="text-lg font-black text-emerald-900 block">{responseCounters.early}</span>
          </div>

          <div className="bg-teal-50 rounded-xl p-2.5 border border-teal-200 text-center">
            <span className="text-[10px] font-bold text-teal-800 uppercase block">Will Attend</span>
            <span className="text-lg font-black text-teal-900 block">{responseCounters.attending}</span>
          </div>

          <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-200 text-center">
            <span className="text-[10px] font-bold text-rose-800 uppercase block">Cannot Make It</span>
            <span className="text-lg font-black text-rose-900 block">{responseCounters.cannotAttend}</span>
          </div>

          <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200 text-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Traveled</span>
            <span className="text-lg font-black text-amber-900 block">{responseCounters.traveled}</span>
          </div>

          <div className="bg-purple-50 rounded-xl p-2.5 border border-purple-200 text-center">
            <span className="text-[10px] font-bold text-purple-800 uppercase block">Needs Prayer</span>
            <span className="text-lg font-black text-purple-900 block">{responseCounters.sickPrayer}</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-center">
            <span className="text-[10px] font-bold text-slate-700 uppercase block">No Response Yet</span>
            <span className="text-lg font-black text-slate-800 block">{responseCounters.noResponse}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Staff Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold text-slate-600">Staff:</span>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 outline-none cursor-pointer focus:ring-2 focus:ring-purple-400"
            >
              <option value="ALL">All Staff ({staffList.length})</option>
              {staffList.map(staff => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalAssignments})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'PENDING' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({totalAssignments - completedAssignments})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('REACHED_OUT')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'REACHED_OUT' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Done ({completedAssignments})
            </button>
          </div>

          {/* Student Response Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-600">Response:</span>
            <select
              value={responseFilter}
              onChange={e => setResponseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 outline-none cursor-pointer focus:ring-2 focus:ring-purple-400"
            >
              <option value="ALL">All Responses</option>
              <option value="ATTENDING_EARLY">Attending Early (8am)</option>
              <option value="ATTENDING">Will Attend</option>
              <option value="CANNOT_ATTEND">Cannot Make It</option>
              <option value="TRAVELED">Traveled / Away</option>
              <option value="SICK_NEED_PRAYER">Needs Prayer</option>
              <option value="NO_RESPONSE">No Response</option>
              <option value="UNRECORDED">Unrecorded</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search member..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      </div>

      {/* Main Section: Active Class Register Members */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span>Active Class Register Members</span>
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
              {filteredActiveAssignments.length} Members
            </span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Staff performs reminder outreach · Response tracking enabled
          </span>
        </div>

        {filteredActiveAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveAssignments.map(item => renderCard(item))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            No active members matching filter criteria.
          </div>
        )}
      </div>

      {/* Excluded Members Section */}
      <div className="space-y-4 pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="text-base font-black text-slate-900">
                Excluded Students & Inactive Members ({filteredExcludedAssignments.length})
              </h3>
              <p className="text-xs text-slate-500">
                Temporary exclusions and archived members. Reminders can still be dispatched to encourage return to Sunday School.
              </p>
            </div>
          </div>
          <span className="text-xs bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1 rounded-xl font-bold">
            Excluded Roster
          </span>
        </div>

        {filteredExcludedAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExcludedAssignments.map(item => renderCard(item))}
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
            No excluded students found for this class.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: RECORD STUDENT RESPONSE                                           */}
      {/* ========================================================================= */}
      {recordingResponseItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-200 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Record Student Feedback
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {recordingResponseItem.member.fullName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record member's response for upcoming Week {upcomingWeekNumber} lesson.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordingResponseItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentResponse} className="space-y-4 text-xs">
              <div>
                <label className="font-black text-slate-700 block mb-2">
                  What did the student respond?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'ATTENDING_EARLY', label: 'Attending Early (8am)', color: 'border-emerald-500 bg-emerald-50 text-emerald-950' },
                    { id: 'ATTENDING', label: 'Will Attend', color: 'border-teal-500 bg-teal-50 text-teal-950' },
                    { id: 'CANNOT_ATTEND', label: 'Cannot Make It', color: 'border-rose-500 bg-rose-50 text-rose-950' },
                    { id: 'TRAVELED', label: 'Traveled / Away', color: 'border-amber-500 bg-amber-50 text-amber-950' },
                    { id: 'SICK_NEED_PRAYER', label: 'Needs Prayer / Sick', color: 'border-purple-500 bg-purple-50 text-purple-950' },
                    { id: 'NO_RESPONSE', label: 'No Response Yet', color: 'border-slate-400 bg-slate-100 text-slate-800' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedStudentResponse(opt.id as StudentReminderResponse)}
                      className={`p-3 rounded-xl border text-left font-black transition cursor-pointer ${
                        selectedStudentResponse === opt.id
                          ? `${opt.color} ring-2 ring-indigo-500/30 shadow-xs`
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-black text-slate-700 block mb-1">
                  Optional Feedback Notes:
                </label>
                <textarea
                  rows={2}
                  value={studentResponseNote}
                  onChange={e => setStudentResponseNote(e.target.value)}
                  placeholder="e.g. Traveled for family event, promises to join next Sunday..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecordingResponseItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Response</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
