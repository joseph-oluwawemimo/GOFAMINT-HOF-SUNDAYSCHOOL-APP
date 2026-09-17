import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, Building2, ShieldCheck, Users } from 'lucide-react';
import { getAllGrades, getAllMembers } from '../../db/indexedDB';
import type { AdminProfile, ClassProfile, Member, SundaySchoolYear, WeeklyGradeRecord } from '../../types';

interface Props {
  currentAdmin: AdminProfile;
  allClasses: ClassProfile[];
  sundaySchoolYear: SundaySchoolYear;
}

export const DepartmentSuperintendentView: React.FC<Props> = ({ currentAdmin, allClasses, sundaySchoolYear }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [grades, setGrades] = useState<WeeklyGradeRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const departmentId = String(currentAdmin.departmentId || '').trim();
  const departmentClasses = useMemo(
    () => allClasses.filter(item => String(item.department || '').trim() === departmentId),
    [allClasses, departmentId]
  );
  const classIds = useMemo(() => new Set(departmentClasses.map(item => item.id)), [departmentClasses]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getAllMembers(), getAllGrades()])
      .then(([allMembers, allGrades]) => {
        if (!mounted) return;
        setMembers(allMembers.filter(item => !!item.classId && classIds.has(item.classId)));
        setGrades(allGrades.filter(item => !!item.classId && classIds.has(item.classId)));
        setLoadError(null);
      })
      .catch(error => {
        console.error('[Department Superintendent] Failed to load scoped analytics:', error);
        if (mounted) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => { mounted = false; };
  }, [classIds]);

  const activeMembers = members.filter(member => !['LEFT_CLASS', 'DEPARTED', 'ARCHIVED'].includes(String(member.status || '').toUpperCase()));
  const recordedGrades = grades.filter(grade => !grade.isNoRecordWeek);
  const presentCount = recordedGrades.filter(grade => grade.attendance === 'PRESENT').length;
  const attendanceRate = recordedGrades.length ? Math.round((presentCount / recordedGrades.length) * 100) : 0;
  const scored = recordedGrades.filter(grade => Number.isFinite(Number(grade.lessonTotal)));
  const averageScore = scored.length ? Math.round(scored.reduce((sum, grade) => sum + Number(grade.lessonTotal || 0), 0) / scored.length) : 0;

  if (!departmentId) {
    return <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-sm font-bold text-red-800">This account has no department assignment. A General Superintendent must correct the staff profile before analytics can be shown.</div>;
  }

  return (
    <div className="space-y-6 text-slate-900">
      <section className="rounded-3xl border border-amber-400/40 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-400/15 p-3 text-amber-300"><ShieldCheck className="h-7 w-7" /></div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Read-only departmental oversight</div>
            <h1 className="mt-1 text-2xl font-black">{departmentId} Department Analytics</h1>
            <p className="mt-1 text-sm text-blue-100">{currentAdmin.profileName} • {sundaySchoolYear.yearName}. Records outside this department are inaccessible and no editing actions are available here.</p>
          </div>
        </div>
      </section>

      {loadError && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">Department analytics failed to load: {loadError}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Department Classes', value: departmentClasses.length, icon: Building2 },
          { label: 'Active Members', value: activeMembers.length, icon: Users },
          { label: 'Recorded Attendance', value: `${attendanceRate}%`, icon: BarChart3 },
          { label: 'Average Lesson Score', value: `${averageScore}/50`, icon: BookOpen },
        ].map(card => <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><card.icon className="mb-3 h-5 w-5 text-blue-900" /><div className="text-2xl font-black text-slate-950">{card.value}</div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</div></div>)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black text-slate-950">Class Performance Summary</h2><p className="text-xs text-slate-500">Live, read-only figures for {departmentId} classes.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Class</th><th className="px-5 py-3">Members</th><th className="px-5 py-3">Attendance</th><th className="px-5 py-3">Avg. score</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {departmentClasses.map(cls => {
                const classMembers = activeMembers.filter(member => member.classId === cls.id);
                const classGrades = recordedGrades.filter(grade => grade.classId === cls.id);
                const classPresent = classGrades.filter(grade => grade.attendance === 'PRESENT').length;
                const classAttendance = classGrades.length ? Math.round(classPresent * 100 / classGrades.length) : 0;
                const classAverage = classGrades.length ? Math.round(classGrades.reduce((sum, grade) => sum + Number(grade.lessonTotal || 0), 0) / classGrades.length) : 0;
                return <tr key={cls.id}><td className="px-5 py-3 font-bold text-slate-900">{cls.className}</td><td className="px-5 py-3">{classMembers.length}</td><td className="px-5 py-3">{classAttendance}%</td><td className="px-5 py-3">{classAverage}/50</td></tr>;
              })}
              {departmentClasses.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No classes are currently assigned to this department.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
