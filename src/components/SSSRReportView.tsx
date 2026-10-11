import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Send,
  Copy,
  Check,
  Calendar,
  Users,
  Award,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Share2,
  BookOpen,
  UserCheck,
  Edit3,
  Save,
  MessageCircle
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  ClassProfile,
  LessonInfo,
  SSSRDeliveryRecord,
  QuarterData
} from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import { generateSSSRReport, resolveWeeklyKeyPoints } from '../utils/sssrReportGenerator';
import { VisitorReportCardView } from './VisitorReportCardView';
import { FollowUpWeekSyncBar } from './FollowUpPortal/FollowUpWeekSyncBar';

interface SSSRReportViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  lessons?: LessonInfo[];
  selectedQuarterNumber?: number;
  quarterData?: QuarterData | null;
  onSelectWeek?: (week: number) => void;
  onUpdateClassProfile?: (updated: ClassProfile) => Promise<void>;
}

export const SSSRReportView: React.FC<SSSRReportViewProps> = ({
  members,
  grades,
  currentWeek,
  classProfile,
  lessons = GOFAMINT_HOF_12_LESSONS,
  selectedQuarterNumber = 1,
  quarterData,
  onSelectWeek,
  onUpdateClassProfile
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
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'SINGLE_REPORT' | 'BATCH_DISPATCH' | 'KEY_POINTS_EDITOR' | 'FULL_REPORT_CARD'>('SINGLE_REPORT');
  const [copied, setCopied] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Storage key for SSSR deliveries
  const storageKey = useMemo(() => {
    const cid = classProfile?.id || 'default_class';
    return `gofamint_sssr_deliveries_${cid}_q${selectedQuarterNumber}`;
  }, [classProfile?.id, selectedQuarterNumber]);

  // Load deliveries
  const cloudDeliveries = useMemo(() => classProfile?.sssrDeliveries || {}, [classProfile?.sssrDeliveries]);
  const [savedDeliveries, setSavedDeliveries] = useState<Record<string, SSSRDeliveryRecord>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const local = raw ? JSON.parse(raw) : {};
      return { ...cloudDeliveries, ...local };
    } catch {
      return { ...cloudDeliveries };
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const local = raw ? JSON.parse(raw) : {};
      const merged = { ...local, ...(classProfile?.sssrDeliveries || {}) };
      setSavedDeliveries(merged);
    } catch {
      setSavedDeliveries(classProfile?.sssrDeliveries || {});
    }
  }, [storageKey, classProfile?.sssrDeliveries]);

  // Secretary Key Points form state for selectedWeek
  const defaultPoints = useMemo(() => {
    const currentLesson = lessons.find(l => l.weekNumber === selectedWeek) || lessons[0];
    return resolveWeeklyKeyPoints(selectedWeek, classProfile, undefined, currentLesson);
  }, [selectedWeek, classProfile, lessons]);

  const [keyPoint1, setKeyPoint1] = useState(defaultPoints[0]);
  const [keyPoint2, setKeyPoint2] = useState(defaultPoints[1]);
  const [keyPoint3, setKeyPoint3] = useState(defaultPoints[2]);

  // Update key points inputs when selectedWeek changes
  useEffect(() => {
    const points = resolveWeeklyKeyPoints(selectedWeek, classProfile, undefined, lessons.find(l => l.weekNumber === selectedWeek));
    setKeyPoint1(points[0]);
    setKeyPoint2(points[1]);
    setKeyPoint3(points[2]);
  }, [selectedWeek, classProfile, lessons]);

  // All active members on register
  const activeMembers = useMemo(() => {
    return members.filter(m => m.status !== 'LEFT_CLASS');
  }, [members]);

  const selectedMember = useMemo(() => {
    return activeMembers.find(m => m.id === selectedMemberId) || activeMembers[0] || null;
  }, [activeMembers, selectedMemberId]);

  // Grade of selected member in selectedWeek
  const selectedGrade = useMemo(() => {
    if (!selectedMember) return null;
    return grades.find(g => g.memberId === selectedMember.id && g.weekNumber === selectedWeek) || null;
  }, [selectedMember, selectedWeek, grades]);

  // Lesson of selectedWeek
  const selectedLesson = useMemo(() => {
    return lessons.find(l => l.weekNumber === selectedWeek) || lessons[0];
  }, [lessons, selectedWeek]);

  // Generate current report
  const currentReport = useMemo(() => {
    if (!selectedMember) return null;
    return generateSSSRReport({
      member: selectedMember,
      weekNumber: selectedWeek,
      classProfile,
      lesson: selectedLesson,
      grade: selectedGrade,
      customKeyPoints: [keyPoint1, keyPoint2, keyPoint3]
    });
  }, [selectedMember, selectedWeek, classProfile, selectedLesson, selectedGrade, keyPoint1, keyPoint2, keyPoint3]);

  // Delivery status for selected member
  const currentDeliveryRecordId = selectedMember
    ? `${classProfile?.id || 'default'}_q${selectedQuarterNumber}_w${selectedWeek}_m${selectedMember.id}`
    : '';
  const isCurrentReportDone = savedDeliveries[currentDeliveryRecordId]?.status === 'DONE';

  // Toggle delivery status
  const handleToggleDeliveryStatus = async (member: Member) => {
    const recId = `${classProfile?.id || 'default'}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
    const isDone = savedDeliveries[recId]?.status === 'DONE';
    const nextStatus = isDone ? 'PENDING' : 'DONE';
    const nowIso = new Date().toISOString();

    const memGrade = grades.find(g => g.memberId === member.id && g.weekNumber === selectedWeek);

    const record: SSSRDeliveryRecord = {
      id: recId,
      classId: classProfile?.id || '',
      quarterNumber: selectedQuarterNumber,
      weekNumber: selectedWeek,
      memberId: member.id,
      memberName: member.fullName,
      attendance: memGrade?.attendance || 'ABSENT',
      status: nextStatus,
      sentAt: nextStatus === 'DONE' ? nowIso : undefined,
      sentBy: classProfile?.secretaryName || 'Class Secretary',
      method: 'WHATSAPP',
      updatedAt: nowIso
    };

    const nextSaved = { ...savedDeliveries, [recId]: record };
    setSavedDeliveries(nextSaved);

    try {
      localStorage.setItem(storageKey, JSON.stringify(nextSaved));
    } catch (err) {
      console.error('Failed to save SSSR delivery locally:', err);
    }

    if (classProfile && onUpdateClassProfile) {
      await onUpdateClassProfile({
        ...classProfile,
        sssrDeliveries: {
          ...(classProfile.sssrDeliveries || {}),
          [recId]: record
        }
      });
    }
  };

  // Save Key Points entered by secretary
  const handleSaveKeyPoints = async () => {
    if (!keyPoint1.trim() || !keyPoint2.trim() || !keyPoint3.trim()) {
      alert('Please fill all three key lesson points.');
      return;
    }

    const key = `w${selectedWeek}`;
    const updatedKeyPoints = {
      ...(classProfile?.weeklyLessonKeyPoints || {}),
      [key]: [keyPoint1.trim(), keyPoint2.trim(), keyPoint3.trim()]
    };

    if (classProfile && onUpdateClassProfile) {
      await onUpdateClassProfile({
        ...classProfile,
        weeklyLessonKeyPoints: updatedKeyPoints
      });
    }

    setSaveFeedback('Key points saved successfully!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Copy message
  const handleCopyMessage = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(currentReport.formattedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Statistics for Batch Dispatch
  const totalInClass = activeMembers.length;
  const completedCount = activeMembers.filter(m => {
    const recId = `${classProfile?.id || 'default'}_q${selectedQuarterNumber}_w${selectedWeek}_m${m.id}`;
    return savedDeliveries[recId]?.status === 'DONE';
  }).length;
  const completionPercentage = totalInClass > 0 ? Math.round((completedCount / totalInClass) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/30">
                Activity One · SSS Report
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-500/30">
                Week {selectedWeek}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <FileText className="w-7 h-7 text-amber-400" />
              Sunday School Summary Report (SSS Report)
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 mt-1 max-w-2xl font-medium">
              Personalized 7-section report for every person on the class register (students, visitors, and one-time visitors). Grounded in actual attendance, assessment, lesson points, and registration progress.
            </p>
          </div>

          {/* Dynamic Week Indicator Badge */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15">
            <Calendar className="w-5 h-5 text-amber-300" />
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Processing Week</span>
              <span className="text-white font-black text-sm">
                Week {selectedWeek} Follow-Up
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-t border-white/15 pt-4">
          <button
            onClick={() => setActiveTab('SINGLE_REPORT')}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'SINGLE_REPORT'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            1. Member Report & Dispatch
          </button>

          <button
            onClick={() => setActiveTab('BATCH_DISPATCH')}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'BATCH_DISPATCH'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Users className="w-4 h-4" />
            2. Class Batch Dispatch ({completedCount}/{totalInClass})
          </button>

          <button
            onClick={() => setActiveTab('KEY_POINTS_EDITOR')}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'KEY_POINTS_EDITOR'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            3. Secretary Lesson Key Points
          </button>

          <button
            onClick={() => setActiveTab('FULL_REPORT_CARD')}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'FULL_REPORT_CARD'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Award className="w-4 h-4" />
            4. Formal Student Report Card
          </button>
        </div>
      </div>

      {/* Synchronized Follow-Up Week Switcher & Live Deadline Timer */}
      <FollowUpWeekSyncBar
        selectedWeek={selectedWeek}
        onSelectWeek={handleSelectWeek}
        totalWeeks={12}
        quarter={quarterData}
        quarterNumber={selectedQuarterNumber}
        label="SSSR report week"
      />

      {/* ========================================================================= */}
      {/* TAB 1: INDIVIDUAL MEMBER SSSR REPORT & DISPATCH                           */}
      {/* ========================================================================= */}
      {activeTab === 'SINGLE_REPORT' && (
        <div className="space-y-6">
          {/* Member Picker */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Person:</span>
              <select
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {activeMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberType}{m.isOneTimeVisitor ? ' · One-Time' : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Attendance & Done Indicators */}
            {selectedMember && (
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  currentReport?.isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {currentReport?.isPresent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{currentReport?.isPresent ? 'Present (Week ' + selectedWeek + ')' : 'Absent (Week ' + selectedWeek + ')'}</span>
                </span>

                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isCurrentReportDone ? 'bg-emerald-600 text-white shadow-xs' : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  {isCurrentReportDone ? 'Report Sent ✓' : 'Pending Send'}
                </span>
              </div>
            )}
          </div>

          {currentReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Metrics & Structure Card */}
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Concise 2-Paragraph SSSR Format
                  </h3>

                  <ul className="space-y-2.5 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">¶1.</span>
                      <span>
                        <strong>Greeting & Qualitative Feedback:</strong> Warm greeting, punctuality & recitation feedback (no scores), plus direct profile/registration link ({currentReport.registrationPercentage}% complete).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">¶2.</span>
                      <span>
                        <strong>Scripture & Blessing:</strong> Lesson topic ("{currentReport.lessonTopic}"), memory verse, and warm closing prayer for their week.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Score Summary Box for Present Members */}
                {currentReport.isPresent && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-5 border border-emerald-200 text-xs space-y-3">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                      Actual Assessment Maximums
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-400 block font-bold">Punctuality</span>
                        <strong className="text-base text-slate-900 font-black">{currentReport.punctualityScore}/15</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-400 block font-bold">Memory Verse</span>
                        <strong className="text-base text-slate-900 font-black">{currentReport.memoryVerseScore}/15</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-400 block font-bold">Participation</span>
                        <strong className="text-base text-slate-900 font-black">{currentReport.participationScore}/20</strong>
                      </div>
                    </div>
                    <div className="text-center pt-1 font-bold text-emerald-900">
                      Total Lesson Score: {currentReport.totalScore} / 50 marks
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                  {selectedMember?.phone ? (
                    <a
                      href={currentReport.whatsAppDirectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send via WhatsApp</span>
                    </a>
                  ) : (
                    <div className="text-xs text-center text-slate-400 italic py-2">
                      No phone number logged for WhatsApp
                    </div>
                  )}

                  <button
                    onClick={handleCopyMessage}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy WhatsApp Message'}</span>
                  </button>

                  <button
                    onClick={() => selectedMember && handleToggleDeliveryStatus(selectedMember)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer border ${
                      isCurrentReportDone
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                    }`}
                  >
                    {isCurrentReportDone ? 'Mark as Pending' : 'Mark Report as Sent / Completed'}
                  </button>
                </div>
              </div>

              {/* Right Column: Live Message Preview */}
              <div className="lg:col-span-2">
                <div className="bg-[#0b141a] rounded-3xl p-6 shadow-xl border border-slate-800 text-slate-100">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-400">
                        WhatsApp Message Preview · {currentReport.memberName}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {currentReport.memberPhone || 'No Phone'}
                    </span>
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-200 select-all overflow-x-auto">
                    {currentReport.formattedMessage}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLASS BATCH DISPATCH & OVERVIEW                                    */}
      {/* ========================================================================= */}
      {activeTab === 'BATCH_DISPATCH' && (
        <div className="space-y-6">
          {/* Batch Progress Bar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Class SSS Report Completion Status · Week {selectedWeek}
              </span>
              <h3 className="text-2xl font-black text-slate-900">
                {completedCount} of {totalInClass} Reports Sent ({completionPercentage}%)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tracks SSS Report distribution across all enrolled students, visitors, and one-time visitors.
              </p>
            </div>

            <div className="w-full sm:w-64 bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Roster Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">
                All Members on Register ({activeMembers.length})
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                Week {selectedWeek} Lesson: "{selectedLesson.topic}"
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">Scores / Status</th>
                    <th className="py-3 px-4">SSS Report Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMembers.map(member => {
                    const grade = grades.find(g => g.memberId === member.id && g.weekNumber === selectedWeek);
                    const isPresent = grade?.attendance === 'PRESENT';
                    const recId = `${classProfile?.id || 'default'}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
                    const isDone = savedDeliveries[recId]?.status === 'DONE';

                    const rpt = generateSSSRReport({
                      member,
                      weekNumber: selectedWeek,
                      classProfile,
                      lesson: selectedLesson,
                      grade,
                      customKeyPoints: [keyPoint1, keyPoint2, keyPoint3]
                    });

                    return (
                      <tr key={member.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>
                            <span>{member.fullName}</span>
                            {member.phone && (
                              <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{member.phone}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {member.memberType}
                            {member.isOneTimeVisitor ? ' · OTV' : ''}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {isPresent ? (
                            <span>{grade?.lessonTotal || 0}/50 pts</span>
                          ) : (
                            <span className="text-slate-400 italic">Absent (Welfare)</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isDone ? 'Done ✓' : 'Not Done'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {member.phone && (
                              <a
                                href={rpt.whatsAppDirectLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 transition"
                              >
                                <Send className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            <button
                              onClick={() => handleToggleDeliveryStatus(member)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                              }`}
                            >
                              {isDone ? 'Done' : 'Mark Done'}
                            </button>

                            <button
                              onClick={() => {
                                setSelectedMemberId(member.id);
                                setActiveTab('SINGLE_REPORT');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              View Card
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SECRETARY LESSON KEY POINTS EDITOR                                */}
      {/* ========================================================================= */}
      {activeTab === 'KEY_POINTS_EDITOR' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
              Class Secretary Curriculum Entry
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-2">
              Three Key Lesson Points for Week {selectedWeek}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter the three key takeaways taught this week for "{selectedLesson.topic}". These points will automatically be embedded into every member's SSSR WhatsApp message.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                1. First Key Point:
              </label>
              <textarea
                rows={2}
                value={keyPoint1}
                onChange={e => setKeyPoint1(e.target.value)}
                placeholder="Enter first key lesson point..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                2. Second Key Point:
              </label>
              <textarea
                rows={2}
                value={keyPoint2}
                onChange={e => setKeyPoint2(e.target.value)}
                placeholder="Enter second key lesson point..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                3. Third Key Point:
              </label>
              <textarea
                rows={2}
                value={keyPoint3}
                onChange={e => setKeyPoint3(e.target.value)}
                placeholder="Enter third key lesson point..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleSaveKeyPoints}
              className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Key Points for Week {selectedWeek}</span>
            </button>

            {saveFeedback && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" />
                {saveFeedback}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FORMAL STUDENT REPORT CARD & AWARDS                                */}
      {/* ========================================================================= */}
      {activeTab === 'FULL_REPORT_CARD' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <VisitorReportCardView
            memberId={selectedMemberId || members[0]?.id || ''}
            members={activeMembers}
            grades={grades}
            classProfile={classProfile}
            lessons={lessons}
          />
        </div>
      )}
    </div>
  );
};
