import React, { useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  HeartHandshake,
  MessageCircle,
  PhoneCall,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Plus,
  ShieldAlert,
  HelpCircle,
  UserX,
  ArrowRightLeft,
  FileText,
  Calendar,
  Filter,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  AbsenceReasonCategory,
  EscalationDecision,
  ClassProfile,
  FollowUpTask,
  FollowUpActionType,
  FollowUpStatus,
  LessonInfo,
  ExitReviewOutcome
} from '../types';
import { getConsecutiveAbsences, getAbsenceUrgency } from '../utils/calculations';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';

interface WelfareFollowUpViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  activeLessons?: LessonInfo[];
  selectedQuarterNumber?: number;
  onSaveAbsenceLog: (log: AbsenceLogRecord) => Promise<void>;
  onCompleteExitReview: (memberId: string, outcome: ExitReviewOutcome, reason: string) => Promise<void>;
  onRelegateToVisitor: (memberId: string) => void;
  onRestoreToStudent?: (memberId: string) => void;
}

const EXIT_REASONS = [
  'Travel / Out of town',
  'Relocation to new area',
  'Moved abroad / Overseas',
  'Transferred to another assembly',
  'Work / School / Exam schedule',
  'Illness / Medical recovery',
  'No longer attending / Backslid',
  'Other / Special circumstances'
];

