import React, { useState } from 'react';
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
  LessonInfo
} from '../types';
import { getConsecutiveAbsences, getAbsenceUrgency } from '../utils/calculations';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';

interface WelfareFollowUpViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  activeLessons?: LessonInfo[];
  selectedQuarterNumber?: number;
  onSaveAbsenceLog: (log: AbsenceLogRecord) => void;
  onUpdateMemberStatus: (memberId: string, status: any, exitNote?: string) => void;
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
  onUpdateMemberStatus,
  onRelegateToVisitor,
  onRestoreToStudent
}) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'EXECUTED'>('PENDING');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<'ALL' | '1_WEEK' | '2_WEEKS' | '3_WEEKS' | '4_PLUS_WEEKS' | '6_WEEK_EXIT_REVIEW'>('ALL');
  
  // Execution Modal State
  const [actioningMember, setActioningMember] = useState<{ member: Member; weeksAbsent: number; actionType: FollowUpActionType } | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>(EXIT_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState('');
  const [exitDecision, setExitDecision] = useState<'CONTINUE_MONITORING' | 'EXEMPT' | 'LEFT_CLASS' | 'RELEGATED_VISITOR'>('CONTINUE_MONITORING');
  const [feedback, setFeedback] = useState<string | null>(null);

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
    setExitDecision(weeksAbsent >= 6 ? 'EXEMPT' : weeksAbsent >= 4 && member.memberType === 'STUDENT' ? 'RELEGATED_VISITOR' : 'CONTINUE_MONITORING');
  };

  const handleCompleteAction = (e: React.FormEvent) => {
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

    onSaveAbsenceLog(newLog);

    // Apply decision if specified
    if (exitDecision === 'LEFT_CLASS') {
      onUpdateMemberStatus(member.id, 'LEFT_CLASS', finalReason);
      setFeedback(`${member.fullName} marked as Left Class.`);
    } else if (exitDecision === 'RELEGATED_VISITOR') {
      onRelegateToVisitor(member.id);
      setFeedback(`${member.fullName} relegated to Visitor due to extended absence.`);
    } else if (exitDecision === 'EXEMPT') {
      onUpdateMemberStatus(member.id, 'EXEMPT', finalReason);
      setFeedback(`${member.fullName} granted temporary exemption.`);
    } else {
      setFeedback(`Follow-up action recorded for ${member.fullName}. Moved to Executed list.`);
    }

    setTimeout(() => setFeedback(null), 3500);
    setActioningMember(null);
  };

  const generateWhatsAppMessage = (member: Member) => {
    const text = `Calvary greetings ${member.fullName}! 🙏\n\nWe missed your warm presence in our GOFAMINT_HOF Sunday School class today (Lesson ${currentWeek}: "${currentLesson.topic}").\n\nMemory Verse: "${currentLesson.memoryVerse || ''}" (${currentLesson.memoryVerseRef || ''}).\n\nWe are upholding you in prayer. Please let us know if there is anything we can pray with you about.\n\n— ${classProfile?.secretaryName || 'Sunday School Secretary'}, GOFAMINT_HOF ${classProfile?.className || ''}`;
    return encodeURIComponent(text);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              WELFARE & SYSTEMATIC FOLLOW-UP CENTER
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
            Care Workflow, Follow-up Logs & 6-Week Exemption Reviews
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Systematic pastoral pipeline (Wk 1: WhatsApp → Wk 2: Phone Call → Wk 3: Pastoral Visit → Wk 4: Relegate / WhatsApp → Wk 6: Exit Review).
          </p>
        </div>

        {/* Urgency Counter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">1 Wk (WhatsApp)</span>
            <span className="text-sm font-black text-amber-900">
              {absenteesList.filter(i => i.weeksAbsent === 1).length}
            </span>
          </div>
          <div className="bg-orange-50 border border-orange-300 px-3 py-1.5 rounded-lg text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-orange-800 block">2 Wks (Phone Call)</span>
            <span className="text-sm font-black text-orange-900">
              {absenteesList.filter(i => i.weeksAbsent === 2).length}
            </span>
          </div>
          <div className="bg-indigo-50 border border-indigo-300 px-3 py-1.5 rounded-lg text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-indigo-800 block">3 Wks (Visitation)</span>
            <span className="text-sm font-black text-indigo-900">
              {absenteesList.filter(i => i.weeksAbsent === 3).length}
            </span>
          </div>
          <div className="bg-red-50 border border-red-300 px-3 py-1.5 rounded-lg text-center shadow-xs animate-pulse">
            <span className="text-[10px] uppercase font-bold text-red-800 block">6+ Wks (Exit Review)</span>
            <span className="text-sm font-black text-red-900">
              {absenteesList.filter(i => i.weeksAbsent >= 6).length}
            </span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Tabs: Pending Follow-Ups vs Executed Archive */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition flex items-center gap-2 ${
            activeTab === 'PENDING'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Pending Follow-Ups ({pendingAbsentees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('EXECUTED')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition flex items-center gap-2 ${
            activeTab === 'EXECUTED'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Executed Follow-Up Archive ({executedLogs.length})</span>
        </button>
      </div>

      {activeTab === 'PENDING' ? (
        <div className="space-y-4">
          
          {/* Sub Filter */}
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
            <button
              onClick={() => setSelectedUrgencyFilter('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === 'ALL' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Pending ({pendingAbsentees.length})
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('1_WEEK')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '1_WEEK' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Week 1: WhatsApp
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('2_WEEKS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '2_WEEKS' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Week 2: Phone Call
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('3_WEEKS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '3_WEEKS' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Week 3: Pastoral Visit
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('4_PLUS_WEEKS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '4_PLUS_WEEKS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Weeks 4-5: Relegate / Care
            </button>
            <button
              onClick={() => setSelectedUrgencyFilter('6_WEEK_EXIT_REVIEW')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                selectedUrgencyFilter === '6_WEEK_EXIT_REVIEW' ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              6+ Weeks: RED EXIT REVIEW
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
                    className={`bg-white border rounded-lg p-5 shadow-xs transition ${
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
                              <span>PROLONGED 6-WEEK ABSENCE: Mandatory Exemption or Exit Review required for class data integrity.</span>
                            </div>
                          )}

                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                        {member.phone && (
                          <a
                            href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}?text=${waEncoded}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleOpenActionModal(member, weeksAbsent, actionType)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
                            isRedAlert
                              ? 'bg-red-700 hover:bg-red-800 text-white'
                              : 'bg-blue-900 hover:bg-blue-800 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 text-amber-300" />
                          <span>{isRedAlert ? 'Perform Exit Review' : 'Mark Done & Log'}</span>
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

              {/* Status Decision (especially for 4+ and 6+ weeks) */}
              {(actioningMember.weeksAbsent >= 4 || actioningMember.actionType === 'PROLONGED_EXIT_REVIEW') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Membership Status Decision:
                  </label>
                  <select
                    value={exitDecision}
                    onChange={(e) => setExitDecision(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="CONTINUE_MONITORING">Continue Monitoring (Keep on active roster)</option>
                    <option value="EXEMPT">Mark as Temporarily Exempt (Illness/Exam/Short Travel)</option>
                    {actioningMember.member.memberType === 'STUDENT' && (
                      <option value="RELEGATED_VISITOR">Relegate to Visitor Status (Due to extended absence)</option>
                    )}
                    <option value="LEFT_CLASS">Mark as Exited / Left Class (Relocated/Transferred/Left)</option>
                  </select>
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
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save Log & Move to Executed</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
