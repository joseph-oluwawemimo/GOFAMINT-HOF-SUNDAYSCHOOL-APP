import React, { useRef } from 'react';
import {
  Printer,
  X,
  FileText,
  Calendar,
  Building,
  Users,
  Coins,
  CheckCircle2,
  Share2,
  Check,
  Sparkles
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  ClassProfile,
  LessonInfo,
  QuarterData
} from '../types';
import { GofamintLogo } from './GofamintLogo';
import { calculateCumulativeOffering } from '../utils/calculations';

interface OfficialReturnPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  classProfile: ClassProfile | null;
  selectedWeek: number;
  quarterNumber: number;
  quarterData?: QuarterData | null;
  lesson?: LessonInfo;
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  isNoRecordWeek?: boolean;
}

export const OfficialReturnPrintModal: React.FC<OfficialReturnPrintModalProps> = ({
  isOpen,
  onClose,
  classProfile,
  selectedWeek,
  quarterNumber,
  quarterData,
  lesson,
  members,
  grades,
  offerings,
  isNoRecordWeek = false
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filter members and compute statistics for this week
  const weekGrades = grades.filter(g => g.weekNumber === selectedWeek && !g.isNoRecordWeek);
  const currentOffering = offerings.find(o => o.weekNumber === selectedWeek && !o.isNoRecordWeek);
  const thisWeekOfferingAmount = currentOffering ? Number(currentOffering.amount) || 0 : 0;
  const cumulativeOffering = calculateCumulativeOffering(offerings);

  const students = members.filter(m => m.memberType === 'STUDENT' && m.status !== 'LEFT_CLASS');
  const visitors = members.filter(m => m.memberType === 'VISITOR' && m.status !== 'LEFT_CLASS');
  const totalEnrolled = members.filter(m => m.status !== 'LEFT_CLASS').length;

  let presentCount = 0;
  let absentCount = 0;
  let exemptCount = 0;
  let visitorPresentCount = 0;
  let newVisitorsCount = 0;
  let returningVisitorsCount = 0;

  // Enriched member rows
  const rosterRows = members
    .filter(m => m.status !== 'LEFT_CLASS')
    .map(member => {
      const grade = weekGrades.find(g => g.memberId === member.id);
      const isPresent = grade?.attendance === 'PRESENT';
      const isAbsent = grade?.attendance === 'ABSENT';
      const isExempt = grade?.attendance === 'EXEMPT';

      if (isPresent) {
        presentCount++;
        if (member.memberType === 'VISITOR') {
          visitorPresentCount++;
          // Check if first visit
          const priorPresent = grades.filter(
            g => g.memberId === member.id && g.weekNumber < selectedWeek && g.attendance === 'PRESENT'
          ).length;
          if (priorPresent === 0) newVisitorsCount++;
          else returningVisitorsCount++;
        }
      } else if (isAbsent) {
        absentCount++;
      } else if (isExempt) {
        exemptCount++;
      }

      return {
        member,
        grade,
        attendance: grade?.attendance || (isNoRecordWeek ? 'NO RECORD' : 'NOT MARKED'),
        punctuality: isPresent ? (grade?.punctuality || 0) : 0,
        memoryVerse: isPresent ? (grade?.memoryVerse || 0) : 0,
        participation: isPresent ? (grade?.classParticipation || 0) : 0,
        total: isPresent ? (grade?.lessonTotal || 0) : 0,
        prayerMtg: grade?.joinedPrayerMeeting || false,
        statusPost: grade?.postedStatusInsight || false,
        invited: grade?.invitedSomeone || false
      };
    });

  const attendanceRate = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;
  const scoredPresentCount = rosterRows.filter(r => r.attendance === 'PRESENT').length;
  const averageScore = scoredPresentCount > 0
    ? Math.round(rosterRows.filter(r => r.attendance === 'PRESENT').reduce((sum, r) => sum + r.total, 0) / scoredPresentCount)
    : 0;

  const handlePrint = () => {
    window.print();
  };

  const quarterName = quarterData?.quarterName || (
    quarterNumber === 1 ? 'First Quarter' :
    quarterNumber === 2 ? 'Second Quarter' :
    quarterNumber === 3 ? 'Third Quarter' : 'Fourth Quarter'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white">
      <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 max-h-[92vh] flex flex-col print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Control Bar (Hidden during printing) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider font-['Cinzel',serif]">
                Official Sunday School Return — Print / Export
              </h3>
              <p className="text-xs text-slate-300">
                Class: <strong>{classProfile?.className || 'Sunday School Class'}</strong> • {quarterName} • Week {selectedWeek}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-print-official-return-execute"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Return (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Return Body */}
        <div ref={printContainerRef} className="overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:space-y-4 print:text-black">
          
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1 relative">
            <div className="flex items-center justify-center gap-3">
              <GofamintLogo className="w-12 h-12 print:w-10 print:h-10" />
              <div>
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-wide font-['Cinzel',serif] text-slate-900 print:text-black">
                  THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR)
                </h1>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-blue-900 print:text-black">
                  DIRECTORATE OF SUNDAY SCHOOL & CHRISTIAN EDUCATION
                </h2>
                <p className="text-[11px] font-bold text-slate-600 print:text-black uppercase tracking-wider">
                  OFFICIAL WEEKLY CLASS RETURN & ACADEMIC ATTENDANCE REGISTER
                </p>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs print:bg-white print:border-slate-400 print:p-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Class Name:</span>
              <span className="font-black text-slate-900 text-sm print:text-black">{classProfile?.className || 'Standard Class'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Department:</span>
              <span className="font-black text-slate-900 print:text-black">{classProfile?.department || 'Adult'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Quarter & Session:</span>
              <span className="font-black text-slate-900 print:text-black">{quarterName} ({classProfile?.year || new Date().getFullYear()})</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Lesson Week:</span>
              <span className="font-black text-blue-900 print:text-black text-sm">
                Week #{selectedWeek} {isNoRecordWeek ? '(NO RECORD WEEK)' : ''}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Teacher(s) in Charge:</span>
              <span className="font-bold text-slate-800 print:text-black">
                {classProfile?.teachers?.map(t => t.name).join(', ') || classProfile?.secretaryName || 'Assigned Teacher'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Class Secretary:</span>
              <span className="font-bold text-slate-800 print:text-black">
                {classProfile?.secretaryName || 'Class Secretary'} {classProfile?.secretaryPhone ? `(${classProfile.secretaryPhone})` : ''}
              </span>
            </div>
          </div>

          {/* Lesson Topic & Scripture */}
          {lesson && (
            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 text-xs space-y-1 print:bg-white print:border-slate-400 print:p-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-black text-blue-950 uppercase print:text-black">Lesson Topic:</span>
                <span className="font-bold text-slate-900 print:text-black text-sm">{lesson.topic}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-700 print:text-black">
                <div>
                  <span className="font-bold">Scripture Reading: </span>
                  <span>{lesson.scriptureReading || 'As assigned in lesson curriculum'}</span>
                </div>
                <div>
                  <span className="font-bold">Memory Verse: </span>
                  <span>{lesson.memoryVerse ? `"${lesson.memoryVerse}" (${lesson.memoryVerseRef || ''})` : 'Assigned Memory Verse'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Collation Summary KPI Boxes */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="bg-slate-100 border border-slate-300 p-2.5 rounded-lg print:border-slate-400">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Enrolled</span>
              <span className="text-base font-black text-slate-900 print:text-black">{totalEnrolled}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-lg print:border-slate-400">
              <span className="text-[9px] uppercase font-bold text-emerald-800 block">Present</span>
              <span className="text-base font-black text-emerald-900 print:text-black">{presentCount}</span>
            </div>
            <div className="bg-red-50 border border-red-300 p-2.5 rounded-lg print:border-slate-400">
              <span className="text-[9px] uppercase font-bold text-red-800 block">Absent</span>
              <span className="text-base font-black text-red-900 print:text-black">{absentCount}</span>
            </div>
            <div className="bg-purple-50 border border-purple-300 p-2.5 rounded-lg print:border-slate-400">
              <span className="text-[9px] uppercase font-bold text-purple-800 block">Visitors</span>
              <span className="text-base font-black text-purple-900 print:text-black">{visitorPresentCount}</span>
            </div>
            <div className="bg-blue-50 border border-blue-300 p-2.5 rounded-lg print:border-slate-400">
              <span className="text-[9px] uppercase font-bold text-blue-800 block">Offering (₦)</span>
              <span className="text-base font-black text-blue-900 print:text-black">₦{thisWeekOfferingAmount.toLocaleString()}</span>
            </div>
            <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg print:border-slate-400">
              <span className="text-[9px] uppercase font-bold text-amber-800 block">Cumulative (₦)</span>
              <span className="text-base font-black text-amber-900 print:text-black">₦{cumulativeOffering.toLocaleString()}</span>
            </div>
          </div>

          {/* Roster & Scores Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black">
                Class Attendance, Memory Verse & Grading Collation
              </h4>
              <span className="text-[10px] text-slate-500 print:text-black">
                Class Average: <strong>{averageScore}/50 marks</strong> • Attendance Rate: <strong>{attendanceRate}%</strong>
              </span>
            </div>

            <div className="border border-slate-300 rounded-lg overflow-hidden print:border-slate-500">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider print:bg-slate-200 print:text-black">
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-8">S/N</th>
                    <th className="py-2 px-2.5 border-r border-slate-700 print:border-slate-400">Full Name</th>
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-16">Type</th>
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-20">Attendance</th>
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-14" title="Max 15">Punct. /15</th>
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-14" title="Max 15">M.V. /15</th>
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-14" title="Max 20">Part. /20</th>
                    <th className="py-2 px-2 border-r border-slate-700 print:border-slate-400 text-center w-14 bg-blue-950 print:bg-slate-300">Total /50</th>
                    <th className="py-2 px-2 text-center w-24">Spiritual Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 print:divide-slate-400">
                  {rosterRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                        No students or visitors registered in this class.
                      </td>
                    </tr>
                  ) : (
                    rosterRows.map((row, idx) => (
                      <tr
                        key={row.member.id}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50 print:bg-white'}
                      >
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center font-mono text-slate-500 print:text-black">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-200 print:border-slate-400 font-bold text-slate-900 print:text-black">
                          {row.member.fullName}
                          {row.member.phone && (
                            <span className="block text-[9px] text-slate-400 print:text-slate-600 font-mono font-normal">
                              {row.member.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            row.member.memberType === 'STUDENT'
                              ? 'bg-blue-100 text-blue-800 print:bg-transparent print:text-black'
                              : 'bg-purple-100 text-purple-800 print:bg-transparent print:text-black'
                          }`}>
                            {row.member.memberType}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center font-bold">
                          <span className={`text-[10px] ${
                            row.attendance === 'PRESENT'
                              ? 'text-emerald-700 print:text-black font-black'
                              : row.attendance === 'ABSENT'
                              ? 'text-red-700 print:text-black'
                              : 'text-slate-400 print:text-black'
                          }`}>
                            {row.attendance}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center font-mono font-semibold">
                          {row.attendance === 'PRESENT' ? row.punctuality : '—'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center font-mono font-semibold">
                          {row.attendance === 'PRESENT' ? row.memoryVerse : '—'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center font-mono font-semibold">
                          {row.attendance === 'PRESENT' ? row.participation : '—'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 print:border-slate-400 text-center font-mono font-black text-blue-900 print:text-black bg-blue-50/50 print:bg-transparent">
                          {row.attendance === 'PRESENT' ? row.total : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-center text-[9px] text-slate-600 print:text-black">
                          {row.attendance === 'PRESENT' ? (
                            <div className="flex items-center justify-center gap-1">
                              {row.prayerMtg && <span title="Joined Prayer Meeting" className="font-bold text-blue-700">P</span>}
                              {row.statusPost && <span title="Posted WhatsApp Insight" className="font-bold text-emerald-700">W</span>}
                              {row.invited && <span title="Invited Someone" className="font-bold text-purple-700">I</span>}
                              {!row.prayerMtg && !row.statusPost && !row.invited && <span>—</span>}
                            </div>
                          ) : (
                            <span className="text-red-500 print:text-black text-[9px]">Follow-Up Logged</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Certification & Signatures Section */}
          <div className="pt-8 grid grid-cols-4 gap-4 text-center text-xs print:pt-6">
            <div className="border-t border-slate-800 pt-2 print:border-black">
              <p className="font-bold text-slate-900 print:text-black">{classProfile?.teachers?.[0]?.name || 'Teacher Signature'}</p>
              <p className="text-[10px] text-slate-500 uppercase">Sunday School Teacher</p>
            </div>
            <div className="border-t border-slate-800 pt-2 print:border-black">
              <p className="font-bold text-slate-900 print:text-black">{classProfile?.secretaryName || 'Secretary Signature'}</p>
              <p className="text-[10px] text-slate-500 uppercase">Class Secretary</p>
            </div>
            <div className="border-t border-slate-800 pt-2 print:border-black">
              <p className="font-bold text-slate-900 print:text-black">Sunday School Superintendent</p>
              <p className="text-[10px] text-slate-500 uppercase">General Superintendent / Rep</p>
            </div>
            <div className="border-t border-slate-800 pt-2 print:border-black">
              <p className="font-bold text-slate-900 print:text-black">Assembly Pastor</p>
              <p className="text-[10px] text-slate-500 uppercase">Pastor in Charge / Seal</p>
            </div>
          </div>

          <div className="text-center pt-2 text-[9px] text-slate-400 print:text-slate-600 border-t border-slate-200">
            Official Return generated directly from GOFAMINT_HOF Sunday School Register Live Database • {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

        </div>

      </div>
    </div>
  );
};
