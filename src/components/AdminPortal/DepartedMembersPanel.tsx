import React, { useMemo, useState } from 'react';
import { Search, UserX, Clock, Archive, Users, MessageCircle, HelpCircle } from 'lucide-react';
import type { ClassProfile, Member } from '../../types';
import { buildWhatsAppDirectLink } from '../../utils/phoneUtils';

interface DepartedMembersPanelProps {
  members: Member[];
  classes: ClassProfile[];
}

export const DepartedMembersPanel: React.FC<DepartedMembersPanelProps> = ({ members, classes }) => {
  const [query, setQuery] = useState('');
  const [subTab, setSubTab] = useState<'ALL' | 'ONE_TIME' | 'ARCHIVED'>('ALL');

  const classById = useMemo(() => new Map(classes.map(item => [item.id, item])), [classes]);

  // Identify One-Time Visitors vs Permanently Archived Members
  const isOneTimeVisitor = (m: Member): boolean => {
    return (
      m.isOneTimeVisitor === true ||
      m.exclusionType === 'TEMPORARY' ||
      m.exitReviewOutcome === 'TEMPORARY_EXIT' ||
      (m.memberType === 'VISITOR' && (m.status === 'LEFT_CLASS' || m.status === 'RELEGATED_VISITOR'))
    );
  };

  const isArchivedDeparture = (m: Member): boolean => {
    if (m.isOneTimeVisitor === true) return false;
    return (
      m.status === 'LEFT_CLASS' ||
      m.exitReviewOutcome === 'PERMANENT_EXIT' ||
      m.exclusionType === 'PERMANENT'
    );
  };

  const allDeparted = useMemo(() => {
    return members
      .filter(m => isOneTimeVisitor(m) || isArchivedDeparture(m))
      .filter(m => {
        const cls = m.classId ? classById.get(m.classId) : undefined;
        const searchable = `${m.fullName} ${m.phone || ''} ${cls?.className || ''} ${cls?.department || ''} ${m.departureReason || ''} ${m.exitNote || ''}`.toLowerCase();
        return searchable.includes(query.trim().toLowerCase());
      })
      .sort((a, b) => (b.departureDate || b.updatedAt).localeCompare(a.departureDate || a.updatedAt));
  }, [members, classById, query]);

  const oneTimeVisitors = useMemo(() => allDeparted.filter(isOneTimeVisitor), [allDeparted]);
  const archivedDepartures = useMemo(() => allDeparted.filter(isArchivedDeparture), [allDeparted]);

  const displayedList = useMemo(() => {
    if (subTab === 'ONE_TIME') return oneTimeVisitors;
    if (subTab === 'ARCHIVED') return archivedDepartures;
    return allDeparted;
  }, [subTab, allDeparted, oneTimeVisitors, archivedDepartures]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-black text-slate-900 text-base">
            <UserX className="h-5 w-5 text-rose-700" />
            Departed Members & Visitors Register
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Audit trail of one-time visitors and permanently archived members. Class historical records remain intact.
          </p>
        </div>
        <label className="relative block sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by name, class, contact…"
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-rose-600 bg-white"
          />
        </label>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Total Departures</span>
            <h4 className="text-xl font-black text-slate-900 mt-0.5">{allDeparted.length}</h4>
            <span className="text-[11px] text-slate-500">Across All Classes</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-800">One-Time Visitors</span>
            <h4 className="text-xl font-black text-amber-950 mt-0.5">{oneTimeVisitors.length}</h4>
            <span className="text-[11px] text-amber-700">Temporary Exits / Single Visits</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-800">Archived Members</span>
            <h4 className="text-xl font-black text-rose-950 mt-0.5">{archivedDepartures.length}</h4>
            <span className="text-[11px] text-rose-700">Permanent Exits / Relocations</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800">
            <Archive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 px-5 border-b border-slate-200 pb-3">
        <button
          onClick={() => setSubTab('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            subTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span>All Departed</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-white">
            {allDeparted.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('ONE_TIME')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            subTab === 'ONE_TIME'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>One-Time Visitors</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-700 text-amber-100">
            {oneTimeVisitors.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('ARCHIVED')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            subTab === 'ARCHIVED'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archived Departures</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-800 text-rose-100">
            {archivedDepartures.length}
          </span>
        </button>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[850px] text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
          <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-white">
            <tr>
              <th className="p-3">Member / Visitor</th>
              <th className="p-3">Classification</th>
              <th className="p-3">Class / Department</th>
              <th className="p-3">Departure Point</th>
              <th className="p-3">Reason / Details</th>
              <th className="p-3 text-right">Contact & WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedList.map(member => {
              const cls = member.classId ? classById.get(member.classId) : undefined;
              const isOneTime = isOneTimeVisitor(member);
              const waLink = buildWhatsAppDirectLink(
                member.phone,
                `Hello ${member.fullName}, greetings from GOFAMINT Sunday Bible School. We cherish your time with us and pray God's continued grace upon you!`
              );

              return (
                <tr key={member.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        isOneTime ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {member.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{member.fullName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{member.gender || '—'}</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3">
                    {isOneTime ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3 h-3" /> One-Time Visitor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        <Archive className="w-3 h-3" /> Archived Departed
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-slate-700">
                    <span className="block font-bold">{cls?.className || 'Former class'}</span>
                    <span className="text-[11px] text-slate-500">{cls?.department || 'Department unavailable'}</span>
                  </td>

                  <td className="p-3 text-slate-700">
                    <span className="block font-semibold">
                      {member.departureWeek
                        ? `Week ${member.departureWeek}`
                        : member.firstLessonWeek
                        ? `Left after Week ${member.firstLessonWeek}`
                        : 'Week not logged'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {member.departureDate
                        ? new Date(member.departureDate).toLocaleDateString()
                        : member.updatedAt
                        ? new Date(member.updatedAt).toLocaleDateString()
                        : 'Historical exit'}
                    </span>
                  </td>

                  <td className="max-w-sm p-3 text-slate-700">
                    <p className="line-clamp-2">
                      {member.departureReason || member.exitNote || member.notes || (isOneTime ? 'Single visitor session completed' : 'Permanent exit recorded')}
                    </p>
                  </td>

                  <td className="p-3 text-right">
                    {member.phone ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs transition"
                        title={`Direct WhatsApp to ${member.phone}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-mono">{member.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 font-mono">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {displayedList.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center font-semibold text-slate-500">
                  No departed members or visitors match the filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