export const WelfareFollowUpView: React.FC<WelfareFollowUpViewProps> = ({
  members,
  grades,
  absenceLogs,
  currentWeek,
  classProfile,
  activeLessons = GOFAMINT_HOF_12_LESSONS,
  selectedQuarterNumber = 1,
  onSaveAbsenceLog,
  onCompleteExitReview,
  onRelegateToVisitor,
  onRestoreToStudent
}) => {
  useScrollRestoration('welfare_follow_up');
  const [activeTab, setActiveTab] = usePersistedState<'PENDING' | 'EXECUTED'>('gofamint_welfare_tab', 'PENDING');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = usePersistedState<'ALL' | '1_WEEK' | '2_WEEKS' | '3_WEEKS' | '4_PLUS_WEEKS' | '6_WEEK_EXIT_REVIEW'>('gofamint_welfare_urgency', 'ALL');
  
  // Execution Modal State
  const [actioningMember, setActioningMember] = useState<{ member: Member; weeksAbsent: number; actionType: FollowUpActionType } | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>(EXIT_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState('');
  const [exitDecision, setExitDecision] = useState<ExitReviewOutcome>('CONTINUE_MONITORING');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Derive absent members and follow-up status
  const currentLesson = activeLessons.find(l => l.weekNumber === currentWeek) || activeLessons[0] || GOFAMINT_HOF_12_LESSONS[0];

  const absenteesList = members
    .filter(m => m.status !== 'LEFT_CLASS')
    .map(member => {
      const weeksAbsent = getConsecutiveAbsences(member.id, currentWeek, grades, member.firstLessonWeek || 1);
      const urgency = getAbsenceUrgency(weeksAbsent);
      const memberLogs = absenceLogs.filter(l => l.memberId === member.id);
      const latestLog = memberLogs.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())[0];

      // Check if this week's follow-up was executed
      const isExecutedThisCycle = memberLogs.some(
        l => l.weekNumber === currentWeek || (l.consecutiveWeeksAbsent === weeksAbsent && new Date(l.loggedAt).getTime() > Date.now() - 6 * 24 * 60 * 60 * 1000)
      );

      // Determine follow up action
      let actionType: FollowUpActionType = 'WHATSAPP';
      let actionLabel = 'WhatsApp Message (Check-in)';
      if (weeksAbsent === 2 || weeksAbsent === 5) {
        actionType = 'PHONE_CALL';
        actionLabel = 'Phone Call Check-in (Log Required)';
      } else if (weeksAbsent === 3) {
        actionType = 'PASTORAL_VISITATION';
        actionLabel = 'Pastoral Visitation / Care Team';
      } else if (weeksAbsent === 4) {
        actionType = 'WHATSAPP';
        actionLabel = 'WhatsApp Care Message';
      } else if (weeksAbsent >= 6) {
        actionType = 'PROLONGED_EXIT_REVIEW';
        actionLabel = '6-Week Exemption / Exit Review Required';
      }

      return {
        member,
        weeksAbsent,
        urgency,
        latestLog,
        totalLogs: memberLogs.length,
        isExecutedThisCycle,
        actionType,
        actionLabel
      };
    })
    .filter(item => item.weeksAbsent > 0)
    .sort((a, b) => b.weeksAbsent - a.weeksAbsent);

  const pendingAbsentees = absenteesList.filter(item => !item.isExecutedThisCycle);
  const executedLogs = absenceLogs.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  // Filtered pending list
  const filteredPending = pendingAbsentees.filter(item => {
    if (selectedUrgencyFilter === '1_WEEK') return item.weeksAbsent === 1;
    if (selectedUrgencyFilter === '2_WEEKS') return item.weeksAbsent === 2;
    if (selectedUrgencyFilter === '3_WEEKS') return item.weeksAbsent === 3;
    if (selectedUrgencyFilter === '4_PLUS_WEEKS') return item.weeksAbsent >= 4 && item.weeksAbsent < 6;
    if (selectedUrgencyFilter === '6_WEEK_EXIT_REVIEW') return item.weeksAbsent >= 6;
    return true;
  });

  const handleOpenActionModal = (member: Member, weeksAbsent: number, actionType: FollowUpActionType) => {
    setActioningMember({ member, weeksAbsent, actionType });
    setCallNotes('');
    setSelectedReason(EXIT_REASONS[0]);
    setCustomReasonText('');
    setExitDecision('CONTINUE_MONITORING');
    setActionError(null);
  };

  const handleCompleteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actioningMember) return;

    const { member, weeksAbsent, actionType } = actioningMember;
    const finalReason = selectedReason === 'Other / Special circumstances' ? (customReasonText.trim() || 'Other') : selectedReason;

    let contactMethod: 'WHATSAPP' | 'PHONE_CALL' | 'PASTORAL_VISIT' | 'IN_PERSON' = 'WHATSAPP';
    if (actionType === 'PHONE_CALL') contactMethod = 'PHONE_CALL';
    else if (actionType === 'PASTORAL_VISITATION') contactMethod = 'PASTORAL_VISIT';
    else if (actionType === 'PROLONGED_EXIT_REVIEW') contactMethod = 'IN_PERSON';

    const newLog: AbsenceLogRecord = {
      id: `welfare_log_${member.id}_w${currentWeek}_${Date.now()}`,
      memberId: member.id,
      classId: classProfile?.id,
      quarterNumber: selectedQuarterNumber,
      weekNumber: currentWeek,
      consecutiveWeeksAbsent: weeksAbsent,
      urgencyLevel: weeksAbsent >= 6 ? 'CRITICAL' : weeksAbsent >= 3 ? 'RED' : weeksAbsent === 2 ? 'ORANGE' : 'YELLOW',
      contactMethod,
      reasonCategory: 'OTHER',
      exitNote: `${finalReason}. ${callNotes.trim()}`,
      notes: callNotes.trim() || `Follow-up executed (${actionType}): ${finalReason}`,
      decisionMade: true,
      decisionDate: new Date().toISOString(),
      loggedAt: new Date().toISOString()
    };

    setIsSavingAction(true);
    setActionError(null);
    try {
      await onSaveAbsenceLog(newLog);
      if (weeksAbsent >= 6) {
        await onCompleteExitReview(member.id, exitDecision, finalReason);
        const label = exitDecision === 'PERMANENT_EXIT'
          ? 'permanently exited and moved to departed members'
          : exitDecision === 'TEMPORARY_EXIT'
          ? 'placed on temporary exit while remaining associated with the class'
          : 'kept active for continued monitoring';
        setFeedback(`${member.fullName} ${label}.`);
      } else {
        setFeedback(`Follow-up action recorded for ${member.fullName}. Moved to Executed list.`);
      }
      setTimeout(() => setFeedback(null), 3500);
      setActioningMember(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionError(`Could not save this welfare action: ${message}`);
    } finally {
      setIsSavingAction(false);
    }
  };

  const generateWhatsAppMessage = (member: Member) => {
    const studentName = member.fullName;
    const className = classProfile?.className || 'our Sunday School class';
    const secretaryName = classProfile?.secretaryName || 'the class secretary';
    const text = `We miss you dearly at our Sunday School (${className}). We'd love to know why you were not around today, why you came late for Sunday School, or why you could not make it to church. Are there any issues you're facing? We'd like to know and also pray with you. Regards from ${secretaryName} and the teachers of the class.`;
    return encodeURIComponent(text);
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in max-w-7xl mx-auto">
      
      {/* Top Banner */}
      <section aria-labelledby="welfare-heading" className="bg-gradient-to-br from-[#201005] via-[#6d2f0b] to-[#171b3d] border border-amber-600/40 rounded-2xl p-4 sm:p-6 shadow-xl shadow-amber-950/10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-950 bg-amber-400 px-2.5 py-1 rounded-lg">
              Care
            </span>
            <span className="text-[10px] font-black text-amber-100 bg-white/10 border border-white/15 px-2 py-1 rounded-lg">
              Week {currentWeek}
            </span>
          </div>
          <h2 id="welfare-heading" className="text-xl sm:text-3xl font-black text-white mt-2 tracking-tight">
            Welfare & follow-up
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/80 mt-1 max-w-xl">
            See who needs care, take action and keep a clear follow-up history.
          </p>
        </div>

        {/* Urgency Counter Badges */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full lg:w-auto">
          <div className="bg-white/10 border border-white/15 px-2 sm:px-3 py-2 rounded-xl text-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-100 block">Message</span>
            <span className="text-base font-black text-white">
              {absenteesList.filter(i => i.weeksAbsent === 1).length}
            </span>
          </div>
          <div className="bg-white/10 border border-white/15 px-2 sm:px-3 py-2 rounded-xl text-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-orange-100 block">Call</span>
            <span className="text-base font-black text-white">
              {absenteesList.filter(i => i.weeksAbsent === 2).length}
            </span>
          </div>
          <div className="bg-white/10 border border-white/15 px-2 sm:px-3 py-2 rounded-xl text-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-100 block">Visit</span>
            <span className="text-base font-black text-white">
              {absenteesList.filter(i => i.weeksAbsent === 3).length}
            </span>
          </div>
          <div className="bg-red-500/20 border border-red-300/30 px-2 sm:px-3 py-2 rounded-xl text-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-red-100 block">Review</span>
            <span className="text-base font-black text-white">
              {absenteesList.filter(i => i.weeksAbsent >= 6).length}
            </span>
          </div>
        </div>
      </section>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Tabs: Pending Follow-Ups vs Executed Archive */}
      <div className="grid grid-cols-2 gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'PENDING'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Pending ({pendingAbsentees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('EXECUTED')}
          className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'EXECUTED'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Completed ({executedLogs.length})</span>
        </button>
      </div>

      {activeTab === 'PENDING' ? (
        <div className="space-y-4">
          
          {/* Sub Filter */}
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedUrgencyFilter('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === 'ALL' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({pendingAbsentees.length})
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('1_WEEK')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '1_WEEK' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              1 week · Message
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('2_WEEKS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '2_WEEKS' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              2 weeks · Call
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('3_WEEKS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '3_WEEKS' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              3 weeks · Visit
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('4_PLUS_WEEKS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '4_PLUS_WEEKS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              4–5 weeks · Care
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('6_WEEK_EXIT_REVIEW')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '6_WEEK_EXIT_REVIEW' ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              6+ weeks · Review
            </button>
          </div>

          {/* Cards List */}
          {filteredPending.length === 0 ? (
            <div className="bg-white border border-slate-200 p-12 rounded-lg text-center text-slate-500 shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h4 className="text-base font-bold text-slate-900">All Welfare Follow-Ups Completed!</h4>
              <p className="text-xs text-slate-500 mt-1">
                There are no pending actions in this category for Lesson {currentWeek}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPending.map(({ member, weeksAbsent, urgency, latestLog, actionType, actionLabel }) => {
                const waEncoded = generateWhatsAppMessage(member);
                const isRedAlert = weeksAbsent >= 6;
                const isVisitation = weeksAbsent === 3;

                return (
                  <div
                    key={member.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition ${
                      isRedAlert
                        ? 'border-red-400 border-l-4 border-l-red-600 bg-red-50/20'
                        : isVisitation
                        ? 'border-indigo-300 border-l-4 border-l-indigo-600'
                        : weeksAbsent === 2
                        ? 'border-orange-300 border-l-4 border-l-orange-500'
                        : 'border-slate-200 border-l-4 border-l-amber-500'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* Member Details */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-700 shrink-0">
                          {member.photoBase64 ? (
                            <img src={member.photoBase64} alt={member.fullName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            member.fullName.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-base">{member.fullName}</h4>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              member.memberType === 'STUDENT' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {member.memberType}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isRedAlert
                                ? 'bg-red-600 text-white animate-pulse'
                                : isVisitation
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}>
                              {weeksAbsent} {weeksAbsent === 1 ? 'Week' : 'Weeks'} Absent
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                            {member.phone ? (
                              <span className="font-mono text-slate-800 font-bold">📞 {member.phone}</span>
                            ) : (
                              <span className="text-slate-400 italic">No phone number</span>
                            )}
                            <span>•</span>
                            <span>First joined: Lesson {member.firstLessonWeek || 1}</span>
                            <span>•</span>
                            <span className="text-slate-600">Pending Action: <strong className="text-slate-900">{actionLabel}</strong></span>
                          </div>

                          {/* Relegation Prompt if Student is absent for 4+ consecutive weeks */}
                          {member.memberType === 'STUDENT' && weeksAbsent >= 4 && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex items-center justify-between gap-2">
                              <span>⚠️ Student has missed {weeksAbsent} consecutive lessons. Recommended to reclassify as Visitor.</span>
                              <button
                                onClick={() => onRelegateToVisitor(member.id)}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shrink-0"
                              >
                                Relegate to Visitor
                              </button>
                            </div>
                          )}

                          {/* 6-Week Exit Review Red Banner */}
                          {isRedAlert && (
                            <div className="mt-2 p-2.5 bg-red-100 border border-red-400 rounded text-xs text-red-900 font-bold flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
                              <span>PROLONGED 6-WEEK ABSENCE: Exit Review required — Continue Monitoring, Temporary Exit, or Permanent Exit.</span>
                            </div>
                          )}

                        </div>
                      </div>

                      {/* Quick Communication & Action Buttons (Phase 6) */}
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto lg:self-center">
                        {member.phone && (
                          <>
                            <a
                              href={`tel:${normalizePhoneNumber(member.phone)}`}
                              className="min-h-[42px] px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                              title="Direct Phone Call"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </a>

                            <a
                              href={`https://wa.me/${normalizePhoneNumber(member.phone).replace(/[^0-9]/g, '')}?text=${generateWhatsAppMessage(member)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[42px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                              title="Personalized WhatsApp message"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        )}

                        <button
                          onClick={() => handleOpenActionModal(member, weeksAbsent, actionType)}
                          className={`col-span-2 sm:col-span-1 min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                            isRedAlert
                              ? 'bg-red-700 hover:bg-red-800 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 text-amber-300" />
                          <span>{isRedAlert ? 'Perform Exit Review' : 'Mark Activity Done'}</span>
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Executed Logs Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Historical Follow-Up Archive ({executedLogs.length} Executed Logs)
              </span>
              <span className="text-xs text-slate-500">
                Organized chronologically by execution date
              </span>
            </div>

            {executedLogs.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
                <p className="text-sm font-bold text-slate-600">No executed logs recorded yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  When you complete a follow-up action (WhatsApp, phone call, visitation, or exit review), it will appear here permanently.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Date Executed</th>
                      <th className="py-3 px-3">Member Name</th>
                      <th className="py-3 px-3">Lesson Week</th>
                      <th className="py-3 px-3">Consecutive Absent</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Outcome Notes / Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {executedLogs.map(log => {
                      const mem = members.find(m => m.id === log.memberId);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                            {new Date(log.loggedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {mem?.fullName || 'Registered Member'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-blue-900">
                            Lesson {log.weekNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.consecutiveWeeksAbsent >= 6
                                ? 'bg-red-100 text-red-800'
                                : log.consecutiveWeeksAbsent >= 3
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {log.consecutiveWeeksAbsent} Wks
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {log.contactMethod}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-md">
                            {log.exitNote || log.notes}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Action / Review Modal */}
      {actioningMember && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              Log Welfare Follow-up Action
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Recording follow-up for <strong>{actioningMember.member.fullName}</strong> ({actioningMember.weeksAbsent} consecutive weeks absent).
            </p>

            <form onSubmit={handleCompleteAction} className="space-y-4">
              
              {/* Reason Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Absence / Follow-up Finding:
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {EXIT_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {selectedReason === 'Other / Special circumstances' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Specific Circumstance (Describe):
                  </label>
                  <input
                    type="text"
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    placeholder="Enter details..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900"
                    required
                  />
                </div>
              )}

              {/* Membership status changes only at the six-week exit review. */}
              {actioningMember.weeksAbsent >= 6 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Membership Status Decision:
                  </label>
                  <select
                    value={exitDecision}
                    onChange={(e) => setExitDecision(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="CONTINUE_MONITORING">Continue to Monitor (Keep active)</option>
                    <option value="TEMPORARY_EXIT">Temporary Exit (Keep class association and attendance history)</option>
                    <option value="PERMANENT_EXIT">Permanent Exit (Move to Departed Members)</option>
                  </select>
                </div>
              )}

              {actionError && (
                <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                  {actionError}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pastor / Teacher Care Notes:
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Record outcome of conversation, prayer points, or expected return date..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 resize-none focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActioningMember(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAction}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isSavingAction ? 'Saving…' : 'Save Log & Move to Executed'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
