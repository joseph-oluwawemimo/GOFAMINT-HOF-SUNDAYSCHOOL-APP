import React, { useState } from 'react';
import {
  AlertTriangle,
  PhoneCall,
  MessageCircle,
  ShieldAlert,
  Clock,
  UserX,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  UserCheck,
  Send,
  Plus,
  HelpCircle
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  AbsenceReasonCategory,
  EscalationDecision,
  ClassProfile
} from '../types';
import { getConsecutiveAbsences, getAbsenceUrgency } from '../utils/calculations';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';

interface AbsenceCareViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  onSaveAbsenceLog: (log: AbsenceLogRecord) => void;
  onUpdateMemberStatus: (memberId: string, status: any, exitNote?: string) => void;
  onRelegateToVisitor: (memberId: string) => void;
  onOpenAICompose: (member: Member, weeksAbsent: number) => void;
}

const REASON_CATEGORIES: Array<{ id: AbsenceReasonCategory; label: string }> = [
  { id: 'ILLNESS', label: 'Illness / Health Recovery' },
  { id: 'TRAVEL', label: 'Travel / Out of Town' },
  { id: 'WORK_SCHOOL', label: 'Work / Shift / Exam Schedule' },
  { id: 'FAMILY_EMERGENCY', label: 'Family Emergency / Bereavement' },
  { id: 'PERSONAL', label: 'Personal / Domestic Challenge' },
  { id: 'RELOCATION', label: 'Relocated to New Area' },
  { id: 'OTHER', label: 'Other Special Circumstance' }
];

