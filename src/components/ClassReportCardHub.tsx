import React, { useEffect } from 'react';
import { Award } from 'lucide-react';
import { ClassProfile, LessonInfo, Member, WeeklyGradeRecord } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { VisitorReportCardView } from './VisitorReportCardView';

interface ClassReportCardHubProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  classProfile: ClassProfile | null;
  lessons?: LessonInfo[];
}

export const ClassReportCardHub: React.FC<ClassReportCardHubProps> = ({ members, grades, classProfile, lessons }) => {
  const activeMembers = members.filter(member => member.status !== 'LEFT_CLASS');
  const [selectedMemberId, setSelectedMemberId] = usePersistedState<string>(
    `gofamint_report_card_member_${classProfile?.id || 'default'}`,
    activeMembers[0]?.id || ''
  );

  useEffect(() => {
    if (!activeMembers.some(member => member.id === selectedMemberId)) {
      setSelectedMemberId(activeMembers[0]?.id || '');
    }
  }, [activeMembers, selectedMemberId, setSelectedMemberId]);

  return (
    <section aria-labelledby="report-card-hub-heading" className="space-y-4 pb-10 animate-fade-in">
      <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-indigo-100 p-2.5 text-indigo-800"><Award className="h-5 w-5" /></span>
            <div>
              <h1 id="report-card-hub-heading" className="text-xl sm:text-3xl font-black text-slate-950">Report Card</h1>
              <p className="text-xs text-slate-500">Open any member's live Sunday School performance card.</p>
            </div>
          </div>
          <label className="min-w-0 sm:min-w-72">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Select member</span>
            <select value={selectedMemberId} onChange={event => setSelectedMemberId(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900">
              {activeMembers.map(member => <option key={member.id} value={member.id}>{member.fullName} ({member.memberType})</option>)}
            </select>
          </label>
        </div>
      </div>
      {selectedMemberId && (
        <VisitorReportCardView memberId={selectedMemberId} members={activeMembers} grades={grades} classProfile={classProfile} lessons={lessons} />
      )}
    </section>
  );
};
