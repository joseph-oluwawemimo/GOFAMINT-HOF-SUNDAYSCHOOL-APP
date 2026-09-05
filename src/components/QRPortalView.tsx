import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Share2,
  Printer,
  Copy,
  Check,
  Award,
  BookOpen,
  Calendar,
  UserCheck,
  ExternalLink,
  Shield,
  Eye
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import {
  Member,
  WeeklyGradeRecord,
  ClassProfile,
  HardWorkStats
} from '../types';
import { calculateMemberStats } from '../utils/calculations';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';

interface QRPortalViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  classProfile: ClassProfile | null;
  selectedMemberId?: string | null;
}

export const QRPortalView: React.FC<QRPortalViewProps> = ({
  members,
  grades,
  classProfile,
  selectedMemberId: initialMemberId
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || (members[0]?.id || '')
  );
  const [memberQrDataUrl, setMemberQrDataUrl] = useState<string>('');
  const [classQrDataUrl, setClassQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const selectedMember = members.find(m => m.id === selectedMemberId) || members[0];
  const memberStats: HardWorkStats | null = selectedMember
    ? calculateMemberStats(selectedMember, grades, 12)
    : null;

  // Generate QR Code for Selected Member
  useEffect(() => {
    if (selectedMember) {
      const publicUrl = `${window.location.origin}/#portal?member=${selectedMember.id}&class=${classProfile?.id || 'default'}`;
      QRCode.toDataURL(publicUrl, {
        width: 256,
        margin: 1.5,
        color: {
          dark: '#1e3a8a',
          light: '#ffffff'
        }
      })
        .then(url => setMemberQrDataUrl(url))
        .catch(err => console.error('QR generation error:', err));
    }
  }, [selectedMember, classProfile]);

  // Generate Class-Wide Portal QR Code
  useEffect(() => {
    const classUrl = `${window.location.origin}/#portal?class=${classProfile?.id || 'default'}`;
    QRCode.toDataURL(classUrl, {
      width: 256,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setClassQrDataUrl(url))
      .catch(err => console.error('Class QR error:', err));
  }, [classProfile]);

  const handleCopyPortalLink = () => {
    const link = `${window.location.origin}/#portal?member=${selectedMember?.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              PUBLIC QR PROFILE & REPORT PORTAL
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1 font-['Cinzel',serif]">
            Student QR Codes & Public Performance Portal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generates individual scannable QR cards for parents & members. Sensitive pastoral notes remain securely hidden.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyPortalLink}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Portal Link'}</span>
          </button>

          <button
            onClick={handlePrintCard}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Print Student Report</span>
          </button>
        </div>
      </div>

      {/* Member Selector Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Select Member / Student:
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full sm:w-72 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
          >
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.memberType})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Read-Only Protected Public View</span>
        </div>
      </div>

      {/* Read-Only Portal Card Preview */}
      {selectedMember && memberStats && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-md max-w-3xl mx-auto print:border-none print:shadow-none print:p-0">
          
          {/* Header Branding */}
          <div className="border-b border-slate-200 pb-5 mb-6 text-center">
            <div className="flex items-center justify-center mx-auto mb-2">
              <GofamintLogo size={56} />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase text-blue-900 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              THE GOSPEL FAITH MISSION INTL
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 font-['Cinzel',serif] tracking-wide print:text-black">
              SUNDAY SCHOOL SECRETARY REPORT CARD
            </h3>
            <p className="text-xs text-slate-600 mt-1 font-semibold print:text-slate-700">
              Class: {classProfile?.className || 'Grace & Truth Class'} • {classProfile?.department || 'Young Adults'} • Quarter 1 ({new Date().getFullYear()})
            </p>
          </div>

          {/* Student Profile & QR Code Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200 print:bg-white print:border-slate-300">
            
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                {selectedMember.photoBase64 ? (
                  <img
                    src={selectedMember.photoBase64}
                    alt={selectedMember.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black text-slate-700">
                    {selectedMember.fullName.charAt(0)}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {selectedMember.memberType}
                </span>
                <h4 className="text-xl font-bold text-slate-900 mt-1 print:text-black">
                  {selectedMember.fullName}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 print:text-slate-600">
                  {selectedMember.occupation || 'Sunday School Member'}
                </p>
                <p className="text-xs text-amber-800 font-bold mt-1">
                  Enrolled from Lesson {selectedMember.firstLessonWeek || 1}
                </p>
              </div>
            </div>

            {/* Generated Member QR Code */}
            <div className="flex flex-col items-center bg-white p-3 rounded-lg shadow-xs border border-slate-300">
              {memberQrDataUrl && (
                <img
                  src={memberQrDataUrl}
                  alt="Student QR Code"
                  className="w-28 h-28 object-contain"
                />
              )}
              <span className="text-[10px] font-bold text-slate-700 mt-1 uppercase tracking-wider">
                Scan for Live Portal
              </span>
            </div>

          </div>

          {/* Key Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
            
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center print:border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hard Work Rate</span>
              <span className="text-2xl font-black text-amber-800 print:text-black">
                {memberStats.hardWorkRate}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Fair Normalized</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center print:border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Points</span>
              <span className="text-2xl font-black text-slate-900 print:text-black">
                {memberStats.totalScoreEarned}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">out of {memberStats.totalPossibleScore}</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center print:border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Attendance</span>
              <span className="text-2xl font-black text-emerald-700 print:text-black">
                {memberStats.attendedWeeks}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">out of {memberStats.weeksRecorded} lessons</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center print:border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Memory Verse Recitation</span>
              <span className="text-2xl font-black text-amber-700 print:text-black">
                {memberStats.memoryVersePercentage}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">{memberStats.memoryVerseScoreObtained} / {memberStats.memoryVerseMaxObtainable} marks</span>
            </div>

          </div>

          {/* 12-Lesson Detailed Score Breakdown Grid */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 print:text-black">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>12-Lesson Attendance & Academic Breakdown</span>
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-200 print:border-slate-300">
              <table className="w-full text-left text-xs text-slate-700 print:text-black">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200 print:bg-slate-100 print:text-black">
                  <tr>
                    <th className="py-2.5 px-3">Week</th>
                    <th className="py-2.5 px-3">Lesson Topic</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Punctuality (15)</th>
                    <th className="py-2.5 px-3">Memory Verse (15)</th>
                    <th className="py-2.5 px-3">Participation (20)</th>
                    <th className="py-2.5 px-3 font-bold text-amber-800">Total (50)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {GOFAMINT_HOF_12_LESSONS.map((lesson) => {
                    const grade = grades.find(g => g.memberId === selectedMember.id && g.weekNumber === lesson.weekNumber);
                    const isExempt = selectedMember.firstLessonWeek > lesson.weekNumber;
                    const status = isExempt ? 'EXEMPT' : (grade?.attendance || 'ABSENT');

                    return (
                      <tr key={lesson.weekNumber} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-500">
                          Wk {lesson.weekNumber}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 print:text-black truncate max-w-[200px]">
                          {lesson.topic}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'EXEMPT'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-2 px-3">{status === 'PRESENT' ? grade?.punctuality : '—'}</td>
                        <td className="py-2 px-3 text-amber-800 font-semibold">{status === 'PRESENT' ? grade?.memoryVerse : '—'}</td>
                        <td className="py-2 px-3">{status === 'PRESENT' ? grade?.classParticipation : '—'}</td>
                        <td className="py-2 px-3 font-black text-amber-800">
                          {status === 'PRESENT' ? (grade?.lessonTotal || 0) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assigned Teachers & Official Signature Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 print:text-black">
            <div>
              <span className="font-bold text-slate-800 block mb-0.5">Assigned Class Teacher(s):</span>
              <p>
                {classProfile?.teachers?.map(t => `${t.name} (${t.phone || 'N/A'})`).join(' • ') || 'Elder Samuel Adeleke'}
              </p>
              <p className="mt-0.5">Secretary: {classProfile?.secretaryName} ({classProfile?.secretaryPhone})</p>
            </div>

            <div className="text-right sm:self-end">
              <div className="w-36 border-b border-slate-400 mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Teacher / Secretary Signature</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