export const AbsenceCareView: React.FC<AbsenceCareViewProps> = ({
  members,
  grades,
  absenceLogs,
  currentWeek,
  classProfile,
  onSaveAbsenceLog,
  onUpdateMemberStatus,
  onRelegateToVisitor,
  onOpenAICompose
}) => {
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<'ALL' | '1_WEEK' | '2_WEEKS' | '3_PLUS_WEEKS'>('ALL');
  
  // Call Log Modal State
  const [loggingMember, setLoggingMember] = useState<{ member: Member; weeksAbsent: number } | null>(null);
  const [contactMethod, setContactMethod] = useState<'WHATSAPP' | 'PHONE_CALL' | 'PASTORAL_VISIT' | 'IN_PERSON'>('PHONE_CALL');
  const [reasonCategory, setReasonCategory] = useState<AbsenceReasonCategory>('ILLNESS');
  const [escalationDecision, setEscalationDecision] = useState<EscalationDecision>('HIGH_PROBABILITY');
  const [exitNote, setExitNote] = useState('');
  const [notes, setNotes] = useState('');

  // Identify all absent members in the active quarter
  const absentMembersWithStats = members
    .filter(m => m.status !== 'LEFT_CLASS')
    .map(member => {
      const weeksAbsent = getConsecutiveAbsences(member.id, currentWeek, grades, member.firstLessonWeek || 1);
      const urgency = getAbsenceUrgency(weeksAbsent);
      const memberLogs = absenceLogs.filter(l => l.memberId === member.id);
      const latestLog = memberLogs.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())[0];

      return {
        member,
        weeksAbsent,
        urgency,
        latestLog,
        totalLogs: memberLogs.length
      };
    })
    .filter(item => item.weeksAbsent > 0)
    .sort((a, b) => b.weeksAbsent - a.weeksAbsent);

  const filteredAbsentees = absentMembersWithStats.filter(item => {
    if (selectedUrgencyFilter === '1_WEEK') return item.weeksAbsent === 1;
    if (selectedUrgencyFilter === '2_WEEKS') return item.weeksAbsent === 2;
    if (selectedUrgencyFilter === '3_PLUS_WEEKS') return item.weeksAbsent >= 3;
    return true;
  });

  const handleOpenLogModal = (member: Member, weeksAbsent: number) => {
    setLoggingMember({ member, weeksAbsent });
    setContactMethod(weeksAbsent >= 2 ? 'PHONE_CALL' : 'WHATSAPP');
    setReasonCategory('ILLNESS');
    setEscalationDecision('HIGH_PROBABILITY');
    setExitNote('');
    setNotes('');
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingMember) return;

    const newLog: AbsenceLogRecord = {
      id: `log_${loggingMember.member.id}_w${currentWeek}_${Date.now()}`,
      memberId: loggingMember.member.id,
      weekNumber: currentWeek,
      consecutiveWeeksAbsent: loggingMember.weeksAbsent,
      urgencyLevel: loggingMember.weeksAbsent >= 3 ? 'RED' : loggingMember.weeksAbsent === 2 ? 'ORANGE' : 'YELLOW',
      contactMethod,
      reasonCategory,
      escalationDecision: loggingMember.weeksAbsent >= 3 ? escalationDecision : undefined,
      exitNote: exitNote.trim() || undefined,
      notes: notes.trim(),
      loggedAt: new Date().toISOString()
    };

    onSaveAbsenceLog(newLog);

    // Apply escalation decision if 3+ weeks
    if (loggingMember.weeksAbsent >= 3) {
      if (escalationDecision === 'LEFT_CLASS') {
        onUpdateMemberStatus(loggingMember.member.id, 'LEFT_CLASS', exitNote);
      } else if (escalationDecision === 'RELEGATED_VISITOR') {
        onRelegateToVisitor(loggingMember.member.id);
      } else if (escalationDecision === 'HIGH_PROBABILITY') {
        onUpdateMemberStatus(loggingMember.member.id, 'HIGH_PROBABILITY');
      }
    }

    setLoggingMember(null);
  };

  const currentLesson = GOFAMINT_HOF_12_LESSONS.find(l => l.weekNumber === currentWeek) || GOFAMINT_HOF_12_LESSONS[0];

  const generateWhatsAppMessage = (member: Member, weeksAbsent: number) => {
    const text = `Calvary greetings ${member.fullName}! 🙏\n\nWe missed your warm presence in our GOFAMINT_HOF Sunday School class today for Lesson ${currentWeek} ("${currentLesson.topic}").\n\nMemory Verse: "${currentLesson.memoryVerse}" (${currentLesson.memoryVerseRef}).\n\nWe are praying with you concerning: "${member.prayerRequests || 'God\'s peace and blessings'}".\n\nPlease let us know if there is anything we can uphold in prayer for you. Look forward to seeing you next Sunday!\n\n— ${classProfile?.secretaryName || 'Sunday School Secretary'}, GOFAMINT_HOF ${classProfile?.className || ''}`;
    return encodeURIComponent(text);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              PASTORAL CARE & ABSENCE ESCALATION
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
            Automated Absence Urgency & Follow-up Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Color-coded escalation workflows (Yellow: WhatsApp, Orange: Phone Call Log, Red: Pastoral Escalation Prompts).
          </p>
        </div>

        {/* Urgency Counter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">1 Week (Yellow)</span>
            <span className="text-sm font-black text-amber-900">
              {absentMembersWithStats.filter(i => i.weeksAbsent === 1).length}
            </span>
          </div>
          <div className="bg-orange-50 border border-orange-300 px-3 py-1.5 rounded-lg text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-orange-800 block">2 Weeks (Orange)</span>
            <span className="text-sm font-black text-orange-900">
              {absentMembersWithStats.filter(i => i.weeksAbsent === 2).length}
            </span>
          </div>
          <div className="bg-red-50 border border-red-300 px-3 py-1.5 rounded-lg text-center shadow-xs animate-pulse">
            <span className="text-[10px] uppercase font-bold text-red-800 block">3+ Wks (Red Alert)</span>
            <span className="text-sm font-black text-red-900">
              {absentMembersWithStats.filter(i => i.weeksAbsent >= 3).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
        <button
          onClick={() => setSelectedUrgencyFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            selectedUrgencyFilter === 'ALL' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Absentees ({absentMembersWithStats.length})
        </button>
        <button
          onClick={() => setSelectedUrgencyFilter('1_WEEK')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            selectedUrgencyFilter === '1_WEEK' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          1 Week Absent (Yellow Check-in)
        </button>
        <button
          onClick={() => setSelectedUrgencyFilter('2_WEEKS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            selectedUrgencyFilter === '2_WEEKS' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          2 Weeks Absent (Orange Call Log)
        </button>
        <button
          onClick={() => setSelectedUrgencyFilter('3_PLUS_WEEKS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            selectedUrgencyFilter === '3_PLUS_WEEKS' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          3+ Weeks Absent (Red Pastoral Alerts)
        </button>
      </div>

      {/* Absentees List Cards */}
      <div className="space-y-3">
        {filteredAbsentees.length === 0 ? (
          <div className="bg-white border border-slate-200 p-12 rounded-lg text-center text-slate-500 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-base font-bold text-slate-900">Full Attendance Reached!</h4>
            <p className="text-xs text-slate-500 mt-1">
              No members are currently flagged in this absence urgency category.
            </p>
          </div>
        ) : (
          filteredAbsentees.map(({ member, weeksAbsent, urgency, latestLog, totalLogs }) => {
            const isEscalationRequired = weeksAbsent >= 3;
            const waEncoded = generateWhatsAppMessage(member, weeksAbsent);

            return (
              <div
                key={member.id}
                id={`absence-card-${member.id}`}
                className={`bg-white border rounded-lg p-5 shadow-xs transition ${
                  weeksAbsent >= 3
                    ? 'border-slate-200 border-l-4 border-l-red-500'
                    : weeksAbsent === 2
                    ? 'border-slate-200 border-l-4 border-l-orange-500'
                    : 'border-slate-200 border-l-4 border-l-amber-500'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Member Info & Badge */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      {member.photoBase64 ? (
                        <img src={member.photoBase64} alt={member.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-base font-black text-slate-700">{member.fullName.charAt(0)}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">{member.fullName}</h4>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          weeksAbsent >= 3
                            ? 'bg-red-100 text-red-800'
                            : weeksAbsent === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {urgency.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {member.occupation || 'Student'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        {member.phone && (
                          <span className="font-mono text-slate-800 font-bold">{member.phone}</span>
                        )}
                        <span>•</span>
                        <span>First joined: Lesson {member.firstLessonWeek}</span>
                        <span>•</span>
                        <span className="text-amber-700 font-bold">Consecutive Absent: {weeksAbsent} wks</span>
                      </div>

                      {/* Prayer Request Quote */}
                      {member.prayerRequests && (
                        <p className="text-xs text-blue-900 italic mt-1.5 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 max-w-xl">
                          Prayer request: "{member.prayerRequests}"
                        </p>
                      )}

                      {/* Latest Log Summary if exists */}
                      {latestLog && (
                        <div className="text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-200 flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-900">Latest Contact ({new Date(latestLog.loggedAt).toLocaleDateString()}): </span>
                            <span>{latestLog.contactMethod} — {latestLog.reasonCategory || 'General'} — "{latestLog.notes}"</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Urgency Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                    
                    {/* 1 Week: Soft WhatsApp Button */}
                    <a
                      href={`https://wa.me/${member.phone ? member.phone.replace(/[^0-9]/g, '') : ''}?text=${waEncoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>WhatsApp Template</span>
                    </a>

                    {/* AI Personalized Compose Button */}
                    <button
                      onClick={() => onOpenAICompose(member, weeksAbsent)}
                      className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                      title="Generate customized AI follow-up message"
                    >
                      <span>AI Script</span>
                    </button>

                    {/* Phone Call / Log Action */}
                    {member.phone && (
                      <a
                        href={`tel:${member.phone}`}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                        <span>Call</span>
                      </a>
                    )}

                    {/* Mandatory Log / Escalation Button */}
                    <button
                      id={`btn-log-absence-${member.id}`}
                      onClick={() => handleOpenLogModal(member, weeksAbsent)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
                        isEscalationRequired
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                          : 'bg-blue-900 hover:bg-blue-800 text-white shadow-xs'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isEscalationRequired ? 'Pastoral Escalation & Decision' : 'Log Phone Call'}</span>
                    </button>

                  </div>

                </div>

                {/* Week 3 / Week 4 Escalation Prompt Notice */}
                {isEscalationRequired && (
                  <div className="mt-3.5 pt-3 border-t border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-red-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 font-bold">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>
                        {weeksAbsent === 3
                          ? 'Week 3 Absence Prompt: Secretary must select: [Left Class (requires exit note)] | [Relegate to Visitor] | [High Probability to Return Next Week]'
                          : 'Week 4+ Extended Absence: Secretary must select: [Left Class] | [Relegate to Visitor]'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenLogModal(member, weeksAbsent)}
                      className="text-xs font-bold text-red-700 hover:underline shrink-0"
                    >
                      Resolve Status Decision →
                    </button>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* Mandatory Phone Call Log & Pastoral Escalation Modal */}
      {loggingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-2xl overflow-hidden my-8">
            
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  loggingMember.weeksAbsent >= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {loggingMember.weeksAbsent >= 3 ? 'Week 3+ Pastoral Escalation Decision' : 'Mandatory Phone Call Log'}
                  </h3>
                  <p className="text-xs text-slate-500">{loggingMember.member.fullName} ({loggingMember.weeksAbsent} weeks absent)</p>
                </div>
              </div>
              <button
                onClick={() => setLoggingMember(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="p-5 space-y-4">
              
              {/* Contact Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Method
                  </label>
                  <select
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="PHONE_CALL">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp Chat / Voice Note</option>
                    <option value="PASTORAL_VISIT">Pastoral Home / Hospital Visit</option>
                    <option value="IN_PERSON">In-Person Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Absence Reason Category
                  </label>
                  <select
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    {REASON_CATEGORIES.map(rc => (
                      <option key={rc.id} value={rc.id}>{rc.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Automated Status Escalation Prompts (Week 3 & Week 4) */}
              {loggingMember.weeksAbsent >= 3 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-2.5">
                  <label className="block text-xs font-bold text-red-900">
                    Automated Status Escalation Decision (Mandatory) <span className="text-red-600">*</span>
                  </label>
                  
                  <div className="space-y-2">
                    {loggingMember.weeksAbsent === 3 && (
                      <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-emerald-500">
                        <input
                          type="radio"
                          name="escalation_choice"
                          checked={escalationDecision === 'HIGH_PROBABILITY'}
                          onChange={() => setEscalationDecision('HIGH_PROBABILITY')}
                          className="text-emerald-600 focus:ring-0"
                        />
                        <div className="text-xs">
                          <strong className="text-slate-900 block">High Probability to Return Next Week</strong>
                          <span className="text-slate-500">Member confirmed imminent return with valid excuse.</span>
                        </div>
                      </label>
                    )}

                    <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-purple-500">
                      <input
                        type="radio"
                        name="escalation_choice"
                        checked={escalationDecision === 'RELEGATED_VISITOR'}
                        onChange={() => setEscalationDecision('RELEGATED_VISITOR')}
                        className="text-purple-600 focus:ring-0"
                      />
                      <div className="text-xs">
                        <strong className="text-slate-900 block">Relegate to Visitor</strong>
                        <span className="text-slate-500">Releases active student roster seat while tracking occasional visits.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-red-500">
                      <input
                        type="radio"
                        name="escalation_choice"
                        checked={escalationDecision === 'LEFT_CLASS'}
                        onChange={() => setEscalationDecision('LEFT_CLASS')}
                        className="text-red-600 focus:ring-0"
                      />
                      <div className="text-xs">
                        <strong className="text-slate-900 block">Left Class (Requires Exit Note)</strong>
                        <span className="text-slate-500">Relocated, transferred assembly, or discontinued.</span>
                      </div>
                    </label>
                  </div>

                  {escalationDecision === 'LEFT_CLASS' && (
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-red-900 mb-1">
                        Exit Note / Relocation Details <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={exitNote}
                        onChange={(e) => setExitNote(e.target.value)}
                        placeholder="e.g. Relocated to Ibadan for university education..."
                        className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Call Summary / Secretary Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Follow-up Discussion Notes & Prayer Points
                </label>
                <textarea
                  rows={3}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Summarize conversation with member, family updates, and specific prayer points..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-2 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Log & Apply Status Decision</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
