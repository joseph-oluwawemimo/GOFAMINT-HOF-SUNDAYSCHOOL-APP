import React, { useMemo, useState } from 'react';
import { Search, UserX } from 'lucide-react';
import type { ClassProfile, Member } from '../../types';

interface DepartedMembersPanelProps {
  members: Member[];
  classes: ClassProfile[];
}

export const DepartedMembersPanel: React.FC<DepartedMembersPanelProps> = ({ members, classes }) => {
  const [query, setQuery] = useState('');
  const classById = useMemo(() => new Map(classes.map(item => [item.id, item])), [classes]);
  const departed = useMemo(() => members
    .filter(member => member.status === 'LEFT_CLASS' || member.exitReviewOutcome === 'PERMANENT_EXIT')
    .filter(member => {
      const cls = member.classId ? classById.get(member.classId) : undefined;
      const searchable = `${member.fullName} ${member.phone || ''} ${cls?.className || ''} ${cls?.department || ''}`.toLowerCase();
      return searchable.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => (b.departureDate || b.updatedAt).localeCompare(a.departureDate || a.updatedAt)),
  [members, classById, query]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-black text-slate-900">
            <UserX className="h-5 w-5 text-rose-700" />
            Departed Members Register
          </h3>
          <p className="mt-1 text-xs text-slate-600">Permanent exits only. Class identity and all historical attendance remain preserved.</p>
        </div>
        <label className="relative block sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search departed members…"
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-rose-600"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-white">
            <tr>
              <th className="p-3">Member</th>
              <th className="p-3">Class / Department</th>
              <th className="p-3">Departure point</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departed.map(member => {
              const cls = member.classId ? classById.get(member.classId) : undefined;
              return (
                <tr key={member.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{member.fullName}</td>
                  <td className="p-3 text-slate-700">
                    <span className="block font-bold">{cls?.className || 'Former class unavailable'}</span>
                    <span className="text-[11px] text-slate-500">{cls?.department || 'Department unavailable'}</span>
                  </td>
                  <td className="p-3 text-slate-700">
                    <span className="block">{member.departureDate ? new Date(member.departureDate).toLocaleDateString() : 'Legacy exit'}</span>
                    {member.departureQuarter && member.departureWeek && (
                      <span className="text-[11px] text-slate-500">Q{member.departureQuarter}, Week {member.departureWeek}</span>
                    )}
                  </td>
                  <td className="max-w-sm p-3 text-slate-700">{member.departureReason || member.exitNote || 'No reason recorded'}</td>
                  <td className="p-3 font-mono text-slate-700">{member.phone || '—'}</td>
                </tr>
              );
            })}
            {departed.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center font-semibold text-slate-500">No departed members match this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
